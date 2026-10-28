import { expect, test } from '@playwright/test';

test.describe('Login Page', () => {
  test('should show login form', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/user/login');

    await expect(page.getByText('KubeRunner').first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText('Kubernetes 多集群管理平台')).toBeVisible();
    await expect(page.getByPlaceholder('用户名（默认 admin）')).toBeVisible();
    await expect(page.getByPlaceholder('密码（默认 admin）')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/user/login');
    await page.getByRole('button', { name: /登\s*录/ }).click();

    await expect(page.getByText('请输入用户名')).toBeVisible();
    await expect(page.getByText('请输入密码')).toBeVisible();
  });
});
