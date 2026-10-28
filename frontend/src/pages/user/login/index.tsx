import {
  ArrowRightOutlined,
  CheckCircleFilled,
  CloudServerOutlined,
  CodeOutlined,
  DeploymentUnitOutlined,
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Helmet, history, useModel } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  ConfigProvider,
  Form,
  Input,
  theme,
  Tooltip,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useState } from 'react';
import { getHealth, login } from '@/services/kuberunner';
import { saveStoredUser, saveToken } from '@/utils/auth';
import Settings from '../../../../config/defaultSettings';

const LAST_USER_KEY = 'kuberunner.lastUser';

/**
 * 校验回跳地址，避免开放重定向。
 */
const getSafeRedirectUrl = (redirect: string | null): string => {
  if (!redirect?.startsWith('/')) return '/overview';
  if (redirect.startsWith('//')) return '/overview';

  try {
    const parsed = new URL(redirect, window.location.origin);
    if (parsed.origin !== window.location.origin) return '/overview';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/overview';
  }
};

const readLastUser = (): string => {
  try {
    return localStorage.getItem(LAST_USER_KEY) ?? '';
  } catch {
    return '';
  }
};

const FEATURES = [
  {
    icon: <CloudServerOutlined />,
    title: '多集群统一入口',
    desc: '集群、命名空间一键切换，无需维护多个 kubeconfig 上下文',
  },
  {
    icon: <DeploymentUnitOutlined />,
    title: '完整的资源管理',
    desc: '工作负载、网络、配置、存储的创建、更新与 YAML 编排',
  },
  {
    icon: <CodeOutlined />,
    title: '日志与 Web 终端',
    desc: '容器日志实时查看，浏览器内直接 exec 进入容器',
  },
  {
    icon: <SafetyCertificateOutlined />,
    title: '登录态保护',
    desc: 'Token 鉴权，接口与终端连接均需有效凭证',
  },
];

interface HealthState {
  state: 'loading' | 'ok' | 'error';
  clusters?: number;
  latency?: number;
}

const useStyles = createStyles(() => ({
  shell: {
    position: 'relative',
    zIndex: 2,
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 460,
    margin: '0 auto',
    padding: '64px 24px 32px',
    '@media (min-width: 1080px)': {
      gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 440px)',
      gap: 72,
      maxWidth: 1120,
      padding: '96px 24px 48px',
    },
  },
  brand: {
    display: 'none',
    '@media (min-width: 1080px)': {
      display: 'flex',
      flexDirection: 'column',
    },
  },
  logoRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 20,
    fontWeight: 600,
    color: '#f8fafc',
    img: { width: 40, height: 40, borderRadius: 10 },
  },
  headline: {
    margin: '30px 0 14px',
    fontSize: 40,
    lineHeight: 1.2,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: '#f8fafc',
  },
  gradient: {
    background:
      'linear-gradient(120deg, #60a5fa 0%, #a78bfa 55%, #22d3ee 100%)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  },
  lead: {
    margin: '0 0 28px',
    maxWidth: 460,
    fontSize: 15,
    lineHeight: 1.8,
    color: 'rgba(203, 213, 225, 0.78)',
  },
  features: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  feature: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
  },
  featureIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
    width: 34,
    height: 34,
    marginTop: 2,
    borderRadius: 10,
    fontSize: 16,
    color: '#93c5fd',
    background: 'rgba(59, 130, 246, 0.12)',
    border: '1px solid rgba(96, 165, 250, 0.22)',
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#e2e8f0',
  },
  featureDesc: {
    marginTop: 2,
    fontSize: 12.5,
    lineHeight: 1.6,
    color: 'rgba(148, 163, 184, 0.85)',
  },
  statusCard: {
    marginTop: 30,
    maxWidth: 460,
    padding: '16px 18px',
    borderRadius: 14,
    background: 'rgba(10, 22, 42, 0.66)',
    border: '1px solid rgba(96, 165, 250, 0.18)',
    backdropFilter: 'blur(10px)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
  statusTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12.5,
    color: 'rgba(203, 213, 225, 0.9)',
  },
  statusMeta: {
    marginLeft: 'auto',
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
    fontSize: 11.5,
    color: 'rgba(148, 163, 184, 0.85)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#64748b',
    boxShadow: '0 0 0 3px rgba(148, 163, 184, 0.14)',
  },
  dotOk: {
    background: '#22c55e',
    boxShadow: '0 0 0 3px rgba(34, 197, 94, 0.18)',
  },
  dotError: {
    background: '#ef4444',
    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.18)',
  },
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 10,
    marginTop: 14,
    div: {
      padding: '10px 12px',
      borderRadius: 10,
      background: 'rgba(148, 163, 184, 0.07)',
      border: '1px solid rgba(148, 163, 184, 0.1)',
    },
    span: {
      display: 'block',
      fontSize: 11,
      color: 'rgba(148, 163, 184, 0.8)',
    },
    b: {
      display: 'block',
      marginTop: 4,
      fontSize: 15,
      fontWeight: 600,
      color: '#e2e8f0',
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
    },
  },
  card: {
    padding: '30px 28px 22px',
    borderRadius: 20,
    background: 'rgba(9, 19, 36, 0.78)',
    border: '1px solid rgba(96, 165, 250, 0.2)',
    backdropFilter: 'blur(18px)',
    boxShadow:
      '0 40px 90px -50px rgba(2, 8, 20, 0.95), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  },
  cardHead: {
    marginBottom: 22,
    h2: {
      margin: 0,
      fontSize: 22,
      fontWeight: 600,
      color: '#f8fafc',
    },
    p: {
      margin: '6px 0 0',
      fontSize: 12.5,
      color: 'rgba(148, 163, 184, 0.9)',
    },
  },
  submit: {
    height: 44,
    fontWeight: 600,
    border: 'none',
    background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
    boxShadow: '0 14px 32px -16px rgba(37, 99, 235, 0.95)',
    '&:hover': {
      background: 'linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)',
    },
  },
  caps: {
    marginTop: -6,
    marginBottom: 12,
    fontSize: 12,
    color: '#fbbf24',
  },
  cardFoot: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 14,
    borderTop: '1px solid rgba(148, 163, 184, 0.12)',
    fontSize: 11.5,
    color: 'rgba(148, 163, 184, 0.75)',
  },
  pageFoot: {
    position: 'relative',
    zIndex: 2,
    padding: '18px 24px 26px',
    textAlign: 'center',
    fontSize: 11.5,
    letterSpacing: '0.02em',
    color: 'rgba(148, 163, 184, 0.55)',
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
  },
  mobileBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
    fontSize: 18,
    fontWeight: 600,
    color: '#f8fafc',
    img: { width: 34, height: 34, borderRadius: 9 },
    '@media (min-width: 1080px)': { display: 'none' },
  },
}));

const Login: React.FC = () => {
  const { setInitialState } = useModel('@@initialState');
  const { message } = App.useApp();
  const { styles } = useStyles();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [health, setHealth] = useState<HealthState>({ state: 'loading' });

  const checkHealth = async () => {
    setHealth({ state: 'loading' });
    const started = performance.now();
    try {
      const data = await getHealth();
      setHealth({
        state: 'ok',
        clusters: data?.clusters?.length ?? 0,
        latency: Math.max(1, Math.round(performance.now() - started)),
      });
    } catch {
      setHealth({ state: 'error' });
    }
  };

  useEffect(() => {
    void checkHealth();
  }, []);

  const handleSubmit = async (values: {
    username: string;
    password: string;
  }) => {
    setSubmitting(true);
    setError(undefined);
    try {
      const user = await login(values.username, values.password);
      if (!user?.token) {
        throw new Error('登录响应缺少凭证，请检查后端版本');
      }

      saveToken(user.token);
      const currentUser = {
        name: user.username ?? values.username,
        access: 'admin',
      };
      saveStoredUser(currentUser);
      try {
        localStorage.setItem(LAST_USER_KEY, values.username);
      } catch {
        // 忽略存储失败
      }

      await setInitialState((s) => ({
        ...s,
        currentUser,
      }));
      message.success('登录成功，正在进入控制台…');
      const redirect = new URLSearchParams(window.location.search).get(
        'redirect',
      );
      history.replace(getSafeRedirectUrl(redirect));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '登录失败，请检查用户名和密码',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const statusText =
    health.state === 'ok'
      ? '连接正常'
      : health.state === 'error'
        ? '后端不可达'
        : '检测中';

  const dotClass = [
    styles.dot,
    health.state === 'ok' ? styles.dotOk : '',
    health.state === 'error' ? styles.dotError : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#3b82f6',
          colorBgContainer: 'rgba(8, 18, 35, 0.55)',
          colorBgElevated: '#0b1729',
          colorBorder: 'rgba(96, 165, 250, 0.24)',
          colorText: '#e2e8f0',
          colorTextSecondary: '#94a3b8',
          borderRadius: 10,
        },
      }}
    >
      <Helmet>
        <title>登录 - {Settings.title}</title>
      </Helmet>

      <div className="kr-login-page">
        <div className="kr-login-grid" />
        <div className="kr-orb kr-orb-blue" />
        <div className="kr-orb kr-orb-purple" />

        <div className={styles.shell}>
          <section className={styles.brand}>
            <div className={styles.logoRow}>
              <img alt="KubeRunner" src="/logo.svg" />
              <span>KubeRunner</span>
            </div>

            <h1 className={styles.headline}>
              掌控每一个
              <br />
              <span className={styles.gradient}>Kubernetes 集群</span>
            </h1>
            <p className={styles.lead}>
              面向运维与开发的轻量控制台：多集群切换、资源编排、日志与终端，
              不必再在多个 kubectl 上下文之间来回切换。
            </p>

            <ul className={styles.features}>
              {FEATURES.map((feature) => (
                <li key={feature.title} className={styles.feature}>
                  <span className={styles.featureIcon}>{feature.icon}</span>
                  <span>
                    <div className={styles.featureTitle}>{feature.title}</div>
                    <div className={styles.featureDesc}>{feature.desc}</div>
                  </span>
                </li>
              ))}
            </ul>

            <div className={styles.statusCard}>
              <div className={styles.statusTop}>
                <span className={dotClass} />
                <span>API 状态 · {statusText}</span>
                <span className={styles.statusMeta}>
                  {health.state === 'ok' && health.latency
                    ? `${health.latency} ms`
                    : '—'}
                </span>
                <Tooltip title="重新检测">
                  <Button
                    type="text"
                    size="small"
                    aria-label="重新检测"
                    icon={<ReloadOutlined />}
                    onClick={() => void checkHealth()}
                  />
                </Tooltip>
              </div>
              <div className={styles.statusGrid}>
                <div>
                  <span>集群</span>
                  <b>{health.clusters ?? '—'}</b>
                </div>
                <div>
                  <span>认证</span>
                  <b>Token</b>
                </div>
                <div>
                  <span>终端</span>
                  <b>WS</b>
                </div>
              </div>
            </div>
          </section>

          <section className={`kr-login-card ${styles.card}`}>
            <div className={styles.mobileBrand}>
              <img alt="KubeRunner" src="/logo.svg" />
              <span>KubeRunner</span>
            </div>

            <div className={styles.cardHead}>
              <h2>登录控制台</h2>
              <p>使用后端 config.yaml 中配置的账号密码</p>
            </div>

            {error ? (
              <Alert
                type="error"
                showIcon
                title="登录失败"
                description={error}
                style={{ marginBottom: 18 }}
              />
            ) : null}

            {health.state === 'error' ? (
              <Alert
                type="warning"
                showIcon
                title="后端服务不可达"
                description="请确认后端已启动，或开发代理 KUBERUNNER_API 配置正确。"
                style={{ marginBottom: 18 }}
              />
            ) : null}

            <Form
              layout="vertical"
              requiredMark={false}
              initialValues={{ username: readLastUser(), password: '' }}
              onFinish={handleSubmit}
              size="large"
            >
              <Form.Item
                name="username"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="用户名"
                  aria-label="用户名"
                  autoComplete="username"
                  autoFocus
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="密码"
                  aria-label="密码"
                  autoComplete="current-password"
                  onKeyUp={(event) => {
                    if (typeof event.getModifierState === 'function') {
                      setCapsLock(event.getModifierState('CapsLock'));
                    }
                  }}
                  onBlur={() => setCapsLock(false)}
                />
              </Form.Item>

              {capsLock ? (
                <div className={styles.caps}>
                  ⚠ 大写锁定已开启，请注意密码大小写
                </div>
              ) : null}

              <Form.Item style={{ marginBottom: 8 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  className={styles.submit}
                  loading={submitting}
                >
                  登 录 <ArrowRightOutlined />
                </Button>
              </Form.Item>
            </Form>

            <div className={styles.cardFoot}>
              <span>
                <CheckCircleFilled
                  style={{ color: '#22c55e', marginRight: 6 }}
                />
                凭证仅保存在本机浏览器
              </span>
              <span>{__APP_VERSION__}</span>
            </div>
          </section>
        </div>

        <div className={styles.pageFoot}>
          KubeRunner · Kubernetes 多集群管理平台
        </div>
      </div>
    </ConfigProvider>
  );
};

export default Login;
