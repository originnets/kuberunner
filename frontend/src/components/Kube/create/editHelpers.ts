import { parseKeyValueInput } from '../helpers';
import {
  buildConfigMap,
  buildIngress,
  buildNamespace,
  buildPersistentVolume,
  buildPersistentVolumeClaim,
  buildPod,
  buildSecret,
  buildService,
  buildStorageClass,
  buildWorkload,
  type ContainerInput,
  type CreateContext,
  type ProbeInput,
  type VolumeInput,
  type WorkloadKind,
} from './builders';

type AnyRecord = Record<string, any>;

const obj = (value: unknown): AnyRecord =>
  value && typeof value === 'object' ? (value as AnyRecord) : {};

const joinKV = (value?: Record<string, string>) =>
  Object.entries(value ?? {})
    .map(([key, item]) => `${key}=${item}`)
    .join('\n');

const entries = (value?: Record<string, string>) =>
  Object.entries(value ?? {}).map(([key, item]) => ({
    key,
    value: item,
  }));

const encodeBase64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const decodeBase64 = (text: string) => {
  try {
    const binary = atob(text);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
};

function probeToForm(probe: unknown): ProbeInput {
  const value = obj(probe);
  if (!Object.keys(value).length) return { enabled: false };
  const tcp = obj(value.tcpSocket);
  const http = obj(value.httpGet);
  return {
    enabled: true,
    type: tcp.port ? 'tcp' : 'http',
    path: http.path ?? '/',
    port: tcp.port ?? http.port ?? 80,
    initialDelaySeconds: value.initialDelaySeconds,
    periodSeconds: value.periodSeconds,
    timeoutSeconds: value.timeoutSeconds,
    failureThreshold: value.failureThreshold,
  };
}

function containerToForm(container: unknown): ContainerInput {
  const value = obj(container);
  const resources = obj(value.resources);
  const requests = obj(resources.requests);
  const limits = obj(resources.limits);
  const envFrom = (value.envFrom ?? []) as AnyRecord[];
  const configMapRef = envFrom.find((item) => item.configMapRef)?.configMapRef;
  const secretRef = envFrom.find((item) => item.secretRef)?.secretRef;

  return {
    name: value.name,
    image: value.image,
    imagePullPolicy: value.imagePullPolicy,
    ports: ((value.ports ?? []) as AnyRecord[]).map((port) => ({
      name: port.name,
      containerPort: port.containerPort,
      protocol: port.protocol,
    })),
    env: ((value.env ?? []) as AnyRecord[])
      .filter((item) => item.name)
      .map((item) => ({ name: item.name, value: item.value ?? '' })),
    envFromConfigMap: configMapRef?.name,
    envFromSecret: secretRef?.name,
    command: ((value.command ?? []) as string[]).join('\n'),
    args: ((value.args ?? []) as string[]).join('\n'),
    cpuRequest: requests.cpu,
    memoryRequest: requests.memory,
    cpuLimit: limits.cpu,
    memoryLimit: limits.memory,
    readiness: probeToForm(value.readinessProbe),
    liveness: probeToForm(value.livenessProbe),
  };
}

function volumeToForm(volume: unknown, containers: AnyRecord[]): VolumeInput {
  const value = obj(volume);
  let type: VolumeInput['type'] = 'emptyDir';
  let source: string | undefined;

  if (value.configMap) {
    type = 'configMap';
    source = value.configMap.name;
  } else if (value.secret) {
    type = 'secret';
    source = value.secret.secretName;
  } else if (value.persistentVolumeClaim) {
    type = 'pvc';
    source = value.persistentVolumeClaim.claimName;
  } else if (value.hostPath) {
    type = 'hostPath';
    source = value.hostPath.path;
  }

  const mounted = containers
    .flatMap((container) =>
      (container.volumeMounts ?? [])
        .filter((mount: AnyRecord) => mount.name === value.name)
        .map((mount: AnyRecord) => ({ container: container.name, mount })),
    )
    .at(0);

  return {
    name: value.name,
    type,
    source,
    container: mounted?.container,
    mountPath: mounted?.mount?.mountPath,
    readOnly: Boolean(mounted?.mount?.readOnly),
  };
}

function workloadToForm(kind: string, record: AnyRecord): AnyRecord {
  const spec = obj(record.spec);
  const podSpec =
    kind === 'pod' ? spec : obj(obj(spec.template).spec);
  const containers = (podSpec.containers ?? []) as AnyRecord[];

  const values: AnyRecord = {
    name: record.metadata?.name,
    namespace: record.metadata?.namespace,
    labels: joinKV(record.metadata?.labels),
    annotations: joinKV(record.metadata?.annotations),
    containers: containers.map(containerToForm),
    volumes: ((podSpec.volumes ?? []) as AnyRecord[]).map((volume) =>
      volumeToForm(volume, containers),
    ),
    serviceAccountName: podSpec.serviceAccountName,
    terminationGracePeriodSeconds: podSpec.terminationGracePeriodSeconds,
    imagePullSecrets: ((podSpec.imagePullSecrets ?? []) as AnyRecord[])
      .map((item) => item.name)
      .join(','),
    nodeSelector: joinKV(podSpec.nodeSelector),
    hostNetwork: Boolean(podSpec.hostNetwork),
    podNodeName: podSpec.nodeName,
    restartPolicy: podSpec.restartPolicy,
  };

  if (kind === 'deployment') {
    const rolling = obj(obj(spec.strategy).rollingUpdate);
    values.maxSurge = rolling.maxSurge;
    values.maxUnavailable = rolling.maxUnavailable;
  }
  if (kind === 'statefulset') {
    values.replicas = spec.replicas;
    values.serviceName = spec.serviceName;
    values.podManagementPolicy = spec.podManagementPolicy;
  }
  if (kind === 'daemonset') {
    values.updateStrategy = obj(spec.updateStrategy).type;
  }
  if (kind !== 'pod' && kind !== 'daemonset') {
    values.replicas = spec.replicas;
  }
  return values;
}

/** 将已有资源对象转换为创建表单可回填的 values */
export function toFormValues(kind: string, record: AnyRecord): AnyRecord {
  const metadata = obj(record.metadata);
  const spec = obj(record.spec);

  switch (kind) {
    case 'deployment':
    case 'statefulset':
    case 'daemonset':
    case 'pod':
      return workloadToForm(kind, record);

    case 'service':
      return {
        name: metadata.name,
        namespace: metadata.namespace,
        labels: joinKV(metadata.labels),
        annotations: joinKV(metadata.annotations),
        type: spec.type ?? 'ClusterIP',
        clusterIP: spec.clusterIP,
        sessionAffinity: spec.sessionAffinity,
        externalTrafficPolicy: spec.externalTrafficPolicy,
        selector: joinKV(spec.selector),
        ports: ((spec.ports ?? []) as AnyRecord[]).map((port) => ({
          name: port.name,
          port: port.port,
          targetPort: port.targetPort,
          protocol: port.protocol,
          nodePort: port.nodePort,
        })),
      };

    case 'configmap':
      return {
        name: metadata.name,
        namespace: metadata.namespace,
        labels: joinKV(metadata.labels),
        annotations: joinKV(metadata.annotations),
        data: entries(record.data),
      };

    case 'secret':
      return {
        name: metadata.name,
        namespace: metadata.namespace,
        labels: joinKV(metadata.labels),
        annotations: joinKV(metadata.annotations),
        type: record.type ?? 'Opaque',
        data: entries(
          Object.fromEntries(
            Object.entries(obj(record.data)).map(([key, value]) => [
              key,
              decodeBase64(String(value)),
            ]),
          ),
        ),
      };

    case 'pvc':
      return {
        name: metadata.name,
        namespace: metadata.namespace,
        labels: joinKV(metadata.labels),
        annotations: joinKV(metadata.annotations),
        accessModes: spec.accessModes ?? ['ReadWriteOnce'],
        storage: obj(obj(spec.resources).requests).storage,
        storageClassName: spec.storageClassName,
        volumeMode: spec.volumeMode ?? 'Filesystem',
        selector: joinKV(obj(spec.selector).matchLabels),
      };

    case 'pv': {
      const localNode = (() => {
        const terms = obj(obj(spec.nodeAffinity).required).nodeSelectorTerms ?? [];
        const match = obj(terms[0]).matchExpressions ?? [];
        const host = (match as AnyRecord[]).find(
          (item) => item.key === 'kubernetes.io/hostname',
        );
        return host?.values?.[0];
      })();

      let volumeType = 'nfs';
      if (spec.hostPath) volumeType = 'hostPath';
      else if (spec.local) volumeType = 'local';
      else if (spec.csi) volumeType = 'csi';
      else if (spec.cephfs) volumeType = 'cephfs';
      else if (spec.rbd) volumeType = 'rbd';

      return {
        name: metadata.name,
        labels: joinKV(metadata.labels),
        annotations: joinKV(metadata.annotations),
        volumeType,
        storage: obj(spec.capacity).storage,
        accessModes: spec.accessModes ?? ['ReadWriteOnce'],
        reclaimPolicy: spec.persistentVolumeReclaimPolicy,
        storageClassName: spec.storageClassName,
        volumeMode: spec.volumeMode ?? 'Filesystem',
        mountOptions: ((spec.mountOptions ?? []) as string[]).join(','),
        server: obj(spec.nfs).server,
        path: obj(spec.nfs).path ?? obj(spec.hostPath).path ?? obj(spec.local).path,
        nodeName: localNode,
        fsType: obj(spec.local).fsType ?? obj(spec.csi).fsType ?? obj(spec.rbd).fsType,
        csiDriver: obj(spec.csi).driver,
        csiVolumeHandle: obj(spec.csi).volumeHandle,
        monitors: ((obj(spec.cephfs).monitors ?? obj(spec.rbd).monitors ?? []) as string[]).join(','),
        user: obj(spec.cephfs).user ?? obj(spec.rbd).user,
        pool: obj(spec.rbd).pool,
        image: obj(spec.rbd).image,
        secretName: obj(obj(spec.cephfs).secretRef).name ?? obj(obj(spec.rbd).secretRef).name,
        secretNamespace: obj(obj(spec.cephfs).secretRef).namespace ?? obj(obj(spec.rbd).secretRef).namespace,
      };
    }

    case 'storageclass':
      return {
        name: metadata.name,
        labels: joinKV(metadata.labels),
        annotations: joinKV(metadata.annotations),
        provisioner: record.provisioner,
        reclaimPolicy: record.reclaimPolicy,
        volumeBindingMode: record.volumeBindingMode,
        allowVolumeExpansion: Boolean(record.allowVolumeExpansion),
        parameters: entries(record.parameters),
        mountOptions: ((record.mountOptions ?? []) as string[]).join(','),
      };

    case 'ingress':
      return {
        name: metadata.name,
        namespace: metadata.namespace,
        labels: joinKV(metadata.labels),
        annotations: joinKV(metadata.annotations),
        ingressClassName: spec.ingressClassName,
        hosts: ((spec.rules ?? []) as AnyRecord[]).map((rule) => ({
          host: rule.host,
          paths: ((obj(rule.http).paths ?? []) as AnyRecord[]).map((path) => ({
            path: path.path,
            pathType: path.pathType,
            serviceName: obj(obj(path.backend).service).name,
            servicePort: obj(obj(obj(path.backend).service).port).number,
          })),
        })),
        tls: ((spec.tls ?? []) as AnyRecord[]).map((item) => ({
          secretName: item.secretName,
          hosts: ((item.hosts ?? []) as string[]).join(','),
        })),
      };

    case 'namespace':
      return {
        name: metadata.name,
        labels: joinKV(metadata.labels),
        annotations: joinKV(metadata.annotations),
      };

    default:
      return {};
  }
}

const labelsFrom = (values: AnyRecord) => {
  const labels = parseKeyValueInput(values.labels);
  return Object.keys(labels).length ? labels : undefined;
};

const annotationsFrom = (values: AnyRecord) => {
  const annotations = parseKeyValueInput(values.annotations);
  return Object.keys(annotations).length ? annotations : undefined;
};

function assignOrDelete(
  target: AnyRecord,
  key: string,
  value: unknown,
) {
  if (value === undefined || value === null || value === '') {
    delete target[key];
  } else {
    target[key] = value;
  }
}

/** 把表单值合并回已有对象，保留表单未覆盖的字段 */
export function mergeResource(
  kind: string,
  values: AnyRecord,
  existing: AnyRecord,
  ctx: CreateContext,
): AnyRecord {
  const merged = JSON.parse(JSON.stringify(existing)) as AnyRecord;
  const labelValue = labelsFrom(values);
  const annotationValue = annotationsFrom(values);
  merged.metadata = {
    ...obj(merged.metadata),
    ...(labelValue ? { labels: labelValue } : {}),
    ...(annotationValue ? { annotations: annotationValue } : {}),
  };
  if (!labelValue) delete merged.metadata.labels;
  if (!annotationValue) delete merged.metadata.annotations;

  switch (kind) {
    case 'deployment':
    case 'statefulset':
    case 'daemonset':
    case 'pod': {
      const workloadKind = (
        kind === 'pod' ? 'Pod' : kind.charAt(0).toUpperCase() + kind.slice(1)
      ) as WorkloadKind;
      const built =
        kind === 'pod'
          ? buildPod(values, ctx)
          : buildWorkload(workloadKind, values, ctx);
      const builtSpec = obj(
        kind === 'pod' ? built.spec : obj(built.spec).template?.spec,
      );
      const targetSpec = obj(
        kind === 'pod' ? merged.spec : obj(merged.spec).template?.spec,
      );

      targetSpec.containers = ((builtSpec.containers ?? []) as AnyRecord[]).map(
        (container, index) => {
          const original = ((targetSpec.containers ?? []) as AnyRecord[])[index];
          const next = { ...obj(original), ...container };
          if (container.volumeMounts === undefined) {
            delete next.volumeMounts;
          }
          return next;
        },
      );

      assignOrDelete(targetSpec, 'volumes', builtSpec.volumes);
      for (const key of [
        'serviceAccountName',
        'nodeSelector',
        'imagePullSecrets',
        'terminationGracePeriodSeconds',
        'hostNetwork',
        'nodeName',
        'restartPolicy',
      ]) {
        assignOrDelete(targetSpec, key, builtSpec[key]);
      }

      if (kind !== 'pod') {
        const template = obj(merged.spec).template;
        template.spec = targetSpec;
      }
      if (kind !== 'daemonset' && kind !== 'pod') {
        merged.spec.replicas = obj(built.spec).replicas;
      }
      if (kind === 'deployment') {
        assignOrDelete(merged.spec, 'strategy', obj(built.spec).strategy);
      }
      if (kind === 'statefulset') {
        assignOrDelete(merged.spec, 'serviceName', obj(built.spec).serviceName);
        assignOrDelete(
          merged.spec,
          'podManagementPolicy',
          obj(built.spec).podManagementPolicy,
        );
      }
      if (kind === 'daemonset') {
        assignOrDelete(
          merged.spec,
          'updateStrategy',
          obj(built.spec).updateStrategy,
        );
      }
      if (kind === 'pod') {
        merged.spec = targetSpec;
      }
      break;
    }

    case 'service': {
      const built = buildService(values, ctx);
      const spec = obj(merged.spec);
      assignOrDelete(spec, 'type', obj(built.spec).type);
      assignOrDelete(spec, 'selector', obj(built.spec).selector);
      spec.ports = obj(built.spec).ports;
      assignOrDelete(spec, 'sessionAffinity', obj(built.spec).sessionAffinity);
      assignOrDelete(
        spec,
        'externalTrafficPolicy',
        obj(built.spec).externalTrafficPolicy,
      );
      break;
    }

    case 'configmap': {
      const built = buildConfigMap(values, ctx);
      merged.data = obj(built).data;
      break;
    }

    case 'secret': {
      const built = buildSecret(values, ctx);
      const data = Object.fromEntries(
        Object.entries(obj(obj(built).stringData)).map(([key, value]) => [
          key,
          encodeBase64(String(value)),
        ]),
      );
      merged.data = data;
      delete merged.stringData;
      assignOrDelete(merged, 'type', obj(built).type);
      break;
    }

    case 'pvc': {
      const built = buildPersistentVolumeClaim(values, ctx);
      const spec = obj(merged.spec);
      const builtSpec = obj(built.spec);
      merged.spec = {
        ...spec,
        accessModes: builtSpec.accessModes,
        resources: {
          ...obj(spec.resources),
          requests: {
            ...obj(obj(spec.resources).requests),
            ...obj(obj(builtSpec.resources).requests),
          },
        },
      };
      if (builtSpec.volumeMode) merged.spec.volumeMode = builtSpec.volumeMode;
      else delete merged.spec.volumeMode;
      assignOrDelete(merged.spec, 'selector', builtSpec.selector);
      break;
    }

    case 'pv': {
      const built = buildPersistentVolume(values, ctx);
      const claimRef = obj(merged.spec).claimRef;
      merged.spec = {
        ...obj(built.spec),
        ...(claimRef ? { claimRef } : {}),
      };
      break;
    }

    case 'storageclass': {
      const built = buildStorageClass(values, ctx);
      merged.provisioner = obj(built).provisioner;
      merged.reclaimPolicy = obj(built).reclaimPolicy;
      merged.volumeBindingMode = obj(built).volumeBindingMode;
      assignOrDelete(merged, 'allowVolumeExpansion', obj(built).allowVolumeExpansion === true ? true : undefined);
      assignOrDelete(merged, 'parameters', Object.keys(obj(obj(built).parameters)).length ? obj(obj(built).parameters) : undefined);
      assignOrDelete(merged, 'mountOptions', obj(built).mountOptions);
      break;
    }

    case 'ingress': {
      const built = buildIngress(values, ctx);
      const spec = obj(merged.spec);
      spec.rules = obj(built.spec).rules;
      spec.ingressClassName = obj(built.spec).ingressClassName;
      if (obj(built.spec).tls) spec.tls = obj(built.spec).tls;
      else delete spec.tls;
      break;
    }

    case 'namespace': {
      const built = buildNamespace(values, ctx);
      merged.metadata = obj(built.metadata);
      merged.metadata.name = existing.metadata?.name;
      break;
    }

    default:
      break;
  }

  return merged;
}
