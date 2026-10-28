import {
  CheckCircleFilled,
  CloudServerOutlined,
  CodeOutlined,
  DeploymentUnitOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Helmet, history, useModel } from '@umijs/max';
import { Alert, App, Button, Form, Input } from 'antd';
import { createStyles } from 'antd-style';
import React, { useState } from 'react';
import { login } from '@/services/kuberunner';
import { saveStoredUser, saveToken } from '@/utils/auth';
import Settings from '../../../../config/defaultSettings';

const LAST_USER_KEY = 'kuberunner.lastUser';

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
    desc: '集群、命名空间一键切换',
  },
  {
    icon: <DeploymentUnitOutlined />,
    title: '完整的资源管理',
    desc: '创建、编辑与 YAML 编排',
  },
  {
    icon: <CodeOutlined />,
    title: '日志与 Web 终端',
    desc: '浏览器内查看日志、进入容器',
  },
  {
    icon: <SafetyCertificateOutlined />,
    title: '登录态保护',
    desc: '接口与终端均需有效凭证',
  },
];

const useStyles = createStyles(({ token }) => ({
  page: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    padding: 24,
    overflow: 'hidden',
  },
  shell: {
    position: 'relative',
    zIndex: 2,
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 32,
    alignContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 1080,
    margin: '0 auto',
    flex: 1,
    padding: '24px 0',
    '@media (min-width: 960px)': {
      gridTemplateColumns: 'minmax(0, 1fr) 400px',
      gap: 72,
    },
  },
  brand: {
    display: 'none',
    '@media (min-width: 960px)': {
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
    margin: '28px 0 14px',
    fontSize: 36,
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    color: '#f8fafc',
  },
  accent: {
    background: 'linear-gradient(120deg, #93c5fd 0%, #c4b5fd 100%)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  },
  lead: {
    margin: 0,
    maxWidth: 440,
    fontSize: 15,
    lineHeight: 1.8,
    color: 'rgba(203, 213, 225, 0.82)',
  },
  features: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    margin: '26px 0 0',
    padding: 0,
    listStyle: 'none',
  },
  feature: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
    width: 34,
    height: 34,
    marginTop: 1,
    borderRadius: 10,
    fontSize: 16,
    color: '#93c5fd',
    background: 'rgba(59, 130, 246, 0.16)',
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.5,
    color: '#e2e8f0',
  },
  featureDesc: {
    fontSize: 12.5,
    lineHeight: 1.6,
    color: 'rgba(148, 163, 184, 0.9)',
  },
  card: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
    padding: '36px 32px 24px',
    background: '#ffffff',
    border: '1px solid #eef2f7',
    borderRadius: 18,
    boxShadow: '0 24px 64px -32px rgba(15, 23, 42, 0.28)',
  },
  mobileBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
    fontSize: 18,
    fontWeight: 600,
    color: '#1f2937',
    img: { width: 34, height: 34, borderRadius: 9 },
    '@media (min-width: 960px)': { display: 'none' },
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 600,
    color: '#0f172a',
  },
  subtitle: {
    margin: '8px 0 22px',
    fontSize: 13,
    color: '#94a3b8',
  },
  submit: {
    height: 44,
    fontWeight: 600,
    borderRadius: 10,
  },
  caps: {
    marginTop: -8,
    marginBottom: 12,
    fontSize: 12,
    color: token.colorWarning,
  },
  hint: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
    paddingTop: 14,
    borderTop: '1px solid #f1f5f9',
    fontSize: 12,
    color: '#94a3b8',
  },
  footer: {
    position: 'relative',
    zIndex: 2,
    padding: '12px 0 4px',
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(148, 163, 184, 0.65)',
  },
}));

const Login: React.FC = () => {
  const { setInitialState } = useModel('@@initialState');
  const { message } = App.useApp();
  const { styles } = useStyles();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

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
      message.success('登录成功');
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

  return (
    <>
      <Helmet>
        <title>登录 - {Settings.title}</title>
      </Helmet>

      <div className={`kr-login-page ${styles.page}`}>
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
              简单、直接的
              <br />
              <span className={styles.accent}>Kubernetes 管理台</span>
            </h1>
            <p className={styles.lead}>
              多集群切换、资源编排、日志与 Web 终端，集中在一个控制台完成，
              不必在多个 kubectl 上下文之间来回切换。
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
          </section>

          <section className={styles.card}>
            <div className={styles.mobileBrand}>
              <img alt="KubeRunner" src="/logo.svg" />
              <span>KubeRunner</span>
            </div>

            <h2 className={styles.title}>登录 KubeRunner</h2>
            <p className={styles.subtitle}>
              使用后端 config.yaml 中配置的账号密码
            </p>

            {error ? (
              <Alert
                type="error"
                showIcon
                title="登录失败"
                description={error}
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
                <div className={styles.caps}>大写锁定已开启，请注意密码大小写</div>
              ) : null}

              <Form.Item style={{ marginBottom: 4 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  className={styles.submit}
                  loading={submitting}
                >
                  登 录
                </Button>
              </Form.Item>
            </Form>

            <div className={styles.hint}>
              <CheckCircleFilled style={{ color: '#22c55e' }} />
              凭证仅保存在本机浏览器
            </div>
          </section>
        </div>

        <div className={styles.footer}>KubeRunner · Kubernetes 多集群管理平台</div>
      </div>
    </>
  );
};

export default Login;
