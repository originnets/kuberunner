package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gitlayzer/kuberunner/pkg/utils"
)

// publicPaths 为无需登录即可访问的路径。
var publicPaths = map[string]struct{}{
	"/login":   {},
	"/healthz": {},
}

// Middleware 校验登录令牌。
// 普通请求读取 Authorization: Bearer <token>；
// WebSocket 无法自定义请求头，允许通过 ?token= 传递。
func Middleware() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		if ctx.Request.Method == http.MethodOptions {
			ctx.Next()
			return
		}
		if _, ok := publicPaths[ctx.Request.URL.Path]; ok {
			ctx.Next()
			return
		}

		token := ExtractToken(ctx)
		if _, ok := utils.ValidateToken(token); !ok {
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"message": "登录已失效，请重新登录",
				"data":    nil,
			})
			return
		}

		ctx.Next()
	}
}

// ExtractToken 从请求头或查询参数中提取令牌。
func ExtractToken(ctx *gin.Context) string {
	header := strings.TrimSpace(ctx.GetHeader("Authorization"))
	if header != "" {
		if strings.HasPrefix(strings.ToLower(header), "bearer ") {
			return strings.TrimSpace(header[7:])
		}
		return header
	}
	return strings.TrimSpace(ctx.Query("token"))
}
