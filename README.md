# KubeRunner

轻量级 Kubernetes 多集群管理平台。后端基于 Go + client-go，前端基于 React（Ant Design Pro / Umi Max），提供多集群切换、资源创建与编辑、日志与 Web 终端、节点运维等日常能力。

## 功能特性

- **多集群管理**：配置文件接入，或在页面上运行时添加、编辑、删除集群；支持 `kubeconfig`（文件路径 / 粘贴内容）与 `API Server + Token` 两种认证方式。
- **完整资源管理**：Pod、Deployment、StatefulSet、DaemonSet、Service、Ingress、ConfigMap、Secret、PV、PVC、StorageClass、Namespace、Node、Event。
- **创建 / 编辑双模式**：图形化表单与 YAML 二选一；编辑默认进入表单，可随时切换到 YAML，未覆盖字段会被保留。
- **工作负载运维**：扩缩容、重启、查看关联 Pod（按 `spec.selector` 的标签精确过滤）、容器日志、Web 终端。
- **节点运维**：停止/恢复调度（cordon / uncordon）、驱逐 Pod（drain，走 Eviction API，支持忽略 DaemonSet、强制、emptyDir、超时）。
- **概览页**：资源数量、异常事件、资源分布与常用入口。
- **详情与排障**：YAML / 概要抽屉，支持复制与下载；请求超时与错误提示，避免集群不可达时无限等待。
- **登录鉴权**：Token 鉴权（默认 24 小时），HTTP 接口与 WebSocket 终端均需有效凭证。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 后端 | Go 1.19+、Gin、client-go v0.26、Viper、gorilla/websocket、gzip |
| 前端 | React 19、Umi Max 4、Ant Design 6、ProComponents 3、TypeScript、Biome、Vitest |
| 部署 | 后端单二进制 + config.yaml；前端静态产物由 Nginx 托管 |

## 目录结构

```
kuberunner/
├── backend/                 # Go 后端
│   ├── cmd/main.go          # 入口
│   ├── config.yaml          # 后端配置（监听地址、账号、集群列表）
│   ├── pkg/
│   │   ├── config/          # 配置加载与持久化
│   │   ├── handlers/        # HTTP 路由与处理器
│   │   ├── middlewares/     # 鉴权、跨域、日志等
│   │   ├── types/           # 各资源类型与 K8s 操作
│   │   └── utils/           # 客户端管理、分页、Token
│   ├── kubeconfigs/         # 运行时生成的 kubeconfig（已忽略，不建议入库）
│   └── README.md            # 后端详细说明
├── frontend/                # React 前端
│   ├── config/              # 路由、主题、开发代理
│   ├── src/pages/           # 页面（概览、工作负载、网络、配置、存储、集群…）
│   ├── src/components/Kube/ # 资源表格、抽屉、终端等通用组件
│   └── src/services/        # 后端 API 封装
└── README.md
```

## 快速开始

### 环境要求

- Go >= 1.19
- Node.js >= 22，npm

### 1. 配置并启动后端

编辑 `backend/config.yaml`：

```yaml
ListenAddress: ":8080"
Username: "admin"
Password: "admin"
# 每个集群对应一个 kubeconfig 文件路径，key 为集群名称
KubeConfigs:
  cluster1: "C:/Users/Administrator/Desktop/k3s.yaml"
# 单次 Kubernetes API 请求超时，默认 30s
RequestTimeout: 30s
```

启动：

```bash
cd backend
go run ./cmd
```

默认监听 `:8080`。启动日志会打印实际使用的配置文件路径、加载到的集群数量，以及每个集群客户端创建的结果。

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问 <http://localhost:8000>，使用 `config.yaml` 中的账号密码登录（默认 `admin / admin`）。

开发环境默认把 `/api`、`/login`、`/logout`、`/healthz`、`/ws` 代理到 `http://127.0.0.1:8080`，可通过环境变量覆盖：

```bash
KUBERUNNER_API=http://192.168.1.10:8080 npm run dev
```

## 配置说明

`backend/config.yaml` 支持以下配置项：

| 配置项 | 说明 | 默认值 |
| --- | --- | --- |
| `ListenAddress` | HTTP 监听地址 | `:8080` |
| `Username` / `Password` | 登录账号密码 | 无 |
| `KubeConfigs` | 集群名称 → kubeconfig 路径 | 空 |
| `RequestTimeout` | 单次 K8s API 请求超时 | `30s` |

也支持环境变量覆盖（前缀 `KUBERUNNER_`），例如：

```bash
KUBERUNNER_LISTENADDRESS=:9090 KUBERUNNER_REQUESTTIMEOUT=60s go run ./cmd
```

配置文件查找顺序（启动时自动探测，找到即用）：

1. `KUBERUNNER_CONFIG` 指定的绝对路径
2. 当前工作目录下的 `config.yaml`
3. 当前工作目录下的 `backend/config.yaml`
4. 可执行文件所在目录或上一级目录下的 `config.yaml`

运行期在页面上增删集群，会写回实际加载的配置文件（保留其它配置项与注释），并同步生成对应的 kubeconfig 文件。

## 集群接入

在「集群管理」页面添加/编辑集群，支持三种方式：

| 方式 | 说明 |
| --- | --- |
| KubeConfig 文件路径 | 填写后端服务器上的绝对路径 |
| 粘贴 KubeConfig 内容 | 自动写入 `backend/kubeconfigs/<集群名>.yaml` |
| API Server + Token | 填写 API Server 地址与 Bearer Token，可选 CA 证书或跳过 TLS 校验 |

- 添加/编辑时会先尝试连接集群（10 秒超时），失败会返回具体原因。
- 生成的 kubeconfig 文件位于配置文件同级的 `kubeconfigs/` 目录，请妥善保管，不要提交到仓库。
- 集群连接状态与版本会在集群管理页展示；检测超时为 6 秒，不可达时不会阻塞页面。

## 鉴权说明

- `POST /login` 校验账号密码，成功后返回 `token`（默认 24 小时有效，内存存储）。
- 除 `/login`、`/healthz` 外，所有接口都需要：

  ```http
  Authorization: Bearer <token>
  ```

- WebSocket 终端无法自定义请求头，使用 `/ws?...&token=<token>`。
- `POST /logout` 立即注销当前 Token。
- Token 存储在浏览器 `localStorage`；失效时前端会清理会话并跳转登录页。
- 后端重启后内存中的 Token 全部失效，需要重新登录。

## 主要页面

| 页面 | 路径 | 说明 |
| --- | --- | --- |
| 概览 | `/overview` | 资源统计、事件、分布、快捷入口 |
| Pod | `/workload/pod` | 状态、就绪、重启、节点、日志、终端 |
| Deployment / StatefulSet / DaemonSet | `/workload/*` | 扩缩容、重启、查看关联 Pod |
| Service / Ingress | `/network/*` | 服务与路由管理 |
| ConfigMap / Secret | `/config/*` | 配置与密钥管理 |
| PV / PVC / StorageClass | `/storage/*` | 存储管理 |
| 节点 | `/cluster/node` | cordon / uncordon、drain |
| 命名空间 / 事件 | `/cluster/namespace`、`/cluster/event` | 命名空间与事件查看 |
| 集群管理 | `/cluster/manage` | 添加、编辑、移除集群，查看认证方式与连通性 |
| 登录 | `/user/login` | 账号密码登录 |

## API 概览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/login`、`/logout` | 登录 / 注销 |
| `GET` | `/healthz` | 健康检查（含集群列表，无需登录） |
| `GET` | `/api/v1/k8s/cluster/list` | 集群名称列表 |
| `GET` | `/api/v1/k8s/cluster/status` | 集群版本与连通性 |
| `GET` | `/api/v1/k8s/cluster/detail` | 单集群配置（不含凭据） |
| `POST` | `/api/v1/k8s/cluster/create` | 添加集群 |
| `PUT` | `/api/v1/k8s/cluster/update` | 修改集群名称 / 认证方式 |
| `DELETE` | `/api/v1/k8s/cluster/delete` | 移除集群 |
| `GET` | `/api/v1/k8s/resources` | 各资源数量统计 |
| `POST` | `/api/v1/k8s/apply` | 通用创建 / 更新（YAML/JSON） |
| `GET` | `/api/v1/k8s/<resource>/list` | 资源列表（分页、`filter_name`；Pod 支持 `label_selector`） |
| `GET` | `/api/v1/k8s/<resource>/detail` | 资源详情 |
| `PUT` | `/api/v1/k8s/<resource>/update` | 更新资源（JSON/YAML 内容） |
| `DELETE` | `/api/v1/k8s/<resource>/delete` | 删除资源 |
| `POST` | `/api/v1/k8s/deployment|statefulset/restart` | 重启工作负载 |
| `PUT` | `/api/v1/k8s/deployment|statefulset/replicas` | 调整副本数 |
| `GET` | `/api/v1/k8s/pod/log` | 容器日志 |
| `GET` | `/api/v1/k8s/pod/container` | 容器列表 |
| `POST` | `/api/v1/k8s/node/cordon`、`/node/drain` | 节点调度与驱逐 |
| `GET` | `/ws` | Web 终端（需 `token` 参数） |

## 开发与校验

后端：

```bash
cd backend
go build ./...
go vet ./...
go test ./...
```

前端：

```bash
cd frontend
npm run lint        # Biome + tsc
npm run tsc         # 仅类型检查
npx antd lint ./src # antd 用法检查
npm run build       # 构建静态产物到 dist/
```

## 生产部署

1. **构建后端**

   ```bash
   cd backend
   go build -o kuberunner ./cmd
   ./kuberunner          # 默认读取同目录或当前目录的 config.yaml
   ```

2. **构建前端**

   ```bash
   cd frontend
   npm run build
   ```

   产物位于 `frontend/dist/`。

3. **Nginx 示例**（静态站点 + 反向代理）

   ```nginx
   server {
     listen 80;
     server_name kuberunner.example.com;

     root /usr/share/nginx/html;   # frontend/dist 内容
     index index.html;

     location / {
       try_files $uri $uri/ /index.html;
     }

     location /api/    { proxy_pass http://127.0.0.1:8080; }
     location /login   { proxy_pass http://127.0.0.1:8080; }
     location /logout  { proxy_pass http://127.0.0.1:8080; }
     location /healthz { proxy_pass http://127.0.0.1:8080; }

     location /ws {
       proxy_pass http://127.0.0.1:8080;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_read_timeout 3600s;
     }
   }
   ```

## 安全建议

- 首次部署后修改默认的 `admin / admin`。
- `config.yaml` 与 `backend/kubeconfigs/` 中包含集群访问凭据，请限制文件权限（建议 0600）并确保不提交到仓库。
- Token 目前存储在服务端内存，后端重启后需要重新登录；如需多实例部署，建议改为 Redis 等共享存储。
- 生产环境请启用 HTTPS，并限制控制台的访问来源（VPN / 白名单）。
- 日志与终端会直接暴露容器能力，请按需授权与审计。

## 许可证

见 `backend/LICENSE`。
