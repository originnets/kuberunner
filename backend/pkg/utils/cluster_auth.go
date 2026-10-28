package utils

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/gitlayzer/kuberunner/pkg/config"
	"gopkg.in/yaml.v3"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// ClusterAuth 描述添加/编辑集群时的认证方式。
type ClusterAuth struct {
	Type              string `json:"auth_type"`
	KubeConfigPath    string `json:"kube_config_path"`
	KubeConfigContent string `json:"kube_config_content"`
	Server            string `json:"server"`
	Token             string `json:"token"`
	CAData            string `json:"ca_data"`
	SkipTLSVerify     bool   `json:"skip_tls_verify"`
}

// ClusterInfo 用于集群详情展示。
type ClusterInfo struct {
	Name       string `json:"name"`
	KubeConfig string `json:"kube_config"`
	AuthType   string `json:"auth_type"`
	Server     string `json:"server"`
}

const (
	authTypeKubeConfig = "kubeconfig"
	authTypeToken      = "token"
	verifyTimeout      = 10 * time.Second
	versionTimeout     = 6 * time.Second
)

var invalidNameChars = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)

func managedKubeConfigDir() string {
	return filepath.Join(filepath.Dir(config.GetConfigFile()), "kubeconfigs")
}

func managedKubeConfigPath(name string) string {
	safe := invalidNameChars.ReplaceAllString(name, "-")
	return filepath.Join(managedKubeConfigDir(), safe+".yaml")
}

func isManagedKubeConfig(path string) bool {
	return strings.HasPrefix(filepath.Clean(path), filepath.Clean(managedKubeConfigDir())+string(os.PathSeparator))
}

func writeKubeConfigFile(name string, content []byte) (string, error) {
	if err := os.MkdirAll(managedKubeConfigDir(), 0o700); err != nil {
		return "", fmt.Errorf("创建 kubeconfig 目录失败: %w", err)
	}
	path := managedKubeConfigPath(name)
	if err := os.WriteFile(path, content, 0o600); err != nil {
		return "", fmt.Errorf("写入 kubeconfig 文件失败: %w", err)
	}
	return path, nil
}

// MaterializeClusterAuth 把认证配置落地为 kubeconfig 文件路径。
func MaterializeClusterAuth(name string, auth ClusterAuth) (string, error) {
	authType := strings.TrimSpace(auth.Type)
	if authType == "" {
		authType = authTypeKubeConfig
	}

	switch authType {
	case authTypeKubeConfig:
		if content := strings.TrimSpace(auth.KubeConfigContent); content != "" {
			return writeKubeConfigFile(name, []byte(content))
		}
		path := strings.TrimSpace(auth.KubeConfigPath)
		if path == "" {
			return "", fmt.Errorf("请填写 kubeconfig 文件路径或粘贴 kubeconfig 内容")
		}
		abs, err := filepath.Abs(path)
		if err != nil {
			return "", fmt.Errorf("解析 kubeconfig 路径失败: %w", err)
		}
		if info, err := os.Stat(abs); err != nil || info.IsDir() {
			return "", fmt.Errorf("kubeconfig 文件不可读: %s", abs)
		}
		return abs, nil

	case authTypeToken:
		server := strings.TrimSpace(auth.Server)
		token := strings.TrimSpace(auth.Token)
		if server == "" || token == "" {
			return "", fmt.Errorf("Token 认证需要填写 API Server 地址与 Token")
		}
		if !strings.HasPrefix(server, "http://") && !strings.HasPrefix(server, "https://") {
			server = "https://" + server
		}

		cluster := map[string]interface{}{"server": server}
		if auth.SkipTLSVerify {
			cluster["insecure-skip-tls-verify"] = true
		} else if ca := strings.TrimSpace(auth.CAData); ca != "" {
			cluster["certificate-authority-data"] = base64.StdEncoding.EncodeToString([]byte(ca))
		}

		obj := map[string]interface{}{
			"apiVersion": "v1",
			"kind":       "Config",
			"clusters":   []map[string]interface{}{{"name": name, "cluster": cluster}},
			"users":      []map[string]interface{}{{"name": name, "user": map[string]interface{}{"token": token}}},
			"contexts": []map[string]interface{}{{
				"name":    name,
				"context": map[string]interface{}{"cluster": name, "user": name},
			}},
			"current-context": name,
		}
		out, err := yaml.Marshal(obj)
		if err != nil {
			return "", fmt.Errorf("生成 kubeconfig 失败: %w", err)
		}
		return writeKubeConfigFile(name, out)

	default:
		return "", fmt.Errorf("不支持的认证方式: %s", authType)
	}
}

func verifyKubeConfig(kubeConfigPath string) (*kubernetes.Clientset, error) {
	conf, err := clientcmd.BuildConfigFromFlags("", kubeConfigPath)
	if err != nil {
		return nil, fmt.Errorf("读取 kubeconfig 失败: %w", err)
	}

	conf.Timeout = verifyTimeout
	client, err := kubernetes.NewForConfig(conf)
	if err != nil {
		return nil, fmt.Errorf("创建 K8s 客户端失败: %w", err)
	}
	if _, err := client.Discovery().ServerVersion(); err != nil {
		return nil, fmt.Errorf("连接集群失败: %w", err)
	}

	conf.Timeout = config.GetRequestTimeout()
	client, err = kubernetes.NewForConfig(conf)
	if err != nil {
		return nil, fmt.Errorf("创建 K8s 客户端失败: %w", err)
	}
	return client, nil
}

// AddCluster 校验认证信息并注册一个新集群。
func (k *k8s) AddCluster(name string, auth ClusterAuth) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("集群名称不能为空")
	}
	if strings.ContainsAny(name, " \t\n/\\") {
		return fmt.Errorf("集群名称不能包含空格或斜杠")
	}

	k.mu.RLock()
	_, exists := k.clientMap[name]
	k.mu.RUnlock()
	if exists {
		return fmt.Errorf("集群 %s 已存在", name)
	}

	kubeConfigPath, err := MaterializeClusterAuth(name, auth)
	if err != nil {
		return err
	}

	client, err := verifyKubeConfig(kubeConfigPath)
	if err != nil {
		return err
	}

	k.mu.Lock()
	k.clientMap[name] = client
	k.kubeConfMap[name] = kubeConfigPath
	k.mu.Unlock()

	return nil
}

// UpdateCluster 修改集群名称与认证配置。
func (k *k8s) UpdateCluster(currentName, name string, auth ClusterAuth) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("集群名称不能为空")
	}
	if strings.ContainsAny(name, " \t\n/\\") {
		return fmt.Errorf("集群名称不能包含空格或斜杠")
	}

	k.mu.RLock()
	oldPath, exists := k.kubeConfMap[currentName]
	k.mu.RUnlock()
	if !exists {
		return fmt.Errorf("集群 %s 不存在", currentName)
	}

	if name != currentName {
		k.mu.RLock()
		_, conflict := k.clientMap[name]
		k.mu.RUnlock()
		if conflict {
			return fmt.Errorf("集群 %s 已存在", name)
		}
	}

	kubeConfigPath, err := MaterializeClusterAuth(name, auth)
	if err != nil {
		return err
	}

	client, err := verifyKubeConfig(kubeConfigPath)
	if err != nil {
		return err
	}

	k.mu.Lock()
	delete(k.clientMap, currentName)
	delete(k.kubeConfMap, currentName)
	k.clientMap[name] = client
	k.kubeConfMap[name] = kubeConfigPath
	k.mu.Unlock()

	if oldPath != kubeConfigPath && isManagedKubeConfig(oldPath) {
		_ = os.Remove(oldPath)
	}

	return nil
}

// ClusterDetail 返回集群的名称、kubeconfig 路径与认证方式。
func (k *k8s) ClusterDetail(name string) (*ClusterInfo, error) {
	k.mu.RLock()
	kubeConfigPath, ok := k.kubeConfMap[name]
	k.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("集群 %s 不存在", name)
	}

	info := &ClusterInfo{
		Name:       name,
		KubeConfig: kubeConfigPath,
		AuthType:   authTypeKubeConfig,
	}

	if data, err := os.ReadFile(kubeConfigPath); err == nil {
		var parsed struct {
			Clusters []struct {
				Cluster struct {
					Server string `yaml:"server"`
				} `yaml:"cluster"`
			} `yaml:"clusters"`
			Users []struct {
				User struct {
					Token string `yaml:"token"`
				} `yaml:"user"`
			} `yaml:"users"`
		}
		if yaml.Unmarshal(data, &parsed) == nil {
			if len(parsed.Clusters) > 0 {
				info.Server = parsed.Clusters[0].Cluster.Server
			}
			if len(parsed.Users) > 0 && parsed.Users[0].User.Token != "" {
				info.AuthType = authTypeToken
			}
		}
	}

	return info, nil
}

// ClusterVersion 返回集群版本，用于连通性展示，超时时间较短。
func (k *k8s) ClusterVersion(name string) (string, error) {
	k.mu.RLock()
	kubeConfigPath, ok := k.kubeConfMap[name]
	k.mu.RUnlock()
	if !ok {
		return "", fmt.Errorf("集群 %s 不存在", name)
	}

	conf, err := clientcmd.BuildConfigFromFlags("", kubeConfigPath)
	if err != nil {
		return "", fmt.Errorf("读取 kubeconfig 失败: %w", err)
	}
	conf.Timeout = versionTimeout

	client, err := kubernetes.NewForConfig(conf)
	if err != nil {
		return "", fmt.Errorf("创建 K8s 客户端失败: %w", err)
	}
	version, err := client.Discovery().ServerVersion()
	if err != nil {
		return "", fmt.Errorf("连接集群失败: %w", err)
	}
	return version.GitVersion, nil
}
