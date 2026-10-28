import type { ProColumns } from '@ant-design/pro-components';
import { Space, Tag, Tooltip, Typography } from 'antd';
import React from 'react';
import ResourceTable from '@/components/Kube/ResourceTable';
import { formatTime, fromNow } from '@/components/Kube/helpers';
import { ENDPOINTS } from '@/services/kuberunner';

const columns: ProColumns<KubeAPI.KubeObject>[] = [
  {
    title: '类型',
    dataIndex: 'type',
    width: 100,
    search: false,
    render: (_, record) =>
      record.type === 'Warning' ? (
        <Tag color="error">Warning</Tag>
      ) : (
        <Tag color="success">Normal</Tag>
      ),
  },
  {
    title: '对象',
    dataIndex: 'object',
    width: 260,
    search: false,
    ellipsis: true,
    render: (_, record) => {
      const object = record.involvedObject ?? {};
      return (
        <Space size={4}>
          <Tag>{object.kind ?? '-'}</Tag>
          <Typography.Text ellipsis style={{ maxWidth: 180 }}>
            {object.name ?? '-'}
          </Typography.Text>
        </Space>
      );
    },
  },
  {
    title: '原因',
    dataIndex: 'reason',
    width: 180,
    search: false,
    render: (_, record) => record.reason ?? '-',
  },
  {
    title: '消息',
    dataIndex: 'message',
    search: false,
    ellipsis: true,
    render: (_, record) => (
      <Tooltip title={record.message}>
        <span>{record.message ?? '-'}</span>
      </Tooltip>
    ),
  },
  {
    title: '次数',
    dataIndex: 'count',
    width: 80,
    search: false,
    render: (_, record) => record.count ?? 1,
  },
  {
    title: '最后出现',
    dataIndex: 'lastTimestamp',
    width: 120,
    search: false,
    render: (_, record) => (
      <Tooltip
        title={formatTime(
          record.lastTimestamp ??
            record.eventTime ??
            record.metadata?.creationTimestamp,
        )}
      >
        <span>
          {fromNow(
            record.lastTimestamp ??
              record.eventTime ??
              record.metadata?.creationTimestamp,
          )}
        </span>
      </Tooltip>
    ),
  },
];

const EventPage: React.FC = () => (
  <ResourceTable
    resource={ENDPOINTS.event}
    title="事件"
    description="集群内的调度、拉镜像、重启等事件，Warning 通常代表需要关注的问题。"
    columns={columns}
    showAge={false}
  />
);

export default EventPage;
