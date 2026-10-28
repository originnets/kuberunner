import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import {
  App,
  Badge,
  Button,
  Form,
  Input,
  Modal,
  Radio,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { TableColumnsType } from 'antd';
import React, { useEffect, useState } from 'react';
import type { AppModel } from '@/models/app';
import { invalidateClusters } from '@/components/Kube/useClusters';
import {
  createCluster,
  getClusterDetail,
  getClusterStatus,
  removeCluster,
  updateCluster,
  type ClusterAuthPayload,
  type ClusterAuthType,
  type ClusterStatus,
} from '@/services/kuberunner';

type KubeSource = 'path' | 'content';

interface FormValues {
  name: string;
  auth_type: ClusterAuthType;
  kube_source: KubeSource;
  kube_config_path?: string;
  kube_config_content?: string;
  server?: string;
  token?: string;
  ca_data?: string;
  skip_tls_verify?: boolean;
}

const ClusterManagePage: React.FC = () => {
  const { cluster, setCluster } = useModel('app') as AppModel;
  const { message, modal, notification } = App.useApp();
  const [statuses, setStatuses] = useState<ClusterStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<ClusterStatus>();
  const [authType, setAuthType] = useState<ClusterAuthType>('kubeconfig');
  const [kubeSource, setKubeSource] = useState<KubeSource>('path');
  const [form] = Form.useForm<FormValues>();

  const load = async () => {
    setLoading(true);
    try {
      setStatuses(await getClusterStatus());
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载集群失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(undefined);
    setAuthType('kubeconfig');
    setKubeSource('path');
    form.resetFields();
    form.setFieldsValue({ auth_type: 'kubeconfig', kube_source: 'path' });
    setOpen(true);
  };

  const openEdit = async (record: ClusterStatus) => {
    try {
      const detail = await getClusterDetail(record.name);
      setEditing(record);
      setAuthType(detail.auth_type);
      setKubeSource('path');
      form.resetFields();
      form.setFieldsValue({
        name: detail.name,
        auth_type: detail.auth_type,
        kube_source: 'path',
        kube_config_path:
          detail.auth_type === 'kubeconfig' ? detail.kube_config : undefined,
        server: detail.server,
      });
      setOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载集群配置失败');
    }
  };

  const handleSubmit = async () => {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    const payload: ClusterAuthPayload = {
      name: values.name.trim(),
      auth_type: authType,
    };
    if (authType === 'kubeconfig') {
      if (kubeSource === 'path') {
        payload.kube_config_path = values.kube_config_path?.trim();
      } else {
        payload.kube_config_content = values.kube_config_content;
      }
    } else {
      payload.server = values.server?.trim();
      payload.token = values.token?.trim();
      payload.ca_data = values.ca_data;
      payload.skip_tls_verify = Boolean(values.skip_tls_verify);
    }

    setSubmitting(true);
    try {
      const result = editing
        ? await updateCluster(editing.name, payload)
        : await createCluster(payload);
      message.success(result.message);
      if (result.warnings?.length) {
        notification.warning({
          title: '集群已生效，但配置未持久化',
          description: result.warnings.join('；'),
        });
      }
      if (editing && cluster === editing.name && editing.name !== payload.name) {
        setCluster(payload.name);
      }
      setOpen(false);
      invalidateClusters();
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存集群失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = (record: ClusterStatus) => {
    modal.confirm({
      title: `确认移除集群 ${record.name}？`,
      content:
        '仅从 KubeRunner 中移除连接配置，不会影响集群本身；若当前正在使用该集群，将切换到其它集群。',
      okText: '移除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        const result = await removeCluster(record.name);
        message.success(result.message);
        if (cluster === record.name) {
          setCluster('');
        }
        invalidateClusters();
        await load();
      },
    });
  };

  const columns: TableColumnsType<ClusterStatus> = [
    {
      title: '集群名称',
      dataIndex: 'name',
      render: (_, record) => (
        <Space size={6}>
          <Typography.Text strong>{record.name}</Typography.Text>
          {record.name === cluster ? <Tag color="blue">当前</Tag> : null}
        </Space>
      ),
    },
    {
      title: '认证方式',
      dataIndex: 'auth_type',
      width: 130,
      render: (_, record) =>
        record.auth_type === 'token' ? (
          <Tag color="purple">Token</Tag>
        ) : (
          <Tag color="blue">KubeConfig</Tag>
        ),
    },
    {
      title: '连接信息',
      dataIndex: 'server',
      ellipsis: true,
      render: (_, record) => (
        <Typography.Text copyable style={{ fontSize: 12 }}>
          {record.server || record.kube_config || '-'}
        </Typography.Text>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 140,
      render: (_, record) => record.version || '-',
    },
    {
      title: '状态',
      dataIndex: 'reachable',
      width: 120,
      render: (_, record) =>
        record.reachable ? (
          <Badge status="success" text="连接正常" />
        ) : (
          <Tooltip title={record.error}>
            <Badge status="error" text="连接异常" />
          </Tooltip>
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 110,
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title="编辑集群配置">
            <Button
              type="text"
              size="small"
              aria-label="编辑集群"
              icon={<EditOutlined />}
              onClick={() => void openEdit(record)}
            />
          </Tooltip>
          <Tooltip title="移除集群">
            <Button
              type="text"
              danger
              size="small"
              aria-label="移除集群"
              icon={<DeleteOutlined />}
              onClick={() => handleRemove(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer
      ghost
      title="集群管理"
      subTitle="支持 KubeConfig 与 Token 两种认证方式，配置会写回后端 config.yaml"
      header={{ breadcrumb: {} }}
      extra={[
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
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          添加集群
        </Button>
        <Typography.Text type="secondary">
          添加时会校验认证信息并尝试连接集群。
        </Typography.Text>
      </Space>

      <Table<ClusterStatus>
        rowKey="name"
        loading={loading}
        columns={columns}
        dataSource={statuses}
        pagination={false}
        size="middle"
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: '暂无集群，请添加 kubeconfig 或 Token 后使用' }}
      />

      <Modal
        open={open}
        title={editing ? `编辑集群 · ${editing.name}` : '添加集群'}
        okText={editing ? '保存' : '添加'}
        cancelText="取消"
        confirmLoading={submitting}
        onOk={() => void handleSubmit()}
        onCancel={() => setOpen(false)}
        destroyOnHidden
        width={640}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="集群名称"
            tooltip="用于顶部切换器展示，不能包含空格或斜杠"
            rules={[{ required: true, message: '请输入集群名称' }]}
          >
            <Input placeholder="prod-cluster" />
          </Form.Item>

          <Form.Item
            name="auth_type"
            label="认证方式"
            rules={[{ required: true }]}
          >
            <Radio.Group
              onChange={(event) => setAuthType(event.target.value)}
              options={[
                { label: 'KubeConfig', value: 'kubeconfig' },
                { label: 'API Server + Token', value: 'token' },
              ]}
            />
          </Form.Item>

          {authType === 'kubeconfig' ? (
            <>
              <Form.Item name="kube_source" label="来源">
                <Radio.Group
                  onChange={(event) => setKubeSource(event.target.value)}
                  options={[
                    { label: '文件路径', value: 'path' },
                    { label: '粘贴内容', value: 'content' },
                  ]}
                />
              </Form.Item>
              {kubeSource === 'path' ? (
                <Form.Item
                  name="kube_config_path"
                  label="KubeConfig 路径"
                  tooltip="后端服务器上的绝对路径"
                  rules={[{ required: true, message: '请输入 kubeconfig 路径' }]}
                >
                  <Input placeholder="/root/.kube/config" />
                </Form.Item>
              ) : (
                <Form.Item
                  name="kube_config_content"
                  label="KubeConfig 内容"
                  rules={[{ required: true, message: '请粘贴 kubeconfig 内容' }]}
                >
                  <Input.TextArea
                    rows={8}
                    className="kr-code"
                    placeholder="apiVersion: v1&#10;kind: Config&#10;clusters: ..."
                  />
                </Form.Item>
              )}
            </>
          ) : (
            <>
              <Form.Item
                name="server"
                label="API Server"
                tooltip="例如 https://10.0.0.1:6443"
                rules={[{ required: true, message: '请输入 API Server 地址' }]}
              >
                <Input placeholder="https://10.0.0.1:6443" />
              </Form.Item>
              <Form.Item
                name="token"
                label="Bearer Token"
                tooltip="ServiceAccount Token；出于安全考虑，编辑时需重新填写"
                rules={[{ required: true, message: '请输入 Token' }]}
              >
                <Input.Password placeholder="eyJhbGciOiJSUzI1NiIs..." />
              </Form.Item>
              <Form.Item
                name="skip_tls_verify"
                label="跳过 TLS 校验"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <Form.Item
                noStyle
                shouldUpdate={(prev, next) =>
                  prev.skip_tls_verify !== next.skip_tls_verify
                }
              >
                {({ getFieldValue }) => (
                  <Form.Item
                    name="ca_data"
                    label="CA 证书（PEM，可选）"
                    tooltip="填写后用于校验 API Server 证书"
                  >
                    <Input.TextArea
                      rows={6}
                      className="kr-code"
                      disabled={Boolean(getFieldValue('skip_tls_verify'))}
                      placeholder="-----BEGIN CERTIFICATE-----"
                    />
                  </Form.Item>
                )}
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default ClusterManagePage;
