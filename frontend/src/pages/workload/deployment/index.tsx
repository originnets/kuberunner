import React from 'react';
import { ENDPOINTS } from '@/services/kuberunner';
import WorkloadPage from '../components/WorkloadPage';

const DeploymentPage: React.FC = () => (
  <WorkloadPage
    resource={ENDPOINTS.deployment}
    title="Deployment"
    description="以声明式方式管理无状态应用，支持滚动扩缩容与重启。"
    createKey="deployment"
    extraColumns={[
      {
        title: '更新策略',
        dataIndex: 'strategy',
        width: 130,
        search: false,
        render: (_, record) => record.spec?.strategy?.type ?? 'RollingUpdate',
      },
    ]}
  />
);

export default DeploymentPage;
