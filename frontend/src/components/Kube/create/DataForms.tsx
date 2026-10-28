import { Col, Form, Row, Select } from 'antd';
import React from 'react';
import { KeyValueList, LabelsFields, NameAndNamespace, SectionTitle } from './common';

export const ConfigMapForm: React.FC<{ namespace?: string }> = ({
  namespace,
}) => (
  <>
    <NameAndNamespace namespace={namespace} />
    <LabelsFields />
    <SectionTitle>配置项</SectionTitle>
    <KeyValueList
      name="data"
      keyLabel="键"
      valueLabel="值"
      valueRows={3}
      addText="添加配置项"
      keyPlaceholder="app.conf"
      valuePlaceholder={'server.port=8080\nlog.level=info'}
    />
  </>
);

const SECRET_TYPES = [
  { label: 'Opaque（通用）', value: 'Opaque' },
  { label: 'TLS 证书', value: 'kubernetes.io/tls' },
  { label: 'Docker 仓库凭据', value: 'kubernetes.io/dockerconfigjson' },
  { label: '基础认证', value: 'kubernetes.io/basic-auth' },
  { label: 'SSH 密钥', value: 'kubernetes.io/ssh-auth' },
];

export const SecretForm: React.FC<{ namespace?: string }> = ({
  namespace,
}) => (
  <>
    <NameAndNamespace namespace={namespace} />
    <Row gutter={12}>
      <Col span={12}>
        <Form.Item name="type" label="类型">
          <Select options={SECRET_TYPES} />
        </Form.Item>
      </Col>
    </Row>
    <LabelsFields />
    <SectionTitle>数据（明文，创建时由集群自动 Base64 编码）</SectionTitle>
    <KeyValueList
      name="data"
      keyLabel="键"
      valueLabel="值"
      addText="添加数据项"
      keyPlaceholder="username"
      valuePlaceholder="填写明文值"
    />
  </>
);
