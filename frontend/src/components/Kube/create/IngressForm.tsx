import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
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

const PATH_TYPES = ['Prefix', 'Exact', 'ImplementationSpecific'].map(
  (value) => ({ label: value, value }),
);

const IngressForm: React.FC<{
  namespace?: string;
  editing?: boolean;
}> = ({ namespace, editing }) => (
  <>
    <NameAndNamespace namespace={namespace} editing={editing} />
    <Row gutter={12}>
      <Col span={12}>
        <Form.Item
          name="ingressClassName"
          label="IngressClass"
        >
          <Input placeholder="nginx" />
        </Form.Item>
      </Col>
    </Row>
    <LabelsFields />

    <SectionTitle>路由规则</SectionTitle>
    <Form.List name="hosts">
      {(hostFields, hostOps) => (
        <>
          {hostFields.map((hostField) => (
            <Card
              key={hostField.key}
              size="small"
              style={{ marginBottom: 12 }}
              title={
                <Typography.Text strong style={{ fontSize: 13 }}>
                  域名 {hostField.name + 1}
                </Typography.Text>
              }
              extra={
                <Button
                  type="text"
                  danger
                  aria-label="删除域名"
                  icon={<MinusCircleOutlined />}
                  onClick={() => hostOps.remove(hostField.name)}
                />
              }
            >
              <Form.Item
                name={[hostField.name, 'host']}
                label="Host"
                rules={[{ required: true, message: '请输入域名' }]}
              >
                <Input placeholder="demo.example.com" />
              </Form.Item>

              <Form.List name={[hostField.name, 'paths']}>
                {(pathFields, pathOps) => (
                  <>
                    {pathFields.map((pathField) => (
                      <Row gutter={8} key={pathField.key} align="middle">
                        <Col span={5}>
                          <Form.Item
                            name={[pathField.name, 'path']}
                            label="路径"
                          >
                            <Input placeholder="/" />
                          </Form.Item>
                        </Col>
                        <Col span={5}>
                          <Form.Item
                            name={[pathField.name, 'pathType']}
                            label="匹配方式"
                          >
                            <Select options={PATH_TYPES} placeholder="Prefix" />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item
                            name={[pathField.name, 'serviceName']}
                            label="后端服务"
                            rules={[{ required: true, message: '请输入服务名' }]}
                          >
                            <Input placeholder="demo" />
                          </Form.Item>
                        </Col>
                        <Col span={5}>
                          <Form.Item
                            name={[pathField.name, 'servicePort']}
                            label="服务端口"
                            rules={[{ required: true, message: '请输入端口' }]}
                          >
                            <InputNumber
                              min={1}
                              max={65535}
                              style={{ width: '100%' }}
                              placeholder="80"
                            />
                          </Form.Item>
                        </Col>
                        <Col span={3}>
                          <Button
                            type="text"
                            danger
                            aria-label="删除路径"
                            icon={<MinusCircleOutlined />}
                            onClick={() => pathOps.remove(pathField.name)}
                          />
                        </Col>
                      </Row>
                    ))}
                    <Button
                      type="dashed"
                      block
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() =>
                        pathOps.add({ path: '/', pathType: 'Prefix' })
                      }
                    >
                      添加路径
                    </Button>
                  </>
                )}
              </Form.List>
            </Card>
          ))}
          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={() =>
              hostOps.add({
                host: '',
                paths: [{ path: '/', pathType: 'Prefix', servicePort: 80 }],
              })
            }
            style={{ marginBottom: 16 }}
          >
            添加域名
          </Button>
        </>
      )}
    </Form.List>

    <SectionTitle>TLS（可选）</SectionTitle>
    <Form.List name="tls">
      {(fields, { add, remove }) => (
        <>
          {fields.map((field) => (
            <Row gutter={8} key={field.key} align="middle">
              <Col span={9}>
                <Form.Item
                  name={[field.name, 'secretName']}
                  label="Secret 名称"
                  rules={[{ required: true, message: '请输入 Secret 名称' }]}
                >
                  <Input placeholder="demo-tls" />
                </Form.Item>
              </Col>
              <Col span={13}>
                <Form.Item
                  name={[field.name, 'hosts']}
                  label="域名"
                  tooltip="多个域名用逗号分隔"
                >
                  <Input placeholder="demo.example.com" />
                </Form.Item>
              </Col>
              <Col span={2}>
                <Button
                  type="text"
                  danger
                  aria-label="删除 TLS"
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
            onClick={() => add({})}
          >
            添加 TLS 配置
          </Button>
        </>
      )}
    </Form.List>
  </>
);

export default IngressForm;
