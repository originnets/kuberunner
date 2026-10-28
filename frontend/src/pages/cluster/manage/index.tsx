import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import {
  App,
  Badge,
  Button,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import React, { useEffect, useState } from 'react';
import type { AppModel } from '@/models/app';
import { invalidateClusters } from '@/components/Kube/useClusters';
import {
  createCluster,
  getClusterStatus,
  removeCluster,
  type ClusterStatus,
} from '@/services/kuberunner';

const ClusterManagePage: React.FC = () => {
  const { cluster, setCluster } = useModel('app') as AppModel;
  const { message, modal, notification } = App.useApp();
  const [statuses, setStatuses] = useState<ClusterStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

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

  const handleAdd = async () => {
    let values: { name: string; kube_config_path: string };
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    setSubmitting(true);
    try {
      const result = await createCluster(values.name, values.kube_config_path);
      message.success(result.message);
      if (result.warnings?.length) {
        notification.warning({
          title: '集群已生效，但配置未持久化',
          description: result.warnings.join('；'),
        });
      }
      form.resetFields();
      setAddOpen(false);
      invalidateClusters();
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '添加集群失败');
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
      title: 'KubeConfig 路径',
      dataIndex: 'kube_config',
      ellipsis: true,
      render: (_, record) => (
        <Typography.Text copyable style={{ fontSize: 12 }}>
          {record.kube_config || '-'}
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
      width: 100,
      render: (_, record) => [
        <Tooltip key="delete" title="移除集群">
          <Button
            type="text"
            danger
            size="small"
            aria-label="移除集群"
            icon={<DeleteOutlined />}
            onClick={() => handleRemove(record)}
          />
        </Tooltip>,
      ],
    },
  ];

  return (
    <PageContainer
      ghost
      title="集群管理"
      subTitle="运行时添加或移除集群，配置会尽量写回后端 config.yaml"
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
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setAddOpen(true)}
        >
          添加集群
        </Button>
        <Typography.Text type="secondary">
          添加时会校验 kubeconfig 并尝试连接集群。
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
        locale={{ emptyText: '暂无集群，请添加 kubeconfig 后使用' }}
      />

      <Modal
        open={addOpen}
        title="添加集群"
        okText="添加"
        cancelText="取消"
        confirmLoading={submitting}
        onOk={() => void handleAdd()}
        onCancel={() => setAddOpen(false)}
        destroyOnHidden
        width={560}
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
            name="kube_config_path"
            label="KubeConfig 路径"
            tooltip="后端服务器上的绝对路径，例如 /root/.kube/prod-config"
            rules={[{ required: true, message: '请输入 kubeconfig 路径' }]}
          >
            <Input placeholder="/root/.kube/config" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default ClusterManagePage;
