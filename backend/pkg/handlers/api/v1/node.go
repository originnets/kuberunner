package v1

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/gitlayzer/kuberunner/pkg/types/api/corev1/type_node"
	"github.com/gitlayzer/kuberunner/pkg/utils"
	"net/http"
	"time"
)

var Node node

type node struct{}

func (n *node) Register(router *gin.Engine) {
	node := router.Group("/api/v1/k8s/node")
	{
		node.GET("/list", n.GetNodes)
		node.GET("/detail", n.GetNodeDetail)
		node.POST("/cordon", n.CordonNode)
		node.POST("/drain", n.DrainNode)
	}
}

func (n *node) GetNodes(ctx *gin.Context) {
	params := new(struct {
		FilterName string `form:"filter_name" json:"filter_name"`
		Page       int    `form:"page" json:"page"`
		Limit      int    `form:"limit" json:"limit"`
		Cluster    string `form:"cluster" json:"cluster"`
	})

	if err := ctx.Bind(params); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	client, err := utils.K8s.GetClient(params.Cluster)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	nodeResp, err := type_node.Node.GetNodes(client, params.FilterName, params.Limit, params.Page)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    nodeResp,
	})
}

func (n *node) GetNodeDetail(ctx *gin.Context) {
	params := new(struct {
		NodeName string `form:"node_name" json:"node_name"`
		Cluster  string `form:"cluster" json:"cluster"`
	})

	if err := ctx.Bind(params); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	if params.NodeName == "" || params.Cluster == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "node_name、cluster 均为必填参数",
			"data":    nil,
		})
		return
	}

	client, err := utils.K8s.GetClient(params.Cluster)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	nodeDetail, err := type_node.Node.GetNodeDetail(client, params.NodeName)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    nodeDetail,
	})
}

func (n *node) CordonNode(ctx *gin.Context) {
	params := new(struct {
		NodeName      string `json:"node_name"`
		Cluster       string `json:"cluster"`
		Unschedulable *bool  `json:"unschedulable"`
	})

	if err := ctx.ShouldBindJSON(params); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	if params.NodeName == "" || params.Cluster == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "node_name、cluster 均为必填参数",
			"data":    nil,
		})
		return
	}

	client, err := utils.K8s.GetClient(params.Cluster)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	unschedulable := true
	if params.Unschedulable != nil {
		unschedulable = *params.Unschedulable
	}

	if err := type_node.Node.SetNodeSchedulable(client, params.NodeName, unschedulable); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	message := "节点已恢复调度"
	if unschedulable {
		message = "节点已停止调度"
	}
	ctx.JSON(http.StatusOK, gin.H{
		"message": message,
		"data":    nil,
	})
}

func (n *node) DrainNode(ctx *gin.Context) {
	params := new(struct {
		NodeName           string `json:"node_name"`
		Cluster            string `json:"cluster"`
		Force              bool   `json:"force"`
		IgnoreDaemonSets   *bool  `json:"ignore_daemonsets"`
		DeleteEmptyDirData bool   `json:"delete_emptydir_data"`
		TimeoutSeconds     int    `json:"timeout_seconds"`
	})

	if err := ctx.ShouldBindJSON(params); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	if params.NodeName == "" || params.Cluster == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "node_name、cluster 均为必填参数",
			"data":    nil,
		})
		return
	}

	client, err := utils.K8s.GetClient(params.Cluster)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	ignoreDaemonSets := true
	if params.IgnoreDaemonSets != nil {
		ignoreDaemonSets = *params.IgnoreDaemonSets
	}

	timeout := time.Duration(params.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 2 * time.Minute
	}

	result, err := type_node.Node.DrainNode(client, params.NodeName, type_node.DrainOptions{
		Force:              params.Force,
		IgnoreDaemonSets:   ignoreDaemonSets,
		DeleteEmptyDirData: params.DeleteEmptyDirData,
		Timeout:            timeout,
	})
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("已驱逐 %d 个 Pod，跳过 %d 个", len(result.Evicted), len(result.Skipped)),
		"data":    result,
	})
}
