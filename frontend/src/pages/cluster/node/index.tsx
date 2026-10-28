import {
  ExportOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { App, Button, Space, Tag, Tooltip, Typography } from 'antd';
import React, { useRef, useState } from 'react';
import type { AppModel } from '@/models/app';
import ResourceTable from '@/components/Kube/ResourceTable';
import StatusTag from '@/components/Kube/StatusTag';
import { nodeAddress, nodeRoles } from '@/components/Kube/helpers';
import { cordonNode, ENDPOINTS } from '@/services/kuberunner';
import DrainModal from './components/DrainModal';

const nodeReady = (node: KubeAPI.KubeObject): string => {
  const conditions: { type: string; status: string }[] =
    node.status?.conditions ?? [];
  const ready = conditions.find((item) => item.type === 'Ready');
  return ready?.status === 'True' ? 'Ready' : 'NotReady';
};

const columns: ProColumns<KubeAPI.KubeObject>[] = [
  {
    title: '状态',
    dataIndex: 'status',
    width: 110,
    search: false,
    render: (_, record) => <StatusTag status={nodeReady(record)} />,
  },
  {
    title: '调度',
    dataIndex: 'unschedulable',
    width: 120,
    search: false,
    render: (_, record) =>
      record.spec?.unschedulable ? (
        <Tag color="warning">已停止调度</Tag>
      ) : (
        <Tag color="success">可调度</Tag>
      ),
  },
  {
    title: '角色',
    dataIndex: 'roles',
    width: 150,
    search: false,
    render: (_, record) => {
      const roles = nodeRoles(record).split(', ');
      return (
        <Space size={[4, 4]} wrap>
          {roles.map((role) => (
            <Tag key={role} color="blue" style={{ marginInlineEnd: 0 }}>
              {role}
            </Tag>
          ))}
        </Space>
      );
    },
  },
  {
    title: '版本',
    dataIndex: 'version',
    width: 140,
    search: false,
    render: (_, record) => record.status?.nodeInfo?.kubeletVersion ?? '-',
  },
  {
    title: '内网 IP',
    dataIndex: 'address',
    width: 150,
    search: false,
    render: (_, record) => (
      <Typography.Text copyable>{nodeAddress(record)}</Typography.Text>
    ),
  },
  {
    title: 'CPU',
    dataIndex: 'cpu',
    width: 90,
    search: false,
    render: (_, record) => record.status?.capacity?.cpu ?? '-',
  },
  {
    title: '内存',
    dataIndex: 'memory',
    width: 110,
    search: false,
    render: (_, record) => record.status?.capacity?.memory ?? '-',
  },
  {
    title: '可分配 Pod',
    dataIndex: 'pods',
    width: 120,
    search: false,
    render: (_, record) => record.status?.allocatable?.pods ?? '-',
  },
  {
    title: '操作系统',
    dataIndex: 'os',
    width: 220,
    search: false,
    ellipsis: true,
    render: (_, record) =>
      `${record.status?.nodeInfo?.osImage ?? ''} ${
        record.status?.nodeInfo?.kernelVersion ?? ''
      }`.trim() || '-',
  },
];

const NodePage: React.FC = () => {
  const { cluster } = useModel('app') as AppModel;
  const { message, modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [drainTarget, setDrainTarget] = useState<string>();

  const toggleScheduling = (
    record: KubeAPI.KubeObject,
    reload: () => void,
  ) => {
    const unschedulable = Boolean(record.spec?.unschedulable);
    const next = !unschedulable;
    modal.confirm({
      title: next
        ? `停止调度节点 ${record.metadata.name}？`
        : `恢复调度节点 ${record.metadata.name}？`,
      content: next
        ? '节点将标记为不可调度，新的 Pod 不会调度到该节点（已有 Pod 不受影响）。'
        : '节点将重新允许调度新的 Pod。',
      okText: next ? '停止调度' : '恢复调度',
      cancelText: '取消',
      onOk: async () => {
        const text = await cordonNode({
          cluster,
          nodeName: record.metadata.name,
          unschedulable: next,
        });
        message.success(text);
        reload();
      },
    });
  };

  return (
    <>
      <ResourceTable
        actionRef={actionRef}
        resource={ENDPOINTS.node}
        title="节点"
        description="查看节点状态与资源；支持停止/恢复调度（cordon）与驱逐 Pod（drain）。"
        columns={columns}
        rowActions={(record, context) => {
          const unschedulable = Boolean(record.spec?.unschedulable);
          return [
            <Tooltip
              key="cordon"
              title={unschedulable ? '恢复调度' : '停止调度'}
            >
              <Button
                type="text"
                size="small"
                aria-label={unschedulable ? '恢复调度' : '停止调度'}
                icon={
                  unschedulable ? <PlayCircleOutlined /> : <PauseCircleOutlined />
                }
                onClick={() => toggleScheduling(record, context.reload)}
              />
            </Tooltip>,
            <Tooltip key="drain" title="驱逐节点上的 Pod">
              <Button
                type="text"
                size="small"
                danger
                aria-label="驱逐"
                icon={<ExportOutlined />}
                onClick={() => setDrainTarget(record.metadata.name)}
              />
            </Tooltip>,
          ];
        }}
      />
      <DrainModal
        open={Boolean(drainTarget)}
        cluster={cluster}
        nodeName={drainTarget}
        onClose={() => setDrainTarget(undefined)}
        onDone={() => {
          setDrainTarget(undefined);
          actionRef.current?.reload();
        }}
      />
    </>
  );
};

export default NodePage;
