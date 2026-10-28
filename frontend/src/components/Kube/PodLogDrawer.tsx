import {
  CopyOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { App, Button, Drawer, Empty, Select, Space, Spin, Switch, Typography } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { getPodLog } from '@/services/kuberunner';
import { copyText, downloadFile } from './helpers';

export interface PodLogDrawerProps {
  open: boolean;
  cluster: string;
  namespace?: string;
  podName?: string;
  containers?: string[];
  onClose: () => void;
}

const TAIL_OPTIONS = [100, 500, 1000, 2000, 5000];

const PodLogDrawer: React.FC<PodLogDrawerProps> = ({
  open,
  cluster,
  namespace,
  podName,
  containers = [],
  onClose,
}) => {
  const { message } = App.useApp();
  const [container, setContainer] = useState<string>();
  const [tailLines, setTailLines] = useState(1000);
  const [wrap, setWrap] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  const load = async (scrollToBottom = true) => {
    if (!podName || !namespace) return;
    setLoading(true);
    try {
      const log = await getPodLog({
        cluster,
        namespace,
        podName,
        containerName: container,
        tailLines,
      });
      setContent(log || '（日志为空）');
      if (scrollToBottom) {
        requestAnimationFrame(() => {
          if (preRef.current) {
            preRef.current.scrollTop = preRef.current.scrollHeight;
          }
        });
      }
    } catch (error) {
      setContent(
        `获取日志失败：${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setContainer(containers[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, podName]);

  useEffect(() => {
    if (open && container) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, container, tailLines, podName, namespace]);

  useEffect(() => {
    if (!open || !autoRefresh) return;
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoRefresh, container, tailLines, podName, namespace]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size={860}
      title={<Space>Pod 日志 · {podName}</Space>}
      extra={
        <Space>
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void load()}
          >
            刷新
          </Button>
          <Button
            icon={<CopyOutlined />}
            onClick={async () => {
              await copyText(content);
              message.success('已复制日志');
            }}
          />
          <Button
            icon={<DownloadOutlined />}
            onClick={() =>
              downloadFile(`${podName}-${container ?? 'log'}.log`, content)
            }
          />
        </Space>
      }
    >
      <Space wrap style={{ marginBottom: 12 }}>
        <Select
          value={container}
          style={{ width: 220 }}
          placeholder="选择容器"
          options={containers.map((item) => ({ label: item, value: item }))}
          onChange={setContainer}
        />
        <Select
          value={tailLines}
          style={{ width: 140 }}
          options={TAIL_OPTIONS.map((item) => ({
            label: `最近 ${item} 行`,
            value: item,
          }))}
          onChange={setTailLines}
        />
        <Space>
          <Typography.Text>自动刷新 5s</Typography.Text>
          <Switch checked={autoRefresh} onChange={setAutoRefresh} />
        </Space>
        <Space>
          <Typography.Text>自动换行</Typography.Text>
          <Switch checked={wrap} onChange={setWrap} />
        </Space>
      </Space>

      <Spin spinning={loading}>
        {content ? (
          <pre
            ref={preRef}
            style={{
              margin: 0,
              padding: 16,
              minHeight: 320,
              maxHeight: 'calc(100vh - 300px)',
              overflow: 'auto',
              fontSize: 12.5,
              lineHeight: 1.6,
              borderRadius: 8,
              whiteSpace: wrap ? 'pre-wrap' : 'pre',
              background: '#0b1020',
              color: '#d6deeb',
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            }}
          >
            {content}
          </pre>
        ) : (
          <Empty description="暂无日志" />
        )}
      </Spin>
    </Drawer>
  );
};

export default PodLogDrawer;
