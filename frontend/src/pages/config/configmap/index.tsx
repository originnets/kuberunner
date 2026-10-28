import type { ProColumns } from '@ant-design/pro-components';
import { Space, Tag, Tooltip } from 'antd';
import React from 'react';
import ResourceTable from '@/components/Kube/ResourceTable';
import { ENDPOINTS } from '@/services/kuberunner';

const columns: ProColumns<KubeAPI.KubeObject>[] = [
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
      if (!keys.length) return '-';
      return (
        <Tooltip title={keys.join(', ')}>
          <Space size={[4, 4]} wrap>
            {keys.slice(0, 4).map((key) => (
              <Tag key={key} style={{ marginInlineEnd: 0 }}>
                {key}
              </Tag>
            ))}
            {keys.length > 4 ? <Tag>+{keys.length - 4}</Tag> : null}
          </Space>
        </Tooltip>
      );
    },
  },
];

const ConfigMapPage: React.FC = () => (
  <ResourceTable
    resource={ENDPOINTS.configmap}
    title="ConfigMap"
    description="以键值对形式保存非敏感配置，可挂载为文件或环境变量。"
    columns={columns}
    createKey="configmap"
  />
);

export default ConfigMapPage;
