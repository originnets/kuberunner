import type { ProColumns } from '@ant-design/pro-components';
import { Space, Tag } from 'antd';
import React from 'react';
import ResourceTable from '@/components/Kube/ResourceTable';
import StatusTag from '@/components/Kube/StatusTag';
import { ENDPOINTS } from '@/services/kuberunner';

const columns: ProColumns<KubeAPI.KubeObject>[] = [
  {
    title: '状态',
    dataIndex: 'phase',
    width: 110,
    search: false,
    render: (_, record) => (
      <StatusTag status={record.status?.phase ?? 'Unknown'} />
    ),
  },
  {
    title: '容量',
    dataIndex: 'capacity',
    width: 100,
    search: false,
    render: (_, record) => record.spec?.capacity?.storage ?? '-',
  },
  {
    title: '访问模式',
    dataIndex: 'accessModes',
    width: 150,
    search: false,
    render: (_, record) => (record.spec?.accessModes ?? []).join(', ') || '-',
  },
  {
    title: '回收策略',
    dataIndex: 'reclaimPolicy',
    width: 110,
    search: false,
    render: (_, record) => record.spec?.persistentVolumeReclaimPolicy ?? '-',
  },
  {
    title: 'StorageClass',
    dataIndex: 'storageClassName',
    width: 160,
    search: false,
    render: (_, record) => record.spec?.storageClassName ?? '-',
  },
  {
    title: '存储源',
    dataIndex: 'source',
    width: 220,
    search: false,
    render: (_, record) => {
      const spec = record.spec ?? {};
      for (const key of ['nfs', 'hostPath', 'local', 'cephfs', 'rbd', 'csi']) {
        const source = spec[key];
        if (!source) continue;
        if (key === 'nfs') return `NFS ${source.server}:${source.path}`;
        if (key === 'hostPath') return `HostPath ${source.path}`;
        if (key === 'local') return `Local ${source.path}`;
        if (key === 'csi') return `CSI ${source.driver}`;
        if (key === 'rbd') return `RBD ${source.pool}/${source.image}`;
        return `${key} ${source.path ?? ''}`;
      }
      return '-';
    },
  },
  {
    title: '绑定的 PVC',
    dataIndex: 'claim',
    width: 220,
    search: false,
    render: (_, record) => {
      const claim = record.spec?.claimRef;
      if (!claim) return '-';
      return (
        <Space size={4}>
          <Tag>{claim.namespace ?? '-'}</Tag>
          {claim.name ?? '-'}
        </Space>
      );
    },
  },
];

const PersistentVolumePage: React.FC = () => (
  <ResourceTable
    resource={ENDPOINTS.pv}
    title="PersistentVolume"
    description="集群级存储卷，可由 StorageClass 动态创建，也可以手工绑定。"
    columns={columns}
    createKey="pv"
  />
);

export default PersistentVolumePage;
