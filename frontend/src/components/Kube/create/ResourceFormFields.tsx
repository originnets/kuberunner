import React from 'react';
import { ConfigMapForm, SecretForm } from './DataForms';
import IngressForm from './IngressForm';
import ServiceForm from './ServiceForm';
import {
  NamespaceForm,
  PvcForm,
  PvForm,
  StorageClassForm,
} from './StorageForms';
import type { WorkloadKind } from './builders';
import type { CreateKind } from './templates';
import WorkloadForm from './WorkloadForm';

export interface ResourceFormFieldsProps {
  kind: CreateKind;
  namespace?: string;
  /** 编辑模式：名称/命名空间及部分不可变字段只读 */
  editing?: boolean;
}

/** 按资源类型渲染对应的表单字段（创建、编辑、只读展示共用） */
const ResourceFormFields: React.FC<ResourceFormFieldsProps> = ({
  kind,
  namespace,
  editing = false,
}) => {
  switch (kind) {
    case 'deployment':
    case 'statefulset':
    case 'daemonset':
    case 'pod':
      return (
        <WorkloadForm
          kind={
            (kind === 'deployment'
              ? 'Deployment'
              : kind === 'statefulset'
                ? 'StatefulSet'
                : kind === 'daemonset'
                  ? 'DaemonSet'
                  : 'Pod') as WorkloadKind | 'Pod'
          }
          namespace={namespace}
          editing={editing}
        />
      );
    case 'service':
      return <ServiceForm namespace={namespace} editing={editing} />;
    case 'configmap':
      return <ConfigMapForm namespace={namespace} editing={editing} />;
    case 'secret':
      return <SecretForm namespace={namespace} editing={editing} />;
    case 'pvc':
      return <PvcForm namespace={namespace} editing={editing} />;
    case 'namespace':
      return <NamespaceForm editing={editing} />;
    case 'ingress':
      return <IngressForm namespace={namespace} editing={editing} />;
    case 'pv':
      return <PvForm editing={editing} />;
    case 'storageclass':
      return <StorageClassForm editing={editing} />;
    default:
      return null;
  }
};

export default ResourceFormFields;
