package type_apply

import (
	"context"
	"strings"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

const deploymentYAML = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo
  namespace: shop
  resourceVersion: "12345"
  uid: 0e8b1f7a-0f6a-4f4b-9d3a-1234567890ab
spec:
  replicas: 2
  selector:
    matchLabels:
      app: demo
  template:
    metadata:
      labels:
        app: demo
    spec:
      containers:
        - name: demo
          image: nginx:1.25
          ports:
            - containerPort: 80
          env:
            - name: MODE
              value: production
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
`

func TestApplyDeployment(t *testing.T) {
	client := fake.NewSimpleClientset()
	ctx := context.Background()

	message, err := Apply.Apply(ctx, client, deploymentYAML)
	if err != nil {
		t.Fatalf("apply deployment failed: %v", err)
	}
	if !strings.Contains(message, "Deployment/demo") {
		t.Fatalf("unexpected message: %s", message)
	}

	got, err := client.AppsV1().Deployments("shop").Get(ctx, "demo", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("deployment not created: %v", err)
	}
	if got.Spec.Replicas == nil || *got.Spec.Replicas != 2 {
		t.Fatalf("replicas not preserved")
	}
	container := got.Spec.Template.Spec.Containers[0]
	if len(container.Env) != 1 || container.Env[0].Name != "MODE" {
		t.Fatalf("env not preserved: %+v", container.Env)
	}
	if container.Resources.Limits.Cpu().String() != "500m" {
		t.Fatalf("resources not preserved: %+v", container.Resources)
	}
	// 集群专属字段应被清理
	if got.ResourceVersion != "" || got.UID != "" {
		t.Fatalf("metadata not sanitized: rv=%q uid=%q", got.ResourceVersion, got.UID)
	}
}

func TestApplyConfigMapWithoutNamespace(t *testing.T) {
	client := fake.NewSimpleClientset()
	ctx := context.Background()

	manifest := `
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  app.conf: |
    server.port=8080
`
	if _, err := Apply.Apply(ctx, client, manifest); err != nil {
		t.Fatalf("apply configmap failed: %v", err)
	}

	got, err := client.CoreV1().ConfigMaps("default").Get(ctx, "app-config", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("configmap not created in default namespace: %v", err)
	}
	if !strings.Contains(got.Data["app.conf"], "server.port=8080") {
		t.Fatalf("data not preserved: %v", got.Data)
	}
}

func TestApplyServiceJSON(t *testing.T) {
	client := fake.NewSimpleClientset()
	ctx := context.Background()

	manifest := `{"apiVersion":"v1","kind":"Service","metadata":{"name":"demo-svc","namespace":"shop"},"spec":{"type":"NodePort","selector":{"app":"demo"},"ports":[{"name":"http","port":80,"targetPort":8080,"nodePort":30080}]}}`
	if _, err := Apply.Apply(ctx, client, manifest); err != nil {
		t.Fatalf("apply service failed: %v", err)
	}

	svc, err := client.CoreV1().Services("shop").Get(ctx, "demo-svc", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("service not created: %v", err)
	}
	if svc.Spec.Ports[0].NodePort != 30080 {
		t.Fatalf("nodePort not preserved: %+v", svc.Spec.Ports)
	}
}

func TestApplyRejectsUnknownKind(t *testing.T) {
	client := fake.NewSimpleClientset()
	manifest := `
apiVersion: example.com/v1
kind: SomethingElse
metadata:
  name: nope
`
	if _, err := Apply.Apply(context.Background(), client, manifest); err == nil {
		t.Fatal("expected error for unsupported kind")
	}
}

func TestApplyRejectsInvalidYAML(t *testing.T) {
	client := fake.NewSimpleClientset()
	if _, err := Apply.Apply(context.Background(), client, "metadata: [unclosed"); err == nil {
		t.Fatal("expected error for invalid yaml")
	}
}

func TestApplyReportsAlreadyExists(t *testing.T) {
	client := fake.NewSimpleClientset()
	ctx := context.Background()

	manifest := `
apiVersion: v1
kind: Namespace
metadata:
  name: qa
`
	if _, err := Apply.Apply(ctx, client, manifest); err != nil {
		t.Fatalf("first apply failed: %v", err)
	}
	_, err := Apply.Apply(ctx, client, manifest)
	if err == nil || !strings.Contains(err.Error(), "已存在") {
		t.Fatalf("expected already exists error, got %v", err)
	}
}
