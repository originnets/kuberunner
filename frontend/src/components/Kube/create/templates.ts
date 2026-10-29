/**
 * 创建抽屉 YAML 模式下的模板，按当前命名空间生成。
 */
export type CreateKind =
  | 'deployment'
  | 'statefulset'
  | 'daemonset'
  | 'pod'
  | 'service'
  | 'ingress'
  | 'configmap'
  | 'secret'
  | 'pvc'
  | 'pv'
  | 'storageclass'
  | 'namespace';

export interface CreateKindMeta {
  kind: CreateKind;
  title: string;
  /** 后端展示用的 Kubernetes Kind */
  k8sKind: string;
  namespaced: boolean;
}

export const CREATE_KINDS: Record<CreateKind, CreateKindMeta> = {
  deployment: {
    kind: 'deployment',
    title: 'Deployment',
    k8sKind: 'Deployment',
    namespaced: true,
  },
  statefulset: {
    kind: 'statefulset',
    title: 'StatefulSet',
    k8sKind: 'StatefulSet',
    namespaced: true,
  },
  daemonset: {
    kind: 'daemonset',
    title: 'DaemonSet',
    k8sKind: 'DaemonSet',
    namespaced: true,
  },
  pod: {
    kind: 'pod',
    title: 'Pod',
    k8sKind: 'Pod',
    namespaced: true,
  },
  service: {
    kind: 'service',
    title: 'Service',
    k8sKind: 'Service',
    namespaced: true,
  },
  ingress: {
    kind: 'ingress',
    title: 'Ingress',
    k8sKind: 'Ingress',
    namespaced: true,
  },
  configmap: {
    kind: 'configmap',
    title: 'ConfigMap',
    k8sKind: 'ConfigMap',
    namespaced: true,
  },
  secret: {
    kind: 'secret',
    title: 'Secret',
    k8sKind: 'Secret',
    namespaced: true,
  },
  pvc: {
    kind: 'pvc',
    title: 'PersistentVolumeClaim',
    k8sKind: 'PersistentVolumeClaim',
    namespaced: true,
  },
  pv: {
    kind: 'pv',
    title: 'PersistentVolume',
    k8sKind: 'PersistentVolume',
    namespaced: false,
  },
  storageclass: {
    kind: 'storageclass',
    title: 'StorageClass',
    k8sKind: 'StorageClass',
    namespaced: false,
  },
  namespace: {
    kind: 'namespace',
    title: '命名空间',
    k8sKind: 'Namespace',
    namespaced: false,
  },
};

/** 资源接口 id → 表单类型（PVC/PV 的接口 id 与表单 key 不同） */
export function toCreateKind(id: string): CreateKind | undefined {
  if (id === 'persistentvolumeclaim') return 'pvc';
  if (id === 'persistentvolume') return 'pv';
  return id in CREATE_KINDS ? (id as CreateKind) : undefined;
}

const indent = (text: string, spaces: number) =>
  text
    .split('\n')
    .map((line) => (line ? ' '.repeat(spaces) + line : line))
    .join('\n');

export function buildTemplate(kind: CreateKind, namespace?: string): string {
  const ns = namespace || 'default';

  switch (kind) {
    case 'deployment':
      return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo
  namespace: ${ns}
  labels:
    app: demo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: demo
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 25%
  template:
    metadata:
      labels:
        app: demo
    spec:
      containers:
        - name: demo
          image: nginx:1.25
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 80
              protocol: TCP
          env:
            - name: APP_ENV
              value: production
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 15
            periodSeconds: 30
          volumeMounts:
            - name: config
              mountPath: /etc/demo
      volumes:
        - name: config
          configMap:
            name: demo-config
`;

    case 'statefulset':
      return `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
  namespace: ${ns}
  labels:
    app: mysql
spec:
  serviceName: mysql-headless
  replicas: 3
  podManagementPolicy: OrderedReady
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
        - name: mysql
          image: mysql:8.0
          ports:
            - name: mysql
              containerPort: 3306
          env:
            - name: MYSQL_ROOT_PASSWORD
              value: change-me
          resources:
            requests:
              cpu: 500m
              memory: 1Gi
            limits:
              cpu: 2
              memory: 4Gi
          volumeMounts:
            - name: data
              mountPath: /var/lib/mysql
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes:
          - ReadWriteOnce
        resources:
          requests:
            storage: 20Gi
`;

    case 'daemonset':
      return `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
  namespace: ${ns}
  labels:
    app: node-exporter
spec:
  selector:
    matchLabels:
      app: node-exporter
  updateStrategy:
    type: RollingUpdate
  template:
    metadata:
      labels:
        app: node-exporter
    spec:
      hostNetwork: true
      hostPID: true
      tolerations:
        - operator: Exists
      containers:
        - name: node-exporter
          image: prom/node-exporter:v1.7.0
          ports:
            - name: metrics
              containerPort: 9100
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 128Mi
`;

    case 'pod':
      return `apiVersion: v1
kind: Pod
metadata:
  name: demo-pod
  namespace: ${ns}
  labels:
    app: demo
spec:
  restartPolicy: Always
  containers:
    - name: demo
      image: nginx:1.25
      imagePullPolicy: IfNotPresent
      ports:
        - name: http
          containerPort: 80
          protocol: TCP
      env:
        - name: APP_ENV
          value: production
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
        limits:
          cpu: 500m
          memory: 256Mi
`;

    case 'service':
      return `apiVersion: v1
kind: Service
metadata:
  name: demo
  namespace: ${ns}
  labels:
    app: demo
spec:
  type: ClusterIP
  selector:
    app: demo
  ports:
    - name: http
      port: 80
      targetPort: 8080
      protocol: TCP
`;

    case 'ingress':
      return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: demo
  namespace: ${ns}
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: 10m
spec:
  ingressClassName: nginx
  rules:
    - host: demo.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: demo
                port:
                  number: 80
`;

    case 'configmap':
      return `apiVersion: v1
kind: ConfigMap
metadata:
  name: demo-config
  namespace: ${ns}
data:
  app.conf: |
    server.port=8080
    log.level=info
`;

    case 'secret':
      return `apiVersion: v1
kind: Secret
metadata:
  name: demo-secret
  namespace: ${ns}
type: Opaque
stringData:
  username: admin
  password: change-me
`;

    case 'pvc':
      return `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: demo-data
  namespace: ${ns}
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  resources:
    requests:
      storage: 10Gi
`;

    case 'pv':
      return `apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-demo
spec:
  capacity:
    storage: 50Gi
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  storageClassName: nfs
  nfs:
    server: 192.168.1.10
    path: /data/demo
`;

    case 'storageclass':
      return `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/no-provisioner
parameters:
  type: gp3
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
mountOptions:
  - discard
`;

    case 'namespace':
      return `apiVersion: v1
kind: Namespace
metadata:
  name: demo-namespace
  labels:
    team: platform
`;

    default:
      return '';
  }
}

export { indent };
