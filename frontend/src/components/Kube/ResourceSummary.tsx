import { Card, Descriptions, Space, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import React from 'react';
import {
  formatTime,
  nodeAddress,
  nodeRoles,
  podStatus,
  readyCounts,
  selectorText,
  shortImage,
} from './helpers';

type AnyRecord = Record<string, any>;

const text = (value: unknown, fallback = '-') =>
  value === undefined || value === null || value === '' ? fallback : String(value);

const tagList = (values?: string[]) =>
  values?.length ? (
    <Space size={[4, 4]} wrap>
      {values.map((item) => (
        <Tag key={item} style={{ marginInlineEnd: 0 }}>
          {item}
        </Tag>
      ))}
    </Space>
  ) : (
    '-'
  );

const kvTags = (values?: Record<string, string>) =>
  values && Object.keys(values).length ? (
    <Space size={[4, 4]} wrap>
      {Object.entries(values).map(([key, value]) => (
        <Tag key={key} style={{ marginInlineEnd: 0 }}>
          {value ? `${key}=${value}` : key}
        </Tag>
      ))}
    </Space>
  ) : (
    '-'
  );

function statusOf(detail: KubeAPI.KubeObject): string {
  switch (detail.kind) {
    case 'Pod':
      return podStatus(detail).text;
    case 'Deployment':
    case 'StatefulSet':
    case 'DaemonSet': {
      const { ready, desired } = readyCounts(detail);
      return `${ready}/${desired}`;
    }
    case 'Node': {
      const conditions = (detail.status?.conditions ?? []) as AnyRecord[];
      const ready = conditions.find((item) => item.type === 'Ready');
      return ready?.status === 'True' ? 'Ready' : 'NotReady';
    }
    default:
      return text((detail.status as AnyRecord | undefined)?.phase);
  }
}

function containerRows(containers?: AnyRecord[]) {
  return (containers ?? []).map((container) => ({
    key: container.name,
    name: container.name,
    image: container.image,
    ports: (container.ports ?? [])
      .map(
        (port: AnyRecord) =>
          `${port.containerPort}/${port.protocol ?? 'TCP'}${port.name ? ` (${port.name})` : ''}`,
      )
      .join(', '),
    resources: [
      container.resources?.requests
        ? `请求 ${Object.entries(container.resources.requests)
            .map(([key, value]) => `${key}=${value}`)
            .join(' ')}`
        : '',
      container.resources?.limits
        ? `上限 ${Object.entries(container.resources.limits)
            .map(([key, value]) => `${key}=${value}`)
            .join(' ')}`
        : '',
    ]
      .filter(Boolean)
      .join('；'),
    probe:
      [
        container.readinessProbe ? '就绪' : '',
        container.livenessProbe ? '存活' : '',
        container.startupProbe ? '启动' : '',
      ]
        .filter(Boolean)
        .join('/') || '-',
  }));
}

const containerColumns: TableColumnsType<AnyRecord> = [
  { title: '名称', dataIndex: 'name', width: 120, ellipsis: true },
  {
    title: '镜像',
    dataIndex: 'image',
    ellipsis: true,
    render: (value: string) => (
      <Typography.Text copyable={{ text: value }} style={{ fontSize: 12 }}>
        {shortImage(value)}
      </Typography.Text>
    ),
  },
  { title: '端口', dataIndex: 'ports', width: 150, ellipsis: true },
  { title: '资源', dataIndex: 'resources', ellipsis: true },
  { title: '探针', dataIndex: 'probe', width: 90 },
];

function volumeRows(volumes?: AnyRecord[], containers?: AnyRecord[]) {
  return (volumes ?? []).map((volume) => {
    const sources = Object.keys(volume).filter((key) => key !== 'name');
    const sourceKey = sources[0] ?? '';
    const sourceValue = volume[sourceKey];
    const mounts = (containers ?? []).flatMap((container) =>
      (container.volumeMounts ?? [])
        .filter((mount: AnyRecord) => mount.name === volume.name)
        .map(
          (mount: AnyRecord) =>
            `${container.name}:${mount.mountPath}${mount.readOnly ? '（只读）' : ''}`,
        ),
    );
    return {
      key: volume.name,
      name: volume.name,
      type: sourceKey || '-',
      source:
        sourceValue && typeof sourceValue === 'object'
          ? Object.entries(sourceValue)
              .map(([key, value]) => `${key}=${value}`)
              .join(', ') || '{}'
          : text(sourceValue),
      mounts: mounts.join(', ') || '-',
    };
  });
}

const volumeColumns: TableColumnsType<AnyRecord> = [
  { title: '名称', dataIndex: 'name', width: 130, ellipsis: true },
  { title: '类型', dataIndex: 'type', width: 120 },
  { title: '来源', dataIndex: 'source', ellipsis: true },
  { title: '挂载', dataIndex: 'mounts', ellipsis: true },
];

const ResourceSummary: React.FC<{ detail: KubeAPI.KubeObject }> = ({
  detail,
}) => {
  const spec = (detail.spec ?? {}) as AnyRecord;
  const metadata = (detail.metadata ?? {}) as AnyRecord;
  const status = (detail.status ?? {}) as AnyRecord;
  const kind = detail.kind ?? '';

  const podSpec = kind === 'Pod' ? spec : (spec.template?.spec as AnyRecord) ?? {};

  const basicItems = [
    { label: '名称', children: text(metadata.name) },
    ...(metadata.namespace
      ? [{ label: '命名空间', children: metadata.namespace }]
      : []),
    {
      label: '类型',
      children: `${detail.apiVersion ?? '-'} / ${kind || '-'}`,
    },
    { label: '状态', children: statusOf(detail) },
    { label: '创建时间', children: formatTime(metadata.creationTimestamp) },
    {
      label: 'UID',
      children: (
        <Typography.Text copyable style={{ fontSize: 12 }}>
          {text(metadata.uid)}
        </Typography.Text>
      ),
    },
    { label: '标签', children: kvTags(metadata.labels) },
    {
      label: '注解',
      children: text(
        metadata.annotations ? Object.keys(metadata.annotations).length : 0,
      ),
    },
  ];

  const cards: React.ReactNode[] = [];

  if (kind === 'Pod') {
    cards.push(
      <Card key="containers" size="small" title="容器">
        <Table
          rowKey="name"
          size="small"
          pagination={false}
          columns={containerColumns}
          dataSource={containerRows(spec.containers)}
        />
      </Card>,
      <Card key="volumes" size="small" title="存储卷">
        <Table
          rowKey="name"
          size="small"
          pagination={false}
          columns={volumeColumns}
          dataSource={volumeRows(spec.volumes, spec.containers)}
        />
      </Card>,
    );
    const conditions = (status.conditions ?? []) as AnyRecord[];
    if (conditions.length) {
      cards.push(
        <Card key="conditions" size="small" title="状态条件">
          <Table
            rowKey={(row) => `${row.type}-${row.lastTransitionTime}`}
            size="small"
            pagination={false}
            dataSource={conditions}
            columns={[
              { title: '类型', dataIndex: 'type', width: 140 },
              {
                title: '状态',
                dataIndex: 'status',
                width: 90,
                render: (value: string) => (
                  <Tag color={value === 'True' ? 'success' : 'default'}>
                    {value}
                  </Tag>
                ),
              },
              { title: '原因', dataIndex: 'reason' },
              { title: '时间', dataIndex: 'lastTransitionTime' },
            ]}
          />
        </Card>,
      );
    }
  }

  if (['Deployment', 'StatefulSet', 'DaemonSet'].includes(kind)) {
    cards.push(
      <Card key="workload" size="small" title="工作负载配置">
        <Descriptions
          column={2}
          size="small"
          items={[
            { label: '期望副本', children: text(spec.replicas) },
            { label: '就绪副本', children: text(status.readyReplicas, '0') },
            { label: '选择器', children: text(selectorText(spec.selector?.matchLabels)) },
            { label: 'ServiceAccount', children: text(podSpec.serviceAccountName, 'default') },
            {
              label: '更新策略',
              children: text(
                spec.strategy?.type ?? spec.updateStrategy?.type,
                kind === 'StatefulSet' ? spec.podManagementPolicy : 'RollingUpdate',
              ),
            },
            {
              label: '节点选择器',
              children: text(selectorText(podSpec.nodeSelector)),
            },
            { label: 'Pod 管理', children: text(spec.podManagementPolicy) },
            { label: '服务名', children: text(spec.serviceName) },
          ]}
        />
      </Card>,
      <Card key="containers" size="small" title="容器">
        <Table
          rowKey="name"
          size="small"
          pagination={false}
          columns={containerColumns}
          dataSource={containerRows(podSpec.containers)}
        />
      </Card>,
      <Card key="volumes" size="small" title="存储卷">
        <Table
          rowKey="name"
          size="small"
          pagination={false}
          columns={volumeColumns}
          dataSource={volumeRows(podSpec.volumes, podSpec.containers)}
        />
      </Card>,
    );
  }

  if (kind === 'Service') {
    cards.push(
      <Card key="service" size="small" title="服务配置">
        <Descriptions
          column={2}
          size="small"
          items={[
            { label: '类型', children: text(spec.type, 'ClusterIP') },
            { label: 'ClusterIP', children: text(spec.clusterIP) },
            { label: '会话保持', children: text(spec.sessionAffinity, 'None') },
            { label: '选择器', children: kvTags(spec.selector) },
          ]}
        />
      </Card>,
      <Card key="ports" size="small" title="端口">
        <Table
          rowKey={(row) => `${row.name}-${row.port}`}
          size="small"
          pagination={false}
          dataSource={(spec.ports ?? []) as AnyRecord[]}
          columns={[
            { title: '名称', dataIndex: 'name', width: 110, render: (v: string) => text(v) },
            { title: '端口', dataIndex: 'port', width: 90 },
            { title: '目标端口', dataIndex: 'targetPort', width: 100 },
            { title: '协议', dataIndex: 'protocol', width: 80 },
            { title: 'NodePort', dataIndex: 'nodePort', render: (v: unknown) => text(v) },
          ]}
        />
      </Card>,
    );
  }

  if (kind === 'Ingress') {
    const rules = (spec.rules ?? []) as AnyRecord[];
    const pathRows = rules.flatMap((rule) =>
      ((rule.http?.paths ?? []) as AnyRecord[]).map((path) => ({
        key: `${rule.host}-${path.path}`,
        host: rule.host || '*',
        path: path.path,
        pathType: path.pathType,
        service: path.backend?.service?.name,
        port: path.backend?.service?.port?.number ?? path.backend?.service?.port?.name,
      })),
    );
    cards.push(
      <Card key="rules" size="small" title="路由规则">
        <Table
          rowKey="key"
          size="small"
          pagination={false}
          dataSource={pathRows}
          columns={[
            { title: '域名', dataIndex: 'host' },
            { title: '路径', dataIndex: 'path', width: 120 },
            { title: '匹配', dataIndex: 'pathType', width: 90 },
            { title: '后端服务', dataIndex: 'service' },
            { title: '端口', dataIndex: 'port', width: 80 },
          ]}
        />
      </Card>,
    );
    if ((spec.tls ?? []).length) {
      cards.push(
        <Card key="tls" size="small" title="TLS">
          <Table
            rowKey={(row) => row.secretName}
            size="small"
            pagination={false}
            dataSource={spec.tls as AnyRecord[]}
            columns={[
              { title: 'Secret', dataIndex: 'secretName' },
              {
                title: '域名',
                dataIndex: 'hosts',
                render: (value: string[]) => tagList(value),
              },
            ]}
          />
        </Card>,
      );
    }
  }

  if (kind === 'ConfigMap' || kind === 'Secret') {
    const data = ((detail as AnyRecord).data ?? {}) as Record<string, string>;
    const rows = Object.entries(data).map(([key, value]) => ({
      key,
      keyName: key,
      size: kind === 'Secret' ? `${value.length} B（Base64）` : '-',
      value,
    }));
    cards.push(
      <Card key="data" size="small" title={kind === 'Secret' ? '数据（已隐藏）' : '数据'}>
        <Table
          rowKey="key"
          size="small"
          pagination={false}
          dataSource={rows}
          columns={[
            { title: '键', dataIndex: 'keyName', width: 180, ellipsis: true },
            kind === 'Secret'
              ? { title: '长度', dataIndex: 'size' }
              : {
                  title: '值',
                  dataIndex: 'value',
                  render: (value: string) => (
                    <Typography.Text
                      style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}
                      ellipsis={{ tooltip: value }}
                    >
                      {value}
                    </Typography.Text>
                  ),
                },
          ]}
        />
      </Card>,
    );
  }

  if (kind === 'PersistentVolumeClaim' || kind === 'PersistentVolume') {
    cards.push(
      <Card key="storage" size="small" title="容量与存储">
        <Descriptions
          column={2}
          size="small"
          items={[
            {
              label: '容量',
              children: text(
                spec.resources?.requests?.storage ?? spec.capacity?.storage,
              ),
            },
            { label: 'StorageClass', children: text(spec.storageClassName) },
            {
              label: '访问模式',
              children: tagList((spec.accessModes ?? []) as string[]),
            },
            {
              label: '卷模式',
              children: text(spec.volumeMode, 'Filesystem'),
            },
            {
              label: '回收策略',
              children: text(spec.persistentVolumeReclaimPolicy),
            },
            { label: '状态', children: text(status.phase) },
            {
              label: '绑定声明',
              children: text(
                spec.claimRef
                  ? `${spec.claimRef.namespace}/${spec.claimRef.name}`
                  : undefined,
              ),
            },
            {
              label: '挂载选项',
              children: text((spec.mountOptions ?? []).join(', ')),
            },
          ]}
        />
      </Card>,
    );
  }

  if (kind === 'StorageClass') {
    const parameters = ((detail as AnyRecord).parameters ?? {}) as Record<
      string,
      string
    >;
    cards.push(
      <Card key="sc" size="small" title="存储类配置">
        <Descriptions
          column={2}
          size="small"
          items={[
            { label: 'Provisioner', children: text((detail as AnyRecord).provisioner) },
            { label: '回收策略', children: text((detail as AnyRecord).reclaimPolicy) },
            { label: '绑定模式', children: text((detail as AnyRecord).volumeBindingMode) },
            {
              label: '允许扩容',
              children: (detail as AnyRecord).allowVolumeExpansion ? '是' : '否',
            },
          ]}
        />
      </Card>,
    );
    if (Object.keys(parameters).length) {
      cards.push(
        <Card key="params" size="small" title="参数">
          <Table
            rowKey="key"
            size="small"
            pagination={false}
            dataSource={Object.entries(parameters).map(([key, value]) => ({
              key,
              keyName: key,
              value,
            }))}
            columns={[
              { title: '键', dataIndex: 'keyName', width: 220 },
              { title: '值', dataIndex: 'value' },
            ]}
          />
        </Card>,
      );
    }
  }

  if (kind === 'Node') {
    const capacity = (status.capacity ?? {}) as Record<string, string>;
    const allocatable = (status.allocatable ?? {}) as Record<string, string>;
    const keys = Array.from(
      new Set([...Object.keys(capacity), ...Object.keys(allocatable)]),
    );
    cards.push(
      <Card key="node" size="small" title="节点信息">
        <Descriptions
          column={2}
          size="small"
          items={[
            {
              label: '状态',
              children: (
                <Tag color={statusOf(detail) === 'Ready' ? 'success' : 'error'}>
                  {statusOf(detail)}
                </Tag>
              ),
            },
            { label: '角色', children: text(nodeRoles(detail)) },
            { label: '内网 IP', children: text(nodeAddress(detail)) },
            { label: 'Kubelet', children: text(status.nodeInfo?.kubeletVersion) },
            { label: '操作系统', children: text(status.nodeInfo?.osImage) },
            {
              label: '容器运行时',
              children: text(status.nodeInfo?.containerRuntimeVersion),
            },
          ]}
        />
      </Card>,
      <Card key="capacity" size="small" title="容量">
        <Table
          rowKey="keyName"
          size="small"
          pagination={false}
          dataSource={keys.map((key) => ({
            keyName: key,
            capacity: capacity[key] ?? '-',
            allocatable: allocatable[key] ?? '-',
          }))}
          columns={[
            { title: '资源', dataIndex: 'keyName' },
            { title: '容量', dataIndex: 'capacity' },
            { title: '可分配', dataIndex: 'allocatable' },
          ]}
        />
      </Card>,
    );
  }

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small" title="基本信息">
        <Descriptions column={2} size="small" items={basicItems} />
      </Card>
      {cards}
    </Space>
  );
};

export default ResourceSummary;
