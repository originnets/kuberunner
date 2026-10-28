package config

import (
	"fmt"
	"time"

	"github.com/spf13/viper"
)

const defaultRequestTimeout = 30 * time.Second

var (
	KubeConfigs    map[string]string
	ListenAddress  string
	Username       string
	Password       string
	RequestTimeout time.Duration
)

func init() {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	// 允许通过环境变量覆盖配置，例如 KUBERUNNER_LISTENADDRESS=:8080
	viper.SetEnvPrefix("kuberunner")
	viper.AutomaticEnv()

	if err := viper.ReadInConfig(); err != nil {
		panic(fmt.Errorf("failed to read config file: %w", err))
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
}

func GetKubeConfig() map[string]string {
	return KubeConfigs
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

// SaveKubeConfigs 将集群配置写回 config.yaml。
func SaveKubeConfigs(configs map[string]string) error {
	viper.Set("KubeConfigs", configs)
	if err := viper.WriteConfig(); err != nil {
		return viper.WriteConfigAs("config.yaml")
	}
	return nil
}
