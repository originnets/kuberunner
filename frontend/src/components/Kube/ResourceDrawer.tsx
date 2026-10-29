import {
  CopyOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Drawer,
  Empty,
  Space,
  Spin,
  Tabs,
  Tag,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import {
  getResourceDetail,
  type ResourceEndpoint,
} from '@/services/kuberunner';
import { copyText, downloadFile, toYaml } from './helpers';
import ResourceSummary from './ResourceSummary';

export interface ResourceDrawerProps {
  open: boolean;
  cluster: string;
  resource: ResourceEndpoint;
  /** 资源名称（metadata.name） */
  name?: string;
  namespace?: string;
  /** 行内数据，打开抽屉时先展示，避免等待接口时空白 */
  fallback?: KubeAPI.KubeObject;
  onClose: () => void;
}

const KIND_HINTS: Record<string, string> = {
  pod: 'Pod',
  deployment: 'Deployment',
  statefulset: 'StatefulSet',
  daemonset: 'DaemonSet',
  service: 'Service',
  ingress: 'Ingress',
  configmap: 'ConfigMap',
  secret: 'Secret',
  pvc: 'PersistentVolumeClaim',
  pv: 'PersistentVolume',
  storageclass: 'StorageClass',
  namespace: 'Namespace',
  node: 'Node',
};

const ResourceDrawer: React.FC<ResourceDrawerProps> = ({
  open,
  cluster,
  resource,
  name,
  namespace,
  fallback,
  onClose,
}) => {
  const { message } = App.useApp();
  const [detail, setDetail] = useState<KubeAPI.KubeObject | undefined>(fallback);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const load = async () => {
    if (!name) return;
    if (!resource.detail) {
      setDetail(fallback);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const data = await getResourceDetail<KubeAPI.KubeObject>(resource, {
        cluster,
        name,
        namespace,
      });
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setDetail(fallback);
    setError(undefined);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, name, namespace, cluster]);

  const yaml = useMemo(() => (detail ? toYaml(detail) : ''), [detail]);

  const handleCopy = async () => {
    await copyText(yaml);
    message.success('已复制 YAML');
  };

  const handleDownload = () => {
    if (!detail) return;
    const kind = detail.kind?.toLowerCase() ?? resource.id;
    downloadFile(`${kind}-${detail.metadata.name}.yaml`, yaml);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      destroyOnHidden
      size={900}
      title={
        <Space size={8} wrap>
          <span style={{ fontWeight: 600 }}>{name}</span>
          {detail?.kind ? <Tag color="blue">{detail.kind}</Tag> : null}
          {detail?.metadata?.namespace ? (
            <Tag>{detail.metadata.namespace}</Tag>
          ) : null}
        </Space>
      }
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>
            刷新
          </Button>
          <Button icon={<CopyOutlined />} onClick={() => void handleCopy()} />
          <Button icon={<DownloadOutlined />} onClick={handleDownload} />
        </Space>
      }
    >
      {error ? (
        <Alert
          type="error"
          showIcon
          title="加载详情失败"
          description={error}
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <Spin spinning={loading}>
        {detail ? (
          <Tabs
            defaultActiveKey="info"
            items={[
              {
                key: 'info',
                label: '概要',
                children: (
                  <ResourceSummary
                    detail={detail}
                    kindHint={KIND_HINTS[resource.id]}
                  />
                ),
              },
              {
                key: 'yaml',
                label: 'YAML',
                children: (
                  <pre
                    className="kr-code"
                    style={{ maxHeight: 'calc(100vh - 200px)' }}
                  >
                    {yaml}
                  </pre>
                ),
              },
            ]}
          />
        ) : (
          <Empty description={loading ? '加载中…' : '暂无数据'} />
        )}
      </Spin>
    </Drawer>
  );
};

export default ResourceDrawer;
