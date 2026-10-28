package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/viper"
	"gopkg.in/yaml.v3"
)

const defaultRequestTimeout = 30 * time.Second

var (
	KubeConfigs    map[string]string
	ListenAddress  string
	Username       string
	Password       string
	RequestTimeout time.Duration

	// ConfigFile 为实际加载的配置文件绝对路径，运行时写回也使用该文件。
	ConfigFile string
)

// locateConfig 依次尝试常见位置，兼容从仓库根目录、backend 目录或任意工作目录启动。
func locateConfig() (string, []string) {
	candidates := make([]string, 0, 6)

	if envPath := strings.TrimSpace(os.Getenv("KUBERUNNER_CONFIG")); envPath != "" {
		candidates = append(candidates, envPath)
	}

	if cwd, err := os.Getwd(); err == nil {
		candidates = append(candidates,
			filepath.Join(cwd, "config.yaml"),
			filepath.Join(cwd, "backend", "config.yaml"),
		)
	}

	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		candidates = append(candidates,
			filepath.Join(exeDir, "config.yaml"),
			filepath.Join(exeDir, "..", "config.yaml"),
			filepath.Join(exeDir, "..", "backend", "config.yaml"),
		)
	}

	for _, candidate := range candidates {
		abs, err := filepath.Abs(candidate)
		if err != nil {
			continue
		}
		if info, err := os.Stat(abs); err == nil && !info.IsDir() {
			return abs, candidates
		}
	}

	return "", candidates
}

func init() {
	configFile, searched := locateConfig()
	if configFile == "" {
		panic(fmt.Errorf(
			"未找到配置文件 config.yaml（已尝试: %s）；可通过环境变量 KUBERUNNER_CONFIG 指定绝对路径",
			strings.Join(searched, ", "),
		))
	}
	ConfigFile = configFile

	viper.SetConfigFile(configFile)
	// 允许通过环境变量覆盖配置，例如 KUBERUNNER_LISTENADDRESS=:8080
	viper.SetEnvPrefix("kuberunner")
	viper.AutomaticEnv()

	if err := viper.ReadInConfig(); err != nil {
		panic(fmt.Errorf("读取配置文件 %s 失败: %w", configFile, err))
	}

	KubeConfigs = viper.GetStringMapString("KubeConfigs")

	ListenAddress = viper.GetString("ListenAddress")
	if ListenAddress == "" {
		ListenAddress = ":8080"
	}

	Username = viper.GetString("Username")
	Password = viper.GetString("Password")

	RequestTimeout = viper.GetDuration("RequestTimeout")
	if RequestTimeout <= 0 {
		RequestTimeout = defaultRequestTimeout
	}

	fmt.Printf("配置文件: %s（已配置集群 %d 个）\n", ConfigFile, len(KubeConfigs))
}

func GetKubeConfig() map[string]string {
	return KubeConfigs
}

func GetConfigFile() string {
	return ConfigFile
}

func GetListenAddress() string {
	return ListenAddress
}

func GetUsername() string {
	return Username
}

func GetPassword() string {
	return Password
}

func GetRequestTimeout() time.Duration {
	return RequestTimeout
}

// SaveKubeConfigs 将集群配置写回实际加载的 config.yaml。
// 使用 yaml.Node 修改，只替换 KubeConfigs 节点，保留其它配置与注释。
func SaveKubeConfigs(configs map[string]string) error {
	if ConfigFile == "" {
		return fmt.Errorf("未找到配置文件路径，无法持久化集群配置")
	}

	data, err := os.ReadFile(ConfigFile)
	if err != nil {
		return fmt.Errorf("读取配置文件失败: %w", err)
	}

	var doc yaml.Node
	if len(strings.TrimSpace(string(data))) > 0 {
		if err := yaml.Unmarshal(data, &doc); err != nil {
			return fmt.Errorf("解析配置文件失败: %w", err)
		}
	}

	var root *yaml.Node
	if len(doc.Content) > 0 {
		root = doc.Content[0]
	} else {
		root = &yaml.Node{Kind: yaml.MappingNode, Tag: "!!map"}
		doc.Kind = yaml.DocumentNode
		doc.Content = append(doc.Content, root)
	}
	if root.Kind != yaml.MappingNode {
		return fmt.Errorf("配置文件格式不正确，期望 YAML 映射")
	}

	valueNode := &yaml.Node{}
	if err := valueNode.Encode(configs); err != nil {
		return fmt.Errorf("序列化集群配置失败: %w", err)
	}

	replaced := false
	for i := 0; i+1 < len(root.Content); i += 2 {
		if root.Content[i].Value == "KubeConfigs" {
			root.Content[i+1] = valueNode
			replaced = true
			break
		}
	}
	if !replaced {
		root.Content = append(root.Content,
			&yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: "KubeConfigs"},
			valueNode,
		)
	}

	out, err := yaml.Marshal(&doc)
	if err != nil {
		return fmt.Errorf("序列化配置失败: %w", err)
	}
	if err := os.WriteFile(ConfigFile, out, 0o644); err != nil {
		return fmt.Errorf("写入配置文件失败: %w", err)
	}

	KubeConfigs = configs
	viper.Set("KubeConfigs", configs)
	return nil
}
