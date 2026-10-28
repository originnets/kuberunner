import { Badge } from 'antd';
import React from 'react';
import { statusBadge } from './helpers';

export interface StatusTagProps {
  status?: string;
  text?: string;
}

/** 统一的资源状态标签，颜色按 Kubernetes 常见状态映射 */
const StatusTag: React.FC<StatusTagProps> = ({ status, text }) => {
  const label = text ?? status ?? 'Unknown';
  return <Badge status={statusBadge(label)} text={label} />;
};

export default StatusTag;
