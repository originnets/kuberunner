import dayjs from 'dayjs';
import { parse as parseYamlText, stringify as stringifyYaml } from 'yaml';

/** 资源对象创建时长：3d / 5h / 12m / 30s */
export function age(timestamp?: string): string {
  if (!timestamp) return '-';
  const created = dayjs(timestamp);
  if (!created.isValid()) return '-';

  const seconds = Math.max(0, dayjs().diff(created, 'second'));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 365) return `${days}d`;
  return `${Math.floor(days / 365)}y`;
}

/** 完整时间 */
export function formatTime(timestamp?: string): string {
  if (!timestamp) return '-';
  const time = dayjs(timestamp);
  return time.isValid() ? time.format('YYYY-MM-DD HH:mm:ss') : '-';
}

/** 相对时间（中文），用于事件列表 */
export function fromNow(timestamp?: string): string {
  if (!timestamp) return '-';
  const time = dayjs(timestamp);
  return time.isValid() ? time.fromNow() : '-';
}

/** 字节数转可读大小 */
export function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return '-';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}

/** Kubernetes 资源值（如 "2Gi"、"500m"）原样展示，缺失时返回 "-" */
export function quantity(value?: string): string {
  return value ? String(value) : '-';
}

interface StatusMeta {
  text: string;
  color: string;
}

const STATUS_COLORS: Record<string, string> = {
  Running: 'success',
  Succeeded: 'processing',
  Completed: 'processing',
  Bound: 'success',
  Ready: 'success',
  Active: 'success',
  Available: 'success',
  Healthy: 'success',
  Pending: 'warning',
  ContainerCreating: 'warning',
  PodInitializing: 'warning',
  Terminating: 'warning',
  Released: 'warning',
  ContainerStatusUnknown: 'warning',
  Unknown: 'default',
  Failed: 'error',
  Error: 'error',
  CrashLoopBackOff: 'error',
  ImagePullBackOff: 'error',
  ErrImagePull: 'error',
  CreateContainerError: 'error',
  NotReady: 'error',
  Lost: 'error',
  Evicted: 'error',
  OOMKilled: 'error',
  CompletedWithError: 'error',
};

export function statusColor(status?: string): string {
  if (!status) return 'default';
  return STATUS_COLORS[status] ?? 'default';
}

/** Pod 状态：优先展示容器的等待 / 终止原因，其次才是 phase */
export function podStatus(pod: KubeAPI.KubeObject): StatusMeta {
  if (pod.metadata?.deletionTimestamp) {
    return { text: 'Terminating', color: STATUS_COLORS.Terminating };
  }

  const statuses: KubeAPI.ContainerStatus[] =
    pod.status?.containerStatuses ?? [];

  const waiting = statuses.find((item) => item.state?.waiting?.reason);
  if (waiting?.state?.waiting?.reason) {
    return {
      text: waiting.state.waiting.reason,
      color: statusColor(waiting.state.waiting.reason),
    };
  }

  const terminated = statuses.find(
    (item) =>
      item.state?.terminated?.reason &&
      item.state.terminated.reason !== 'Completed',
  );
  if (terminated?.state?.terminated?.reason) {
    return {
      text: terminated.state.terminated.reason,
      color: statusColor(terminated.state.terminated.reason),
    };
  }

  const phase = pod.status?.phase ?? 'Unknown';
  return { text: phase, color: statusColor(phase) };
}

/** 就绪容器数 / 容器总数 */
export function podReady(pod: KubeAPI.KubeObject): string {
  const statuses: KubeAPI.ContainerStatus[] =
    pod.status?.containerStatuses ?? [];
  const total = statuses.length || pod.spec?.containers?.length || 0;
  const ready = statuses.filter((item) => item.ready).length;
  return `${ready}/${total}`;
}

/** 容器重启次数合计 */
export function podRestarts(pod: KubeAPI.KubeObject): number {
  const statuses: KubeAPI.ContainerStatus[] =
    pod.status?.containerStatuses ?? [];
  return statuses.reduce((sum, item) => sum + (item.restartCount ?? 0), 0);
}

/** 工作负载就绪副本数 */
export function readyCounts(workload: KubeAPI.KubeObject): {
  ready: number;
  desired: number;
} {
  const desired = Number(
    workload.spec?.replicas ?? workload.status?.desiredNumberScheduled ?? 0,
  );
  const ready = Number(
    workload.status?.readyReplicas ?? workload.status?.numberReady ?? 0,
  );
  return { ready, desired };
}

/** 工作负载就绪副本，如 2/3 */
export function readyReplicas(workload: KubeAPI.KubeObject): string {
  const { ready, desired } = readyCounts(workload);
  return `${ready}/${desired}`;
}

/** Service 端口，如 80:30080/TCP */
export function servicePorts(service: KubeAPI.KubeObject): string {
  const ports: { port?: number; nodePort?: number; protocol?: string }[] =
    service.spec?.ports ?? [];
  if (!ports.length) return '-';
  return ports
    .map((port) => {
      const base = port.nodePort ? `${port.port}:${port.nodePort}` : `${port.port}`;
      return `${base}/${port.protocol ?? 'TCP'}`;
    })
    .join(', ');
}

/** Service / Pod 标签选择器 */
export function selectorText(selector?: Record<string, string>): string {
  if (!selector || !Object.keys(selector).length) return '-';
  return Object.entries(selector)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
}

/** 标签转文本 */
export function labelText(labels?: Record<string, string>): string {
  if (!labels) return '-';
  const entries = Object.entries(labels);
  if (!entries.length) return '-';
  return entries.map(([key, value]) => `${key}=${value}`).join(', ');
}

/** 节点角色 */
export function nodeRoles(node: KubeAPI.KubeObject): string {
  const labels: Record<string, string> = node.metadata?.labels ?? {};
  const roles = Object.keys(labels)
    .filter((key) => key.startsWith('node-role.kubernetes.io/'))
    .map((key) => key.replace('node-role.kubernetes.io/', ''))
    .filter(Boolean);
  return roles.length ? roles.join(', ') : 'worker';
}

/** 节点地址 */
export function nodeAddress(node: KubeAPI.KubeObject): string {
  const addresses: { type: string; address: string }[] =
    node.status?.addresses ?? [];
  return (
    addresses.find((item) => item.type === 'InternalIP')?.address ??
    addresses[0]?.address ??
    '-'
  );
}

/** 容器镜像短名 */
export function shortImage(image?: string): string {
  if (!image) return '-';
  const withoutRegistry = image.split('/').pop() ?? image;
  return withoutImageDigest(withoutRegistry);
}

function withoutImageDigest(image: string): string {
  const at = image.indexOf('@');
  return at === -1 ? image : image.slice(0, at);
}

/** 解析 `k=v,k2=v2` 形式的标签输入 */
export function parseKeyValueInput(text?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!text) return result;
  text
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const index = item.indexOf('=');
      if (index > 0) {
        const key = item.slice(0, index).trim();
        const value = item.slice(index + 1).trim();
        if (key) result[key] = value;
      } else {
        result[item] = '';
      }
    });
  return result;
}

/** 解析每行一个 key=value 的文本，用于 ConfigMap / Secret */
export function parseLinesInput(text?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!text) return result;
  text.split('\n').forEach((line) => {
    if (!line.trim() || line.trimStart().startsWith('#')) return;
    const index = line.indexOf('=');
    if (index > 0) {
      result[line.slice(0, index).trim()] = line.slice(index + 1);
    }
  });
  return result;
}

/**
 * 递归去掉 YAML 中的空值（null/undefined、空对象、空数组），
 * 保留 0、false 和空字符串等有意义的值。
 */
export function pruneEmptyValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => pruneEmptyValues(item))
      .filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const pruned = pruneEmptyValues(item);
      if (pruned !== undefined) {
        result[key] = pruned;
      } else if (key === 'emptyDir') {
        // emptyDir 通过空对象表达“空目录卷”，不能省略
        result[key] = {};
      }
    }
    return Object.keys(result).length ? result : undefined;
  }

  if (value === null || value === undefined) {
    return undefined;
  }

  return value;
}

/** 对象转 YAML 文本（过滤空值，便于阅读与编辑） */
export function toYaml(value: unknown): string {
  return stringifyYaml(pruneEmptyValues(value) ?? {}, { lineWidth: 0 });
}

/** YAML 文本转对象，失败时抛出带行号的错误信息 */
export function fromYaml(text: string): unknown {
  try {
    return parseYamlText(text);
  } catch (error) {
    throw new Error(
      `YAML 解析失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** 触发浏览器下载 */
export function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** 复制文本到剪贴板 */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

/** 状态对应的 antd Badge 状态 */
export function statusBadge(
  status?: string,
): 'success' | 'processing' | 'warning' | 'error' | 'default' {
  const color = statusColor(status);
  switch (color) {
    case 'success':
      return 'success';
    case 'processing':
      return 'processing';
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'default';
  }
}