import {
  CopyOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Form,
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
import { toFormValues } from './create/editHelpers';
import ResourceFormFields from './create/ResourceFormFields';
import { toCreateKind } from './create/templates';
import {
  copyText,
  downloadFile,
  formatTime,
  nodeAddress,
  shortImage,
  toYaml,
} from './helpers';

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

const keyValueText = (value?: Record<string, string>) =>
  Object.entries(value ?? {})
    .map(([key, item]) => `${key}=${item}`)
    .join(', ');

/** 依据资源类型补充便于阅读的规格信息 */
function extraSummaryItems(
  detail: KubeAPI.KubeObject,
): { label: string; children: React.ReactNode }[] {
  const spec = detail.spec as Record<string, any> | undefined;
  const status = detail.status as Record<string, any> | undefined;
  const kind = detail.kind ?? '';

  const images = (value: any) =>
    (value ?? [])
      .map((item: any) => shortImage(item.image))
      .filter(Boolean)
      .join(', ') || '-';

  switch (kind) {
    case 'Pod':
      return [
        { label: '状态', children: status?.phase ?? '-' },
        { label: '节点', children: spec?.nodeName ?? '-' },
        { label: 'Pod IP', children: status?.podIP ?? '-' },
        { label: '镜像', children: images(spec?.containers) },
      ];
    case 'Deployment':
    case 'StatefulSet':
    case 'DaemonSet':
      return [
        {
          label: '副本',
          children: `${status?.readyReplicas ?? 0} / ${
            spec?.replicas ?? status?.desiredNumberScheduled ?? '-'
          }`,
        },
        { label: '镜像', children: images(spec?.template?.spec?.containers) },
        {
          label: '选择器',
          children: keyValueText(spec?.selector?.matchLabels) || '-',
        },
      ];
    case 'Service':
      return [
        { label: '类型', children: spec?.type ?? 'ClusterIP' },
        { label: 'ClusterIP', children: spec?.clusterIP ?? '-' },
        {
          label: '端口',
          children:
            (spec?.ports ?? [])
              .map(
                (port: any) =>
                  `${port.port}${port.nodePort ? `:${port.nodePort}` : ''} → ${port.targetPort ?? port.port}/${port.protocol ?? 'TCP'}`,
              )
              .join(', ') || '-',
        },
        { label: '选择器', children: keyValueText(spec?.selector) || '-' },
      ];
    case 'Ingress':
      return [
        { label: 'IngressClass', children: spec?.ingressClassName ?? '-' },
        {
          label: '域名',
          children:
            (spec?.rules ?? [])
              .map((rule: any) => rule.host)
              .filter(Boolean)
              .join(', ') || '-',
        },
        {
          label: 'TLS',
          children:
            (spec?.tls ?? [])
              .map((item: any) => item.secretName)
              .filter(Boolean)
              .join(', ') || '-',
        },
      ];
    case 'ConfigMap': {
      const keys = Object.keys((detail as any).data ?? {});
      return [
        { label: '键数量', children: keys.length },
        { label: '键', children: keys.join(', ') || '-' },
      ];
    }
    case 'Secret': {
      const keys = Object.keys((detail as any).data ?? {});
      return [
        { label: '类型', children: (detail as any).type ?? 'Opaque' },
        { label: '键数量', children: keys.length },
        { label: '键', children: keys.join(', ') || '-' },
      ];
    }
    case 'PersistentVolumeClaim':
    case 'PersistentVolume':
      return [
        {
          label: '容量',
          children: spec?.resources?.requests?.storage ?? spec?.capacity?.storage ?? '-',
        },
        { label: 'StorageClass', children: spec?.storageClassName ?? '-' },
        {
          label: '访问模式',
          children: (spec?.accessModes ?? []).join(', ') || '-',
        },
        { label: '状态', children: status?.phase ?? '-' },
      ];
    case 'StorageClass':
      return [
        { label: 'Provisioner', children: (detail as any).provisioner ?? '-' },
        { label: '回收策略', children: (detail as any).reclaimPolicy ?? '-' },
        {
          label: '绑定模式',
          children: (detail as any).volumeBindingMode ?? '-',
        },
        {
          label: '允许扩容',
          children: (detail as any).allowVolumeExpansion ? '是' : '否',
        },
      ];
    case 'Namespace':
      return [{ label: '状态', children: status?.phase ?? '-' }];
    case 'Node':
      return [
        {
          label: '状态',
          children:
            (status?.conditions ?? []).find((item: any) => item.type === 'Ready')
              ?.status === 'True'
              ? 'Ready'
              : 'NotReady',
        },
        { label: '版本', children: status?.nodeInfo?.kubeletVersion ?? '-' },
        { label: '内网 IP', children: nodeAddress(detail) },
        { label: 'CPU', children: status?.capacity?.cpu ?? '-' },
        { label: '内存', children: status?.capacity?.memory ?? '-' },
      ];
    default:
      return [];
  }
}

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

  const formKind = useMemo(() => toCreateKind(resource.id), [resource.id]);

  const formValues = useMemo(
    () => (detail && formKind ? toFormValues(formKind, detail) : {}),
    [detail, formKind],
  );

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

  const infoItems = detail
    ? [
        { label: '名称', children: detail.metadata?.name ?? '-' },
        { label: '命名空间', children: detail.metadata?.namespace ?? '-' },
        {
          label: '类型',
          children: `${detail.apiVersion ?? '-'} / ${detail.kind ?? resource.id}`,
        },
        ...extraSummaryItems(detail),
        {
          label: '创建时间',
          children: formatTime(detail.metadata?.creationTimestamp),
        },
        {
          label: 'UID',
          children: (
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {detail.metadata?.uid ?? '-'}
            </span>
          ),
        },
        {
          label: '标签',
          children: detail.metadata?.labels ? (
            <Space size={[4, 4]} wrap>
              {Object.entries(detail.metadata.labels).map(([key, value]) => (
                <Tag key={key} style={{ marginInlineEnd: 0 }}>
                  {value ? `${key}=${value}` : key}
                </Tag>
              ))}
            </Space>
          ) : (
            '-'
          ),
        },
        {
          label: '注解',
          children: detail.metadata?.annotations
            ? Object.keys(detail.metadata.annotations).length
            : 0,
        },
      ]
    : [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      destroyOnHidden
      size={760}
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
                  <Descriptions
                    column={1}
                    size="small"
                    bordered
                    items={infoItems}
                  />
                ),
              },
              {
                key: 'form',
                label: '表单',
                children: formKind ? (
                  <Form
                    key={detail.metadata?.uid ?? name}
                    layout="vertical"
                    disabled
                    initialValues={formValues}
                    preserve={false}
                  >
                    <ResourceFormFields
                      kind={formKind}
                      namespace={detail.metadata?.namespace}
                      editing
                    />
                  </Form>
                ) : (
                  <Empty description="该资源暂不支持表单展示" />
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
