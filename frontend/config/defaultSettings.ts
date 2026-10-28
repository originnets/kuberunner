import type { ProLayoutProps } from '@ant-design/pro-components';

/**
 * 全局布局默认配置：KubeRunner Kubernetes 多集群管理平台
 */
const Settings: ProLayoutProps & {
  logo?: string;
  title?: string;
} = {
  navTheme: 'light',
  colorPrimary: '#1677ff',
  layout: 'side',
  contentWidth: 'Fluid',
  fixedHeader: true,
  fixSiderbar: true,
  colorWeak: false,
  title: 'KubeRunner',
  logo: '/logo.svg',
  iconfontUrl: '',
  token: {},
};

export default Settings;
