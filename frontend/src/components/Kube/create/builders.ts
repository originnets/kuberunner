import { parseKeyValueInput } from '../helpers';

export interface CreateContext {
  cluster: string;
  namespace: string;
}

export type WorkloadKind = 'Deployment' | 'StatefulSet' | 'DaemonSet';

export interface PortInput {
  name?: string;
  containerPort?: number;
  protocol?: string;
}

export interface EnvInput {
  name?: string;
  value?: string;
}

export interface ProbeInput {
  enabled?: boolean;
  type?: 'http' | 'tcp';
  path?: string;
  port?: number;
  initialDelaySeconds?: number;
  periodSeconds?: number;
  timeoutSeconds?: number;
  failureThreshold?: number;
}

export interface ContainerInput {
  name?: string;
  image?: string;
  imagePullPolicy?: string;
  ports?: PortInput[];
  env?: EnvInput[];
  envFromConfigMap?: string;
  envFromSecret?: string;
  command?: string;
  args?: string;
  cpuRequest?: string;
  memoryRequest?: string;
  cpuLimit?: string;
  memoryLimit?: string;
  readiness?: ProbeInput;
  liveness?: ProbeInput;
}

export interface VolumeInput {
  name?: string;
  type?: 'emptyDir' | 'configMap' | 'secret' | 'pvc' | 'hostPath';
  source?: string;
  container?: string;
  mountPath?: string;
  readOnly?: boolean;
}

const text = (value?: string) => (value ?? '').trim();

const requireName = (value: string | undefined, field: string) => {
  const name = text(value);
  if (!name) throw new Error(`请填写${field}`);
  return name;
};

const splitLines = (value?: string) =>
  (value ?? '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

function buildMetadata(
  values: Record<string, any>,
  ctx: CreateContext,
  namespaced = true,
) {
  const metadata: Record<string, unknown> = {
    name: requireName(values.name, '名称'),
  };
  if (namespaced) {
    metadata.namespace =
      text(values.namespace) || text(ctx.namespace) || 'default';
  }
  const labels = parseKeyValueInput(values.labels);
  if (Object.keys(labels).length) metadata.labels = labels;
  const annotations = parseKeyValueInput(values.annotations);
  if (Object.keys(annotations).length) metadata.annotations = annotations;
  return metadata as unknown as KubeAPI.Metadata;
}

function buildProbe(probe?: ProbeInput) {
  if (!probe?.enabled) return undefined;
  const result: Record<string, unknown> = {
    initialDelaySeconds: Number(probe.initialDelaySeconds ?? 5),
    periodSeconds: Number(probe.periodSeconds ?? 10),
    timeoutSeconds: Number(probe.timeoutSeconds ?? 3),
    failureThreshold: Number(probe.failureThreshold ?? 3),
  };
  if (probe.type === 'tcp') {
    result.tcpSocket = { port: Number(probe.port ?? 80) };
  } else {
    result.httpGet = {
      path: text(probe.path) || '/',
      port: Number(probe.port ?? 80),
      scheme: 'HTTP',
    };
  }
  return result;
}

function buildContainer(input: ContainerInput): Record<string, unknown> {
  const container: Record<string, unknown> = {
    name: text(input.name) || 'main',
    image: text(input.image) || 'nginx:1.25',
  };
  if (text(input.imagePullPolicy)) {
    container.imagePullPolicy = input.imagePullPolicy;
  }

  const ports = (input.ports ?? [])
    .filter((port) => Number(port.containerPort) > 0)
    .map((port) => ({
      ...(text(port.name) ? { name: text(port.name) } : {}),
      containerPort: Number(port.containerPort),
      protocol: port.protocol || 'TCP',
    }));
  if (ports.length) container.ports = ports;

  const env = (input.env ?? [])
    .filter((item) => text(item.name))
    .map((item) => ({ name: text(item.name), value: item.value ?? '' }));
  if (env.length) container.env = env;

  const envFrom: Record<string, unknown>[] = [];
  if (text(input.envFromConfigMap)) {
    envFrom.push({ configMapRef: { name: input.envFromConfigMap } });
  }
  if (text(input.envFromSecret)) {
    envFrom.push({ secretRef: { name: input.envFromSecret } });
  }
  if (envFrom.length) container.envFrom = envFrom;

  const command = splitLines(input.command);
  if (command.length) container.command = command;
  const args = splitLines(input.args);
  if (args.length) container.args = args;

  const requests: Record<string, string> = {};
  const limits: Record<string, string> = {};
  if (text(input.cpuRequest)) requests.cpu = text(input.cpuRequest);
  if (text(input.memoryRequest)) requests.memory = text(input.memoryRequest);
  if (text(input.cpuLimit)) limits.cpu = text(input.cpuLimit);
  if (text(input.memoryLimit)) limits.memory = text(input.memoryLimit);
  const resources: Record<string, unknown> = {};
  if (Object.keys(requests).length) resources.requests = requests;
  if (Object.keys(limits).length) resources.limits = limits;
  if (Object.keys(resources).length) container.resources = resources;

  const readiness = buildProbe(input.readiness);
  if (readiness) container.readinessProbe = readiness;
  const liveness = buildProbe(input.liveness);
  if (liveness) container.livenessProbe = liveness;

  return container;
}

function buildVolume(
  volume: VolumeInput,
  containers: Record<string, any>[],
): { spec: Record<string, unknown>; mount?: Record<string, unknown> } | undefined {
  const name = text(volume.name);
  if (!name || !volume.type) return undefined;

  let source: Record<string, unknown>;
  switch (volume.type) {
    case 'emptyDir':
      source = { emptyDir: {} };
      break;
    case 'configMap':
      source = { configMap: { name: text(volume.source) } };
      break;
    case 'secret':
      source = { secret: { secretName: text(volume.source) } };
      break;
    case 'pvc':
      source = { persistentVolumeClaim: { claimName: text(volume.source) } };
      break;
    case 'hostPath':
      source = { hostPath: { path: text(volume.source) } };
      break;
    default:
      return undefined;
  }

  if (volume.type !== 'emptyDir' && !text(volume.source)) {
    throw new Error(`存储卷 ${name} 需要填写来源名称`);
  }

  const mountPath = text(volume.mountPath);
  if (!mountPath) return { spec: { name, ...source } };

  const target =
    containers.find((item) => item.name === volume.container) ?? containers[0];
  if (target) {
    target.volumeMounts = [
      ...((target.volumeMounts as Record<string, unknown>[]) ?? []),
      {
        name,
        mountPath,
        ...(volume.readOnly ? { readOnly: true } : {}),
      },
    ];
  }

  return { spec: { name, ...source } };
}

function buildPodSpec(values: Record<string, any>): Record<string, unknown> {
  const containers = ((values.containers ?? []) as ContainerInput[])
    .filter((item) => text(item.name) || text(item.image))
    .map(buildContainer);
  if (!containers.length) {
    throw new Error('至少需要一个容器');
  }

  const volumes = ((values.volumes ?? []) as VolumeInput[])
    .map((item) => buildVolume(item, containers))
    .filter(Boolean) as { spec: Record<string, unknown> }[];

  const podSpec: Record<string, unknown> = { containers };
  if (volumes.length) podSpec.volumes = volumes.map((item) => item.spec);
  if (text(values.serviceAccountName)) {
    podSpec.serviceAccountName = text(values.serviceAccountName);
  }
  const nodeSelector = parseKeyValueInput(values.nodeSelector);
  if (Object.keys(nodeSelector).length) podSpec.nodeSelector = nodeSelector;
  const pullSecrets = (values.imagePullSecrets ?? '')
    .split(',')
    .map((item: string) => item.trim())
    .filter(Boolean);
  if (pullSecrets.length) {
    podSpec.imagePullSecrets = pullSecrets.map((name: string) => ({ name }));
  }
  if (Number(values.terminationGracePeriodSeconds) > 0) {
    podSpec.terminationGracePeriodSeconds = Number(
      values.terminationGracePeriodSeconds,
    );
  }
  if (values.hostNetwork) {
    podSpec.hostNetwork = true;
    podSpec.dnsPolicy = 'ClusterFirstWithHostNet';
  }
  if (text(values.podNodeName)) podSpec.nodeName = text(values.podNodeName);
  if (values.restartPolicy) podSpec.restartPolicy = values.restartPolicy;

  return podSpec;
}
export function buildWorkload(
  kind: WorkloadKind,
  values: Record<string, any>,
  ctx: CreateContext,
): KubeAPI.KubeObject {
  const labels =
    Object.keys(parseKeyValueInput(values.labels)).length > 0
      ? parseKeyValueInput(values.labels)
      : { app: requireName(values.name, '名称') };

  const podSpec = buildPodSpec(values);

  const spec: Record<string, unknown> = {
    selector: { matchLabels: labels },
    template: {
      metadata: { labels },
      spec: podSpec,
    },
  };

  if (kind !== 'DaemonSet') {
    spec.replicas = Number(values.replicas ?? 1);
  }

  if (kind === 'Deployment') {
    spec.strategy = {
      type: 'RollingUpdate',
      rollingUpdate: {
        maxSurge: text(values.maxSurge) || '25%',
        maxUnavailable: text(values.maxUnavailable) || '25%',
      },
    };
    if (values.revisionHistoryLimit !== undefined) {
      spec.revisionHistoryLimit = Number(values.revisionHistoryLimit);
    }
  }
  if (kind === 'StatefulSet') {
    spec.serviceName = text(values.serviceName) || text(values.name);
    spec.podManagementPolicy = values.podManagementPolicy || 'OrderedReady';
  }
  if (kind === 'DaemonSet') {
    spec.updateStrategy = { type: values.updateStrategy || 'RollingUpdate' };
  }

  return {
    apiVersion: 'apps/v1',
    kind,
    metadata: buildMetadata(values, ctx),
    spec,
  };
}

export function buildPod(
  values: Record<string, any>,
  ctx: CreateContext,
): KubeAPI.KubeObject {
  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: buildMetadata(values, ctx),
    spec: buildPodSpec(values),
  };
}
export function buildService(
  values: Record<string, any>,
  ctx: CreateContext,
): KubeAPI.KubeObject {
  const ports = ((values.ports ?? []) as Record<string, any>[])
    .filter((port) => Number(port.port) > 0)
    .map((port) => ({
      ...(text(port.name) ? { name: text(port.name) } : {}),
      port: Number(port.port),
      targetPort: Number(port.targetPort ?? port.port),
      protocol: port.protocol || 'TCP',
      ...(Number(port.nodePort) > 0 ? { nodePort: Number(port.nodePort) } : {}),
    }));
  if (!ports.length) throw new Error('至少需要一个端口');

  const spec: Record<string, unknown> = {
    type: values.type || 'ClusterIP',
    selector: parseKeyValueInput(values.selector),
    ports,
  };
  if (text(values.clusterIP)) spec.clusterIP = text(values.clusterIP);
  if (values.sessionAffinity && values.sessionAffinity !== 'None') {
    spec.sessionAffinity = values.sessionAffinity;
  }
  if (
    (values.type === 'NodePort' || values.type === 'LoadBalancer') &&
    values.externalTrafficPolicy &&
    values.externalTrafficPolicy !== 'Cluster'
  ) {
    spec.externalTrafficPolicy = values.externalTrafficPolicy;
  }

  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: buildMetadata(values, ctx),
    spec,
  };
}

function entriesToMap(entries?: { key?: string; value?: string }[]) {
  const result: Record<string, string> = {};
  (entries ?? []).forEach((entry) => {
    const key = text(entry?.key);
    if (key) result[key] = entry?.value ?? '';
  });
  return result;
}

export function buildConfigMap(
  values: Record<string, any>,
  ctx: CreateContext,
): KubeAPI.KubeObject {
  const data = entriesToMap(values.data);
  if (!Object.keys(data).length) throw new Error('至少填写一个键值对');
  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: buildMetadata(values, ctx),
    data,
  };
}

export function buildSecret(
  values: Record<string, any>,
  ctx: CreateContext,
): KubeAPI.KubeObject {
  const stringData = entriesToMap(values.data);
  if (!Object.keys(stringData).length) throw new Error('至少填写一个键值对');
  return {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: buildMetadata(values, ctx),
    type: values.type || 'Opaque',
    stringData,
  };
}

export function buildPersistentVolumeClaim(
  values: Record<string, any>,
  ctx: CreateContext,
): KubeAPI.KubeObject {
  const spec: Record<string, unknown> = {
    accessModes: values.accessModes?.length
      ? values.accessModes
      : ['ReadWriteOnce'],
    resources: {
      requests: { storage: text(values.storage) || '1Gi' },
    },
  };
  if (text(values.storageClassName)) {
    spec.storageClassName = text(values.storageClassName);
  }
  if (values.volumeMode && values.volumeMode !== 'Filesystem') {
    spec.volumeMode = values.volumeMode;
  }
  const selector = parseKeyValueInput(values.selector);
  if (Object.keys(selector).length) {
    spec.selector = { matchLabels: selector };
  }

  return {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: buildMetadata(values, ctx),
    spec,
  };
}

export function buildNamespace(
  values: Record<string, any>,
  ctx: CreateContext,
): KubeAPI.KubeObject {
  return {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: buildMetadata(values, ctx, false),
  };
}

interface IngressPathInput {
  path?: string;
  pathType?: string;
  serviceName?: string;
  servicePort?: number;
}

interface IngressHostInput {
  host?: string;
  paths?: IngressPathInput[];
}

export function buildIngress(
  values: Record<string, any>,
  ctx: CreateContext,
): KubeAPI.KubeObject {
  const rules = ((values.hosts ?? []) as IngressHostInput[])
    .filter((item) => text(item.host))
    .map((item) => ({
      host: text(item.host),
      http: {
        paths: (item.paths ?? [])
          .filter((path) => text(path.serviceName) && Number(path.servicePort) > 0)
          .map((path) => ({
            path: text(path.path) || '/',
            pathType: path.pathType || 'Prefix',
            backend: {
              service: {
                name: text(path.serviceName),
                port: { number: Number(path.servicePort) },
              },
            },
          })),
      },
    }));

  if (!rules.length) throw new Error('至少配置一个域名或路径');

  const spec: Record<string, unknown> = {
    ingressClassName: text(values.ingressClassName) || 'nginx',
    rules,
  };

  const tls = ((values.tls ?? []) as { secretName?: string; hosts?: string }[])
    .filter((item) => text(item.secretName))
    .map((item) => ({
      secretName: text(item.secretName),
      hosts: (item.hosts ?? '')
        .split(',')
        .map((host) => host.trim())
        .filter(Boolean),
    }));
  if (tls.length) spec.tls = tls;

  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: buildMetadata(values, ctx),
    spec,
  };
}

export function buildPersistentVolume(
  values: Record<string, any>,
  ctx: CreateContext,
): KubeAPI.KubeObject {
  const spec: Record<string, unknown> = {
    capacity: { storage: text(values.storage) || '10Gi' },
    accessModes: values.accessModes?.length ? values.accessModes : ['ReadWriteOnce'],
    persistentVolumeReclaimPolicy: values.reclaimPolicy || 'Retain',
  };
  if (text(values.storageClassName)) {
    spec.storageClassName = text(values.storageClassName);
  }
  if (values.volumeMode && values.volumeMode !== 'Filesystem') {
    spec.volumeMode = values.volumeMode;
  }
  const mountOptions = (values.mountOptions ?? '')
    .split(',')
    .map((item: string) => item.trim())
    .filter(Boolean);
  if (mountOptions.length) spec.mountOptions = mountOptions;

  switch (values.volumeType) {
    case 'nfs':
      if (!text(values.server)) throw new Error('请填写 NFS 服务器地址');
      if (!text(values.path)) throw new Error('请填写 NFS 共享路径');
      spec.nfs = { server: text(values.server), path: text(values.path) };
      break;
    case 'hostPath':
      if (!text(values.path)) throw new Error('请填写节点路径');
      spec.hostPath = { path: text(values.path) };
      break;
    case 'local':
      if (!text(values.path)) throw new Error('请填写节点路径');
      if (!text(values.nodeName)) throw new Error('Local PV 需要指定节点名称');
      spec.local = {
        path: text(values.path),
        ...(text(values.fsType) ? { fsType: text(values.fsType) } : {}),
      };
      spec.nodeAffinity = {
        required: {
          nodeSelectorTerms: [
            {
              matchExpressions: [
                {
                  key: 'kubernetes.io/hostname',
                  operator: 'In',
                  values: [text(values.nodeName)],
                },
              ],
            },
          ],
        },
      };
      break;
    case 'csi':
      if (!text(values.csiDriver)) throw new Error('请填写 CSI Driver');
      spec.csi = {
        driver: text(values.csiDriver),
        volumeHandle:
          text(values.csiVolumeHandle) || text(values.name),
        ...(text(values.fsType) ? { fsType: text(values.fsType) } : {}),
      };
      break;
    case 'cephfs':
      if (!text(values.monitors)) throw new Error('请填写 Monitor 地址');
      spec.cephfs = {
        monitors: text(values.monitors)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        path: text(values.path) || '/',
        user: text(values.user) || 'admin',
        secretRef: {
          name: text(values.secretName) || 'ceph-secret',
          namespace: text(values.secretNamespace) || 'default',
        },
      };
      break;
    case 'rbd':
      if (!text(values.monitors)) throw new Error('请填写 Monitor 地址');
      spec.rbd = {
        monitors: text(values.monitors)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        pool: text(values.pool) || 'rbd',
        image: text(values.image) || text(values.name),
        user: text(values.user) || 'admin',
        secretRef: {
          name: text(values.secretName) || 'ceph-secret',
          namespace: text(values.secretNamespace) || 'default',
        },
        ...(values.fsType ? { fsType: text(values.fsType) } : {}),
      };
      break;
    default:
      throw new Error('请选择存储类型');
  }

  return {
    apiVersion: 'v1',
    kind: 'PersistentVolume',
    metadata: buildMetadata(values, ctx, false),
    spec,
  };
}

export function buildStorageClass(
  values: Record<string, any>,
  ctx: CreateContext,
): KubeAPI.KubeObject {
  const object: Record<string, unknown> = {
    apiVersion: 'storage.k8s.io/v1',
    kind: 'StorageClass',
    metadata: buildMetadata(values, ctx, false),
    provisioner: text(values.provisioner) || 'kubernetes.io/no-provisioner',
    reclaimPolicy: values.reclaimPolicy || 'Delete',
    volumeBindingMode: values.volumeBindingMode || 'Immediate',
  };

  const parameters = entriesToMap(values.parameters);
  if (Object.keys(parameters).length) object.parameters = parameters;

  if (values.allowVolumeExpansion === true) {
    object.allowVolumeExpansion = true;
  }

  const mountOptions = (values.mountOptions ?? '')
    .split(',')
    .map((item: string) => item.trim())
    .filter(Boolean);
  if (mountOptions.length) object.mountOptions = mountOptions;

  return object as unknown as KubeAPI.KubeObject;
}