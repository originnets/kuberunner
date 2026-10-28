import { request } from '@umijs/max';

export const API_PREFIX = '/api/v1/k8s';

export interface ResourceEndpoint {
  /** 资源唯一标识，用于路由与缓存 */
  id: string;
  /** 列表接口路径 */
  list: string;
  /** 详情接口路径 */
  detail?: string;
  /** 新建接口路径 */
  /** 更新（YAML）接口路径 */
  update?: string;
  /** 删除接口路径 */
  remove?: string;
  /** 重启接口路径 */
  restart?: string;
  /** 扩缩容接口路径 */
  replicas?: string;
  /** 后端接收对象名称的字段名 */
  nameKey: string;
  /** 是否属于命名空间级资源 */
  namespaced: boolean;
}

const endpoint = (
  id: string,
  nameKey: string,
  namespaced: boolean,
  extra: Partial<ResourceEndpoint> = {},
): ResourceEndpoint => ({
  id,
  nameKey,
  namespaced,
  list: `${API_PREFIX}/${id}/list`,
  detail: `${API_PREFIX}/${id}/detail`,
  ...extra,
});

export const ENDPOINTS: Record<string, ResourceEndpoint> = {
  cluster: endpoint('cluster', '', false, {
    detail: undefined,
  }),
  node: endpoint('node', 'node_name', false),
  namespace: endpoint('namespace', 'namespace_name', false, {
    update: `${API_PREFIX}/namespace/update`,
    remove: `${API_PREFIX}/namespace/delete`,
  }),
  event: endpoint('event', '', false, {}),
  pod: endpoint('pod', 'pod_name', true, {
    update: `${API_PREFIX}/pod/update`,
    remove: `${API_PREFIX}/pod/delete`,
  }),
  deployment: endpoint('deployment', 'deployment_name', true, {
    update: `${API_PREFIX}/deployment/update`,
    remove: `${API_PREFIX}/deployment/delete`,
    restart: `${API_PREFIX}/deployment/restart`,
    replicas: `${API_PREFIX}/deployment/replicas`,
  }),
  statefulset: endpoint('statefulset', 'statefulset_name', true, {
    update: `${API_PREFIX}/statefulset/update`,
    remove: `${API_PREFIX}/statefulset/delete`,
    restart: `${API_PREFIX}/statefulset/restart`,
    replicas: `${API_PREFIX}/statefulset/replicas`,
  }),
  daemonset: endpoint('daemonset', 'daemonset_name', true, {
    update: `${API_PREFIX}/daemonset/update`,
    remove: `${API_PREFIX}/daemonset/delete`,
    restart: `${API_PREFIX}/daemonset/restart`,
  }),
  service: endpoint('service', 'service_name', true, {
    update: `${API_PREFIX}/service/update`,
    remove: `${API_PREFIX}/service/delete`,
  }),
  ingress: endpoint('ingress', 'ingress_name', true, {
    update: `${API_PREFIX}/ingress/update`,
    remove: `${API_PREFIX}/ingress/delete`,
  }),
  configmap: endpoint('configmap', 'configmap_name', true, {
    update: `${API_PREFIX}/configmap/update`,
    remove: `${API_PREFIX}/configmap/delete`,
  }),
  secret: endpoint('secret', 'secret_name', true, {
    update: `${API_PREFIX}/secret/update`,
    remove: `${API_PREFIX}/secret/delete`,
  }),
  pv: endpoint('persistentvolume', 'persistentvolume_name', false, {
    update: `${API_PREFIX}/persistentvolume/update`,
    remove: `${API_PREFIX}/persistentvolume/delete`,
  }),
  pvc: endpoint('persistentvolumeclaim', 'persistent_volume_claim_name', true, {
    update: `${API_PREFIX}/persistentvolumeclaim/update`,
    remove: `${API_PREFIX}/persistentvolumeclaim/delete`,
  }),
  storageclass: endpoint('storageclass', 'storageclass_name', false, {
    update: `${API_PREFIX}/storageclass/update`,
    remove: `${API_PREFIX}/storageclass/delete`,
  }),
};

export interface ListParams {
  cluster: string;
  namespace?: string;
  filter_name?: string;
  page?: number;
  limit?: number;
}

/** 集群列表 */
export async function getClusters(): Promise<string[]> {
  const res = await request<KubeAPI.Response<string[]>>(
    `${API_PREFIX}/cluster/list`,
    { method: 'GET', skipErrorHandler: true },
  );
  return res.data ?? [];
}

/** 概览资源数量 */
export async function getResourceCount(
  cluster: string,
  refresh = false,
): Promise<KubeAPI.Response<Partial<KubeAPI.ResourceCount>>> {
  return request<KubeAPI.Response<Partial<KubeAPI.ResourceCount>>>(
    `${API_PREFIX}/resources`,
    { method: 'GET', params: { cluster, refresh } },
  );
}

/** 登录（后端为配置文件中的静态账号） */
export async function login(
  username: string,
  password: string,
): Promise<KubeAPI.LoginResult> {
  const res = await request<KubeAPI.Response<KubeAPI.LoginResult>>('/login', {
    method: 'POST',
    data: { username, password },
    skipErrorHandler: true,
  });
  return res.data;
}

/** 资源列表 */
export async function listResource<T = KubeAPI.KubeObject>(
  resource: ResourceEndpoint,
  params: ListParams,
): Promise<KubeAPI.ListResult<T>> {
  const res = await request<KubeAPI.Response<KubeAPI.ListResult<T>>>(
    resource.list,
    {
      method: 'GET',
      params: {
        cluster: params.cluster,
        namespace: resource.namespaced ? params.namespace : undefined,
        filter_name: params.filter_name,
        page: params.page ?? 1,
        limit: params.limit ?? 10,
      },
    },
  );
  return res.data ?? { items: [], total: 0 };
}

/** 资源详情 */
export async function getResourceDetail<T = KubeAPI.KubeObject>(
  resource: ResourceEndpoint,
  params: { cluster: string; name: string; namespace?: string },
): Promise<T> {
  if (!resource.detail) {
    throw new Error(`${resource.id} 不支持详情接口`);
  }
  const res = await request<KubeAPI.Response<T>>(resource.detail, {
    method: 'GET',
    params: {
      cluster: params.cluster,
      namespace: resource.namespaced ? params.namespace : undefined,
      [resource.nameKey]: params.name,
    },
  });
  return res.data;
}

/** 以 JSON 内容更新资源（后端接受 content 为 JSON 字符串） */
export async function updateResource(
  resource: ResourceEndpoint,
  params: {
    cluster: string;
    namespace?: string;
    content: string;
  },
): Promise<void> {
  if (!resource.update) {
    throw new Error(`${resource.id} 不支持更新`);
  }
  await request<KubeAPI.Response<null>>(resource.update, {
    method: 'PUT',
    data: {
      cluster: params.cluster,
      namespace: resource.namespaced ? params.namespace : undefined,
      content: params.content,
    },
  });
}

/** 删除资源 */
export async function deleteResource(
  resource: ResourceEndpoint,
  params: { cluster: string; name: string; namespace?: string },
): Promise<void> {
  if (!resource.remove) {
    throw new Error(`${resource.id} 不支持删除`);
  }
  await request<KubeAPI.Response<null>>(resource.remove, {
    method: 'DELETE',
    data: {
      cluster: params.cluster,
      namespace: resource.namespaced ? params.namespace : undefined,
      [resource.nameKey]: params.name,
    },
  });
}

/** 重启工作负载 */
export async function restartResource(
  resource: ResourceEndpoint,
  params: { cluster: string; name: string; namespace?: string },
): Promise<void> {
  if (!resource.restart) {
    throw new Error(`${resource.id} 不支持重启`);
  }
  await request<KubeAPI.Response<null>>(resource.restart, {
    method: 'POST',
    data: {
      cluster: params.cluster,
      namespace: params.namespace,
      [resource.nameKey]: params.name,
    },
  });
}

/** 扩缩容 */
export async function scaleResource(
  resource: ResourceEndpoint,
  params: {
    cluster: string;
    name: string;
    namespace?: string;
    replicas: number;
  },
): Promise<number> {
  if (!resource.replicas) {
    throw new Error(`${resource.id} 不支持扩缩容`);
  }
  const res = await request<KubeAPI.Response<number>>(resource.replicas, {
    method: 'PUT',
    data: {
      cluster: params.cluster,
      namespace: params.namespace,
      [resource.nameKey]: params.name,
      replicas: params.replicas,
    },
  });
  return res.data;
}

/** 创建资源，payload 由各页面按后端结构体组装 */
export async function createResource<T = unknown>(
  path: string,
  payload: Record<string, unknown>,
): Promise<T | null> {
  const res = await request<KubeAPI.Response<T>>(path, {
    method: 'POST',
    data: payload,
  });
  return res.data ?? null;
}

/** Pod 内的容器列表 */
export async function getPodContainers(params: {
  cluster: string;
  namespace: string;
  podName: string;
}): Promise<string[]> {
  const res = await request<KubeAPI.Response<string[]>>(
    `${API_PREFIX}/pod/container`,
    {
      method: 'GET',
      params: {
        cluster: params.cluster,
        namespace: params.namespace,
        pod_name: params.podName,
      },
    },
  );
  return res.data ?? [];
}

/** Pod 日志 */
export async function getPodLog(params: {
  cluster: string;
  namespace: string;
  podName: string;
  containerName?: string;
  tailLines?: number;
}): Promise<string> {
  const res = await request<KubeAPI.Response<string>>(
    `${API_PREFIX}/pod/log`,
    {
      method: 'GET',
      params: {
        cluster: params.cluster,
        namespace: params.namespace,
        pod_name: params.podName,
        container_name: params.containerName,
        tail_lines: params.tailLines ?? 1000,
      },
    },
  );
  return res.data ?? '';
}

/** 通用创建：content 支持完整的 Kubernetes YAML 或 JSON 对象 */
export async function applyResource(
  cluster: string,
  content: string,
): Promise<string> {
  const res = await request<KubeAPI.Response<null>>(`${API_PREFIX}/apply`, {
    method: 'POST',
    data: { cluster, content },
  });
  return res.message;
}
/** 登出（注销服务端令牌） */
export async function logout(): Promise<void> {
  await request('/logout', {
    method: 'POST',
    skipErrorHandler: true,
  }).catch(() => undefined);
}

/** 节点调度开关（cordon / uncordon） */
export async function cordonNode(params: {
  cluster: string;
  nodeName: string;
  unschedulable: boolean;
}): Promise<string> {
  const res = await request<KubeAPI.Response<null>>(`${API_PREFIX}/node/cordon`, {
    method: 'POST',
    data: {
      cluster: params.cluster,
      node_name: params.nodeName,
      unschedulable: params.unschedulable,
    },
  });
  return res.message;
}

export interface DrainResult {
  evicted: string[];
  skipped: string[];
  errors: string[];
}

/** 驱逐节点上的 Pod */
export async function drainNode(params: {
  cluster: string;
  nodeName: string;
  force?: boolean;
  ignoreDaemonsets?: boolean;
  deleteEmptyDirData?: boolean;
  timeoutSeconds?: number;
}): Promise<{ message: string; result: DrainResult }> {
  const res = await request<KubeAPI.Response<DrainResult>>(
    `${API_PREFIX}/node/drain`,
    {
      method: 'POST',
      data: {
        cluster: params.cluster,
        node_name: params.nodeName,
        force: Boolean(params.force),
        ignore_daemonsets: params.ignoreDaemonsets ?? true,
        delete_emptydir_data: Boolean(params.deleteEmptyDirData),
        timeout_seconds: params.timeoutSeconds ?? 120,
      },
    },
  );
  return { message: res.message, result: res.data };
}

export interface ClusterStatus {
  name: string;
  kube_config: string;
  version: string;
  reachable: boolean;
  error?: string;
}

/** 集群列表与连通性 */
export async function getClusterStatus(): Promise<ClusterStatus[]> {
  const res = await request<KubeAPI.Response<ClusterStatus[]>>(
    `${API_PREFIX}/cluster/status`,
    { method: 'GET' },
  );
  return res.data ?? [];
}

/** 运行时添加集群 */
export async function createCluster(
  name: string,
  kubeConfigPath: string,
): Promise<{ message: string; warnings?: string[] }> {
  const res = await request<KubeAPI.Response<null>>(
    `${API_PREFIX}/cluster/create`,
    { method: 'POST', data: { name, kube_config_path: kubeConfigPath } },
  );
  return { message: res.message, warnings: res.warnings };
}

/** 运行时移除集群 */
export async function removeCluster(
  name: string,
): Promise<{ message: string; warnings?: string[] }> {
  const res = await request<KubeAPI.Response<null>>(
    `${API_PREFIX}/cluster/delete`,
    { method: 'DELETE', data: { name } },
  );
  return { message: res.message, warnings: res.warnings };
}

export interface HealthInfo {
  status: string;
  clusters: string[];
}

/** 后端健康检查（无需登录），用于登录页展示连通性 */
export async function getHealth(): Promise<HealthInfo> {
  const res = await request<KubeAPI.Response<HealthInfo>>('/healthz', {
    method: 'GET',
    skipErrorHandler: true,
  });
  return res.data;
}