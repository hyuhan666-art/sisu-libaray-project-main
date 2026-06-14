/* ============================================================
   utils.js — 工具函数（无 DOM 依赖）
   ============================================================ */

const Utils = {

  /* ------ 日期格式化 ------ */
  formatDate(isoStr, fmt = 'YYYY-MM-DD') {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const pad = n => String(n).padStart(2, '0');
    return fmt
      .replace('YYYY', d.getFullYear())
      .replace('MM', pad(d.getMonth() + 1))
      .replace('DD', pad(d.getDate()))
      .replace('HH', pad(d.getHours()))
      .replace('mm', pad(d.getMinutes()))
      .replace('ss', pad(d.getSeconds()));
  },

  /** 距离现在的相对时间描述 */
  relativeTime(isoStr) {
    if (!isoStr) return '';
    const diff = Date.now() - new Date(isoStr).getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return '刚刚';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} 分钟前`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} 小时前`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day} 天前`;
    return Utils.formatDate(isoStr);
  },

  /** 逾期天数 */
  daysOverdue(dueDate) {
    if (!dueDate) return 0;
    const diff = Date.now() - new Date(dueDate).getTime();
    return Math.max(0, Math.floor(diff / 86400000));
  },

  /* ------ 状态映射 ------ */
  copyStatusLabel(s) {
    const map = { available: '可借', borrowed: '已借出', damaged: '破损', lost: '遗失', scrapped: '报废' };
    return map[s] || s;
  },
  copyStatusBadge(s) {
    const map = { available: 'badge-green', borrowed: 'badge-blue', damaged: 'badge-yellow', lost: 'badge-red', scrapped: 'badge-gray' };
    return map[s] || 'badge-gray';
  },
  borrowStatusLabel(s) {
    const map = { borrowing: '借阅中', returned: '已归还', overdue: '逾期', renewed: '已续借' };
    return map[s] || s;
  },
  borrowStatusBadge(s) {
    const map = { borrowing: 'badge-blue', returned: 'badge-green', overdue: 'badge-red', renewed: 'badge-yellow' };
    return map[s] || 'badge-gray';
  },
  cardStatusLabel(s) {
    const map = { active: '正常', expired: '已过期', suspended: '已暂停' };
    return map[s] || s;
  },
  cardStatusBadge(s) {
    const map = { active: 'badge-green', expired: 'badge-red', suspended: 'badge-yellow' };
    return map[s] || 'badge-gray';
  },
  resvStatusLabel(s) {
    const map = { pending: '待处理', active: '已生效', expired: '已过期', cancelled: '已取消' };
    return map[s] || s;
  },
  resvStatusBadge(s) {
    const map = { pending: 'badge-yellow', active: 'badge-green', expired: 'badge-gray', cancelled: 'badge-red' };
    return map[s] || 'badge-gray';
  },
  roleLabel(r) {
    const map = { reader: '读者', librarian: '馆员', admin: '管理员' };
    return map[r] || r;
  },

  /* ------ HTML 转义 ------ */
  escape(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },

  /* ------ 分页器 ------ */
  renderPagination(page, pages, onPage) {
    if (pages <= 1) return '';
    let html = '';
    html += `<button ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">‹ 上一页</button>`;
    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || Math.abs(i - page) <= 2) {
        html += `<button class="${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
      } else if (i === 2 && page > 4) {
        html += '<button disabled>…</button>';
      } else if (i === pages - 1 && page < pages - 3) {
        html += '<button disabled>…</button>';
      }
    }
    html += `<button ${page >= pages ? 'disabled' : ''} data-page="${page + 1}">下一页 ›</button>`;
    html += `<span class="page-info">共 ${pages} 页</span>`;
    return html;
  },

  /* ------ 简易模态框 ------ */
  showModal(title, bodyHtml, onConfirm, confirmText = '确定') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3>${title}</h3>
        <div>${bodyHtml}</div>
        <div class="modal-actions">
          <button class="btn btn-outline cancel-btn">取消</button>
          <button class="btn btn-primary confirm-btn">${confirmText}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.cancel-btn').onclick = () => overlay.remove();
    overlay.querySelector('.confirm-btn').onclick = () => {
      if (onConfirm) onConfirm();
      overlay.remove();
    };
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    return overlay;
  },

  /* ------ Toast ------ */
  showToast(message, type = 'info', duration = 3000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); if (!container.children.length) container.remove(); }, duration);
  },

  /* ------ 取值安全 ------ */
  getVal(obj, path, def = '') {
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, obj) ?? def;
  }
};

// 暴露到全局
window.Utils = Utils;
