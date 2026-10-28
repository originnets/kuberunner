package terminal

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gitlayzer/kuberunner/pkg/utils"
	"github.com/gorilla/websocket"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/remotecommand"
)

var Terminal terminal

type terminal struct{}

var upgrader = func() websocket.Upgrader {
	u := websocket.Upgrader{}
	u.HandshakeTimeout = time.Second * 10
	// 只允许同源、本机来源的握手，避免任意站点借助浏览器连接终端。
	u.CheckOrigin = func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}

		parsed, err := url.Parse(origin)
		if err != nil {
			return false
		}

		host := parsed.Hostname()
		switch host {
		case "localhost", "127.0.0.1", "::1":
			return true
		}

		requestHost := r.Host
		if h, _, err := net.SplitHostPort(requestHost); err == nil {
			requestHost = h
		}
		return strings.EqualFold(host, requestHost)
	}
	return u
}()

func (t *TerminalSession) Done() {
	t.doneOnce.Do(func() {
		close(t.DoneChan)
	})
}

func (t *TerminalSession) Next() *remotecommand.TerminalSize {
	select {
	case size := <-t.SizeChan:
		return &size
	case <-t.DoneChan:
		return nil
	}
}

func (t *TerminalSession) Read(p []byte) (int, error) {
	_, data, err := t.WsConn.ReadMessage()
	if err != nil {
		return 0, err
	}
	var msg TerminalMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return 0, fmt.Errorf("解析终端消息失败: %w", err)
	}
	switch msg.Operation {
	case "stdin":
		return copy(p, msg.Data), nil
	case "resize":
		// 非阻塞写入，避免远端未消费尺寸事件时阻塞读循环。
		select {
		case t.SizeChan <- remotecommand.TerminalSize{Width: msg.Cols, Height: msg.Rows}:
		default:
		}
		return 0, nil
	case "ping":
		return 0, nil
	default:
		// 未知操作类型直接忽略，不要让整个终端会话因此断开。
		return 0, nil
	}
}

func (t *TerminalSession) Write(p []byte) (int, error) {
	msg, err := json.Marshal(TerminalMessage{
		Operation: "stdout",
		Data:      string(p),
	})
	if err != nil {
		return 0, fmt.Errorf("序列化终端输出失败: %w", err)
	}

	if err := t.WsConn.WriteMessage(websocket.TextMessage, msg); err != nil {
		return 0, fmt.Errorf("写入终端消息失败: %w", err)
	}
	return len(p), nil
}

func (t *TerminalSession) Close() error {
	return t.WsConn.Close()
}

type WebShellOptions struct {
	Namespace     string `form:"namespace"`
	PodName       string `form:"pod_name"`
	ContainerName string `form:"container_name"`
	Cluster       string `form:"cluster"`
}

func (o *WebShellOptions) Validate() error {
	if o.Namespace == "" || o.PodName == "" || o.Cluster == "" {
		return fmt.Errorf("namespace、pod_name、cluster 均为必填参数")
	}
	return nil
}

func (t *terminal) WebShellHandler(webShellOptions *WebShellOptions, w http.ResponseWriter, r *http.Request) {
	client, err := utils.K8s.GetClient(webShellOptions.Cluster)
	if err != nil {
		return
	}

	kubeConfig, err := utils.K8s.GetKubeConfig(webShellOptions.Cluster)
	if err != nil {
		return
	}

	conf, err := clientcmd.BuildConfigFromFlags("", kubeConfig)
	if err != nil {
		return
	}

	pty, err := NewTerminalSession(w, r, nil)
	if err != nil {
		return
	}

	// 会话结束时只关闭一次，并保证连接最终释放。
	defer pty.Close()
	defer pty.Done()

	execOptions := &corev1.PodExecOptions{
		Container: webShellOptions.ContainerName,
		Command:   []string{"/bin/sh"},
		Stdin:     true,
		Stdout:    true,
		Stderr:    true,
		TTY:       true,
	}

	req := client.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(webShellOptions.PodName).
		Namespace(webShellOptions.Namespace).
		SubResource("exec").
		VersionedParams(execOptions, scheme.ParameterCodec)

	exec, err := remotecommand.NewSPDYExecutor(conf, "POST", req.URL())
	if err != nil {
		_, _ = pty.Write([]byte(fmt.Sprintf("创建终端会话失败: %v\n", err)))
		return
	}

	// 请求上下文取消（例如浏览器关闭）时同步中断远端 exec。
	if err = exec.StreamWithContext(r.Context(), remotecommand.StreamOptions{
		Stdin:             pty,
		Stdout:            pty,
		Stderr:            pty,
		TerminalSizeQueue: pty,
		Tty:               true,
	}); err != nil {
		_, _ = pty.Write([]byte(fmt.Sprintf("Exec to pod error: %v\n", err)))
	}
}

func (t *terminal) ServeWsTerminal(c *gin.Context) {
	var webShellOptions WebShellOptions
	if err := c.ShouldBindQuery(&webShellOptions); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
		})
		return
	}
	if err := webShellOptions.Validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
		})
		return
	}
	t.WebShellHandler(&webShellOptions, c.Writer, c.Request)
}

func NewTerminalSession(w http.ResponseWriter, r *http.Request, responseHeader http.Header) (*TerminalSession, error) {
	wsConn, err := upgrader.Upgrade(w, r, responseHeader)
	if err != nil {
		return nil, err
	}
	// 清理 HTTP Server 可能遗留的读写 deadline，避免长连接被提前中断。
	_ = wsConn.UnderlyingConn().SetReadDeadline(time.Time{})
	_ = wsConn.UnderlyingConn().SetWriteDeadline(time.Time{})
	return &TerminalSession{
		WsConn:   wsConn,
		SizeChan: make(chan remotecommand.TerminalSize, 4),
		DoneChan: make(chan struct{}),
	}, nil
}
