package type_namespace

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gitlayzer/kuberunner/pkg/utils/dataselect"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

var Namespace namespace

type namespace struct{}

func (n *namespace) GetNamespaces(client *kubernetes.Clientset, filterName string, limit, page int) (namespaceResp *NamespaceResp, err error) {
	namespaceList, err := client.CoreV1().Namespaces().List(context.Background(), metav1.ListOptions{})

	if err != nil {
		return nil, errors.New(fmt.Sprintf("获取Namespace列表失败: %v", err))
	}

	selectableData := &dataselect.DataSelector{
		GenericDataList: n.toCells(namespaceList.Items),
		DataSelectorQuery: &dataselect.DataSelectorQuery{
			FilterQuery: &dataselect.FilterQuery{
				Name: filterName,
			},
			Pagination: &dataselect.PaginateQuery{
				Limit: limit,
				Page:  page,
			},
		},
	}

	filtered := selectableData.Filter()

	total := len(filtered.GenericDataList)

	namespaces := n.fromCells(filtered.GenericDataList)

	return &NamespaceResp{
		Items: namespaces,
		Total: total,
	}, nil
}

func (n *namespace) CreateNamespace(client *kubernetes.Clientset, namespaceCreate *NamespaceCreate) (err error) {
	namespace := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name:   namespaceCreate.Name,
			Labels: namespaceCreate.Label,
		},
	}

	_, err = client.CoreV1().Namespaces().Create(context.Background(), namespace, metav1.CreateOptions{})
	if err != nil {
		return errors.New(fmt.Sprintf("创建Namespace失败: %v", err))
	}

	return nil
}

func (n *namespace) DeleteNamespace(client *kubernetes.Clientset, namespaceName string) (err error) {
	if err := client.CoreV1().Namespaces().Delete(context.Background(), namespaceName, metav1.DeleteOptions{}); err != nil {
		return errors.New(fmt.Sprintf("删除Namespace失败: %v", err))
	}

	return nil
}

func (n *namespace) toCells(std []corev1.Namespace) []dataselect.DataCell {
	cells := make([]dataselect.DataCell, len(std))
	for i := range std {
		cells[i] = dataselect.NamespaceCell(std[i])
	}
	return cells
}

func (n *namespace) fromCells(cells []dataselect.DataCell) []corev1.Namespace {
	namespaces := make([]corev1.Namespace, len(cells))
	for i := range cells {
		namespaces[i] = corev1.Namespace(cells[i].(dataselect.NamespaceCell))
	}
	return namespaces
}

func (n *namespace) GetNamespaceDetail(client *kubernetes.Clientset, namespaceName string) (*corev1.Namespace, error) {
	namespace, err := client.CoreV1().Namespaces().Get(context.TODO(), namespaceName, metav1.GetOptions{})
	if err != nil {
		return nil, errors.New(fmt.Sprintf("获取Namespace详情失败: %v", err))
	}

	return namespace, nil
}

func (n *namespace) UpdateNamespace(client *kubernetes.Clientset, content string) error {
	var namespace corev1.Namespace
	if err := json.Unmarshal([]byte(content), &namespace); err != nil {
		return errors.New(fmt.Sprintf("反序列化失败: %v", err))
	}

	if _, err := client.CoreV1().Namespaces().Update(context.TODO(), &namespace, metav1.UpdateOptions{}); err != nil {
		return errors.New(fmt.Sprintf("更新Namespace失败: %v", err))
	}

	return nil
}
