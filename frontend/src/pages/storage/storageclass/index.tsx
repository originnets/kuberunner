import type { ProColumns } from '@ant-design/pro-components';
import { Tag } from 'antd';
import React from 'react';
import ResourceTable from '@/components/Kube/ResourceTable';
import { ENDPOINTS } from '@/services/kuberunner';

const columns: ProColumns<KubeAPI.KubeObject>[] = [
  {
    title: 'Provisioner',
    dataIndex: 'provisioner',
    width: 260,
    search: false,
    render: (_, record) => record.provisioner ?? '-',
  },
  {
    title: '回收策略',
    dataIndex: 'reclaimPolicy',
    width: 120,
    search: false,
    render: (_, record) => record.reclaimPolicy ?? 'Delete',
  },
  {
    title: '绑定模式',
    dataIndex: 'volumeBindingMode',
    width: 150,
    search: false,
    render: (_, record) => record.volumeBindingMode ?? 'Immediate',
  },
  {
    title: '允许扩容',
    dataIndex: 'allowVolumeExpansion',
    width: 110,
    search: false,
    render: (_, record) =>
      record.allowVolumeExpansion ? <Tag color="green">是</Tag> : <Tag>否</Tag>,
  },
  {
    title: '默认',
    dataIndex: 'default',
    width: 80,
    search: false,
    render: (_, record) =>
      record.metadata?.annotations?.[
        'storageclass.kubernetes.io/is-default-class'
      ] === 'true' ? (
        <Tag color="blue">默认</Tag>
      ) : (
        '-'
      ),
  },
];

const StorageClassPage: React.FC = () => (
  <ResourceTable
    resource={ENDPOINTS.storageclass}
    title="StorageClass"
    description="定义存储类型与供给策略，供 PVC 动态创建 PV。"
    columns={columns}
    createKey="storageclass"
  />
);

export default StorageClassPage;
