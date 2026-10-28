import React from 'react';
import { ENDPOINTS } from '@/services/kuberunner';
import WorkloadPage from '../components/WorkloadPage';

const DaemonSetPage: React.FC = () => (
  <WorkloadPage
    resource={ENDPOINTS.daemonset}
    title="DaemonSet"
    description="保证每个（或指定）节点上运行一个 Pod 副本，适用于日志、监控等守护进程。"
    createKey="daemonset"
    scalable={false}
    extraColumns={[
      {
        title: '更新策略',
        dataIndex: 'updateStrategy',
        width: 140,
        search: false,
        render: (_, record) =>
          record.spec?.updateStrategy?.type ?? 'RollingUpdate',
      },
    ]}
  />
);

export default DaemonSetPage;
