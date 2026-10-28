package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gitlayzer/kuberunner/pkg/middlewares/auth"
	"github.com/gitlayzer/kuberunner/pkg/types/api/corev1/type_login"
	"github.com/gitlayzer/kuberunner/pkg/utils"
)

var Login login

type login struct{}

func (l *login) Register(router *gin.Engine) {
	router.POST("/login", l.AuthLogin)
	router.POST("/logout", l.Logout)
}

func (l *login) AuthLogin(ctx *gin.Context) {
	params := new(struct {
		Username string `json:"username" form:"username"`
		Password string `json:"password" form:"password"`
	})

	if err := ctx.ShouldBindJSON(params); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	if err := type_login.Login.Login(params.Username, params.Password); err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"message": "用户名或密码错误",
			"data":    nil,
		})
		return
	}

	token, expiresAt, err := utils.IssueToken(params.Username)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": "生成登录凭证失败",
			"data":    nil,
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"username":   params.Username,
			"token":      token,
			"expires_at": expiresAt.Unix(),
		},
	})
}

func (l *login) Logout(ctx *gin.Context) {
	utils.RevokeToken(auth.ExtractToken(ctx))
	ctx.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data":    nil,
	})
}
