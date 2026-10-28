import {
  AppstoreOutlined,
  CloudServerOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  GlobalOutlined,
  HddOutlined,
  InboxOutlined,
  ReloadOutlined,
  RightOutlined,
  SettingOutlined,
  TagsOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history, useModel } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import type { AppModel } from '@/models/app';
import { ENDPOINTS, getResourceCount, listResource } from '@/services/kuberunner';
import ContextBar from '@/components/Kube/ContextSwitches';
import { fromNow } from '@/components/Kube/helpers';
import { useClusters } from '@/components/Kube/useClusters';

interface Metric {
  key: keyof KubeAPI.ResourceCount;
  label: string;
  path: string;
  icon: React.ReactNode;
  color: string;
}

const METRICS: Metric[] = [
  {
    key: 'Pods',
    label: 'Pod',
    path: '/workload/pod',
    icon: <CloudServerOutlined />,
    color: '#1677ff',
  },
  {
    key: 'Deployments',
    label: 'Deployment',
    path: '/workload/deployment',
    icon: <DeploymentUnitOutlined />,
    color: '#2f54eb',
  },
  {
    key: 'StatefulSets',
    label: 'StatefulSet',
    path: '/workload/statefulset',
    icon: <AppstoreOutlined />,
    color: '#722ed1',
  },
  {
    key: 'DaemonSets',
    label: 'DaemonSet',
    path: '/workload/daemonset',
    icon: <ClusterOutlined />,
    color: '#13c2c2',
  },
  {
    key: 'Services',
    label: 'Service',
    path: '/network/service',
    icon: <GlobalOutlined />,
    color: '#52c41a',
  },
  {
    key: 'Ingress',
    label: 'Ingress',
    path: '/network/ingress',
    icon: <SettingOutlined />,
    color: '#a0d911',
  },
  {
    key: 'ConfigMaps',
    label: 'ConfigMap',
    path: '/config/configmap',
    icon: <TagsOutlined />,
    color: '#fa8c16',
  },
  {
    key: 'Secrets',
    label: 'Secret',
    path: '/config/secret',
    icon: <InboxOutlined />,
    color: '#fa541c',
  },
  {
    key: 'Nodes',
    label: '节点',
    path: '/cluster/node',
    icon: <DatabaseOutlined />,
    color: '#eb2f96',
  },
  {
    key: 'PersistentVolumes',
    label: 'PV',
    path: '/storage/pv',
    icon: <HddOutlined />,
    color: '#08979c',
  },
  {
    key: 'PersistentVolumeClaims',
    label: 'PVC',
    path: '/storage/pvc',
    icon: <HddOutlined />,
    color: '#d4b106',
  },
  {
    key: 'StorageClasses',
    label: 'StorageClass',
    path: '/storage/storageclass',
    icon: <DatabaseOutlined />,
    color: '#531dab',
  },
];

const QUICK_LINKS = [
  { label: '查看 Pod 与日志', path: '/workload/pod', icon: <CloudServerOutlined /> },
  { label: '管理 Deployment', path: '/workload/deployment', icon: <DeploymentUnitOutlined /> },
  { label: '查看集群事件', path: '/cluster/event', icon: <ThunderboltOutlined /> },
  { label: '管理命名空间', path: '/cluster/namespace', icon: <TeamOutlined /> },
];

const MetricCard: React.FC<{ metric: Metric; value: number }> = ({
  metric,
  value,
}) => (
  <Card
    className="kr-metric-card"
    size="small"
    onClick={() => history.push(metric.path)}
    styles={{ body: { padding: 16 } }}
  >
    <Space size={12} align="center" style={{ width: '100%' }}>
      <span
        style={{
          display: 'inline-flex',
          width: 38,
          height: 38,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
          fontSize: 18,
          color: metric.color,
          background: `${metric.color}14`,
        }}
      >
        {metric.icon}
      </span>
      <span style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            color: 'rgba(15, 23, 42, 0.55)',
            whiteSpace: 'nowrap',
          }}
        >
          {metric.label}
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, lineHeight: '26px' }}>
          {value}
        </div>
      </span>
    </Space>
  </Card>
);

const OverviewPage: React.FC = () => {
  const { cluster } = useModel('app') as AppModel;
  const { clusters } = useClusters();
  const [counts, setCounts] = useState<Partial<KubeAPI.ResourceCount>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [events, setEvents] = useState<KubeAPI.KubeObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [healthy, setHealthy] = useState<boolean>();
  const [updatedAt, setUpdatedAt] = useState<string>();

  const load = async () => {
    if (!cluster) {
      setCounts({});
      setEvents([]);
      setHealthy(undefined);
      return;
    }
    setLoading(true);
    setEventsLoading(true);
    try {
      const result = await getResourceCount(cluster);
      setCounts(result.data ?? {});
      setWarnings(result.warnings ?? []);
      setHealthy(true);
      setUpdatedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    } catch {
      setCounts({});
      setHealthy(false);
    } finally {
      setLoading(false);
    }

    try {
      const result = await listResource(ENDPOINTS.event, {
        cluster,
        page: 1,
        limit: 8,
      });
      setEvents(result.items);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cluster]);

  const total = useMemo(
    () => METRICS.reduce((sum, metric) => sum + (counts[metric.key] ?? 0), 0),
    [counts],
  );

  const maxCount = useMemo(
    () => Math.max(1, ...METRICS.map((metric) => counts[metric.key] ?? 0)),
    [counts],
  );

  const eventColumns = [
    {
      title: '类型',
      dataIndex: 'type',
      width: 90,
      render: (_: unknown, record: KubeAPI.KubeObject) =>
        record.type === 'Warning' ? (
          <Tag color="error">Warning</Tag>
        ) : (
          <Tag color="success">Normal</Tag>
        ),
    },
    {
      title: '对象',
      dataIndex: 'object',
      width: 240,
      ellipsis: true,
      render: (_: unknown, record: KubeAPI.KubeObject) => {
        const object = record.involvedObject ?? {};
        return `${object.kind ?? '-'} / ${object.name ?? '-'}`;
      },
    },
    {
      title: '原因',
      dataIndex: 'reason',
      width: 160,
      ellipsis: true,
      render: (_: unknown, record: KubeAPI.KubeObject) => record.reason ?? '-',
    },
    {
      title: '最后出现',
      dataIndex: 'lastTimestamp',
      width: 110,
      render: (_: unknown, record: KubeAPI.KubeObject) =>
        fromNow(
          record.lastTimestamp ??
            record.eventTime ??
            record.metadata?.creationTimestamp,
        ),
    },
  ];

  const heroButtonStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.16)',
    borderColor: 'rgba(255, 255, 255, 0.35)',
    color: '#fff',
  };

  return (
    <PageContainer
      ghost
      title="集群概览"
      subTitle="多集群资源与事件总览"
      header={{ breadcrumb: {} }}
      extra={[
        <ContextBar key="context" />,
        <Button
          key="refresh"
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => void load()}
        >
          刷新
        </Button>,
      ]}
    >
      {!cluster ? (
        <Alert
          type="warning"
          showIcon
          title="尚未选择集群"
          description={
            clusters.length
              ? '请在页面右上角选择需要查看的集群。'
              : '后端没有返回可用集群，请检查 backend/config.yaml 中的 KubeConfigs 配置以及 kubeconfig 文件路径。'
          }
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <div className="kr-hero" style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="kr-hero-meta" style={{ fontSize: 13 }}>
            当前集群
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, lineHeight: '38px' }}>
            {cluster || '未选择集群'}
          </div>
          <Space size={20} wrap className="kr-hero-meta" style={{ marginTop: 10 }}>
            <span>
              <ClusterOutlined /> 集群 {clusters.length}
            </span>
            <span>
              <CloudServerOutlined /> Pod {counts.Pods ?? 0}
            </span>
            <span>
              <DatabaseOutlined /> 节点 {counts.Nodes ?? 0}
            </span>
            <span>
              <ThunderboltOutlined /> 资源对象 {total}
            </span>
            {updatedAt ? <span>更新于 {updatedAt}</span> : null}
          </Space>
          <Space size={12} style={{ marginTop: 20 }} wrap>
            <Button
              style={heroButtonStyle}
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={() => void load()}
            >
              刷新数据
            </Button>
            <Button
              style={heroButtonStyle}
              icon={<ThunderboltOutlined />}
              onClick={() => history.push('/cluster/event')}
            >
              查看事件
            </Button>
            <Button
              style={heroButtonStyle}
              icon={<TeamOutlined />}
              onClick={() => history.push('/cluster/namespace')}
            >
              命名空间
            </Button>
            <span className="kr-hero-meta" style={{ fontSize: 12 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  marginRight: 6,
                  borderRadius: '50%',
                  background:
                    healthy === undefined
                      ? '#cbd5e1'
                      : healthy
                        ? '#4ade80'
                        : '#f87171',
                }}
              />
              {healthy === undefined
                ? '检测中'
                : healthy
                  ? 'API 连接正常'
                  : 'API 连接异常'}
            </span>
          </Space>
        </div>
      </div>

      <Spin spinning={loading}>
        <Row gutter={[12, 12]}>
          {METRICS.map((metric) => (
            <Col key={metric.key} xs={12} sm={8} md={6} lg={4} xl={4}>
              <MetricCard metric={metric} value={counts[metric.key] ?? 0} />
            </Col>
          ))}
        </Row>
      </Spin>

      {warnings.length ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
          title="部分资源统计失败"
          description={warnings.join('；')}
        />
      ) : null}

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card
            title="最近事件"
            extra={
              <Typography.Link onClick={() => history.push('/cluster/event')}>
                查看全部 <RightOutlined style={{ fontSize: 10 }} />
              </Typography.Link>
            }
            styles={{ body: { padding: 0 } }}
          >
            {events.length ? (
              <Table
                size="small"
                rowKey={(record) =>
                  `${record.metadata?.namespace ?? ''}/${record.metadata?.name}`
                }
                columns={eventColumns}
                dataSource={events}
                loading={eventsLoading}
                pagination={false}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无事件"
                style={{ padding: 40 }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="资源分布" styles={{ body: { padding: 16 } }}>
            <Space orientation="vertical" style={{ width: '100%' }} size={10}>
              {METRICS.slice(0, 8).map((metric) => (
                <div key={metric.key}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                    }}
                  >
                    <Space size={6}>
                      <span style={{ color: metric.color }}>{metric.icon}</span>
                      <span>{metric.label}</span>
                    </Space>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {counts[metric.key] ?? 0}
                    </span>
                  </div>
                  <Progress
                    percent={Math.round(
                      ((counts[metric.key] ?? 0) / maxCount) * 100,
                    )}
                    showInfo={false}
                    strokeColor={metric.color}
                    size="small"
                  />
                </div>
              ))}
            </Space>
          </Card>
          <Card title="快捷入口" style={{ marginTop: 16 }} styles={{ body: { padding: 8 } }}>
            <Space orientation="vertical" style={{ width: '100%' }} size={0}>
              {QUICK_LINKS.map((link) => (
                <div
                  key={link.path}
                  className="kr-quick-link"
                  onClick={() => history.push(link.path)}
                >
                  <Space size={10}>
                    <span style={{ color: '#1677ff' }}>{link.icon}</span>
                    <span>{link.label}</span>
                  </Space>
                  <RightOutlined style={{ fontSize: 10, color: '#98a2b3' }} />
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};

export default OverviewPage;
