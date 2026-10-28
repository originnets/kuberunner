import React from 'react';
import { ENDPOINTS } from '@/services/kuberunner';
import WorkloadPage from '../components/WorkloadPage';

const StatefulSetPage: React.FC = () => (
  <WorkloadPage
    resource={ENDPOINTS.statefulset}
    title="StatefulSet"
    description="为有状态应用提供稳定的网络标识与有序的部署、扩缩容。"
    createKey="statefulset"
    extraColumns={[
      {
        title: 'Headless Service',
        dataIndex: 'serviceName',
        width: 180,
        search: false,
        render: (_, record) => record.spec?.serviceName ?? '-',
      },
    ]}
  />
);

export default StatefulSetPage;
