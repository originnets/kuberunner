import {
  DeploymentUnitOutlined,
  ExpandAltOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { history, useModel } from '@umijs/max';
import { App, Button, Progress, Space, Tooltip } from 'antd';
import React, { useState } from 'react';
import type { AppModel } from '@/models/app';
import { restartResource, type ResourceEndpoint } from '@/services/kuberunner';
import { readyCounts, shortImage } from '@/components/Kube/helpers';
import ResourceTable from '@/components/Kube/ResourceTable';
import ScaleModal from '@/components/Kube/ScaleModal';

export interface WorkloadPageProps {
  resource: ResourceEndpoint;
  title: string;
  description?: string;
  createKey?: string;
  /** 是否支持扩缩容 */
  scalable?: boolean;
  /** 是否支持重启 */
  restartable?: boolean;
  /** 额外展示列（插在镜像列之后） */
  extraColumns?: ProColumns<KubeAPI.KubeObject>[];
}

interface ScaleTarget {
  record: KubeAPI.KubeObject;
  reload: () => void;
}

const imageOf = (record: KubeAPI.KubeObject): string => {
  const containers: KubeAPI.Container[] =
    record.spec?.template?.spec?.containers ?? [];
  return containers.map((item) => shortImage(item.image)).join(', ') || '-';
};

const ReadyCell: React.FC<{ record: KubeAPI.KubeObject }> = ({ record }) => {
  const { ready, desired } = readyCounts(record);
  const percent = desired > 0 ? Math.round((ready / desired) * 100) : 0;
  const healthy = desired > 0 && ready >= desired;
  return (
    <Space size={8}>
      <Progress
        percent={percent}
        size="small"
        showInfo={false}
        strokeColor={healthy ? '#52c41a' : '#faad14'}
        style={{ width: 56, marginBottom: 0 }}
      />
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {ready}/{desired}
      </span>
    </Space>
  );
};

const WorkloadPage: React.FC<WorkloadPageProps> = ({
  resource,
  title,
  description,
  createKey,
  scalable = true,
  restartable = true,
  extraColumns = [],
}) => {
  const { cluster, namespace, setNamespace } = useModel('app') as AppModel;
  const { message, modal } = App.useApp();
  const [scaleTarget, setScaleTarget] = useState<ScaleTarget>();

  const columns: ProColumns<KubeAPI.KubeObject>[] = [
    {
      title: '就绪',
      dataIndex: 'ready',
      width: 150,
      search: false,
      render: (_, record) => <ReadyCell record={record} />,
    },
    {
      title: '镜像',
      dataIndex: 'image',
      search: false,
      ellipsis: true,
      render: (_, record) => imageOf(record),
    },
    ...extraColumns,
  ];

  const confirmRestart = (record: KubeAPI.KubeObject, reload: () => void) => {
    modal.confirm({
      title: `确认重启 ${record.metadata.name}？`,
      content: '将触发一次滚动更新，重启期间服务可能出现短暂中断。',
      okText: '重启',
      cancelText: '取消',
      onOk: async () => {
        await restartResource(resource, {
          cluster,
          namespace: record.metadata.namespace,
          name: record.metadata.name,
        });
        message.success('已提交重启');
        reload();
      },
    });
  };

  return (
    <>
      <ResourceTable
        resource={resource}
        title={title}
        description={description}
        columns={columns}
        createKey={createKey}
        rowActions={(record, context) => {
          const actions: React.ReactNode[] = [
            <Tooltip key="pods" title="查看该工作负载的 Pod">
              <Button
                type="text"
                size="small"
                aria-label="查看 Pod"
                icon={<DeploymentUnitOutlined />}
                onClick={() => {
                  const matchLabels = (record.spec?.selector?.matchLabels ??
                    {}) as Record<string, string>;
                  const selector = Object.entries(matchLabels)
                    .map(([key, value]) => `${key}=${value}`)
                    .join(',');
                  if (
                    record.metadata.namespace &&
                    record.metadata.namespace !== namespace
                  ) {
                    setNamespace(record.metadata.namespace);
                  }
                  const search = new URLSearchParams();
                  if (selector) {
                    search.set('label_selector', selector);
                  } else {
                    search.set('filter_name', record.metadata.name);
                  }
                  history.push(`/workload/pod?${search.toString()}`);
                }}
              />
            </Tooltip>,
          ];
          if (scalable && resource.replicas) {
            actions.push(
              <Tooltip key="scale" title="调整副本数">
                <Button
                  type="text"
                  size="small"
                  aria-label="扩缩容"
                  icon={<ExpandAltOutlined />}
                  onClick={() =>
                    setScaleTarget({ record, reload: context.reload })
                  }
                />
              </Tooltip>,
            );
          }
          if (restartable && resource.restart) {
            actions.push(
              <Tooltip key="restart" title="滚动重启">
                <Button
                  type="text"
                  size="small"
                  aria-label="重启"
                  icon={<ReloadOutlined />}
                  onClick={() => confirmRestart(record, context.reload)}
                />
              </Tooltip>,
            );
          }
          return actions;
        }}
      />

      <ScaleModal
        open={Boolean(scaleTarget)}
        resource={resource}
        cluster={cluster}
        namespace={scaleTarget?.record.metadata.namespace ?? namespace}
        record={scaleTarget?.record}
        onClose={() => setScaleTarget(undefined)}
        onDone={() => {
          scaleTarget?.reload();
          setScaleTarget(undefined);
        }}
      />
    </>
  );
};

export default WorkloadPage;
