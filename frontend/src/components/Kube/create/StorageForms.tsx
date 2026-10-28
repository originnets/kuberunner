import { Col, Form, Input, Row, Select, Switch } from 'antd';
import React from 'react';
import {
  KeyValueList,
  LabelsFields,
  NameAndNamespace,
  SectionTitle,
} from './common';

const ACCESS_MODES = [
  'ReadWriteOnce',
  'ReadOnlyMany',
  'ReadWriteMany',
  'ReadWriteOncePod',
].map((value) => ({ label: value, value }));

export const PvcForm: React.FC<{ namespace?: string }> = ({ namespace }) => (
  <>
    <NameAndNamespace namespace={namespace} />
    <Row gutter={12}>
      <Col span={10}>
        <Form.Item
          name="accessModes"
          label="访问模式"
        >
          <Select mode="multiple" options={ACCESS_MODES} />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item
          name="storage"
          label="容量"
          rules={[{ required: true, message: '请输入容量' }]}
        >
          <Input placeholder="1Gi" />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item
          name="storageClassName"
          label="StorageClass"
          tooltip="留空使用默认 StorageClass"
        >
          <Input placeholder="standard" />
        </Form.Item>
      </Col>
    </Row>
    <Row gutter={12}>
      <Col span={8}>
        <Form.Item name="volumeMode" label="卷模式">
          <Select
            options={[
              { label: 'Filesystem', value: 'Filesystem' },
              { label: 'Block', value: 'Block' },
            ]}
          />
        </Form.Item>
      </Col>
      <Col span={16}>
        <Form.Item
          name="selector"
          label="PV 选择器"
          tooltip="按标签选择已有 PV，k=v，多个用逗号分隔"
        >
          <Input placeholder="disk=ssd" />
        </Form.Item>
      </Col>
    </Row>
    <LabelsFields />
  </>
);

export const NamespaceForm: React.FC = () => (
  <>
    <NameAndNamespace namespaced={false} />
    <LabelsFields />
  </>
);

const PV_TYPES = [
  { label: 'NFS', value: 'nfs' },
  { label: 'HostPath', value: 'hostPath' },
  { label: 'Local（本地盘）', value: 'local' },
  { label: 'CSI', value: 'csi' },
  { label: 'CephFS', value: 'cephfs' },
  { label: 'Ceph RBD', value: 'rbd' },
];

export const PvForm: React.FC = () => {
  const form = Form.useFormInstance();
  const volumeType = Form.useWatch('volumeType', form) ?? 'nfs';

  return (
    <>
      <NameAndNamespace namespaced={false} />
      <Row gutter={12}>
        <Col span={8}>
          <Form.Item name="volumeType" label="存储类型">
            <Select options={PV_TYPES} />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item
            name="storage"
            label="容量"
            rules={[{ required: true, message: '请输入容量' }]}
          >
            <Input placeholder="10Gi" />
          </Form.Item>
        </Col>
        <Col span={10}>
          <Form.Item
            name="accessModes"
            label="访问模式"
          >
            <Select mode="multiple" options={ACCESS_MODES} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={12}>
        <Col span={6}>
          <Form.Item
            name="reclaimPolicy"
            label="回收策略"
          >
            <Select
              options={['Retain', 'Delete', 'Recycle'].map((value) => ({
                label: value,
                value,
              }))}
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="storageClassName" label="StorageClass">
            <Input placeholder="nfs" />
          </Form.Item>
        </Col>
        <Col span={5}>
          <Form.Item name="volumeMode" label="卷模式">
            <Select
              options={[
                { label: 'Filesystem', value: 'Filesystem' },
                { label: 'Block', value: 'Block' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col span={5}>
          <Form.Item
            name="mountOptions"
            label="挂载参数"
            tooltip="逗号分隔，例如 vers=4.1"
          >
            <Input placeholder="vers=4.1" />
          </Form.Item>
        </Col>
      </Row>

      {volumeType === 'nfs' ? (
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="server"
              label="NFS Server"
              rules={[{ required: true, message: '请输入服务器地址' }]}
            >
              <Input placeholder="192.168.1.10" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="path"
              label="共享路径"
              rules={[{ required: true, message: '请输入共享路径' }]}
            >
              <Input placeholder="/data/nfs" />
            </Form.Item>
          </Col>
        </Row>
      ) : null}

      {volumeType === 'hostPath' ? (
        <Form.Item
          name="path"
          label="节点路径"
          rules={[{ required: true, message: '请输入节点路径' }]}
        >
          <Input placeholder="/mnt/data" />
        </Form.Item>
      ) : null}

      {volumeType === 'local' ? (
        <Row gutter={12}>
          <Col span={10}>
            <Form.Item
              name="nodeName"
              label="节点名称"
              tooltip="Local PV 需要固定到具体节点，会生成 nodeAffinity"
              rules={[{ required: true, message: '请输入节点名称' }]}
            >
              <Input placeholder="node-1" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="path"
              label="节点路径"
              rules={[{ required: true, message: '请输入节点路径' }]}
            >
              <Input placeholder="/mnt/local" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="fsType" label="文件系统">
              <Input placeholder="ext4" />
            </Form.Item>
          </Col>
        </Row>
      ) : null}

      {volumeType === 'csi' ? (
        <Row gutter={12}>
          <Col span={10}>
            <Form.Item
              name="csiDriver"
              label="CSI Driver"
              rules={[{ required: true, message: '请输入 CSI Driver' }]}
            >
              <Input placeholder="nfs.csi.k8s.io" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="csiVolumeHandle"
              label="VolumeHandle"
              tooltip="留空则使用名称"
            >
              <Input placeholder="volume-id" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="fsType" label="文件系统">
              <Input placeholder="ext4" />
            </Form.Item>
          </Col>
        </Row>
      ) : null}

      {volumeType === 'cephfs' || volumeType === 'rbd' ? (
        <>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="monitors"
                label="Monitor 地址"
                tooltip="多个地址用逗号分隔"
                rules={[{ required: true, message: '请输入 Monitor 地址' }]}
              >
                <Input placeholder="10.0.0.1:6789,10.0.0.2:6789" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="user" label="Ceph 用户">
                <Input placeholder="admin" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="fsType" label="文件系统">
                <Input placeholder="ext4" />
              </Form.Item>
            </Col>
          </Row>
          {volumeType === 'cephfs' ? (
            <Form.Item
              name="path"
              label="CephFS 路径"
              rules={[{ required: true, message: '请输入路径' }]}
            >
              <Input placeholder="/" />
            </Form.Item>
          ) : (
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item
                  name="pool"
                  label="Pool"
                  rules={[{ required: true, message: '请输入 Pool' }]}
                >
                  <Input placeholder="rbd" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="image"
                  label="Image"
                  tooltip="留空则使用 PV 名称"
                >
                  <Input placeholder="volume-1" />
                </Form.Item>
              </Col>
            </Row>
          )}
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="secretName"
                label="Secret 名称"
                rules={[{ required: true, message: '请输入 Secret 名称' }]}
              >
                <Input placeholder="ceph-secret" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="secretNamespace"
                label="Secret 命名空间"
                rules={[{ required: true, message: '请输入命名空间' }]}
              >
                <Input placeholder="default" />
              </Form.Item>
            </Col>
          </Row>
        </>
      ) : null}

      <LabelsFields />
    </>
  );
};

export const StorageClassForm: React.FC = () => (
  <>
    <NameAndNamespace namespaced={false} />
    <Row gutter={12}>
      <Col span={10}>
        <Form.Item
          name="provisioner"
          label="Provisioner"
          tooltip="动态供给插件；使用静态 PV 时可填 kubernetes.io/no-provisioner"
          rules={[{ required: true, message: '请输入 Provisioner' }]}
        >
          <Input placeholder="nfs.csi.k8s.io / kubernetes.io/no-provisioner" />
        </Form.Item>
      </Col>
      <Col span={7}>
        <Form.Item name="reclaimPolicy" label="回收策略">
          <Select
            options={['Delete', 'Retain', 'Recycle'].map((value) => ({
              label: value,
              value,
            }))}
          />
        </Form.Item>
      </Col>
      <Col span={7}>
        <Form.Item
          name="volumeBindingMode"
          label="绑定模式"
          tooltip="WaitForFirstConsumer 适合延迟绑定的存储（如本地盘）"
        >
          <Select
            options={[
              { label: 'Immediate', value: 'Immediate' },
              { label: 'WaitForFirstConsumer', value: 'WaitForFirstConsumer' },
            ]}
          />
        </Form.Item>
      </Col>
    </Row>
    <Row gutter={12}>
      <Col span={8}>
        <Form.Item
          name="allowVolumeExpansion"
          label="允许扩容"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Col>
      <Col span={16}>
        <Form.Item
          name="mountOptions"
          label="挂载参数"
          tooltip="逗号分隔，例如 vers=4.1"
        >
          <Input placeholder="vers=4.1" />
        </Form.Item>
      </Col>
    </Row>

    <SectionTitle>Parameters（可选，按 Provisioner 要求填写）</SectionTitle>
    <KeyValueList
      name="parameters"
      keyLabel="参数名"
      valueLabel="参数值"
      addText="添加参数"
      keyPlaceholder="type / server / share"
    />

    <LabelsFields />
  </>
);