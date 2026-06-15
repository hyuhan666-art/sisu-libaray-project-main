/* ============================================================
   api.js — HTTP 封装层
   所有请求走这里：自动带 JWT、拦截 401、统一错误处理
   ============================================================ */

const API_BASE = window.SISU_API_BASE || `${window.location.origin}/api`;

const Api = {

  /** 核心请求方法 */
  async request(method, path, body = null, isForm = false) {
    const url = API_BASE + path;
    const headers = {};
    const token = Auth.getToken();
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    if (!isForm) {
      headers['Content-Type'] = 'application/json';
    }

    const opts = { method, headers };
    if (body && !isForm) {
      opts.body = JSON.stringify(body);
    } else if (body && isForm) {
      opts.body = body;
    }

    let res;
    try {
      res = await fetch(url, opts);
    } catch (e) {
      Utils.showToast('网络错误，请检查后端是否启动', 'error');
      throw e;
    }

    // 401 → token 失效，清掉并跳登录
    if (res.status === 401) {
      Auth.logout();
      Utils.showToast('登录已过期，请重新登录', 'warning');
      App.navigateTo('/login');
      throw new Error('Unauthorized');
    }

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = json.message || json.error || `请求失败 (${res.status})`;
      Utils.showToast(msg, 'error');
      const err = new Error(msg);
      err.status = res.status;
      err.data = json;
      throw err;
    }

    return json;
  },

  get(path, params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const q = qs.toString();
    return this.request('GET', path + (q ? '?' + q : ''));
  },

  post(path, data) {
    return this.request('POST', path, data);
  },

  put(path, data) {
    return this.request('PUT', path, data);
  },

  del(path) {
    return this.request('DELETE', path);
  }
};

window.Api = Api;
