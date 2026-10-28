const USER_STORAGE_KEY = 'kuberunner.user';
const TOKEN_STORAGE_KEY = 'kuberunner.token';

export interface CurrentUser {
  name: string;
  access?: string;
  avatar?: string;
}

/** 从 localStorage 读取登录用户 */
export function readStoredUser(): CurrentUser | undefined {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CurrentUser;
    return parsed?.name ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** 登录成功后写入本地用户信息 */
export function saveStoredUser(user: CurrentUser) {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // 忽略存储失败
  }
}

/** 读取登录令牌 */
export function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** 保存登录令牌 */
export function saveToken(token: string) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // 忽略存储失败
  }
}

/** 清理本地会话（用户 + 令牌） */
export function clearSession() {
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // 忽略存储失败
  }
}
