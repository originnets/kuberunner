package v1

import (
	"github.com/gin-gonic/gin"
	"github.com/gitlayzer/kuberunner/pkg/types/api/corev1/type_event"
	"github.com/gitlayzer/kuberunner/pkg/utils"
	"net/http"
)

var Event event

type event struct{}

func (e *event) Register(router *gin.Engine) {
	event := router.Group("/api/v1/k8s/event")
	{
		event.GET("/list", e.GetEventList)
		event.GET("/detail", e.GetEventDetail)
	}
}

func (e *event) GetEventList(ctx *gin.Context) {
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

	eventResp, err := type_event.Event.GetEventList(client, params.FilterName, params.Limit, params.Page)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    eventResp,
	})
}

func (e *event) GetEventDetail(ctx *gin.Context) {
	params := new(struct {
		EventName string `form:"event_name" json:"event_name"`
		Namespace string `form:"namespace" json:"namespace"`
		Cluster   string `form:"cluster" json:"cluster"`
	})

	if err := ctx.Bind(params); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	if params.EventName == "" || params.Namespace == "" || params.Cluster == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "event_name、namespace、cluster 均为必填参数",
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

	eventDetail, err := type_event.Event.GetEventDetail(client, params.EventName, params.Namespace)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    eventDetail,
	})
}
