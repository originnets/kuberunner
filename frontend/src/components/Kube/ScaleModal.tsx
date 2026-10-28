import { App, InputNumber, Modal, Space, Typography } from 'antd';
import React, { useEffect, useState } from 'react';
import { scaleResource, type ResourceEndpoint } from '@/services/kuberunner';

export interface ScaleModalProps {
  open: boolean;
  cluster: string;
  namespace?: string;
  resource: ResourceEndpoint;
  record?: KubeAPI.KubeObject;
  onClose: () => void;
  onDone?: () => void;
}

const ScaleModal: React.FC<ScaleModalProps> = ({
  open,
  cluster,
  namespace,
  resource,
  record,
  onClose,
  onDone,
}) => {
  const { message } = App.useApp();
  const [replicas, setReplicas] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  const current = Number(record?.spec?.replicas ?? 0);

  useEffect(() => {
    if (open) {
      setReplicas(Number(record?.spec?.replicas ?? 1));
    }
  }, [open, record]);

  const submit = async () => {
    if (!record) return;
    setLoading(true);
    try {
      await scaleResource(resource, {
        cluster,
        namespace: record.metadata.namespace ?? namespace,
        name: record.metadata.name,
        replicas,
      });
      message.success(`已将 ${record.metadata.name} 的副本数调整为 ${replicas}`);
      onDone?.();
      onClose();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '扩缩容失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`调整副本数 · ${record?.metadata.name ?? ''}`}
      okText="确定"
      cancelText="取消"
      confirmLoading={loading}
      onOk={() => void submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          当前副本数：{current}
        </Typography.Text>
        <InputNumber
          min={0}
          max={1000}
          value={replicas}
          onChange={(value) => setReplicas(Number(value ?? 0))}
          style={{ width: '100%' }}
        />
      </Space>
    </Modal>
  );
};

export default ScaleModal;
