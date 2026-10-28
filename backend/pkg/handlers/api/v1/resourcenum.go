package v1

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gitlayzer/kuberunner/pkg/config"
	"github.com/gitlayzer/kuberunner/pkg/types/api/corev1/type_resourcenum"
	"github.com/gitlayzer/kuberunner/pkg/utils"
)

var ResourceNum resourcenum

type resourcenum struct{}

// 概览页会周期性刷新，这里做一层短 TTL 缓存，避免每次刷新都触发 12 次
// 全集群 List 请求。
const resourceCacheTTL = 3 * time.Second

type resourceCacheEntry struct {
	data      map[string]int
	expiresAt time.Time
}

var (
	resourceCacheMu sync.Mutex
	resourceCache   = make(map[string]resourceCacheEntry)
)

func (r *resourcenum) Register(router *gin.Engine) {
	resource := router.Group("/api/v1/k8s")
	{
		resource.GET("/resources", r.GetResources)
	}
}

func (r *resourcenum) GetResources(ctx *gin.Context) {
	params := new(struct {
		Cluster string `json:"cluster" form:"cluster"`
		Refresh bool   `json:"refresh" form:"refresh"`
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

	if !params.Refresh {
		if data, ok := getCachedResources(params.Cluster); ok {
			ctx.JSON(http.StatusOK, gin.H{
				"message": "success",
				"data":    data,
			})
			return
		}
	}

	// 为整次统计设置上限，避免某个资源接口卡住导致请求一直挂起。
	reqCtx, cancel := context.WithTimeout(ctx.Request.Context(), config.GetRequestTimeout())
	defer cancel()

	data, errs := type_resourcenum.ResourceNum.GetResourceNum(reqCtx, client)
	if len(data) == 0 && len(errs) > 0 {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": errs[0].Error(),
			"data":    nil,
		})
		return
	}

	if len(errs) == 0 {
		setCachedResources(params.Cluster, data)
	}

	messages := make([]string, 0, len(errs))
	for _, e := range errs {
		messages = append(messages, e.Error())
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message":  "success",
		"data":     data,
		"warnings": messages,
	})
}

func getCachedResources(cluster string) (map[string]int, bool) {
	resourceCacheMu.Lock()
	defer resourceCacheMu.Unlock()

	entry, ok := resourceCache[cluster]
	if !ok || time.Now().After(entry.expiresAt) {
		return nil, false
	}
	return entry.data, true
}

func setCachedResources(cluster string, data map[string]int) {
	resourceCacheMu.Lock()
	defer resourceCacheMu.Unlock()

	resourceCache[cluster] = resourceCacheEntry{
		data:      data,
		expiresAt: time.Now().Add(resourceCacheTTL),
	}
}
