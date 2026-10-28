package v1

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gitlayzer/kuberunner/pkg/config"
	"github.com/gitlayzer/kuberunner/pkg/utils"
)

var Cluster cluster

type cluster struct{}

type clusterStatus struct {
	Name       string `json:"name"`
	KubeConfig string `json:"kube_config"`
	Version    string `json:"version"`
	Reachable  bool   `json:"reachable"`
	Error      string `json:"error,omitempty"`
}

func (c *cluster) Register(router *gin.Engine) {
	group := router.Group("/api/v1/k8s/cluster")
	{
		group.GET("/list", c.GetClusterList)
		group.GET("/status", c.GetClusterStatus)
		group.POST("/create", c.CreateCluster)
		group.DELETE("/delete", c.DeleteCluster)
	}
}

func (c *cluster) GetClusterList(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    utils.K8s.Clusters(),
	})
}

// GetClusterStatus 返回每个集群的 kubeconfig 路径与连通性。
func (c *cluster) GetClusterStatus(ctx *gin.Context) {
	kubeConfigs := utils.K8s.KubeConfigs()
	names := utils.K8s.Clusters()

	statuses := make([]clusterStatus, 0, len(names))
	for _, name := range names {
		item := clusterStatus{
			Name:       name,
			KubeConfig: kubeConfigs[name],
		}
		if version, err := utils.K8s.ClusterVersion(name); err != nil {
			item.Error = err.Error()
		} else {
			item.Version = version
			item.Reachable = true
		}
		statuses = append(statuses, item)
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    statuses,
	})
}

// CreateCluster 运行时添加集群，并尽量写回 config.yaml。
func (c *cluster) CreateCluster(ctx *gin.Context) {
	params := new(struct {
		Name           string `json:"name"`
		KubeConfigPath string `json:"kube_config_path"`
	})

	if err := ctx.ShouldBindJSON(params); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	name := strings.TrimSpace(params.Name)
	kubeConfigPath := strings.TrimSpace(params.KubeConfigPath)
	if name == "" || kubeConfigPath == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "集群名称与 kubeconfig 路径不能为空",
			"data":    nil,
		})
		return
	}
	if strings.ContainsAny(name, " \t\n/\\") {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "集群名称不能包含空格或斜杠",
			"data":    nil,
		})
		return
	}

	if err := utils.K8s.AddCluster(name, kubeConfigPath); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	warnings := make([]string, 0)
	if err := config.SaveKubeConfigs(utils.K8s.KubeConfigs()); err != nil {
		warnings = append(warnings, "集群已生效，但写回 config.yaml 失败: "+err.Error())
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message":  "集群已添加",
		"data":     nil,
		"warnings": warnings,
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

	if strings.TrimSpace(params.Name) == "" {
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

	warnings := make([]string, 0)
	if err := config.SaveKubeConfigs(utils.K8s.KubeConfigs()); err != nil {
		warnings = append(warnings, "集群已移除，但写回 config.yaml 失败: "+err.Error())
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message":  "集群已移除",
		"data":     nil,
		"warnings": warnings,
	})
}
