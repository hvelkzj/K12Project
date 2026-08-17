import type {
  CurrentUserResponse,
  LoginResponse,
  UserSummary,
} from '@k12/shared'

// 1. 读取统一的 API 地址，如果环境变量没配置，则使用默认的本地地址
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000';
// 2. 严格遵循任务要求的 Token 键名
const TOKEN_KEY = 'k12AccessToken';

/**
 * 封装一个带有鉴权头和 401 拦截机制的 fetch 函数
 */
async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  // 每次请求前，去 sessionStorage 里拿 Token
  const token = sessionStorage.getItem(TOKEN_KEY);

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  // 3. 核心拦截：收到 401 未授权时，必须立刻清除本地 Token
  if (response.status === 401) {
    sessionStorage.removeItem(TOKEN_KEY);
    // 这里抛出错误，以便组件能捕获并跳转回登录页
    throw new Error('认证已过期，请重新登录');
  }

  return response;
}

/**
 * 导出的真实认证 API 服务
 */
export const authService = {
  // 登录接口：POST /auth/login
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await fetchWithAuth('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) throw new Error('登录失败，请检查账号和密码');
    return (await res.json()) as LoginResponse
  },

  // 获取当前用户接口：GET /auth/me
  async getMe(): Promise<UserSummary> {
    const res = await fetchWithAuth('/auth/me');
    if (!res.ok) throw new Error('获取用户信息失败');
    const payload = (await res.json()) as CurrentUserResponse
    return payload.user
  },

  // 退出登录接口：POST /auth/logout
  async logout(): Promise<void> {
    try {
      await fetchWithAuth('/auth/logout', { method: 'POST' });
    } finally {
      // 4. 主动退出时必须清除本地 Token
      sessionStorage.removeItem(TOKEN_KEY);
    }
  }
};
