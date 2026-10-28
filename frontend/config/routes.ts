export default [
  {
    path: '/user',
    layout: false,
    routes: [
      {
        name: '登录',
        path: '/user/login',
        component: './user/login',
      },
    ],
  },
  {
    path: '/',
    redirect: '/overview',
  },
  {
    path: '/overview',
    name: '集群概览',
    icon: 'dashboard',
    component: './overview',
  },
  {
    path: '/workload',
    name: '工作负载',
    icon: 'appstore',
    routes: [
      { path: '/workload', redirect: '/workload/pod' },
      { path: '/workload/pod', name: 'Pod', component: './workload/pod' },
      {
        path: '/workload/deployment',
        name: 'Deployment',
        component: './workload/deployment',
      },
      {
        path: '/workload/statefulset',
        name: 'StatefulSet',
        component: './workload/statefulset',
      },
      {
        path: '/workload/daemonset',
        name: 'DaemonSet',
        component: './workload/daemonset',
      },
    ],
  },
  {
    path: '/network',
    name: '网络',
    icon: 'global',
    routes: [
      { path: '/network', redirect: '/network/service' },
      {
        path: '/network/service',
        name: 'Service',
        component: './network/service',
      },
      {
        path: '/network/ingress',
        name: 'Ingress',
        component: './network/ingress',
      },
    ],
  },
  {
    path: '/config',
    name: '配置',
    icon: 'setting',
    routes: [
      { path: '/config', redirect: '/config/configmap' },
      {
        path: '/config/configmap',
        name: 'ConfigMap',
        component: './config/configmap',
      },
      { path: '/config/secret', name: 'Secret', component: './config/secret' },
    ],
  },
  {
    path: '/storage',
    name: '存储',
    icon: 'database',
    routes: [
      { path: '/storage', redirect: '/storage/pvc' },
      { path: '/storage/pv', name: 'PV', component: './storage/pv' },
      { path: '/storage/pvc', name: 'PVC', component: './storage/pvc' },
      {
        path: '/storage/storageclass',
        name: 'StorageClass',
        component: './storage/storageclass',
      },
    ],
  },
  {
    path: '/cluster',
    name: '集群',
    icon: 'cluster',
    routes: [
      { path: '/cluster', redirect: '/cluster/node' },
      { path: '/cluster/node', name: '节点', component: './cluster/node' },
      {
        path: '/cluster/manage',
        name: '集群管理',
        component: './cluster/manage',
      },
      {
        path: '/cluster/namespace',
        name: '命名空间',
        component: './cluster/namespace',
      },
      { path: '/cluster/event', name: '事件', component: './cluster/event' },
    ],
  },
  {
    component: './exception/404',
    layout: false,
    path: '/*',
  },
];
