import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Col, Form, Input, Row, Typography } from 'antd';
import React from 'react';

/** 表单分组标题 */
export const SectionTitle: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Typography.Text
    strong
    style={{ display: 'block', margin: '4px 0 12px', fontSize: 13 }}
  >
    {children}
  </Typography.Text>
);

/** 名称 + 命名空间 */
export const NameAndNamespace: React.FC<{
  namespaced?: boolean;
  namespace?: string;
  editing?: boolean;
}> = ({ namespaced = true, namespace, editing = false }) => (
  <Row gutter={16}>
    <Col span={namespaced && !namespace ? 12 : 24}>
      <Form.Item
        name="name"
        label="名称"
        rules={[{ required: true, message: '请输入名称' }]}
      >
        <Input placeholder="demo" autoComplete="off" disabled={editing} />
      </Form.Item>
    </Col>
    {namespaced && !namespace ? (
      <Col span={12}>
        <Form.Item
          name="namespace"
          label="命名空间"
          rules={[{ required: true, message: '请输入命名空间' }]}
        >
          <Input placeholder="default" autoComplete="off" disabled={editing} />
        </Form.Item>
      </Col>
    ) : null}
  </Row>
);

/** 标签 / 注解 */
export const LabelsFields: React.FC = () => (
  <Row gutter={16}>
    <Col span={12}>
      <Form.Item name="labels" label="标签" tooltip="k=v，多个用逗号或换行分隔">
        <Input.TextArea
          autoSize={{ minRows: 1, maxRows: 3 }}
          placeholder={'app=demo\ntier=backend'}
        />
      </Form.Item>
    </Col>
    <Col span={12}>
      <Form.Item
        name="annotations"
        label="注解"
        tooltip="k=v，多个用逗号或换行分隔"
      >
        <Input.TextArea
          autoSize={{ minRows: 1, maxRows: 3 }}
          placeholder="example.com/owner=platform"
        />
      </Form.Item>
    </Col>
  </Row>
);

/** 可增删的键值对列表 */
export const KeyValueList: React.FC<{
  name: string;
  keyLabel?: string;
  valueLabel?: string;
  valueRows?: number;
  addText?: string;
  valuePlaceholder?: string;
  keyPlaceholder?: string;
}> = ({
  name,
  keyLabel = '键',
  valueLabel = '值',
  valueRows = 1,
  addText = '添加一项',
  valuePlaceholder,
  keyPlaceholder,
}) => (
  <Form.List name={name}>
    {(fields, { add, remove }) => (
      <>
        {fields.map((field) => (
          <Row gutter={8} key={field.key} align="top">
            <Col span={7}>
              <Form.Item
                name={[field.name, 'key']}
                label={keyLabel}
                rules={[{ required: true, message: '请填写键' }]}
              >
                <Input placeholder={keyPlaceholder ?? 'key'} />
              </Form.Item>
            </Col>
            <Col span={15}>
              <Form.Item name={[field.name, 'value']} label={valueLabel}>
                <Input.TextArea
                  rows={valueRows}
                  placeholder={valuePlaceholder}
                  style={valueRows > 1 ? { fontFamily: 'monospace' } : undefined}
                />
              </Form.Item>
            </Col>
            <Col span={2}>
              <Button
                type="text"
                danger
                style={{ marginTop: 30 }}
                aria-label="删除该项"
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
          style={{ marginBottom: 12 }}
        >
          {addText}
        </Button>
      </>
    )}
  </Form.List>
);
