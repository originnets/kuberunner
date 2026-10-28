import {
  CopyOutlined,
  DownloadOutlined,
  EditOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { Alert, App, Button, Descriptions, Drawer, Empty, Input, Space, Spin, Tabs, Tag } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import {
  getResourceDetail,
  type ResourceEndpoint,
  updateResource,
} from '@/services/kuberunner';
import {
  copyText,
  downloadFile,
  formatTime,
  fromYaml,
  toYaml,
} from './helpers';

export interface ResourceDrawerProps {
  open: boolean;
  cluster: string;
  resource: ResourceEndpoint;
  /** 资源名称（metadata.name） */
  name?: string;
  namespace?: string;
  /** 行内数据，打开抽屉时先展示，避免等待接口时空白 */
  fallback?: KubeAPI.KubeObject;
  initialEdit?: boolean;
  onClose: () => void;
  onSaved?: () => void;
}


const ResourceDrawer: React.FC<ResourceDrawerProps> = ({
  open,
  cluster,
  resource,
  name,
  namespace,
  fallback,
  initialEdit = false,
  onClose,
  onSaved,
}) => {
  const { message } = App.useApp();
  const [detail, setDetail] = useState<KubeAPI.KubeObject | undefined>(fallback);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState(initialEdit);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const canEdit = Boolean(resource.update);

  const load = async () => {
    if (!name) return;
    if (!resource.detail) {
      setDetail(fallback);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const data = await getResourceDetail<KubeAPI.KubeObject>(resource, {
        cluster,
        name,
        namespace,
      });
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setDetail(fallback);
    setEditing(initialEdit);
    setError(undefined);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, name, namespace, cluster, initialEdit]);

  const yaml = useMemo(
    () => (detail ? toYaml(detail) : ''),
    [detail],
  );

  useEffect(() => {
    if (editing) setDraft(yaml);
  }, [editing, yaml]);

  const save = async () => {
    if (!detail) return;
    let parsed: KubeAPI.KubeObject;
    try {
      parsed = fromYaml(draft) as KubeAPI.KubeObject;
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'YAML 解析失败');
      return;
    }
    if (!parsed?.metadata?.name) {
      message.error('缺少 metadata.name，无法保存');
      return;
    }
    // status 由集群维护，回传可能导致更新被拒绝。
    delete parsed.status;

    setSaving(true);
    try {
      await updateResource(resource, {
        cluster,
        namespace: parsed.metadata.namespace ?? namespace,
        content: JSON.stringify(parsed),
      });
      message.success('保存成功');
      setEditing(false);
      await load();
      onSaved?.();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    await copyText(yaml);
    message.success('已复制 YAML');
  };

  const handleDownload = () => {
    if (!detail) return;
    const kind = detail.kind?.toLowerCase() ?? resource.id;
    downloadFile(`${kind}-${detail.metadata.name}.yaml`, yaml);
  };

  const infoItems = detail
    ? [
        { label: '名称', children: detail.metadata?.name ?? '-' },
        { label: '命名空间', children: detail.metadata?.namespace ?? '-' },
        {
          label: '类型',
          children: `${detail.apiVersion ?? '-'} / ${detail.kind ?? resource.id}`,
        },
        {
          label: '创建时间',
          children: formatTime(detail.metadata?.creationTimestamp),
        },
        {
          label: 'UID',
          children: (
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {detail.metadata?.uid ?? '-'}
            </span>
          ),
        },
        {
          label: '标签',
          children: detail.metadata?.labels ? (
            <Space size={[4, 4]} wrap>
              {Object.entries(detail.metadata.labels).map(([key, value]) => (
                <Tag key={key} style={{ marginInlineEnd: 0 }}>
                  {value ? `${key}=${value}` : key}
                </Tag>
              ))}
            </Space>
          ) : (
            '-'
          ),
        },
        {
          label: '注解',
          children: detail.metadata?.annotations
            ? Object.keys(detail.metadata.annotations).length
            : 0,
        },
      ]
    : [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size={editing ? 860 : 720}
      title={
        <Space size={8} wrap>
          <span style={{ fontWeight: 600 }}>{name}</span>
          {detail?.kind ? <Tag color="blue">{detail.kind}</Tag> : null}
          {detail?.metadata?.namespace ? (
            <Tag>{detail.metadata.namespace}</Tag>
          ) : null}
        </Space>
      }
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>
            刷新
          </Button>
          <Button icon={<CopyOutlined />} onClick={() => void handleCopy()} />
          <Button icon={<DownloadOutlined />} onClick={handleDownload} />
        </Space>
      }
      footer={
        canEdit ? (
          <Space style={{ float: 'right' }}>
            {editing ? (
              <>
                <Button onClick={() => setEditing(false)}>取消</Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={() => void save()}
                >
                  保存
                </Button>
              </>
            ) : (
              <Button
                icon={<EditOutlined />}
                onClick={() => setEditing(true)}
                disabled={!detail}
              >
                编辑 YAML
              </Button>
            )}
          </Space>
        ) : null
      }
    >
      {editing ? (
        <Alert
          type="warning"
          showIcon
          title="正在编辑 YAML"
          description="保存会直接覆盖集群中的对象（status 会被忽略）；建议先在本地备份。"
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {error ? (
        <Alert
          type="error"
          showIcon
          title="加载详情失败"
          description={error}
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <Spin spinning={loading}>
        {detail ? (
          <Tabs
            defaultActiveKey="yaml"
            items={[
              {
                key: 'yaml',
                label: editing ? '编辑 YAML' : 'YAML',
                children: editing ? (
                  <Input.TextArea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    autoSize={{ minRows: 22, maxRows: 30 }}
                    spellCheck={false}
                    style={{
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontSize: 13,
                      lineHeight: 1.65,
                    }}
                  />
                ) : (
                  <pre className="kr-code" style={{ maxHeight: 'calc(100vh - 220px)' }}>{yaml}</pre>
                ),
              },
              {
                key: 'info',
                label: '概要',
                children: (
                  <Descriptions
                    column={1}
                    size="small"
                    bordered
                    items={infoItems}
                  />
                ),
              },
            ]}
          />
        ) : (
          <Empty description={loading ? '加载中…' : '暂无数据'} />
        )}
      </Spin>
    </Drawer>
  );
};

export default ResourceDrawer;
