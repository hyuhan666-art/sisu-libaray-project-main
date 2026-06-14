/* ============================================================
   auth.js — 认证状态管理
   登录 / 注册 / 登出 / Token 存取 / 用户信息
   ============================================================ */

const Auth = {

  /** 存储 token 和用户信息到 localStorage */
  saveSession(data) {
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('user', JSON.stringify(data.user));
  },

  /** 清除登录状态 */
  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  },

  /** 获取 access_token */
  getToken() {
    return localStorage.getItem('access_token');
  },

  /** 获取 refresh_token */
  getRefreshToken() {
    return localStorage.getItem('refresh_token');
  },

  /** 获取当前用户对象 */
  getUser() {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    } catch { return null; }
  },

  /** 是否已登录 */
  isLoggedIn() {
    return !!this.getToken();
  },

  /** 角色 */
  getRole() {
    const u = this.getUser();
    return u ? u.role : null;
  },

  /** 登录 */
  async login(username, password) {
    const res = await Api.post('/auth/login', { username, password });
    this.saveSession(res.data);
    return res.data.user;
  },

  /** 注册 */
  async register(data) {
    const res = await Api.post('/auth/register', data);
    return res.data;
  },

  /** 刷新 token（用 refresh_token） */
  async refreshToken() {
    const refresh = this.getRefreshToken();
    if (!refresh) return false;
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + refresh
      };
      const res = await fetch(API_BASE + '/auth/refresh', { method: 'POST', headers });
      if (!res.ok) { this.logout(); return false; }
      const json = await res.json();
      localStorage.setItem('access_token', json.data.access_token);
      return true;
    } catch {
      this.logout();
      return false;
    }
  },

  /** 获取当前用户完整信息（含 reader_card） */
  async fetchMe() {
    const res = await Api.get('/auth/me');
    localStorage.setItem('user', JSON.stringify(res.data));
    return res.data;
  }
};

window.Auth = Auth;
