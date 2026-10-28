package v1

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gitlayzer/kuberunner/pkg/types/api/corev1/type_apply"
	"github.com/gitlayzer/kuberunner/pkg/utils"
)

var Apply apply

type apply struct{}

func (a *apply) Register(router *gin.Engine) {
	resource := router.Group("/api/v1/k8s")
	{
		resource.POST("/apply", a.ApplyResource)
	}
}

// ApplyResource 创建任意内置资源，content 支持 YAML 或 JSON。
func (a *apply) ApplyResource(ctx *gin.Context) {
	params := new(struct {
		Cluster string `json:"cluster"`
		Content string `json:"content"`
	})

	if err := ctx.ShouldBindJSON(params); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	if params.Cluster == "" || params.Content == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "cluster 与 content 均为必填参数",
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

	message, err := type_apply.Apply.Apply(ctx.Request.Context(), client, params.Content)
	if err != nil {
		// 解析类错误按 400 返回，便于前端区分填写问题与集群问题。
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": message,
		"data":    nil,
	})
}
