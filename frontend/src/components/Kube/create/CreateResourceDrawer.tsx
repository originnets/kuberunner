import { CodeOutlined, FormOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  App,
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  Space,
  Tabs,
  Typography,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import {
  applyResource,
  ENDPOINTS,
  updateResource,
} from '@/services/kuberunner';
import { fromYaml, toYaml } from '../helpers';
import type { CreateContext, WorkloadKind } from './builders';
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
} from './builders';
import { ConfigMapForm, SecretForm } from './DataForms';
import { mergeResource, toFormValues } from './editHelpers';
import IngressForm from './IngressForm';
import ServiceForm from './ServiceForm';
import {
  NamespaceForm,
  PvcForm,
  PvForm,
  StorageClassForm,
} from './StorageForms';
import WorkloadForm from './WorkloadForm';
import type { CreateKind } from './templates';
import { buildTemplate, CREATE_KINDS } from './templates';

export interface CreateResourceDrawerProps {
  open: boolean;
  kind: CreateKind;
  cluster: string;
  namespace?: string;
  /** 编辑模式：回填已有资源并走更新接口 */
  mode?: 'create' | 'edit';
  record?: KubeAPI.KubeObject;
  onClose: () => void;
  onCreated?: () => void;
  onSaved?: () => void;
}

type Builder = (
  values: Record<string, any>,
  ctx: CreateContext,
) => KubeAPI.KubeObject;

const BUILDERS: Record<CreateKind, Builder> = {
  deployment: (values, ctx) =>
    buildWorkload('Deployment' as WorkloadKind, values, ctx),
  statefulset: (values, ctx) =>
    buildWorkload('StatefulSet' as WorkloadKind, values, ctx),
  daemonset: (values, ctx) =>
    buildWorkload('DaemonSet' as WorkloadKind, values, ctx),
  pod: buildPod,
  service: buildService,
  ingress: buildIngress,
  configmap: buildConfigMap,
  secret: buildSecret,
  pvc: buildPersistentVolumeClaim,
  pv: buildPersistentVolume,
  storageclass: buildStorageClass,
  namespace: buildNamespace,
};

function containerDefaults() {
  return [
    {
      name: 'main',
      image: 'nginx:1.25',
      imagePullPolicy: 'IfNotPresent',
      cpuRequest: '100m',
      memoryRequest: '128Mi',
      ports: [{ name: 'http', containerPort: 80, protocol: 'TCP' }],
    },
  ];
}

function defaultValues(
  kind: CreateKind,
  namespace: string,
): Record<string, unknown> {
  const ns = namespace ? {} : { namespace: 'default' };

  switch (kind) {
    case 'deployment':
      return {
        ...ns,
        replicas: 1,
        maxSurge: '25%',
        maxUnavailable: '25%',
        containers: containerDefaults(),
      };
    case 'statefulset':
      return {
        ...ns,
        replicas: 1,
        podManagementPolicy: 'OrderedReady',
        containers: containerDefaults(),
      };
    case 'daemonset':
      return {
        ...ns,
        updateStrategy: 'RollingUpdate',
        containers: containerDefaults(),
      };
    case 'pod':
      return {
        ...ns,
        restartPolicy: 'Always',
        containers: containerDefaults(),
      };
    case 'service':
      return {
        ...ns,
        type: 'ClusterIP',
        ports: [{ name: 'http', port: 80, targetPort: 80, protocol: 'TCP' }],
      };
    case 'ingress':
      return {
        ...ns,
        ingressClassName: 'nginx',
        hosts: [
          {
            host: '',
            paths: [{ path: '/', pathType: 'Prefix', servicePort: 80 }],
          },
        ],
      };
    case 'configmap':
      return { ...ns, data: [{}] };
    case 'secret':
      return { ...ns, type: 'Opaque', data: [{}] };
    case 'pvc':
      return {
        ...ns,
        accessModes: ['ReadWriteOnce'],
        storage: '1Gi',
        volumeMode: 'Filesystem',
      };
    case 'pv':
      return {
        volumeType: 'nfs',
        storage: '10Gi',
        accessModes: ['ReadWriteMany'],
        reclaimPolicy: 'Retain',
        volumeMode: 'Filesystem',
      };
    case 'storageclass':
      return {
        provisioner: 'kubernetes.io/no-provisioner',
        reclaimPolicy: 'Delete',
        volumeBindingMode: 'Immediate',
        parameters: [],
      };
    case 'namespace':
      return {};
    default:
      return {};
  }
}

const CreateResourceDrawer: React.FC<CreateResourceDrawerProps> = ({
  open,
  kind,
  cluster,
  namespace,
  mode = 'create',
  record,
  onClose,
  onCreated,
  onSaved,
}) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [tab, setTab] = useState<'form' | 'yaml'>('form');
  const [yamlText, setYamlText] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const editing = mode === 'edit' && Boolean(record);
  const meta = CREATE_KINDS[kind];

  const initialValues = useMemo(
    () =>
      editing && record
        ? toFormValues(kind, record)
        : defaultValues(kind, namespace ?? ''),
    [editing, record, kind, namespace],
  );

  const template = useMemo(
    () => (editing && record ? toYaml(record) : buildTemplate(kind, namespace)),
    [editing, record, kind, namespace],
  );

  useEffect(() => {
    if (!open) return;
    setTab('form');
    setError(undefined);
    setYamlText(template);
    form.resetFields();
    form.setFieldsValue(initialValues);
  }, [open, kind, template, initialValues, form]);

  const renderForm = () => {
    switch (kind) {
      case 'deployment':
      case 'statefulset':
      case 'daemonset':
      case 'pod':
        return (
          <WorkloadForm
            kind={
              (kind === 'deployment'
                ? 'Deployment'
                : kind === 'statefulset'
                  ? 'StatefulSet'
                  : kind === 'daemonset'
                    ? 'DaemonSet'
                    : 'Pod') as WorkloadKind | 'Pod'
            }
            namespace={namespace}
            editing={editing}
          />
        );
      case 'service':
        return <ServiceForm namespace={namespace} editing={editing} />;
      case 'configmap':
        return <ConfigMapForm namespace={namespace} editing={editing} />;
      case 'secret':
        return <SecretForm namespace={namespace} editing={editing} />;
      case 'pvc':
        return <PvcForm namespace={namespace} editing={editing} />;
      case 'namespace':
        return <NamespaceForm editing={editing} />;
      case 'ingress':
        return <IngressForm namespace={namespace} editing={editing} />;
      case 'pv':
        return <PvForm editing={editing} />;
      case 'storageclass':
        return <StorageClassForm editing={editing} />;
      default:
        return null;
    }
  };

  const submit = async () => {
    setError(undefined);
    setSubmitting(true);
    try {
      if (tab === 'yaml') {
        const parsed = fromYaml(yamlText);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('YAML 内容不能为空');
        }
        if (editing) {
          const object = parsed as KubeAPI.KubeObject;
          delete object.status;
          await updateResource(ENDPOINTS[kind], {
            cluster,
            namespace: object.metadata?.namespace,
            content: JSON.stringify(object),
          });
          message.success('保存成功');
        } else {
          const result = await applyResource(cluster, JSON.stringify(parsed));
          message.success(result || '创建成功');
        }
      } else {
        const values = await form.validateFields();
        const ctx = { cluster, namespace: namespace ?? '' };
        if (editing && record) {
          const object = mergeResource(kind, values, record, ctx);
          delete object.status;
          await updateResource(ENDPOINTS[kind], {
            cluster,
            namespace: object.metadata?.namespace,
            content: JSON.stringify(object),
          });
          message.success('保存成功');
        } else {
          const object = BUILDERS[kind](values, ctx);
          const result = await applyResource(cluster, JSON.stringify(object));
          message.success(result || '创建成功');
        }
      }
      if (editing) {
        onSaved?.();
      } else {
        onCreated?.();
      }
      onClose();
    } catch (err) {
      // 表单校验失败不展示为接口错误
      if (err && typeof err === 'object' && 'errorFields' in err) {
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size={920}
      title={`${editing ? '编辑' : '新建'} ${meta?.title ?? '资源'}`}
      destroyOnHidden
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            loading={submitting}
            onClick={() => void submit()}
          >
            {editing ? '保存' : '创建'}
          </Button>
        </Space>
      }
    >
      {!cluster ? (
        <Alert type="warning" showIcon title="请先在页面右侧选择集群" />
      ) : (
        <>
          {error ? (
            <Alert
              type="error"
              showIcon
              title={editing ? '保存失败' : '创建失败'}
              description={
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{error}</pre>
              }
              style={{ marginBottom: 16 }}
            />
          ) : null}

          <Tabs
            activeKey={tab}
            onChange={(key) => setTab(key as 'form' | 'yaml')}
            items={[
              {
                key: 'form',
                label: (
                  <Space size={6}>
                    <FormOutlined />
                    {editing ? '表单编辑' : '表单创建'}
                  </Space>
                ),
                children: (
                  <Form
                    form={form}
                    layout="vertical"
                    initialValues={initialValues}
                    preserve={false}
                  >
                    {renderForm()}
                  </Form>
                ),
              },
              {
                key: 'yaml',
                label: (
                  <Space size={6}>
                    <CodeOutlined />
                    {editing ? 'YAML 编辑' : 'YAML 创建'}
                  </Space>
                ),
                children: (
                  <>
                    <Space
                      style={{
                        width: '100%',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                      }}
                    >
                      <Typography.Text type="secondary">
                        支持完整的 Kubernetes YAML / JSON，字段不受表单限制。
                      </Typography.Text>
                      <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={() => setYamlText(template)}
                      >
                        重置模板
                      </Button>
                    </Space>
                    <Input.TextArea
                      value={yamlText}
                      onChange={(event) => setYamlText(event.target.value)}
                      autoSize={{ minRows: 22, maxRows: 30 }}
                      spellCheck={false}
                      style={{
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: 13,
                        lineHeight: 1.65,
                      }}
                    />
                  </>
                ),
              },
            ]}
          />
        </>
      )}
    </Drawer>
  );
};

export default CreateResourceDrawer;
