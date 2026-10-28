![kuberunner](https://github.com/gitlayzer/kuberunner-dashboard/assets/77761224/d94d0f6d-aa64-4179-956b-2dcd5544b9c1)

|    名称    |   版本   |    发布时间    |  发布人   | 是否更新UI |
| :--------: |:------:|:----------:| :-------: |:------:|
| kuberunner | v0.0.1 | 2023/03/10 | Gitlayzer |   ×    |
| kuberunner | v0.0.2 | 2023/03/13 | Gitlayzer |   ×    |
| kuberunner | v0.0.3 | 2023/03/13 | Gitlayzer |   √    |
| kuberunner | v0.0.4 | 2023/06/03 | Gitlayzer |   √    |

```shell
本次更新主要针对的路由注册方法，重构了路由注册的思路，通过模块化的形式进行路由注册，可具体到某个资源的所有操作
```
```yaml
# API 监听的端口（终端 WebSocket 已合并到同一端口 /ws）
ListenAddress: ":8080"
# 前端登录验证的账号
Username: "admin"
# 前端登录验证的密码
Password: "admin"
# 可配置多个kubeconfig实现多集群管理
KubeConfigs:
  cluster1: "C:\\Users\\Administrator\\.kube\\config"
# 单次 Kubernetes API 请求超时时间
RequestTimeout: 30s
```

所有环境配置均支持通过 `KUBERUNNER_` 前缀的环境变量覆盖，例如 `KUBERUNNER_LISTENADDRESS=:9090`。


## 接口鉴权

登录成功后 `POST /login` 返回 `token`（24 小时有效）。除 `/login`、`/healthz` 外，
所有 HTTP 接口都需要携带 `Authorization: Bearer <token>`；WebSocket 终端通过
`/ws?...&token=<token>` 传递。`POST /logout` 可立即注销令牌。
集群也可以运行时增删：`POST /api/v1/k8s/cluster/create`（name + kube_config_path）、
`DELETE /api/v1/k8s/cluster/delete`，配置会尽量写回本文件。
## 配置文件查找顺序

后端会依次尝试以下位置，找到即用：

1. 环境变量 `KUBERUNNER_CONFIG` 指定的绝对路径
2. 当前工作目录下的 `config.yaml`
3. 当前工作目录下的 `backend/config.yaml`（在仓库根目录执行 `go run ./backend/cmd` 时）
4. 可执行文件所在目录或上一级目录下的 `config.yaml`

因此无论是 `cd backend && go run ./cmd`，还是在仓库根目录直接启动二进制，都能正确加载配置。
启动日志会打印实际使用的配置文件路径与加载到的集群数量；若 kubeconfig 路径不存在，会逐条输出告警。
运行期通过集群管理页面新增/移除集群会写回该配置文件（保留其它配置与注释）。
## 集群管理与认证方式

在「集群管理」页面可添加、编辑、移除集群，支持两种认证方式：

- **KubeConfig**：填写后端服务器上的文件路径，或直接粘贴 kubeconfig 内容（会生成到
  `config.yaml` 同级的 `kubeconfigs/<集群名>.yaml`，权限 0600）。
- **API Server + Token**：填写 API Server 地址与 Bearer Token，可选 CA 证书（PEM）
  或跳过 TLS 校验；同样会生成独立 kubeconfig 文件。

添加/编辑时会先校验连接（超时 10 秒），配置变更会写回 `config.yaml`。
资源请求由后端 `RequestTimeout` 限制（默认 30 秒），前端另设 15 秒超时并在页面上
显示「请求超时」错误，避免目标集群不可达时一直等待。