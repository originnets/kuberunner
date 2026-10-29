import {
  CloudServerOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  FooterToolbar,
  PageContainer,
  ProTable,
} from '@ant-design/pro-components';
import { history, useModel } from '@umijs/max';
import { Alert, App, Button, Dropdown, Space, Tag, Tooltip, Typography } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AppModel } from '@/models/app';
import {
  deleteResource,
  listResource,
  type ResourceEndpoint,
} from '@/services/kuberunner';
import ContextBar from './ContextSwitches';
import CreateResourceDrawer from './create/CreateResourceDrawer';
import type { CreateKind } from './create/templates';
import { CREATE_KINDS } from './create/templates';
import { age, formatTime } from './helpers';
import ResourceDrawer from './ResourceDrawer';

type RowContext = {
  reload: () => void;
  openDetail: (mode?: 'detail' | 'edit') => void;
};

const CREATE_KIND_MAP: Record<string, CreateKind> = {
  pvc: 'pvc',
  pv: 'pv',
  persistentvolumeclaim: 'pvc',
  persistentvolume: 'pv',
};

export interface ResourceTableProps {
  resource: ResourceEndpoint;
  title: string;
  /** 页面说明，展示在标题下方 */
  description?: string;
  /** 资源专有列，自动补充名称 / 命名空间 / 创建时间 / 操作列 */
  columns?: ProColumns<KubeAPI.KubeObject>[];
  /** 创建类型（CreateKind），存在时展示“新建”按钮 */
  createKey?: string;
  /** 自定义行内操作（日志、终端、扩缩容、重启等） */
  rowActions?: (
    record: KubeAPI.KubeObject,
    context: RowContext,
  ) => React.ReactNode[];
  /** 是否隐藏“详情”入口 */
  hideDetail?: boolean;
  /** 额外工具栏内容 */
  toolbar?: React.ReactNode;
  defaultPageSize?: number;
  /** 是否展示自动追加的创建时间列 */
  showAge?: boolean;
  /** 由页面持有的 actionRef，便于在页面级操作后刷新表格 */
  actionRef?: React.RefObject<ActionType | null>;
}

const AUTO_REFRESH_INTERVAL = 10_000;

const ResourceTable: React.FC<ResourceTableProps> = ({
  resource,
  title,
  description,
  columns = [],
  createKey,
  rowActions,
  hideDetail,
  toolbar,
  showAge = true,
  defaultPageSize = 10,
  actionRef,
}) => {
  const { cluster, namespace, setNamespace } = useModel('app') as AppModel;
  const { message, modal } = App.useApp();
  const innerActionRef = useRef<ActionType>(null);
  const tableRef = actionRef ?? innerActionRef;
  const [error, setError] = useState<string>();
  const [total, setTotal] = useState(0);
  const [selectedRows, setSelectedRows] = useState<KubeAPI.KubeObject[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [drawer, setDrawer] = useState<{
    open: boolean;
    name?: string;
    namespace?: string;
    mode?: 'detail' | 'edit';
    fallback?: KubeAPI.KubeObject;
  }>({ open: false });

  // 支持 /workload/pod?filter_name=orders 这类深链
  const initialFilter = useMemo(
    () =>
      new URLSearchParams(history.location.search).get('filter_name') ?? '',
    [],
  );

  // 支持 /workload/pod?label_selector=app%3Dorders 深链（工作负载的“查看 Pod”）
  const initialLabelSelector = useMemo(
    () =>
      new URLSearchParams(history.location.search).get('label_selector') ?? '',
    [],
  );
  const [labelSelector, setLabelSelector] = useState(initialLabelSelector);

  const reload = () => tableRef.current?.reload();

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      tableRef.current?.reload();
    }, AUTO_REFRESH_INTERVAL);
    return () => window.clearInterval(timer);
  }, [autoRefresh]);

  const showNamespace = resource.namespaced;

  const removeOne = async (record: KubeAPI.KubeObject) => {
    await deleteResource(resource, {
      cluster,
      namespace: record.metadata.namespace,
      name: record.metadata.name,
    });
    message.success(`已删除 ${record.metadata.name}`);
    reload();
  };

  const confirmRemove = (record: KubeAPI.KubeObject) => {
    modal.confirm({
      title: `确认删除 ${record.metadata.name}？`,
      content: `删除后无法恢复，资源所在命名空间：${
        record.metadata.namespace ?? '集群级'
      }`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => removeOne(record),
    });
  };

  const removeSelected = async () => {
    if (!selectedRows.length) return;
    modal.confirm({
      title: `确认删除选中的 ${selectedRows.length} 个资源？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        const results = await Promise.allSettled(
          selectedRows.map((record) =>
            deleteResource(resource, {
              cluster,
              namespace: record.metadata.namespace,
              name: record.metadata.name,
            }),
          ),
        );
        const failed = results.filter((item) => item.status === 'rejected');
        if (failed.length) {
          message.warning(`${failed.length} 个资源删除失败，请刷新后重试`);
        } else {
          message.success('批量删除完成');
        }
        setSelectedRows([]);
        reload();
      },
    });
  };

  const allColumns = useMemo<ProColumns<KubeAPI.KubeObject>[]>(() => {
    const list: ProColumns<KubeAPI.KubeObject>[] = [
      {
        title: '名称',
        dataIndex: 'name',
        copyable: true,
        ellipsis: true,
        width: 250,
        fixed: 'left',
        search: {
          transform: (value: string) => ({ filter_name: value }),
        },
        fieldProps: { placeholder: '按名称模糊搜索' },
        render: (_, record) => (
          <Typography.Link
            onClick={() =>
              setDrawer({
                open: true,
                name: record.metadata.name,
                namespace: record.metadata.namespace,
                fallback: record,
              })
            }
          >
            {record.metadata.name}
          </Typography.Link>
        ),
      },
    ];

    if (showNamespace) {
      list.push({
        title: '命名空间',
        dataIndex: 'namespace',
        width: 150,
        search: false,
        render: (_, record) => {
          const value = record.metadata.namespace;
          if (!value) return '-';
          return (
            <Tooltip title={`只看命名空间 ${value}`}>
              <Tag
                style={{ cursor: 'pointer', marginInlineEnd: 0 }}
                onClick={() => setNamespace(value)}
              >
                {value}
              </Tag>
            </Tooltip>
          );
        },
      });
    }

    list.push(...columns);

    if (showAge) {
      list.push({
        title: '创建时间',
        dataIndex: 'creationTimestamp',
        width: 110,
        search: false,
        render: (_, record) => (
          <Tooltip title={formatTime(record.metadata.creationTimestamp)}>
            <span style={{ color: 'rgba(15, 23, 42, 0.55)' }}>
              {age(record.metadata.creationTimestamp)}
            </span>
          </Tooltip>
        ),
      });
    }

    const hasActions =
      !hideDetail || Boolean(resource.update) || Boolean(resource.remove) || Boolean(rowActions);
    if (!hasActions) return list;

    list.push({
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      align: 'right',
      render: (_, record) => {
        const moreItems = [];
        if (!hideDetail) {
          moreItems.push({
            key: 'detail',
            icon: <EyeOutlined />,
            label: '详情',
            onClick: () =>
              setDrawer({
                open: true,
                name: record.metadata.name,
                namespace: record.metadata.namespace,
                mode: 'detail',
                fallback: record,
              }),
          });
        }
        const formKind = CREATE_KIND_MAP[resource.id] ?? (resource.id as CreateKind);
        if (resource.update && CREATE_KINDS[formKind]) {
          moreItems.push({
            key: 'edit',
            icon: <EditOutlined />,
            label: '编辑',
            onClick: () =>
              setDrawer({
                open: true,
                name: record.metadata.name,
                namespace: record.metadata.namespace,
                mode: 'edit',
                fallback: record,
              }),
          });
        }
        if (resource.remove) {
          moreItems.push({
            key: 'delete',
            icon: <DeleteOutlined />,
            danger: true,
            label: '删除',
            onClick: () => confirmRemove(record),
          });
        }

        return (
          <Space size={0}>
            {rowActions?.(record, {
              reload,
              openDetail: (mode = 'detail') =>
                setDrawer({
                  open: true,
                  name: record.metadata.name,
                  namespace: record.metadata.namespace,
                  mode,
                  fallback: record,
                }),
            })}
            {moreItems.length ? (
              <Dropdown menu={{ items: moreItems }} trigger={['click']}>
                <Button
                  type="text"
                  size="small"
                  aria-label="更多操作"
                  icon={<MoreOutlined />}
                />
              </Dropdown>
            ) : null}
          </Space>
        );
      },
    });

    return list;
  }, [columns, resource, showNamespace, rowActions, hideDetail, showAge]);

  return (
    <PageContainer
      ghost
      title={title}
      subTitle={`共 ${total} 项`}
      header={{ breadcrumb: {} }}
      extra={<ContextBar />}
    >
      {description ? (
        <div className="kr-page-desc">{description}</div>
      ) : null}

      {!cluster ? (
        <Alert
          type="warning"
          showIcon
          icon={<CloudServerOutlined />}
          title="尚未选择集群"
          description="请在页面右上角选择集群后再查看资源；若集群列表为空，请检查后端 config.yaml 中的 KubeConfigs 配置。"
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {labelSelector ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={`已按标签筛选：${labelSelector}`}
          action={
            <Button
              size="small"
              onClick={() => {
                setLabelSelector('');
                history.replace({
                  pathname: history.location.pathname,
                  search: '',
                });
                reload();
              }}
            >
              清除筛选
            </Button>
          }
        />
      ) : null}
      {error ? (
        <Alert
          type="error"
          showIcon
          closable={{ onClose: () => setError(undefined) }}
          title="加载失败"
          description={error}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <ProTable<KubeAPI.KubeObject>
        actionRef={tableRef as React.RefObject<ActionType>}
        rowKey={(record) =>
          `${record.metadata?.namespace ?? ''}/${record.metadata?.name ?? ''}`
        }
        headerTitle={false}
        columns={allColumns}
        params={{ cluster, namespace, label_selector: labelSelector }}
        form={
          initialFilter ? { initialValues: { name: initialFilter } } : undefined
        }
        request={async (params) => {
          if (!cluster) {
            setTotal(0);
            return { data: [], total: 0, success: true };
          }
          try {
            const result = await listResource(resource, {
              cluster,
              namespace: resource.namespaced ? namespace : undefined,
              filter_name:
                (params.filter_name as string | undefined) ??
                (params.name as string | undefined),
              label_selector: labelSelector || undefined,
              page: params.current,
              limit: params.pageSize,
            });
            setError(undefined);
            setTotal(result.total);
            return { data: result.items, total: result.total, success: true };
          } catch (err) {
            const text = err instanceof Error ? err.message : String(err);
            setError(
              /timeout/i.test(text)
                ? '请求超时（15 秒）：目标集群不可达，请检查网络、kubeconfig 或稍后重试'
                : text,
            );
            return { data: [], total: 0, success: false };
          }
        }}
        pagination={{
          defaultPageSize,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (value) => `共 ${value} 项`,
        }}
        options={{ density: true, fullScreen: true, setting: true, reload: true }}
        search={{ labelWidth: 'auto' }}
        cardBordered
        locale={{ emptyText: '暂无数据，请调整筛选条件或先创建资源' }}
        toolBarRender={() => [
          createKey ? (
            <Button
              key="create"
              type="primary"
              icon={<PlusOutlined />}
              disabled={!cluster}
              onClick={() => setCreateOpen(true)}
            >
              新建
            </Button>
          ) : null,
          <Tooltip
            key="auto"
            title={autoRefresh ? '关闭自动刷新' : '每 10 秒自动刷新'}
          >
            <Button
              type={autoRefresh ? 'primary' : 'default'}
              icon={<SyncOutlined spin={autoRefresh} />}
              onClick={() => setAutoRefresh((value) => !value)}
            >
              自动刷新
            </Button>
          </Tooltip>,
          <Button key="refresh" icon={<ReloadOutlined />} onClick={() => reload()}>
            刷新
          </Button>,
          toolbar,
        ]}
        rowSelection={
          resource.remove
            ? {
                selectedRowKeys: selectedRows.map(
                  (record) =>
                    `${record.metadata.namespace ?? ''}/${record.metadata.name}`,
                ),
                onChange: (_, rows) => setSelectedRows(rows),
              }
            : undefined
        }
        scroll={{ x: 'max-content' }}
        size="middle"
      />

      {selectedRows.length > 0 && resource.remove ? (
        <FooterToolbar>
          <Space>
            <span>
              已选择 <strong>{selectedRows.length}</strong> 项
            </span>
            <Button danger icon={<DeleteOutlined />} onClick={removeSelected}>
              批量删除
            </Button>
          </Space>
        </FooterToolbar>
      ) : null}

      <ResourceDrawer
        open={drawer.open && drawer.mode !== 'edit'}
        cluster={cluster}
        resource={resource}
        name={drawer.name}
        namespace={drawer.namespace ?? namespace}
        fallback={drawer.fallback}
        onClose={() => setDrawer({ open: false })}
      />

      {drawer.mode === 'edit' && drawer.fallback ? (
        <CreateResourceDrawer
          open={drawer.open}
          kind={
            CREATE_KIND_MAP[resource.id] ?? (resource.id as CreateKind)
          }
          cluster={cluster}
          namespace={drawer.namespace ?? namespace}
          mode="edit"
          record={drawer.fallback}
          onClose={() => setDrawer({ open: false })}
          onSaved={reload}
        />
      ) : null}

      {createKey ? (
        <CreateResourceDrawer
          open={createOpen}
          kind={createKey as CreateKind}
          cluster={cluster}
          namespace={namespace}
          onClose={() => setCreateOpen(false)}
          onCreated={reload}
        />
      ) : null}
    </PageContainer>
  );
};

export default ResourceTable;
