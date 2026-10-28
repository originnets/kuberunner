package handlers

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	"github.com/gitlayzer/kuberunner/pkg/config"
	"github.com/gitlayzer/kuberunner/pkg/handlers/api"
	v1 "github.com/gitlayzer/kuberunner/pkg/handlers/api/v1"
	"github.com/gitlayzer/kuberunner/pkg/middlewares/auth"
	"github.com/gitlayzer/kuberunner/pkg/middlewares/cors"
	"github.com/gitlayzer/kuberunner/pkg/types/terminal"
	"github.com/gitlayzer/kuberunner/pkg/utils"
)

func init() {
	if err := utils.K8s.Init(); err != nil {
		// 单个集群失败不影响已验证过的集群；完全不可用时仍允许登录后查看错误信息。
		log.Printf("[warn] 初始化集群客户端: %v", err)
	}
}

func InitRouter() {
	// 必须在创建 gin.Engine 之前设置，否则日志格式仍按 debug 模式初始化。
	gin.SetMode(gin.ReleaseMode)

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.Use(gzip.Gzip(gzip.DefaultCompression))
	r.Use(cors.Cors())
	r.Use(auth.Middleware())

	r.GET("/healthz", func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{
			"message": "success",
			"data": gin.H{
				"status":   "ok",
				"clusters": utils.K8s.Clusters(),
			},
		})
	})

	api.Login.Register(r)
	v1.ResourceNum.Register(r)
	v1.Cluster.Register(r)
	v1.Event.Register(r)
	v1.Pod.Register(r)
	v1.Deployment.Register(r)
	v1.DaemonSet.Register(r)
	v1.StatefulSet.Register(r)
	v1.Service.Register(r)
	v1.Ingress.Register(r)
	v1.ConfigMap.Register(r)
	v1.Namespace.Register(r)
	v1.Node.Register(r)
	v1.Secret.Register(r)
	v1.PersistentVolume.Register(r)
	v1.PersistentVolumeClaim.Register(r)
	v1.StorageClass.Register(r)
	v1.Apply.Register(r)

	utils.Logo()
	r.GET("/ws", terminal.Terminal.ServeWsTerminal)

	srv := &http.Server{
		Addr:              config.GetListenAddress(),
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
		// 不设置 ReadTimeout / WriteTimeout：
		// WebSocket 终端是长连接，http.Server 设置的读写 deadline 在连接被
		// hijack 之后仍然生效，会导致终端在固定时间后被断开。
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("HTTP 服务启动失败: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("[warn] HTTP 服务关闭超时: %v", err)
	}
}
