package type_resourcenum

import (
	"context"
	"fmt"
	"sync"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

var ResourceNum resourcenum

type resourcenum struct{}

// GetResourceNum 并发统计各资源数量。单个资源统计失败不会导致整体失败，
// 错误会通过返回的切片汇报，便于前端展示“部分失败”。
func (r *resourcenum) GetResourceNum(ctx context.Context, client *kubernetes.Clientset) (map[string]int, []error) {
	data := make(map[string]int, 12)
	errs := make([]error, 0)

	var (
		wg sync.WaitGroup
		mu sync.Mutex
	)

	collect := func(resource string, fn func() (int, error)) {
		defer wg.Done()

		num, err := fn()

		mu.Lock()
		defer mu.Unlock()
		if err != nil {
			errs = append(errs, fmt.Errorf("%s: %w", resource, err))
			return
		}
		data[resource] = num
	}

	wg.Add(12)
	go collect("Nodes", func() (int, error) {
		list, err := client.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
		if err != nil {
			return 0, err
		}
		return len(list.Items), nil
	})
	go collect("Pods", func() (int, error) {
		list, err := client.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
		if err != nil {
			return 0, err
		}
		return len(list.Items), nil
	})
	go collect("Services", func() (int, error) {
		list, err := client.CoreV1().Services("").List(ctx, metav1.ListOptions{})
		if err != nil {
			return 0, err
		}
		return len(list.Items), nil
	})
	go collect("Ingress", func() (int, error) {
		list, err := client.NetworkingV1().Ingresses("").List(ctx, metav1.ListOptions{})
		if err != nil {
			return 0, err
		}
		return len(list.Items), nil
	})
	go collect("PersistentVolumes", func() (int, error) {
		list, err := client.CoreV1().PersistentVolumes().List(ctx, metav1.ListOptions{})
		if err != nil {
			return 0, err
		}
		return len(list.Items), nil
	})
	go collect("PersistentVolumeClaims", func() (int, error) {
		list, err := client.CoreV1().PersistentVolumeClaims("").List(ctx, metav1.ListOptions{})
		if err != nil {
			return 0, err
		}
		return len(list.Items), nil
	})
	go collect("ConfigMaps", func() (int, error) {
		list, err := client.CoreV1().ConfigMaps("").List(ctx, metav1.ListOptions{})
		if err != nil {
			return 0, err
		}
		return len(list.Items), nil
	})
	go collect("Secrets", func() (int, error) {
		list, err := client.CoreV1().Secrets("").List(ctx, metav1.ListOptions{})
		if err != nil {
			return 0, err
		}
		return len(list.Items), nil
	})
	go collect("DaemonSets", func() (int, error) {
		list, err := client.AppsV1().DaemonSets("").List(ctx, metav1.ListOptions{})
		if err != nil {
			return 0, err
		}
		return len(list.Items), nil
	})
	go collect("StatefulSets", func() (int, error) {
		list, err := client.AppsV1().StatefulSets("").List(ctx, metav1.ListOptions{})
		if err != nil {
			return 0, err
		}
		return len(list.Items), nil
	})
	go collect("StorageClasses", func() (int, error) {
		list, err := client.StorageV1().StorageClasses().List(ctx, metav1.ListOptions{})
		if err != nil {
			return 0, err
		}
		return len(list.Items), nil
	})
	go collect("Deployments", func() (int, error) {
		list, err := client.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
		if err != nil {
			return 0, err
		}
		return len(list.Items), nil
	})
	wg.Wait()

	return data, errs
}
