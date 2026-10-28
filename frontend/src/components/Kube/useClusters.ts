import { useCallback, useEffect, useState } from 'react';
import { getClusters } from '@/services/kuberunner';

let cache: string[] | null = null;
let inflight: Promise<string[]> | null = null;

async function loadClusters(force = false): Promise<string[]> {
  if (cache && !force) return cache;

  if (!inflight) {
    inflight = getClusters().catch(() => [] as string[]);
  }
  try {
    const result = await inflight;
    cache = result;
    return result;
  } finally {
    inflight = null;
  }
}

/**
 * 集群列表（带模块级缓存，避免每个页面重复请求）。
 */
export function useClusters() {
  const [clusters, setClusters] = useState<string[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);

  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    try {
      setClusters(await loadClusters(force));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { clusters, loading, refresh };
}

/** 清空集群列表缓存（增删集群后调用） */
export function invalidateClusters() {
  cache = null;
}