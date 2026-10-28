import type { ProColumns } from '@ant-design/pro-components';
import { Tag } from 'antd';
import React from 'react';
import { selectorText, servicePorts } from '@/components/Kube/helpers';
import ResourceTable from '@/components/Kube/ResourceTable';
import { ENDPOINTS } from '@/services/kuberunner';

const columns: ProColumns<KubeAPI.KubeObject>[] = [
  {
    title: '类型',
    dataIndex: 'type',
    width: 130,
    search: false,
    render: (_, record) => (
      <Tag color={record.spec?.type === 'LoadBalancer' ? 'blue' : 'default'}>
        {record.spec?.type ?? 'ClusterIP'}
      </Tag>
    ),
  },
  {
    title: 'ClusterIP',
    dataIndex: 'clusterIP',
    width: 150,
    search: false,
    render: (_, record) => record.spec?.clusterIP ?? '-',
  },
  {
    title: '端口',
    dataIndex: 'ports',
    width: 180,
    search: false,
    render: (_, record) => servicePorts(record),
  },
  {
    title: 'External IP',
    dataIndex: 'externalIP',
    width: 160,
    search: false,
    render: (_, record) => {
      const ips: string[] =
        record.status?.loadBalancer?.ingress?.map(
          (item: { hostname?: string; ip?: string }) => item.ip ?? item.hostname,
        ) ?? [];
      return ips.filter(Boolean).join(', ') || '-';
    },
  },
  {
    title: '选择器',
    dataIndex: 'selector',
    search: false,
    ellipsis: true,
    render: (_, record) =>
      selectorText(record.spec?.selector as Record<string, string>),
  },
];

const ServicePage: React.FC = () => (
  <ResourceTable
    resource={ENDPOINTS.service}
    title="Service"
    description="为 Pod 提供稳定的访问入口，支持 ClusterIP、NodePort 与 LoadBalancer。"
    columns={columns}
    createKey="service"
  />
);

export default ServicePage;
