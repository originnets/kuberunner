/**
 * 开发环境代理配置：将前端请求转发到本地 KubeRunner 后端。
 * 可通过环境变量 KUBERUNNER_API 覆盖，例如 KUBERUNNER_API=http://192.168.1.10:8080
 */
const target = process.env.KUBERUNNER_API || 'http://127.0.0.1:8080';

const proxy = {
  '/api/': {
    target,
    changeOrigin: true,
  },
  '/login': {
    target,
    changeOrigin: true,
  },
  '/logout': {
    target,
    changeOrigin: true,
  },
  '/healthz': {
    target,
    changeOrigin: true,
  },
  '/ws': {
    target,
    changeOrigin: true,
    ws: true,
  },
};

export default {
  dev: proxy,
  test: proxy,
  pre: proxy,
};
