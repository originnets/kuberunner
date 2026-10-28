import { useState } from 'react';

const CLUSTER_KEY = 'kuberunner.cluster';
const NAMESPACE_KEY = 'kuberunner.namespace';

export interface AppModel {
  /** 当前集群 */
  cluster: string;
  /** 当前命名空间，空字符串表示全部命名空间 */
  namespace: string;
  setCluster: (value: string) => void;
  setNamespace: (value: string) => void;
}

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function write(key: string, value: string) {
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // localStorage 不可用时静默降级为内存状态
  }
}

/**
 * 全局集群 / 命名空间上下文。
 * 选择结果持久化到 localStorage，刷新页面后保持当前视图。
 */
export default function useAppModel(): AppModel {
  const [cluster, setClusterState] = useState<string>(() => read(CLUSTER_KEY));
  const [namespace, setNamespaceState] = useState<string>(() =>
    read(NAMESPACE_KEY),
  );

  const setCluster = (value: string) => {
    write(CLUSTER_KEY, value);
    setClusterState(value);
  };

  const setNamespace = (value: string) => {
    write(NAMESPACE_KEY, value);
    setNamespaceState(value);
  };

  return { cluster, namespace, setCluster, setNamespace };
}
