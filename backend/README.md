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