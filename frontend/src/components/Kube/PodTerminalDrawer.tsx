import { Drawer, Empty, Select, Space } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';
import { readToken } from '@/utils/auth';

export interface PodTerminalDrawerProps {
  open: boolean;
  cluster: string;
  namespace?: string;
  podName?: string;
  containers?: string[];
  onClose: () => void;
}

/**
 * 基于 WebSocket + xterm.js 的容器终端。
 * 后端协议：{ operation: 'stdin' | 'resize' | 'ping', data, rows, cols }
 */
const PodTerminalDrawer: React.FC<PodTerminalDrawerProps> = ({
  open,
  cluster,
  namespace,
  podName,
  containers = [],
  onClose,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [container, setContainer] = useState<string>();
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setContainer(containers[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podName]);

  useEffect(() => {
    if (!open || !podName || !namespace) return;

    let disposed = false;
    let socket: WebSocket | undefined;
    let cleanup = () => {};
    let resizeObserver: ResizeObserver | undefined;

    // 动态引入，避免终端库进入首屏包体
    void Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')]).then(
      ([xtermModule, fitModule]) => {
        if (disposed || !hostRef.current) return;

        const term = new xtermModule.Terminal({
          cursorBlink: true,
          fontSize: 13,
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          theme: {
            background: '#0b1020',
            foreground: '#d6deeb',
            cursor: '#7dd3fc',
            selectionBackground: '#334155',
          },
        });
        const fit = new fitModule.FitAddon();
        term.loadAddon(fit);
        term.open(hostRef.current);
        fit.fit();
        term.focus();
        term.writeln('\x1b[36m正在连接容器终端…\x1b[0m');

        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const query = new URLSearchParams({
          cluster,
          namespace,
          pod_name: podName,
        });
        if (container) query.set('container_name', container);
        const token = readToken();
        if (token) query.set('token', token);

        socket = new WebSocket(
          `${protocol}://${window.location.host}/ws?${query.toString()}`,
        );

        socket.onopen = () => {
          setConnected(true);
          setError(undefined);
          socket?.send(
            JSON.stringify({
              operation: 'resize',
              cols: term.cols,
              rows: term.rows,
            }),
          );
        };

        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload?.operation === 'stdout') {
              term.write(payload.data ?? '');
            }
          } catch {
            term.write(event.data);
          }
        };

        socket.onerror = () => {
          setError('终端连接失败，请确认集群、Pod 与容器是否存在');
        };

        socket.onclose = () => {
          setConnected(false);
          term.writeln('\r\n\x1b[33m连接已关闭\x1b[0m');
        };

        const dataListener = term.onData((data) => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ operation: 'stdin', data }));
          }
        });

        const resizeListener = term.onResize(({ cols, rows }) => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ operation: 'resize', cols, rows }));
          }
        });

        resizeObserver = new ResizeObserver(() => {
          try {
            fit.fit();
          } catch {
            // 容器尺寸为 0 时忽略
          }
        });
        resizeObserver.observe(hostRef.current);

        cleanup = () => {
          dataListener.dispose();
          resizeListener.dispose();
          term.dispose();
        };
      },
    );

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      cleanup();
      socket?.close();
      setConnected(false);
    };
  }, [open, cluster, namespace, podName, container]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size={880}
      title={
        <Space>
          容器终端 · {podName}
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: connected ? '#22c55e' : '#94a3b8',
            }}
          />
        </Space>
      }
      extra={
        <Select
          value={container}
          style={{ width: 220 }}
          placeholder="选择容器"
          options={containers.map((item) => ({ label: item, value: item }))}
          onChange={setContainer}
        />
      }
    >
      {!namespace || !podName ? (
        <Empty description="缺少命名空间或 Pod 信息" />
      ) : (
        <>
          {error ? (
            <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>
          ) : null}
          <div
            ref={hostRef}
            style={{
              height: 'calc(100vh - 180px)',
              background: '#0b1020',
              borderRadius: 8,
              padding: 8,
              overflow: 'hidden',
            }}
          />
        </>
      )}
    </Drawer>
  );
};

export default PodTerminalDrawer;
