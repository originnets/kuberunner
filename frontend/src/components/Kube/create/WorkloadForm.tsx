import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Collapse,
  Divider,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Switch,
  Typography,
} from 'antd';
import React from 'react';
import type { WorkloadKind } from './builders';
import { LabelsFields, NameAndNamespace, SectionTitle } from './common';

const IMAGE_PULL_POLICIES = ['IfNotPresent', 'Always', 'Never'].map((value) => ({
  label: value,
  value,
}));

const PROTOCOLS = ['TCP', 'UDP', 'SCTP'].map((value) => ({
  label: value,
  value,
}));

const ProbeEditor: React.FC<{
  index: number;
  probe: 'readiness' | 'liveness';
}> = ({ index, probe }) => {
  const form = Form.useFormInstance();
  const enabled = Form.useWatch(
    ['containers', index, probe, 'enabled'],
    form,
  );
  const type =
    Form.useWatch(['containers', index, probe, 'type'], form) ?? 'http';

  return (
    <>
      <Row gutter={12} align="middle">
        <Col span={6}>
          <Form.Item
            name={[index, probe, 'enabled']}
            label={probe === 'readiness' ? '就绪探针' : '存活探针'}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
        {enabled ? (
          <>
            <Col span={6}>
              <Form.Item name={[index, probe, 'type']} label="类型">
                <Select
                  options={[
                    { label: 'HTTP GET', value: 'http' },
                    { label: 'TCP', value: 'tcp' },
                  ]}
                />
              </Form.Item>
            </Col>
            {type === 'http' ? (
              <Col span={6}>
                <Form.Item name={[index, probe, 'path']} label="路径">
                  <Input placeholder="/healthz" />
                </Form.Item>
              </Col>
            ) : null}
            <Col span={6}>
              <Form.Item name={[index, probe, 'port']} label="端口">
                <InputNumber
                  min={1}
                  max={65535}
                  style={{ width: '100%' }}
                  placeholder="80"
                />
              </Form.Item>
            </Col>
          </>
        ) : null}
      </Row>
      {enabled ? (
        <Row gutter={12}>
          <Col span={6}>
            <Form.Item name={[index, probe, 'initialDelaySeconds']} label="初始延迟(秒)">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="5" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name={[index, probe, 'periodSeconds']} label="检查间隔(秒)">
              <InputNumber min={1} style={{ width: '100%' }} placeholder="10" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name={[index, probe, 'timeoutSeconds']} label="超时(秒)">
              <InputNumber min={1} style={{ width: '100%' }} placeholder="3" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name={[index, probe, 'failureThreshold']} label="失败阈值">
              <InputNumber min={1} style={{ width: '100%' }} placeholder="3" />
            </Form.Item>
          </Col>
        </Row>
      ) : null}
    </>
  );
};

const ContainerEditor: React.FC<{
  index: number;
  fieldKey: number;
  onRemove: () => void;
}> = ({ index, fieldKey, onRemove }) => (
  <Card
    key={fieldKey}
    size="small"
    style={{ marginBottom: 12 }}
    title={
      <Typography.Text strong style={{ fontSize: 13 }}>
        容器 {index + 1}
      </Typography.Text>
    }
    extra={
      <Button
        type="text"
        danger
        aria-label="删除容器"
        icon={<MinusCircleOutlined />}
        onClick={onRemove}
      />
    }
  >
    <Row gutter={12}>
      <Col span={6}>
        <Form.Item
          name={[index, 'name']}
          label="容器名"
          rules={[{ required: true, message: '请输入容器名' }]}
        >
          <Input placeholder="main" />
        </Form.Item>
      </Col>
      <Col span={11}>
        <Form.Item
          name={[index, 'image']}
          label="镜像"
          rules={[{ required: true, message: '请输入镜像地址' }]}
        >
          <Input placeholder="nginx:1.25" />
        </Form.Item>
      </Col>
      <Col span={7}>
        <Form.Item name={[index, 'imagePullPolicy']} label="拉取策略">
          <Select
            allowClear
            placeholder="IfNotPresent"
            options={IMAGE_PULL_POLICIES}
          />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={12}>
      <Col span={6}>
        <Form.Item name={[index, 'cpuRequest']} label="CPU 请求">
          <Input placeholder="100m" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item name={[index, 'memoryRequest']} label="内存请求">
          <Input placeholder="128Mi" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item name={[index, 'cpuLimit']} label="CPU 上限">
          <Input placeholder="500m" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item name={[index, 'memoryLimit']} label="内存上限">
          <Input placeholder="256Mi" />
        </Form.Item>
      </Col>
    </Row>

    <SectionTitle>端口</SectionTitle>
    <Form.List name={[index, 'ports']}>
      {(fields, { add, remove }) => (
        <>
          {fields.map((field) => (
            <Row gutter={12} key={field.key} align="middle">
              <Col span={8}>
                <Form.Item name={[field.name, 'name']} label="端口名">
                  <Input placeholder="http（可选）" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name={[field.name, 'containerPort']}
                  label="容器端口"
                  rules={[{ required: true, message: '请输入端口' }]}
                >
                  <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name={[field.name, 'protocol']} label="协议">
                  <Select options={PROTOCOLS} placeholder="TCP" allowClear />
                </Form.Item>
              </Col>
              <Col span={2}>
                <Button
                  type="text"
                  danger
                  aria-label="删除端口"
                  icon={<MinusCircleOutlined />}
                  onClick={() => remove(field.name)}
                />
              </Col>
            </Row>
          ))}
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => add({ protocol: 'TCP' })}
          >
            添加端口
          </Button>
        </>
      )}
    </Form.List>

    <Collapse
      ghost
      style={{ marginTop: 12 }}
      items={[
        {
          key: 'advanced',
          label: '高级设置（环境变量、命令、探针、ConfigMap/Secret 引用）',
          children: (
            <>
              <SectionTitle>环境变量</SectionTitle>
              <Form.List name={[index, 'env']}>
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field) => (
                      <Row gutter={8} key={field.key} align="top">
                        <Col span={8}>
                          <Form.Item name={[field.name, 'name']} label="变量名">
                            <Input placeholder="APP_ENV" />
                          </Form.Item>
                        </Col>
                        <Col span={14}>
                          <Form.Item name={[field.name, 'value']} label="值">
                            <Input placeholder="production" />
                          </Form.Item>
                        </Col>
                        <Col span={2}>
                          <Button
                            type="text"
                            danger
                            style={{ marginTop: 30 }}
                            aria-label="删除环境变量"
                            icon={<MinusCircleOutlined />}
                            onClick={() => remove(field.name)}
                          />
                        </Col>
                      </Row>
                    ))}
                    <Button
                      type="dashed"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => add({})}
                    >
                      添加环境变量
                    </Button>
                  </>
                )}
              </Form.List>

              <Divider style={{ margin: '16px 0 12px' }} />
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    name={[index, 'envFromConfigMap']}
                    label="从 ConfigMap 注入全部环境变量"
                  >
                    <Input placeholder="ConfigMap 名称（可选）" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={[index, 'envFromSecret']}
                    label="从 Secret 注入全部环境变量"
                  >
                    <Input placeholder="Secret 名称（可选）" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: '4px 0 12px' }} />
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    name={[index, 'command']}
                    label="启动命令"
                    tooltip="每行一个参数"
                  >
                    <Input.TextArea rows={2} placeholder={'/bin/sh\n-c'} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={[index, 'args']}
                    label="启动参数"
                    tooltip="每行一个参数"
                  >
                    <Input.TextArea rows={2} placeholder={'nginx\n-g\ndaemon off;'} />
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: '4px 0 12px' }} />
              <ProbeEditor index={index} probe="readiness" />
              <ProbeEditor index={index} probe="liveness" />
            </>
          ),
        },
      ]}
    />
  </Card>
);

const VolumeEditor: React.FC<{
  index: number;
  fieldKey: number;
  onRemove: () => void;
}> = ({ index, fieldKey, onRemove }) => {
  const form = Form.useFormInstance();
  const containers: { name?: string }[] =
    Form.useWatch('containers', form) ?? [];

  return (
    <Card
      key={fieldKey}
      size="small"
      style={{ marginBottom: 12 }}
      title={
        <Typography.Text strong style={{ fontSize: 13 }}>
          存储卷 {index + 1}
        </Typography.Text>
      }
      extra={
        <Button
          type="text"
          danger
          aria-label="删除存储卷"
          icon={<MinusCircleOutlined />}
          onClick={onRemove}
        />
      }
    >
      <Row gutter={12}>
        <Col span={7}>
          <Form.Item
            name={[index, 'name']}
            label="卷名"
            rules={[{ required: true, message: '请输入卷名' }]}
          >
            <Input placeholder="data" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name={[index, 'type']} label="类型" initialValue="emptyDir">
            <Select
              options={[
                { label: 'EmptyDir（临时目录）', value: 'emptyDir' },
                { label: 'ConfigMap', value: 'configMap' },
                { label: 'Secret', value: 'secret' },
                { label: 'PVC', value: 'pvc' },
                { label: 'HostPath', value: 'hostPath' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col span={9}>
          <Form.Item
            name={[index, 'source']}
            label="来源名称 / 路径"
            tooltip="EmptyDir 可留空；其它类型填写 ConfigMap/Secret/PVC 名称或主机路径"
          >
            <Input placeholder="configmap / pvc 名称 / /host/path" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={12}>
        <Col span={8}>
          <Form.Item
            name={[index, 'container']}
            label="挂载到容器"
            tooltip="留空则挂载到第一个容器"
          >
            <Select
              allowClear
              placeholder="默认第一个容器"
              options={(containers ?? [])
                .map((item) => item?.name)
                .filter(Boolean)
                .map((name) => ({ label: name as string, value: name as string }))}
            />
          </Form.Item>
        </Col>
        <Col span={10}>
          <Form.Item name={[index, 'mountPath']} label="挂载路径">
            <Input placeholder="/etc/data" />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item
            name={[index, 'readOnly']}
            label="只读"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );
};

const WorkloadForm: React.FC<{
  kind: WorkloadKind | 'Pod';
  namespace?: string;
}> = ({ kind, namespace }) => (
  <>
    <NameAndNamespace namespace={namespace} />
    <Row gutter={12}>
      {kind !== 'DaemonSet' && kind !== 'Pod' ? (
        <Col span={8}>
          <Form.Item name="replicas" label="副本数">
            <InputNumber min={0} max={10000} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      ) : null}
      {kind === 'StatefulSet' ? (
        <>
          <Col span={8}>
            <Form.Item
              name="serviceName"
              label="Headless Service"
              tooltip="留空则使用与资源相同的名称"
            >
              <Input placeholder="mysql-headless" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="podManagementPolicy" label="Pod 管理策略">
              <Select
                options={[
                  { label: 'OrderedReady', value: 'OrderedReady' },
                  { label: 'Parallel', value: 'Parallel' },
                ]}
              />
            </Form.Item>
          </Col>
        </>
      ) : null}
      {kind === 'Deployment' ? (
        <>
          <Col span={8}>
            <Form.Item name="maxSurge" label="maxSurge">
              <Input placeholder="25%" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="maxUnavailable"
              label="maxUnavailable"
            >
              <Input placeholder="25%" />
            </Form.Item>
          </Col>
        </>
      ) : null}
      {kind === 'DaemonSet' ? (
        <Col span={8}>
          <Form.Item name="updateStrategy" label="更新策略">
            <Select
              options={[
                { label: 'RollingUpdate', value: 'RollingUpdate' },
                { label: 'OnDelete', value: 'OnDelete' },
              ]}
            />
          </Form.Item>
        </Col>
      ) : null}
    </Row>

    <LabelsFields />

    <SectionTitle>容器</SectionTitle>
    <Form.List name="containers">
      {(fields, { add, remove }) => (
        <>
          {fields.map((field) => (
            <ContainerEditor
              key={field.key}
              index={field.name}
              fieldKey={field.key}
              onRemove={() => remove(field.name)}
            />
          ))}
          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={() =>
              add({
                name: `container-${fields.length + 1}`,
                image: 'nginx:1.25',
                cpuRequest: '100m',
                memoryRequest: '128Mi',
              })
            }
            style={{ marginBottom: 16 }}
          >
            添加容器
          </Button>
        </>
      )}
    </Form.List>

    <Divider style={{ margin: '8px 0 16px' }} />
    <SectionTitle>存储卷（可选）</SectionTitle>
    <Form.List name="volumes">
      {(fields, { add, remove }) => (
        <>
          {fields.map((field) => (
            <VolumeEditor
              key={field.key}
              index={field.name}
              fieldKey={field.key}
              onRemove={() => remove(field.name)}
            />
          ))}
          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={() => add({ type: 'emptyDir', readOnly: false })}
            style={{ marginBottom: 16 }}
          >
            添加存储卷
          </Button>
        </>
      )}
    </Form.List>

    <Divider style={{ margin: '8px 0 16px' }} />
    <SectionTitle>调度与高级选项</SectionTitle>
    <Row gutter={12}>
      <Col span={8}>
        <Form.Item name="serviceAccountName" label="ServiceAccount">
          <Input placeholder="default" />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="terminationGracePeriodSeconds" label="优雅退出时间(秒)">
          <InputNumber min={0} style={{ width: '100%' }} placeholder="30" />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item
          name="imagePullSecrets"
          label="镜像拉取密钥"
          tooltip="多个 Secret 名称用逗号分隔"
        >
          <Input placeholder="regcred" />
        </Form.Item>
      </Col>
    </Row>
    <Row gutter={12}>
      <Col span={kind === 'Pod' ? 12 : 14}>
        <Form.Item
          name="nodeSelector"
          label="节点选择器"
          tooltip="k=v，多个用逗号或换行分隔"
        >
          <Input.TextArea
            autoSize={{ minRows: 1, maxRows: 2 }}
            placeholder={'kubernetes.io/os=linux\ndisk=ssd'}
          />
        </Form.Item>
      </Col>
      <Col span={4}>
        <Form.Item
          name="hostNetwork"
          label="使用主机网络"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Col>
      {kind === 'Pod' ? (
        <Col span={4}>
          <Form.Item
            name="podNodeName"
            label="指定节点"
            tooltip="直接调度到指定节点，留空由调度器决定"
          >
            <Input placeholder="node-1" />
          </Form.Item>
        </Col>
      ) : null}
      <Col span={4}>
        <Form.Item name="restartPolicy" label="重启策略" tooltip="仅 Pod 生效">
          <Select
            allowClear
            options={['Always', 'OnFailure', 'Never'].map((value) => ({
              label: value,
              value,
            }))}
          />
        </Form.Item>
      </Col>
    </Row>
  </>
);

export default WorkloadForm;
