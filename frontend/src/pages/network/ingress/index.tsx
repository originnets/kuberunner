import { PlusOutlined } from '@ant-design/icons';
import type { ActionType } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { Button, Space, Tag, Typography } from 'antd';
import React, { useRef, useState } from 'react';
import type { AppModel } from '@/models/app';
import ResourceTable from '@/components/Kube/ResourceTable';
import { ENDPOINTS } from '@/services/kuberunner';
import CreateResourceDrawer from '@/components/Kube/create/CreateResourceDrawer';

interface IngressRule {
  host?: string;
  http?: {
    paths?: {
      path?: string;
      pathType?: string;
      backend?: {
        service?: { name?: string; port?: { number?: number; name?: string } };
      };
    }[];
  };
}

const renderRules = (record: KubeAPI.KubeObject) => {
  const rules: IngressRule[] = record.spec?.rules ?? [];
  if (!rules.length) return '-';
  return (
    <Space orientation="vertical" size={2}>
      {rules.map((rule, index) => {
        const paths = rule.http?.paths ?? [];
        return (
          <Typography.Text
            key={rule.host ?? `rule-${index}`}
            style={{ fontSize: 12 }}
          >
            <Tag color="blue" style={{ marginInlineEnd: 6 }}>
              {rule.host || '*'}
            </Tag>
            {paths
              .map((path) => {
                const port =
                  path.backend?.service?.port?.number ??
                  path.backend?.service?.port?.name ??
                  '';
                return `${path.path ?? '/'} → ${
                  path.backend?.service?.name ?? '-'
                }:${port}`;
              })
              .join('  |  ')}
          </Typography.Text>
        );
      })}
    </Space>
  );
};

const columns: ProColumns<KubeAPI.KubeObject>[] = [
  {
    title: 'IngressClass',
    dataIndex: 'ingressClassName',
    width: 140,
    search: false,
    render: (_, record) => record.spec?.ingressClassName ?? '-',
  },
  {
    title: '规则',
    dataIndex: 'rules',
    search: false,
    render: (_, record) => renderRules(record),
  },
  {
    title: 'TLS',
    dataIndex: 'tls',
    width: 90,
    search: false,
    render: (_, record) =>
      record.spec?.tls?.length ? <Tag color="green">已开启</Tag> : '-',
  },
  {
    title: '负载入口',
    dataIndex: 'loadBalancer',
    width: 180,
    search: false,
    render: (_, record) => {
      const ingress: { ip?: string; hostname?: string }[] =
        record.status?.loadBalancer?.ingress ?? [];
      return (
        ingress
          .map((item) => item.ip ?? item.hostname)
          .filter(Boolean)
          .join(', ') || '-'
      );
    },
  },
];

const IngressPage: React.FC = () => {
  const { cluster } = useModel('app') as AppModel;
  const [createOpen, setCreateOpen] = useState(false);
  const actionRef = useRef<ActionType>(null);

  return (
    <>
      <ResourceTable
        actionRef={actionRef}
        resource={ENDPOINTS.ingress}
        title="Ingress"
        description="为集群内的 Service 配置七层路由与 TLS 证书。"
        columns={columns}
        toolbar={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!cluster}
            onClick={() => setCreateOpen(true)}
          >
            新建
          </Button>
        }
      />
      <CreateResourceDrawer
        kind="ingress"
        cluster={cluster}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => actionRef.current?.reload()}
      />
    </>
  );
};

export default IngressPage;
