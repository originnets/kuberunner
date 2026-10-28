package type_node

import (
	"context"
	"errors"
	"fmt"
	"github.com/gitlayzer/kuberunner/pkg/utils/dataselect"
	corev1 "k8s.io/api/core/v1"
	policyv1 "k8s.io/api/policy/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"time"
)

var Node node

type node struct{}

func (n *node) GetNodes(client *kubernetes.Clientset, filterName string, limit, page int) (nodeResp *NodeResp, err error) {
	nodeList, err := client.CoreV1().Nodes().List(context.TODO(), metav1.ListOptions{})

	if err != nil {
		return nil, errors.New(fmt.Sprintf("获取Node列表失败: %v", err))
	}

	selectableData := &dataselect.DataSelector{
		GenericDataList: n.toCells(nodeList.Items),
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

	nodes := n.fromCells(filtered.GenericDataList)

	return &NodeResp{
		Items: nodes,
		Total: total,
	}, nil
}

func (n *node) toCells(std []corev1.Node) []dataselect.DataCell {
	cells := make([]dataselect.DataCell, len(std))
	for i := range std {
		cells[i] = dataselect.NodeCell(std[i])
	}
	return cells
}

func (n *node) fromCells(cells []dataselect.DataCell) []corev1.Node {
	nodes := make([]corev1.Node, len(cells))
	for i := range cells {
		nodes[i] = corev1.Node(cells[i].(dataselect.NodeCell))
	}
	return nodes
}

func (n *node) GetNodeDetail(client *kubernetes.Clientset, nodeName string) (*corev1.Node, error) {
	node, err := client.CoreV1().Nodes().Get(context.TODO(), nodeName, metav1.GetOptions{})
	if err != nil {
		return nil, errors.New(fmt.Sprintf("获取Node详情失败: %v", err))
	}

	return node, nil
}

type DrainOptions struct {
	Force              bool
	IgnoreDaemonSets   bool
	DeleteEmptyDirData bool
	Timeout            time.Duration
}

type DrainResult struct {
	Evicted []string `json:"evicted"`
	Skipped []string `json:"skipped"`
	Errors  []string `json:"errors"`
}

// SetNodeSchedulable 开启/关闭节点调度（cordon / uncordon）。
func (n *node) SetNodeSchedulable(client *kubernetes.Clientset, nodeName string, unschedulable bool) error {
	ctx := context.TODO()

	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		current, err := client.CoreV1().Nodes().Get(ctx, nodeName, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("获取节点失败: %w", err)
		}
		if current.Spec.Unschedulable == unschedulable {
			return nil
		}

		current.Spec.Unschedulable = unschedulable
		if _, err := client.CoreV1().Nodes().Update(ctx, current, metav1.UpdateOptions{}); err != nil {
			lastErr = err
			time.Sleep(100 * time.Millisecond)
			continue
		}
		return nil
	}

	return fmt.Errorf("更新节点调度状态失败: %w", lastErr)
}

// DrainNode 驱逐节点上的 Pod 并将节点标记为不可调度。
func (n *node) DrainNode(client *kubernetes.Clientset, nodeName string, opts DrainOptions) (*DrainResult, error) {
	if opts.Timeout <= 0 {
		opts.Timeout = 2 * time.Minute
	}
	ctx, cancel := context.WithTimeout(context.Background(), opts.Timeout)
	defer cancel()

	node, err := client.CoreV1().Nodes().Get(ctx, nodeName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("获取节点失败: %w", err)
	}

	pods, err := client.CoreV1().Pods("").List(ctx, metav1.ListOptions{
		FieldSelector: "spec.nodeName=" + nodeName,
	})
	if err != nil {
		return nil, fmt.Errorf("获取节点Pod失败: %w", err)
	}

	result := &DrainResult{Evicted: []string{}, Skipped: []string{}, Errors: []string{}}

	for i := range pods.Items {
		pod := &pods.Items[i]
		podKey := pod.Namespace + "/" + pod.Name

		if _, ok := pod.Annotations["kubernetes.io/config.mirror"]; ok {
			result.Skipped = append(result.Skipped, podKey+"（静态 Pod）")
			continue
		}
		if pod.Status.Phase == corev1.PodSucceeded || pod.Status.Phase == corev1.PodFailed {
			continue
		}
		if isDaemonSetPod(pod) && opts.IgnoreDaemonSets {
			result.Skipped = append(result.Skipped, podKey+"（DaemonSet）")
			continue
		}
		if hasEmptyDir(pod) && !opts.DeleteEmptyDirData && !opts.Force {
			result.Skipped = append(result.Skipped, podKey+"（使用 emptyDir，可勾选强制驱逐）")
			continue
		}

		eviction := &policyv1.Eviction{
			ObjectMeta: metav1.ObjectMeta{Name: pod.Name, Namespace: pod.Namespace},
		}
		if err := client.PolicyV1().Evictions(pod.Namespace).Evict(ctx, eviction); err != nil {
			if opts.Force {
				if delErr := client.CoreV1().Pods(pod.Namespace).Delete(ctx, pod.Name, metav1.DeleteOptions{}); delErr == nil {
					result.Evicted = append(result.Evicted, podKey)
					continue
				}
			}
			result.Errors = append(result.Errors, fmt.Sprintf("%s: %v", podKey, err))
			continue
		}
		result.Evicted = append(result.Evicted, podKey)
	}

	if !node.Spec.Unschedulable {
		node.Spec.Unschedulable = true
		if _, err := client.CoreV1().Nodes().Update(ctx, node, metav1.UpdateOptions{}); err != nil {
			result.Errors = append(result.Errors, "节点 cordon 失败: "+err.Error())
		}
	}

	return result, nil
}

func isDaemonSetPod(pod *corev1.Pod) bool {
	for _, owner := range pod.OwnerReferences {
		if owner.Kind == "DaemonSet" {
			return true
		}
	}
	return false
}

func hasEmptyDir(pod *corev1.Pod) bool {
	for _, volume := range pod.Spec.Volumes {
		if volume.EmptyDir != nil {
			return true
		}
	}
	return false
}
