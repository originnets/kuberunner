import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Typography,
} from 'antd';
import React from 'react';
import { LabelsFields, NameAndNamespace, SectionTitle } from './common';

const PROTOCOLS = ['TCP', 'UDP', 'SCTP'].map((value) => ({
  label: value,
  value,
}));

const ServiceForm: React.FC<{
  namespace?: string;
  editing?: boolean;
}> = ({ namespace, editing }) => (
  <>
    <NameAndNamespace namespace={namespace} editing={editing} />
    <Row gutter={12}>
      <Col span={6}>
        <Form.Item name="type" label="类型">
          <Select
            options={['ClusterIP', 'NodePort', 'LoadBalancer'].map((value) => ({
              label: value,
              value,
            }))}
          />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item
          name="clusterIP"
          label="ClusterIP"
          tooltip="创建后不可修改；填写 None 可创建 Headless Service"
        >
          <Input placeholder="自动分配" disabled={editing} />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item name="sessionAffinity" label="会话保持">
          <Select
            allowClear
            placeholder="None"
            options={[
              { label: 'None', value: 'None' },
              { label: 'ClientIP', value: 'ClientIP' },
            ]}
          />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item
          name="externalTrafficPolicy"
          label="外部流量策略"
          tooltip="仅 NodePort / LoadBalancer 生效"
        >
          <Select
            allowClear
            placeholder="Cluster"
            options={[
              { label: 'Cluster', value: 'Cluster' },
              { label: 'Local', value: 'Local' },
            ]}
          />
        </Form.Item>
      </Col>
    </Row>

    <Form.Item
      name="selector"
      label="Pod 选择器"
      tooltip="k=v，多个用逗号或换行分隔；留空表示不使用选择器"
    >
      <Input placeholder="app=demo" />
    </Form.Item>

    <LabelsFields />

    <SectionTitle>端口</SectionTitle>
    <Form.List name="ports">
      {(fields, { add, remove }) => (
        <>
          {fields.map((field) => (
            <Row gutter={12} key={field.key} align="middle">
              <Col span={6}>
                <Form.Item name={[field.name, 'name']} label="名称">
                  <Input placeholder="http（可选）" />
                </Form.Item>
              </Col>
              <Col span={5}>
                <Form.Item
                  name={[field.name, 'port']}
                  label="服务端口"
                  rules={[{ required: true, message: '请输入端口' }]}
                >
                  <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={5}>
                <Form.Item name={[field.name, 'targetPort']} label="容器端口">
                  <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item
                  name={[field.name, 'nodePort']}
                  label="NodePort"
                  tooltip="NodePort / LoadBalancer 类型可指定"
                >
                  <InputNumber
                    min={30000}
                    max={32767}
                    style={{ width: '100%' }}
                    placeholder="自动"
                  />
                </Form.Item>
              </Col>
              <Col span={3}>
                <Form.Item name={[field.name, 'protocol']} label="协议">
                  <Select options={PROTOCOLS} placeholder="TCP" allowClear />
                </Form.Item>
              </Col>
              <Col span={1}>
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
            block
            icon={<PlusOutlined />}
            onClick={() => add({ protocol: 'TCP' })}
          >
            添加端口
          </Button>
        </>
      )}
    </Form.List>

    <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12 }}>
      NodePort 类型会自动分配 30000-32767 之间的端口，也可以手动指定。
    </Typography.Paragraph>
  </>
);

export default ServiceForm;
