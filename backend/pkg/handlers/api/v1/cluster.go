package v1

import (
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gitlayzer/kuberunner/pkg/config"
	"github.com/gitlayzer/kuberunner/pkg/utils"
)

var Cluster cluster

type cluster struct{}

type clusterStatus struct {
	Name       string `json:"name"`
	KubeConfig string `json:"kube_config"`
	AuthType   string `json:"auth_type"`
	Server     string `json:"server"`
	Version    string `json:"version"`
	Reachable  bool   `json:"reachable"`
	Error      string `json:"error,omitempty"`
}

func (c *cluster) Register(router *gin.Engine) {
	group := router.Group("/api/v1/k8s/cluster")
	{
		group.GET("/list", c.GetClusterList)
		group.GET("/status", c.GetClusterStatus)
		group.GET("/detail", c.GetClusterDetail)
		group.POST("/create", c.CreateCluster)
		group.PUT("/update", c.UpdateCluster)
		group.DELETE("/delete", c.DeleteCluster)
	}
}

func (c *cluster) GetClusterList(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    utils.K8s.Clusters(),
	})
}

// GetClusterStatus 返回每个集群的 kubeconfig、认证方式与连通性（并发检测）。
func (c *cluster) GetClusterStatus(ctx *gin.Context) {
	names := utils.K8s.Clusters()
	statuses := make([]clusterStatus, len(names))

	var wg sync.WaitGroup
	for i, name := range names {
		wg.Add(1)
		go func(index int, clusterName string) {
			defer wg.Done()

			item := clusterStatus{Name: clusterName}
			if detail, err := utils.K8s.ClusterDetail(clusterName); err == nil {
				item.KubeConfig = detail.KubeConfig
				item.AuthType = detail.AuthType
				item.Server = detail.Server
			}
			if version, err := utils.K8s.ClusterVersion(clusterName); err != nil {
				item.Error = err.Error()
			} else {
				item.Version = version
				item.Reachable = true
			}
			statuses[index] = item
		}(i, name)
	}
	wg.Wait()

	ctx.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    statuses,
	})
}

// GetClusterDetail 返回单个集群的配置信息（不含敏感凭据）。
func (c *cluster) GetClusterDetail(ctx *gin.Context) {
	name := ctx.Query("name")
	if name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "name 不能为空",
			"data":    nil,
		})
		return
	}

	detail, err := utils.K8s.ClusterDetail(name)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    detail,
	})
}

type clusterAuthPayload struct {
	Name              string `json:"name"`
	AuthType          string `json:"auth_type"`
	KubeConfigPath    string `json:"kube_config_path"`
	KubeConfigContent string `json:"kube_config_content"`
	Server            string `json:"server"`
	Token             string `json:"token"`
	CAData            string `json:"ca_data"`
	SkipTLSVerify     bool   `json:"skip_tls_verify"`
}

func (p clusterAuthPayload) toClusterAuth() utils.ClusterAuth {
	return utils.ClusterAuth{
		Type:              p.AuthType,
		KubeConfigPath:    p.KubeConfigPath,
		KubeConfigContent: p.KubeConfigContent,
		Server:            p.Server,
		Token:             p.Token,
		CAData:            p.CAData,
		SkipTLSVerify:     p.SkipTLSVerify,
	}
}

// persistKubeConfigs 将集群列表写回 config.yaml，返回告警信息。
func persistKubeConfigs() []string {
	if err := config.SaveKubeConfigs(utils.K8s.KubeConfigs()); err != nil {
		return []string{"集群已生效，但写回 config.yaml 失败: " + err.Error()}
	}
	return []string{}
}

// CreateCluster 运行时添加集群，支持 kubeconfig 文件/内容与 Token 认证。
func (c *cluster) CreateCluster(ctx *gin.Context) {
	params := new(clusterAuthPayload)
	if err := ctx.ShouldBindJSON(params); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	if err := utils.K8s.AddCluster(params.Name, params.toClusterAuth()); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message":  "集群已添加",
		"data":     nil,
		"warnings": persistKubeConfigs(),
	})
}

// UpdateCluster 修改集群名称或认证配置。
func (c *cluster) UpdateCluster(ctx *gin.Context) {
	params := new(struct {
		CurrentName string `json:"current_name"`
		clusterAuthPayload
	})
	if err := ctx.ShouldBindJSON(params); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	if params.CurrentName == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "current_name 不能为空",
			"data":    nil,
		})
		return
	}

	if err := utils.K8s.UpdateCluster(params.CurrentName, params.Name, params.toClusterAuth()); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message":  "集群配置已更新",
		"data":     nil,
		"warnings": persistKubeConfigs(),
	})
}

// DeleteCluster 运行时移除集群，并尽量写回 config.yaml。
func (c *cluster) DeleteCluster(ctx *gin.Context) {
	params := new(struct {
		Name string `json:"name"`
	})

	if err := ctx.ShouldBindJSON(params); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	if params.Name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "集群名称不能为空",
			"data":    nil,
		})
		return
	}

	if err := utils.K8s.RemoveCluster(params.Name); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message":  "集群已移除",
		"data":     nil,
		"warnings": persistKubeConfigs(),
	})
}
