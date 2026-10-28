import { CodeOutlined, FileTextOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { history, useModel } from '@umijs/max';
import { Button, Space, Tag, Tooltip, Typography } from 'antd';
import React, { useState } from 'react';
import type { AppModel } from '@/models/app';
import { ENDPOINTS, getPodContainers } from '@/services/kuberunner';
import { podReady, podRestarts, podStatus, shortImage } from '@/components/Kube/helpers';
import PodLogDrawer from '@/components/Kube/PodLogDrawer';
import PodTerminalDrawer from '@/components/Kube/PodTerminalDrawer';
import ResourceTable from '@/components/Kube/ResourceTable';
import StatusTag from '@/components/Kube/StatusTag';

interface PodTarget {
  podName: string;
  namespace: string;
  containers: string[];
}

const RestartCount: React.FC<{ value: number }> = ({ value }) => {
  if (!value) return <span style={{ color: 'rgba(15, 23, 42, 0.45)' }}>0</span>;
  return (
    <Typography.Text type="danger" strong>
      {value}
    </Typography.Text>
  );
};

const columns: ProColumns<KubeAPI.KubeObject>[] = [
  {
    title: '状态',
    dataIndex: 'status',
    width: 150,
    search: false,
    render: (_, record) => {
      const status = podStatus(record);
      return <StatusTag status={status.text} />;
    },
  },
  {
    title: '就绪',
    dataIndex: 'ready',
    width: 80,
    search: false,
    render: (_, record) => podReady(record),
  },
  {
    title: '重启',
    dataIndex: 'restarts',
    width: 80,
    search: false,
    render: (_, record) => <RestartCount value={podRestarts(record)} />,
  },
  {
    title: '节点',
    dataIndex: 'nodeName',
    width: 150,
    search: false,
    ellipsis: true,
    render: (_, record) => {
      const nodeName = record.spec?.nodeName;
      if (!nodeName) return '-';
      return (
        <Tooltip title={`查看节点 ${nodeName}`}>
          <Typography.Link
            onClick={() =>
              history.push(`/cluster/node?filter_name=${encodeURIComponent(nodeName)}`)
            }
          >
            {nodeName}
          </Typography.Link>
        </Tooltip>
      );
    },
  },
  {
    title: 'Pod IP',
    dataIndex: 'podIP',
    width: 140,
    search: false,
    render: (_, record) =>
      record.status?.podIP ? (
        <Typography.Text copyable>{record.status.podIP}</Typography.Text>
      ) : (
        '-'
      ),
  },
  {
    title: '容器',
    dataIndex: 'containers',
    width: 180,
    search: false,
    render: (_, record) => {
      const containers: KubeAPI.Container[] = record.spec?.containers ?? [];
      if (!containers.length) return '-';
      return (
        <Space size={[4, 4]} wrap>
          {containers.map((item) => (
            <Tooltip key={item.name} title={item.image}>
              <Tag style={{ marginInlineEnd: 0 }}>{item.name}</Tag>
            </Tooltip>
          ))}
        </Space>
      );
    },
  },
  {
    title: '镜像',
    dataIndex: 'image',
    search: false,
    ellipsis: true,
    render: (_, record) => {
      const images: string[] = (record.spec?.containers ?? []).map(
        (item: KubeAPI.Container) => shortImage(item.image),
      );
      return images.join(', ') || '-';
    },
  },
];

const PodPage: React.FC = () => {
  const { cluster } = useModel('app') as AppModel;
  const [logTarget, setLogTarget] = useState<PodTarget>();
  const [terminalTarget, setTerminalTarget] = useState<PodTarget>();

  const buildTarget = async (
    record: KubeAPI.KubeObject,
  ): Promise<PodTarget> => {
    const containers: string[] = (record.spec?.containers ?? []).map(
      (item: KubeAPI.Container) => item.name,
    );
    const target: PodTarget = {
      podName: record.metadata.name,
      namespace: record.metadata.namespace ?? '',
      containers,
    };
    if (!containers.length) {
      try {
        target.containers = await getPodContainers({
          cluster,
          namespace: target.namespace,
          podName: target.podName,
        });
      } catch {
        // 忽略，抽屉内会提示无容器
      }
    }
    return target;
  };

  return (
    <>
      <ResourceTable
        resource={ENDPOINTS.pod}
        title="Pod"
        description="查看容器运行状态、日志与终端；点击节点名称可跳转对应节点。"
        columns={columns}
        createKey="pod"
        rowActions={(record) => [
          <Tooltip key="log" title="查看日志">
            <Button
              type="text"
              size="small"
              aria-label="日志"
              icon={<FileTextOutlined />}
              onClick={async () => setLogTarget(await buildTarget(record))}
            />
          </Tooltip>,
          <Tooltip key="terminal" title="打开终端">
            <Button
              type="text"
              size="small"
              aria-label="终端"
              icon={<CodeOutlined />}
              onClick={async () => setTerminalTarget(await buildTarget(record))}
            />
          </Tooltip>,
        ]}
      />

      <PodLogDrawer
        open={Boolean(logTarget)}
        cluster={cluster}
        namespace={logTarget?.namespace}
        podName={logTarget?.podName}
        containers={logTarget?.containers}
        onClose={() => setLogTarget(undefined)}
      />

      <PodTerminalDrawer
        open={Boolean(terminalTarget)}
        cluster={cluster}
        namespace={terminalTarget?.namespace}
        podName={terminalTarget?.podName}
        containers={terminalTarget?.containers}
        onClose={() => setTerminalTarget(undefined)}
      />
    </>
  );
};

export default PodPage;
