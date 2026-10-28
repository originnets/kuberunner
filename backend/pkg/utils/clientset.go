package utils

import (
	"fmt"
	"os"
	"sort"
	"sync"

	"github.com/gitlayzer/kuberunner/pkg/config"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

var K8s k8s

type k8s struct {
	mu          sync.RWMutex
	clientMap   map[string]*kubernetes.Clientset
	kubeConfMap map[string]string
}

// GetClient 返回指定集群的 clientset，集群不存在时返回错误。
func (k *k8s) GetClient(cluster string) (*kubernetes.Clientset, error) {
	k.mu.RLock()
	client, ok := k.clientMap[cluster]
	k.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("集群 %s 不存在，无法获取 client", cluster)
	}
	return client, nil
}

// GetKubeConfig 返回指定集群的 kubeconfig 文件路径。
func (k *k8s) GetKubeConfig(cluster string) (string, error) {
	k.mu.RLock()
	kubeConfig, ok := k.kubeConfMap[cluster]
	k.mu.RUnlock()
	if !ok {
		return "", fmt.Errorf("集群 %s 不存在，无法获取 kubeconfig", cluster)
	}
	return kubeConfig, nil
}

// Clusters 返回已注册的集群名称（已排序）。
func (k *k8s) Clusters() []string {
	k.mu.RLock()
	defer k.mu.RUnlock()

	clusters := make([]string, 0, len(k.clientMap))
	for name := range k.clientMap {
		clusters = append(clusters, name)
	}
	sort.Strings(clusters)
	return clusters
}

// Init 为配置中的每个集群创建 clientset。单个集群失败不会影响其他集群，
// 但会通过返回的 error 汇报，方便启动时定位配置问题。
func (k *k8s) Init() error {
	kubeConfMap := make(map[string]string, len(config.GetKubeConfig()))
	for key, value := range config.GetKubeConfig() {
		kubeConfMap[key] = value
	}

	fmt.Printf("使用配置文件: %s，待加载集群 %d 个\n", config.GetConfigFile(), len(kubeConfMap))
	if len(kubeConfMap) == 0 {
		return fmt.Errorf("配置文件 %s 中没有 KubeConfigs，请添加集群配置或通过集群管理页面添加", config.GetConfigFile())
	}
	clientMap := make(map[string]*kubernetes.Clientset, len(kubeConfMap))
	var failures []error

	for key, value := range kubeConfMap {
		conf, err := clientcmd.BuildConfigFromFlags("", value)
		if err != nil {
			failures = append(failures, fmt.Errorf("集群 %s：创建 K8s 配置失败: %w", key, err))
			continue
		}

		// 给每个请求设置上限，避免单次 API 调用长时间挂起。
		conf.Timeout = config.GetRequestTimeout()

		clientSet, err := kubernetes.NewForConfig(conf)
		if err != nil {
			failures = append(failures, fmt.Errorf("集群 %s：创建 K8s 客户端失败: %w", key, err))
			continue
		}

		clientMap[key] = clientSet
		fmt.Printf("集群 %s：创建 K8s 客户端成功（kubeconfig: %s）\n", key, value)
	}

	k.mu.Lock()
	k.kubeConfMap = kubeConfMap
	k.clientMap = clientMap
	k.mu.Unlock()

	if len(failures) > 0 {
		if len(clientMap) == 0 {
			return fmt.Errorf("没有可用的集群客户端: %v", failures)
		}
		for _, failure := range failures {
			fmt.Printf("[warn] %v\n", failure)
		}
	}

	return nil
}

// RemoveCluster 移除已注册的集群，并清理自动生成的 kubeconfig 文件。
func (k *k8s) RemoveCluster(name string) error {
	k.mu.Lock()
	path, ok := k.kubeConfMap[name]
	if !ok {
		k.mu.Unlock()
		return fmt.Errorf("集群 %s 不存在", name)
	}
	delete(k.clientMap, name)
	delete(k.kubeConfMap, name)
	k.mu.Unlock()

	if isManagedKubeConfig(path) {
		_ = os.Remove(path)
	}
	return nil
}

// KubeConfigs 返回当前集群与 kubeconfig 路径的副本，用于持久化。
func (k *k8s) KubeConfigs() map[string]string {
	k.mu.RLock()
	defer k.mu.RUnlock()

	result := make(map[string]string, len(k.kubeConfMap))
	for name, path := range k.kubeConfMap {
		result[name] = path
	}
	return result
}
