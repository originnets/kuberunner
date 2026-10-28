import type { ProColumns } from '@ant-design/pro-components';
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
    dataIndex: 'storage',
    width: 100,
    search: false,
    render: (_, record) =>
      record.status?.capacity?.storage ??
      record.spec?.resources?.requests?.storage ??
      '-',
  },
  {
    title: '访问模式',
    dataIndex: 'accessModes',
    width: 150,
    search: false,
    render: (_, record) => (record.spec?.accessModes ?? []).join(', ') || '-',
  },
  {
    title: 'StorageClass',
    dataIndex: 'storageClassName',
    width: 160,
    search: false,
    render: (_, record) => record.spec?.storageClassName ?? '-',
  },
  {
    title: '绑定的 PV',
    dataIndex: 'volumeName',
    width: 220,
    search: false,
    render: (_, record) => record.spec?.volumeName ?? '-',
  },
];

const PersistentVolumeClaimPage: React.FC = () => (
  <ResourceTable
    resource={ENDPOINTS.pvc}
    title="PersistentVolumeClaim"
    description="为 Pod 申请持久化存储，由 StorageClass 动态供给或绑定已有 PV。"
    columns={columns}
    createKey="pvc"
  />
);

export default PersistentVolumeClaimPage;
