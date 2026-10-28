import { App, Alert, Form, InputNumber, Modal, Space, Switch, Typography } from 'antd';
import React, { useEffect, useState } from 'react';
import { drainNode } from '@/services/kuberunner';

export interface DrainModalProps {
  open: boolean;
  cluster: string;
  nodeName?: string;
  onClose: () => void;
  onDone?: () => void;
}

const DrainModal: React.FC<DrainModalProps> = ({
  open,
  cluster,
  nodeName,
  onClose,
  onDone,
}) => {
  const { message, notification } = App.useApp();
  const [force, setForce] = useState(false);
  const [ignoreDaemonsets, setIgnoreDaemonsets] = useState(true);
  const [deleteEmptyDirData, setDeleteEmptyDirData] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState(120);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (open) {
      setForce(false);
      setIgnoreDaemonsets(true);
      setDeleteEmptyDirData(false);
      setTimeoutSeconds(120);
      setError(undefined);
    }
  }, [open]);

  const submit = async () => {
    if (!nodeName) return;
    setLoading(true);
    setError(undefined);
    try {
      const { message: text, result } = await drainNode({
        cluster,
        nodeName,
        force,
        ignoreDaemonsets,
        deleteEmptyDirData,
        timeoutSeconds,
      });
      message.success(text);
      if (result.errors?.length) {
        notification.warning({
          title: '部分 Pod 驱逐失败',
          description: result.errors.slice(0, 5).join('\n'),
        });
      }
      onDone?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`驱逐节点 · ${nodeName ?? ''}`}
      okText="开始驱逐"
      cancelText="取消"
      okButtonProps={{ danger: true }}
      confirmLoading={loading}
      onOk={() => void submit()}
      onCancel={onClose}
      destroyOnHidden
      width={560}
    >
      <Space orientation="vertical" style={{ width: '100%' }} size={12}>
        <Alert
          type="warning"
          showIcon
          title="驱逐会逐个迁移该节点上的 Pod，并把节点标记为不可调度"
          description="请确认工作负载有足够副本，且副本可调度到其它节点。"
        />
        {error ? <Alert type="error" showIcon title="驱逐失败" description={error} /> : null}

        <Form layout="vertical" style={{ marginBottom: 0 }}>
          <Form.Item label="忽略 DaemonSet" style={{ marginBottom: 8 }}>
            <Space>
              <Switch checked={ignoreDaemonsets} onChange={setIgnoreDaemonsets} />
              <Typography.Text type="secondary">
                通常保持开启，避免驱逐监控/日志等守护进程
              </Typography.Text>
            </Space>
          </Form.Item>
          <Form.Item label="强制驱逐" style={{ marginBottom: 8 }}>
            <Space>
              <Switch checked={force} onChange={setForce} />
              <Typography.Text type="secondary">
                优先走 Eviction，失败时直接删除 Pod（可能绕过 PDB）
              </Typography.Text>
            </Space>
          </Form.Item>
          <Form.Item label="允许删除 emptyDir 数据" style={{ marginBottom: 8 }}>
            <Space>
              <Switch
                checked={deleteEmptyDirData}
                onChange={setDeleteEmptyDirData}
              />
              <Typography.Text type="secondary">
                使用 emptyDir 的 Pod 默认会被跳过
              </Typography.Text>
            </Space>
          </Form.Item>
          <Form.Item label="超时（秒）" style={{ marginBottom: 0 }}>
            <InputNumber
              min={30}
              max={3600}
              value={timeoutSeconds}
              onChange={(value) => setTimeoutSeconds(Number(value ?? 120))}
              style={{ width: 160 }}
            />
          </Form.Item>
        </Form>
      </Space>
    </Modal>
  );
};

export default DrainModal;
