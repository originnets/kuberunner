import type { ProColumns } from '@ant-design/pro-components';
import { Tag } from 'antd';
import React from 'react';
import ResourceTable from '@/components/Kube/ResourceTable';
import { ENDPOINTS } from '@/services/kuberunner';

const columns: ProColumns<KubeAPI.KubeObject>[] = [
  {
    title: '类型',
    dataIndex: 'type',
    width: 220,
    search: false,
    render: (_, record) => <Tag color="purple">{record.type ?? 'Opaque'}</Tag>,
  },
  {
    title: '键数量',
    dataIndex: 'dataKeys',
    width: 100,
    search: false,
    render: (_, record) => Object.keys(record.data ?? {}).length,
  },
  {
    title: '键名',
    dataIndex: 'keys',
    search: false,
    render: (_, record) => {
      const keys = Object.keys(record.data ?? {});
      return keys.length ? keys.join(', ') : '-';
    },
  },
];

const SecretPage: React.FC = () => (
  <ResourceTable
    resource={ENDPOINTS.secret}
    title="Secret"
    description="保存密码、证书、镜像仓库凭据等敏感信息，数据以 Base64 存储。"
    columns={columns}
    createKey="secret"
  />
);

export default SecretPage;
