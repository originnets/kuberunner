package v1

import (
	"github.com/gin-gonic/gin"
	"github.com/gitlayzer/kuberunner/pkg/utils"
	"sort"
)

var Cluster cluster

type cluster struct{}

func (c *cluster) Register(router *gin.Engine) {
	cluster := router.Group("/api/v1/k8s/cluster")
	{
		cluster.GET("/list", c.GetClusterList)
	}
}

func (c *cluster) GetClusterList(ctx *gin.Context) {
	Clusters := make([]string, 0)

	for key := range utils.K8s.ClientMap {
		Clusters = append(Clusters, key)
	}

	sort.Strings(Clusters)

	ctx.JSON(200, gin.H{
		"msg":  "success",
		"data": Clusters,
	})
}
