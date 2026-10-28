/**
 * KubeRunner 后端返回的数据结构。
 * 后端直接透传 Kubernetes 原生对象（JSON），这里只声明前端真正用到的字段，
 * 其余字段通过索引签名保留，方便 YAML 展示与编辑。
 */
declare namespace KubeAPI {
  type Labels = Record<string, string>;

  interface Metadata {
    name: string;
    namespace?: string;
    uid?: string;
    creationTimestamp?: string;
    deletionTimestamp?: string;
    labels?: Labels;
    annotations?: Labels;
    resourceVersion?: string;
    generation?: number;
    ownerReferences?: { kind: string; name: string }[];
  }

  interface ContainerPort {
    name?: string;
    containerPort: number;
    protocol?: string;
  }

  interface Container {
    name: string;
    image?: string;
    ports?: ContainerPort[];
    resources?: {
      limits?: Record<string, string>;
      requests?: Record<string, string>;
    };
  }

  interface ContainerStatus {
    name: string;
    ready: boolean;
    restartCount: number;
    image?: string;
    state?: {
      running?: { startedAt?: string };
      waiting?: { reason?: string; message?: string };
      terminated?: { reason?: string; exitCode?: number };
    };
  }

  interface KubeObject {
    apiVersion?: string;
    kind?: string;
    metadata: Metadata;
    spec?: any;
    status?: any;
    data?: Record<string, string>;
    stringData?: Record<string, string>;
    type?: string;
    [key: string]: any;
  }

  interface ListResult<T = KubeObject> {
    items: T[];
    total: number;
  }

  interface Response<T> {
    message: string;
    data: T;
    warnings?: string[];
  }

  interface LoginResult {
    username: string;
    token: string;
    expires_at: number;
  }

  interface ResourceCount {
    Nodes: number;
    Pods: number;
    Services: number;
    Ingress: number;
    PersistentVolumes: number;
    PersistentVolumeClaims: number;
    ConfigMaps: number;
    Secrets: number;
    DaemonSets: number;
    StatefulSets: number;
    StorageClasses: number;
    Deployments: number;
    [key: string]: number;
  }
}
