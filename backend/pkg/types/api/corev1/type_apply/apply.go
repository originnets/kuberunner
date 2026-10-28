package type_apply

import (
	"context"
	"fmt"
	"strings"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	storagev1 "k8s.io/api/storage/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
)

var Apply apply

type apply struct{}

var decoder = serializer.NewCodecFactory(scheme.Scheme).UniversalDeserializer()

const defaultNamespace = "default"

// Apply 接收任意 Kubernetes 内置资源（YAML 或 JSON），解析为强类型对象后创建。
// 相比各资源独立的 create 接口，这种方式可以完整保留 PodSpec 等嵌套字段。
func (a *apply) Apply(ctx context.Context, client kubernetes.Interface, content string) (string, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return "", fmt.Errorf("content 不能为空")
	}

	obj, gvk, err := decoder.Decode([]byte(content), nil, nil)
	if err != nil {
		return "", fmt.Errorf("解析资源对象失败: %w", err)
	}

	accessor, err := meta.Accessor(obj)
	if err != nil {
		return "", fmt.Errorf("资源对象缺少 metadata: %w", err)
	}
	if accessor.GetName() == "" {
		return "", fmt.Errorf("资源对象缺少 metadata.name")
	}

	// 复制来的 YAML 常带有集群专属字段，创建前需要清理。
	sanitize(accessor)

	switch object := obj.(type) {
	case *appsv1.Deployment:
		object.Namespace = namespaceOr(object.Namespace)
		_, err = client.AppsV1().Deployments(object.Namespace).Create(ctx, object, metav1.CreateOptions{})
	case *appsv1.StatefulSet:
		object.Namespace = namespaceOr(object.Namespace)
		_, err = client.AppsV1().StatefulSets(object.Namespace).Create(ctx, object, metav1.CreateOptions{})
	case *appsv1.DaemonSet:
		object.Namespace = namespaceOr(object.Namespace)
		_, err = client.AppsV1().DaemonSets(object.Namespace).Create(ctx, object, metav1.CreateOptions{})
	case *corev1.Pod:
		object.Namespace = namespaceOr(object.Namespace)
		_, err = client.CoreV1().Pods(object.Namespace).Create(ctx, object, metav1.CreateOptions{})
	case *corev1.Service:
		object.Namespace = namespaceOr(object.Namespace)
		_, err = client.CoreV1().Services(object.Namespace).Create(ctx, object, metav1.CreateOptions{})
	case *corev1.ConfigMap:
		object.Namespace = namespaceOr(object.Namespace)
		_, err = client.CoreV1().ConfigMaps(object.Namespace).Create(ctx, object, metav1.CreateOptions{})
	case *corev1.Secret:
		object.Namespace = namespaceOr(object.Namespace)
		_, err = client.CoreV1().Secrets(object.Namespace).Create(ctx, object, metav1.CreateOptions{})
	case *corev1.PersistentVolumeClaim:
		object.Namespace = namespaceOr(object.Namespace)
		_, err = client.CoreV1().PersistentVolumeClaims(object.Namespace).Create(ctx, object, metav1.CreateOptions{})
	case *corev1.PersistentVolume:
		_, err = client.CoreV1().PersistentVolumes().Create(ctx, object, metav1.CreateOptions{})
	case *corev1.Namespace:
		_, err = client.CoreV1().Namespaces().Create(ctx, object, metav1.CreateOptions{})
	case *networkingv1.Ingress:
		object.Namespace = namespaceOr(object.Namespace)
		_, err = client.NetworkingV1().Ingresses(object.Namespace).Create(ctx, object, metav1.CreateOptions{})
	case *storagev1.StorageClass:
		_, err = client.StorageV1().StorageClasses().Create(ctx, object, metav1.CreateOptions{})
	case *batchv1.Job:
		object.Namespace = namespaceOr(object.Namespace)
		_, err = client.BatchV1().Jobs(object.Namespace).Create(ctx, object, metav1.CreateOptions{})
	default:
		return "", fmt.Errorf("暂不支持创建 %s 资源", gvk.Kind)
	}

	if err != nil {
		if apierrors.IsAlreadyExists(err) {
			return "", fmt.Errorf("%s/%s 已存在", gvk.Kind, accessor.GetName())
		}
		return "", fmt.Errorf("创建 %s/%s 失败: %w", gvk.Kind, accessor.GetName(), err)
	}

	return fmt.Sprintf("%s/%s 创建成功", gvk.Kind, accessor.GetName()), nil
}

func namespaceOr(namespace string) string {
	if namespace == "" {
		return defaultNamespace
	}
	return namespace
}

func sanitize(accessor metav1.Object) {
	accessor.SetResourceVersion("")
	accessor.SetUID("")
	accessor.SetCreationTimestamp(metav1.Time{})
	accessor.SetDeletionTimestamp(nil)
	accessor.SetDeletionGracePeriodSeconds(nil)
	accessor.SetGeneration(0)
	accessor.SetManagedFields(nil)
	accessor.SetSelfLink("")
}
