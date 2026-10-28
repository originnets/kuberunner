import { ClusterOutlined, DeploymentUnitOutlined } from '@ant-design/icons';
import { useModel } from '@umijs/max';
import { Select, Space, Typography } from 'antd';
import React, { useEffect, useState } from 'react';
import type { AppModel } from '@/models/app';
import { ENDPOINTS, listResource } from '@/services/kuberunner';
import { useClusters } from './useClusters';

const ALL_NAMESPACES = '__all__';

const NAMESPACE_CACHE_TTL = 30_000;

/** 按集群缓存命名空间，避免每次切换页面都重新请求 */
const namespaceCache = new Map<
  string,
  { names: string[]; expiresAt: number }
>();

function readNamespaceCache(cluster: string): string[] | undefined {
  const cached = namespaceCache.get(cluster);
  if (!cached) return undefined;
  if (Date.now() > cached.expiresAt) {
    namespaceCache.delete(cluster);
    return undefined;
  }
  return cached.names;
}

const ClusterSelect: React.FC = () => {
  const { cluster, setCluster } = useModel('app') as AppModel;
  const { clusters, loading } = useClusters();

  useEffect(() => {
    // 集群列表加载完成后再校验本地记忆的集群，避免使用已不存在的集群
    //（例如切换了后端配置、或浏览器里残留了旧集群名）。
    if (loading) return;
    if (!clusters.length) return;
    if (!cluster || !clusters.includes(cluster)) {
      setCluster(clusters[0]);
    }
  }, [cluster, clusters, loading, setCluster]);

  return (
    <Select
      value={cluster || undefined}
      placeholder="选择集群"
      style={{ width: 176 }}
      loading={loading}
      showSearch={{ optionFilterProp: 'label' }}
      options={clusters.map((item) => ({ label: item, value: item }))}
      onChange={(value) => setCluster(value)}
      aria-label="切换集群"
    />
  );
};

const NamespaceSelect: React.FC = () => {
  const { cluster, namespace, setNamespace } = useModel('app') as AppModel;
  const [namespaces, setNamespaces] = useState<string[]>(
    () => readNamespaceCache(cluster) ?? [],
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cluster) {
      setNamespaces([]);
      return;
    }

    const cached = readNamespaceCache(cluster);
    if (cached) {
      setNamespaces(cached);
      return;
    }

    let alive = true;
    setLoading(true);
    listResource(ENDPOINTS.namespace, { cluster, limit: 500 })
      .then((result) => {
        if (!alive) return;
        const names = result.items.map((item) => item.metadata.name).sort();
        namespaceCache.set(cluster, {
          names,
          expiresAt: Date.now() + NAMESPACE_CACHE_TTL,
        });
        setNamespaces(names);
      })
      .catch(() => {
        if (alive) setNamespaces([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [cluster]);

  useEffect(() => {
    // 命名空间列表到位后校验本地记忆值，避免使用已不存在的命名空间。
    if (loading) return;
    if (namespace && !namespaces.includes(namespace)) {
      setNamespace('');
    }
  }, [namespace, namespaces, loading, setNamespace]);

  return (
    <Select
      value={namespace || ALL_NAMESPACES}
      style={{ width: 200 }}
      loading={loading}
      showSearch={{ optionFilterProp: 'label' }}
      options={[
        { label: '全部命名空间', value: ALL_NAMESPACES },
        ...namespaces.map((item) => ({ label: item, value: item })),
      ]}
      onChange={(value) =>
        setNamespace(value === ALL_NAMESPACES ? '' : value)
      }
      aria-label="切换命名空间"
    />
  );
};

/**
 * 页面级上下文选择器：集群 + 命名空间。
 * 放在页面标题右侧，紧贴表格内容，避免在顶部右侧小按钮里翻找。
 */
export const ContextBar: React.FC = () => (
  <Space size={16} wrap className="kr-context-bar">
    <Space size={8}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        <ClusterOutlined /> 集群
      </Typography.Text>
      <ClusterSelect />
    </Space>
    <Space size={8}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        <DeploymentUnitOutlined /> 命名空间
      </Typography.Text>
      <NamespaceSelect />
    </Space>
  </Space>
);

export default ContextBar;
