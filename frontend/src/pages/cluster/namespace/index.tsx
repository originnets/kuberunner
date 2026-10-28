import type { ProColumns } from '@ant-design/pro-components';
import { Space, Tag } from 'antd';
import React from 'react';
import ResourceTable from '@/components/Kube/ResourceTable';
import StatusTag from '@/components/Kube/StatusTag';
import { labelText } from '@/components/Kube/helpers';
import { ENDPOINTS } from '@/services/kuberunner';

const columns: ProColumns<KubeAPI.KubeObject>[] = [
  {
    title: '状态',
    dataIndex: 'phase',
    width: 110,
    search: false,
    render: (_, record) => (
      <StatusTag status={record.status?.phase ?? 'Active'} />
    ),
  },
  {
    title: '标签',
    dataIndex: 'labels',
    search: false,
    render: (_, record) => {
      const labels = record.metadata?.labels ?? {};
      const entries = Object.entries(labels).filter(
        ([key]) => !key.startsWith('kubernetes.io/metadata.name'),
      );
      if (!entries.length) return '-';
      return (
        <Space size={[4, 4]} wrap>
          {entries.slice(0, 4).map(([key, value]) => (
            <Tag key={key} style={{ marginInlineEnd: 0 }}>
              {value ? `${key}=${value}` : key}
            </Tag>
          ))}
          {entries.length > 4 ? <Tag>+{entries.length - 4}</Tag> : null}
        </Space>
      );
    },
  },
  {
    title: '标签数',
    dataIndex: 'labelCount',
    width: 90,
    search: false,
    render: (_, record) => Object.keys(record.metadata?.labels ?? {}).length,
  },
  {
    title: '标签详情',
    dataIndex: 'labelText',
    search: false,
    hidden: true,
    render: (_, record) => labelText(record.metadata?.labels),
  },
];

const NamespacePage: React.FC = () => (
  <ResourceTable
    resource={ENDPOINTS.namespace}
    title="命名空间"
    description="集群内的逻辑隔离单元，页面右上角的命名空间筛选依赖此列表。"
    columns={columns}
    createKey="namespace"
  />
);

export default NamespacePage;
