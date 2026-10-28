/**
 * @see https://umijs.org/docs/max/access
 * KubeRunner 目前只有配置文件中的单一管理员账号，登录即可访问全部资源。
 */
export default function access(
  initialState:
    | {
        currentUser?: {
          name?: string;
          access?: string;
          avatar?: string;
          userid?: string;
        };
      }
    | undefined,
) {
  const { currentUser } = initialState ?? {};
  return {
    canAdmin: currentUser?.access === 'admin',
    isLogin: Boolean(currentUser?.name),
  };
}
