/* ============================================================
   app.js — SPA 路由 + 全部页面渲染
   ============================================================ */

const App = {

  /* ====== 路由表 ====== */
  routes: {},

  /* ====== 当前页面状态 ====== */
  currentPage: null,
  currentParams: {},

  /* ====== 初始化 ====== */
  init() {
    this.registerRoutes();
    window.addEventListener('hashchange', () => this.route());
    this.route();
  },

  registerRoutes() {
    // 公共
    this.routes['/login'] = { render: 'renderLogin', public: true };
    this.routes['/register'] = { render: 'renderRegister', public: true };
    this.routes['/books'] = { render: 'renderBookList', public: true };
    this.routes['/books/'] = { render: 'renderBookDetail', public: true }; // /books/:id

    // 读者
    this.routes['/reader/dashboard'] = { render: 'renderReaderDashboard', role: 'reader' };
    this.routes['/reader/borrows'] = { render: 'renderReaderBorrows', role: 'reader' };
    this.routes['/reader/reservations'] = { render: 'renderReaderReservations', role: 'reader' };
    // 个人中心（所有角色）
    this.routes['/profile'] = { render: 'renderProfile', auth: true };

    // 管理员/馆员
    this.routes['/admin/dashboard'] = { render: 'renderAdminDashboard', role: 'librarian,admin' };
    this.routes['/admin/borrow'] = { render: 'renderBorrowPage', role: 'librarian,admin' };
    this.routes['/admin/return'] = { render: 'renderReturnPage', role: 'librarian,admin' };
    this.routes['/admin/records'] = { render: 'renderRecordsPage', role: 'librarian,admin' };
    this.routes['/admin/books'] = { render: 'renderBookManage', role: 'librarian,admin' };
    this.routes['/admin/readers'] = { render: 'renderReaderManage', role: 'librarian,admin' };
    this.routes['/admin/stats'] = { render: 'renderStatsPage', role: 'librarian,admin' };
  },

  /* ====== 路由分发 ====== */
  route() {
    const hash = location.hash.slice(1) || '/login';
    // 匹配 /books/:id
    let route = this.routes[hash];
    let params = {};
    if (!route) {
      const m = hash.match(/^\/books\/(\d+)$/);
      if (m) {
        route = this.routes['/books/'];
        params = { id: m[1] };
      }
    }
    if (!route) {
      this.navigateTo('/login');
      return;
    }

    // 权限检查
    if (route.role) {
      if (!Auth.isLoggedIn()) { this.navigateTo('/login'); return; }
      const roles = route.role.split(',');
      if (!roles.includes(Auth.getRole())) {
        Utils.showToast('权限不足', 'error');
        this.goHome();
        return;
      }
    }
    if (route.auth && !Auth.isLoggedIn()) {
      this.navigateTo('/login');
      return;
    }

    this.currentPage = route.render;
    this.currentParams = params;
    this.renderLayout(route);
    this[route.render](params);
  },

  navigateTo(path) {
    location.hash = '#' + path;
  },

  goHome() {
    const role = Auth.getRole();
    if (!role) { this.navigateTo('/login'); return; }
    this.navigateTo(role === 'reader' ? '/reader/dashboard' : '/admin/dashboard');
  },

  /* ====== 布局渲染 ====== */
  renderLayout(route) {
    const app = document.getElementById('app');
    const isAuthPage = route.public && (this.currentPage === 'renderLogin' || this.currentPage === 'renderRegister');

    let html = '';

    if (isAuthPage) {
      // 纯居中页面，无导航
      html += '<div id="page-content" class="auth-page"></div>';
    } else if (!Auth.isLoggedIn() || Auth.getRole() === 'reader') {
      // 读者端：顶部导航栏
      html += this._renderNavbar();
      html += '<div id="page-content" class="main-content"></div>';
    } else {
      // 管理端：侧边栏 + 主内容区
      html += this._renderSidebar();
      html += '<div id="page-content" class="main-content with-sidebar"></div>';
    }

    app.innerHTML = html;

    // 绑定导航事件
    this._bindNavEvents();
  },

  _renderNavbar() {
    const role = Auth.getRole();
    const user = Auth.getUser();
    let links = '';
    if (role === 'reader') {
      links += `<a href="#/reader/dashboard" class="nav-dashboard">📊 首页</a>`;
      links += `<a href="#/books" class="nav-books">📚 图书检索</a>`;
      links += `<a href="#/reader/borrows" class="nav-borrows">📋 我的借阅</a>`;
      links += `<a href="#/reader/reservations" class="nav-reservations">📌 我的预约</a>`;
    } else if (role === 'librarian' || role === 'admin') {
      links += `<a href="#/admin/dashboard" class="nav-admin">⚙️ 管理后台</a>`;
      links += `<a href="#/books" class="nav-books">📚 图书检索</a>`;
    } else {
      links += `<a href="#/books">📚 图书检索</a>`;
    }

    return `
      <nav class="navbar">
        <a href="#/books" class="navbar-brand">📖 SISU 图书管理系统</a>
        <div class="navbar-nav">${links}</div>
        <div class="nav-user">
          ${Auth.isLoggedIn() ? `
            <span>👤 ${Utils.escape(user?.username || '')}</span>
            <span class="role-badge">${Utils.roleLabel(role || '')}</span>
            <a href="#/profile">🔧</a>
            <a href="#" class="logout-btn" style="color:var(--gray-500)">退出</a>
          ` : `<a href="#/login">登录</a>`}
        </div>
      </nav>`;
  },

  _icon(name) {
    const icons = {
      logo: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5 40 11v12c0 10-6.6 16.5-16 20-9.4-3.5-16-10-16-20V11L24 5Z"/><path d="M17 18c3.2 0 5.4 1 7 3 1.6-2 3.8-3 7-3v12c-3.2 0-5.4 1-7 3-1.6-2-3.8-3-7-3V18Z"/><path d="M24 21v12"/></svg>',
      home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
      borrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h10a3 3 0 0 1 3 3v11H7a2 2 0 0 1-2-2V5Z"/><path d="M9 9h6"/><path d="M9 13h4"/><path d="m18 8 3 3-3 3"/></svg>',
      return: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 19H9a3 3 0 0 1-3-3V5h11a2 2 0 0 1 2 2v12Z"/><path d="M15 11H7"/><path d="m10 8-3 3 3 3"/></svg>',
      records: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18H6z"/><path d="M9 7h6"/><path d="M9 11h6"/><path d="M9 15h4"/></svg>',
      books: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h6v14H4z"/><path d="M10 5h4v14h-4z"/><path d="m15 6 4-1 3 13-4 1-3-13Z"/></svg>',
      readers: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M17 11a3 3 0 1 0 0-6"/><path d="M18 15a6 6 0 0 1 4 6"/></svg>',
      stats: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>',
      search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>',
      user: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
      settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m4 15-1-3 1-3 3-.5 2-2.5L12 5l3-1 2 2.5 3 .5 1 3-1 3-3 .5-2 2.5-3-1-3 1-2-2.5-3-.5Z"/></svg>',
      bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg>',
      help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.7 2c-1 .7-1.5 1.2-1.5 2.4"/><path d="M12 17h.01"/></svg>',
      refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18 11a6 6 0 0 0-10-4l-4 4"/><path d="M6 13a6 6 0 0 0 10 4l4-4"/></svg>',
      calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v4"/><path d="M17 3v4"/><path d="M4 8h16"/><path d="M5 5h14v16H5z"/></svg>',
      chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
      stack: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4"/><path d="m4 17 8 4 8-4"/></svg>',
      openbook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5c3.5 0 6 .8 8 3v12c-2-2.2-4.5-3-8-3V5Z"/><path d="M20 5c-3.5 0-6 .8-8 3v12c2-2.2 4.5-3 8-3V5Z"/></svg>',
      group: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M2 21a6 6 0 0 1 12 0"/><path d="M17 12a3 3 0 1 0 0-6"/><path d="M17 15a5 5 0 0 1 5 5"/></svg>',
      clipboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6l1 3H8l1-3Z"/><path d="M6 6h12v15H6z"/><path d="m9 14 2 2 4-5"/></svg>',
      clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
      alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5"/><path d="M12 18h.01"/></svg>',
      plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>'
    };
    return icons[name] || icons.books;
  },

  _todayText() {
    const now = new Date();
    const weeks = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${Utils.formatDate(now.toISOString(), 'YYYY-MM-DD')} ${weeks[now.getDay()]}`;
  },

  _bookThumb(title = '', coverUrl = '') {
    if (coverUrl) {
      return `<span class="book-thumb"><img src="${Utils.escape(coverUrl)}" alt="${Utils.escape(title || '图书封面')}" onerror="this.parentElement.innerHTML='<span>${Utils.escape((title || '书').slice(0, 1))}</span>'"></span>`;
    }
    const initial = Utils.escape((title || '书').slice(0, 1));
    return `<span class="book-thumb"><span>${initial}</span></span>`;
  },

  _readerAvatar(name = '', index = 0) {
    const initial = Utils.escape((name || '读').slice(0, 1));
    return `<span class="reader-avatar reader-avatar-${index % 5}">${initial}</span>`;
  },

  _normalizeTrend(raw = [], days = 30) {
    const map = new Map(raw.map(item => [String(item.date).slice(0, 10), item.count || 0]));
    const result = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = Utils.formatDate(d.toISOString(), 'YYYY-MM-DD');
      result.push({ date: key, count: map.get(key) || 0 });
    }
    return result;
  },

  _renderTrendSvg(raw = [], days = 30) {
    const data = this._normalizeTrend(raw, days);
    const width = 720;
    const height = 250;
    const padX = 34;
    const padY = 24;
    const baseY = height - 34;
    const max = Math.max(...data.map(d => d.count || 0), 1);
    const points = data.map((d, i) => {
      const x = padX + (i * (width - padX * 2)) / Math.max(data.length - 1, 1);
      const y = baseY - ((d.count || 0) / max) * (height - padY - 58);
      return { ...d, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    });
    const line = points.map(p => `${p.x},${p.y}`).join(' ');
    const area = `${points[0].x},${baseY} ${line} ${points[points.length - 1].x},${baseY}`;
    const labelIndexes = [0, 6, 12, 18, 24, 29].filter(i => i < points.length);
    return `
      <div class="trend-chart">
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="近 ${days} 天借阅趋势">
          <defs>
            <linearGradient id="trendArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#168f7c" stop-opacity=".26"/>
              <stop offset="100%" stop-color="#168f7c" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <g class="trend-grid">
            <line x1="${padX}" y1="48" x2="${width - padX}" y2="48"/>
            <line x1="${padX}" y1="92" x2="${width - padX}" y2="92"/>
            <line x1="${padX}" y1="136" x2="${width - padX}" y2="136"/>
            <line x1="${padX}" y1="180" x2="${width - padX}" y2="180"/>
            <line x1="${padX}" y1="${baseY}" x2="${width - padX}" y2="${baseY}"/>
          </g>
          <polygon class="trend-area" points="${area}"/>
          <polyline class="trend-stroke" points="${line}"/>
          ${points.map(p => `<circle class="trend-dot" cx="${p.x}" cy="${p.y}" r="3"><title>${p.date}: ${p.count}</title></circle>`).join('')}
          ${labelIndexes.map(i => `<text class="trend-label" x="${points[i].x}" y="240">${points[i].date.slice(5)}</text>`).join('')}
        </svg>
      </div>`;
  },

  _renderSidebar() {
    const role = Auth.getRole();
    return `
      <aside class="sidebar">
        <div class="sidebar-brand"><span class="brand-mark">${this._icon('logo')}</span><span>SISU 图书管理系统</span></div>
        <nav class="sidebar-nav">
          <a href="#/admin/dashboard"><span class="nav-icon">${this._icon('home')}</span><span>管理首页</span><span class="nav-caret">${this._icon('chevron')}</span></a>
          <a href="#/admin/borrow"><span class="nav-icon">${this._icon('borrow')}</span><span>借书办理</span><span class="nav-caret">${this._icon('chevron')}</span></a>
          <a href="#/admin/return"><span class="nav-icon">${this._icon('return')}</span><span>还书办理</span><span class="nav-caret">${this._icon('chevron')}</span></a>
          <a href="#/admin/records"><span class="nav-icon">${this._icon('records')}</span><span>借阅记录</span><span class="nav-caret">${this._icon('chevron')}</span></a>
          <div class="nav-section">管理</div>
          <a href="#/admin/books"><span class="nav-icon">${this._icon('books')}</span><span>图书管理</span><span class="nav-caret">${this._icon('chevron')}</span></a>
          <a href="#/admin/readers"><span class="nav-icon">${this._icon('readers')}</span><span>读者管理</span><span class="nav-caret">${this._icon('chevron')}</span></a>
          <a href="#/admin/stats"><span class="nav-icon">${this._icon('stats')}</span><span>统计分析</span><span class="nav-caret">${this._icon('chevron')}</span></a>
          <div class="nav-section">其他</div>
          <a href="#/books"><span class="nav-icon">${this._icon('search')}</span><span>图书检索</span><span class="nav-caret">${this._icon('chevron')}</span></a>
          <a href="#/profile"><span class="nav-icon">${this._icon('settings')}</span><span>系统设置</span><span class="nav-caret">${this._icon('chevron')}</span></a>
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-clock-label">系统时间</div>
          <div class="sidebar-clock" data-clock-time>--:--:--</div>
          <div class="sidebar-date" data-clock-date>${this._todayText()}</div>
          <a href="#" class="logout-btn sidebar-logout">${Utils.roleLabel(role || '')} · 退出登录</a>
          <div class="sidebar-version">© SISU Library v1.0.0</div>
        </div>
      </aside>`;
  },

  _bindNavEvents() {
    // 退出按钮
    document.querySelectorAll('.logout-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        Auth.logout();
        this.navigateTo('/login');
      });
    });
    // 高亮当前导航
    const hash = location.hash.slice(1) || '/login';
    document.querySelectorAll('.sidebar-nav a, .navbar-nav a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === '#' + hash) a.classList.add('active');
    });
    this._startSidebarClock();
  },

  _startSidebarClock() {
    const timeEl = document.querySelector('[data-clock-time]');
    const dateEl = document.querySelector('[data-clock-date]');
    if (!timeEl || !dateEl) return;
    if (this._sidebarClockTimer) clearInterval(this._sidebarClockTimer);
    const update = () => {
      const now = new Date();
      timeEl.textContent = Utils.formatDate(now.toISOString(), 'HH:mm:ss');
      dateEl.textContent = this._todayText();
    };
    update();
    this._sidebarClockTimer = setInterval(update, 1000);
  },

  /* ====== 页面容器 ====== */
  $page() { return document.getElementById('page-content'); },

  /* ================================================================
     1. 登录页
     ================================================================ */
  renderLogin() {
    const $p = this.$page();
    $p.innerHTML = `
      <div class="auth-card">
        <h1>📖 SISU 图书管理系统</h1>
        <p class="subtitle">登录以继续</p>
        <form id="login-form">
          <div class="form-group">
            <label>用户名</label>
            <input class="form-control" name="username" placeholder="请输入用户名" required autofocus>
          </div>
          <div class="form-group">
            <label>密码</label>
            <input class="form-control" name="password" type="password" placeholder="请输入密码" required>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary btn-block">登 录</button>
          </div>
        </form>
        <div class="form-footer">
          还没有账号？<a href="#/register">立即注册</a>
        </div>
      </div>`;
    document.getElementById('login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true; btn.textContent = '登录中…';
      try {
        const username = e.target.username.value.trim();
        const password = e.target.password.value;
        if (!username || !password) { Utils.showToast('请填写用户名和密码', 'warning'); btn.disabled = false; btn.textContent = '登 录'; return; }
        const user = await Auth.login(username, password);
        Utils.showToast(`欢迎回来，${user.username}！`, 'success');
        this.goHome();
      } catch (err) {
        btn.disabled = false; btn.textContent = '登 录';
      }
    });
  },

  /* ================================================================
     2. 注册页
     ================================================================ */
  renderRegister() {
    const $p = this.$page();
    $p.innerHTML = `
      <div class="auth-card">
        <h1>📝 创建账号</h1>
        <p class="subtitle">注册后自动开通借阅证</p>
        <form id="register-form">
          <div class="form-group"><label>用户名 *</label><input class="form-control" name="username" required></div>
          <div class="form-group"><label>邮箱 *</label><input class="form-control" name="email" type="email" required></div>
          <div class="form-group"><label>密码 *</label><input class="form-control" name="password" type="password" required></div>
          <div class="form-row">
            <div class="form-group"><label>真实姓名</label><input class="form-control" name="real_name"></div>
            <div class="form-group"><label>手机号</label><input class="form-control" name="phone"></div>
          </div>
          <div class="form-actions"><button type="submit" class="btn btn-primary btn-block">注 册</button></div>
        </form>
        <div class="form-footer">已有账号？<a href="#/login">去登录</a></div>
      </div>`;
    document.getElementById('register-form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true; btn.textContent = '注册中…';
      const f = e.target;
      const data = {
        username: f.username.value.trim(),
        email: f.email.value.trim(),
        password: f.password.value,
        real_name: f.real_name.value.trim(),
        phone: f.phone.value.trim()
      };
      if (!data.username || !data.email || !data.password) {
        Utils.showToast('用户名、邮箱、密码为必填', 'warning');
        btn.disabled = false; btn.textContent = '注 册';
        return;
      }
      try {
        await Auth.register(data);
        Utils.showToast('注册成功！请登录', 'success');
        this.navigateTo('/login');
      } catch (err) {
        btn.disabled = false; btn.textContent = '注 册';
      }
    });
  },

  /* ================================================================
     3. 图书检索（公开）
     ================================================================ */
  async renderBookList() {
    const $p = this.$page();
    $p.innerHTML = `
      <div class="page page-wide">
        <h1 class="page-title">📚 图书检索</h1>
        <div class="search-bar">
          <div class="form-group" style="flex:2;min-width:200px">
            <label>关键词</label>
            <input class="form-control" id="search-keyword" placeholder="书名 / 作者">
          </div>
          <div class="form-group" style="flex:1;min-width:140px">
            <label>分类</label>
            <select class="form-control" id="search-category"><option value="">全部分类</option></select>
          </div>
          <div class="form-check" style="margin-bottom:0;align-self:center">
            <input type="checkbox" id="search-available">
            <label for="search-available">仅看可借</label>
          </div>
          <button class="btn btn-primary" id="search-btn">🔍 搜索</button>
        </div>
        <div id="book-list-content"></div>
      </div>`;
    // 加载分类
    try {
      const res = await Api.get('/books/categories');
      const cats = res.data || [];
      const sel = document.getElementById('search-category');
      function addOpts(list, prefix = '') {
        list.forEach(c => {
          sel.innerHTML += `<option value="${c.id}">${prefix}${Utils.escape(c.name)}</option>`;
          if (c.children) addOpts(c.children, prefix + '— ');
        });
      }
      addOpts(cats);
    } catch (e) { /* ignore */ }
    const presetKeyword = sessionStorage.getItem('sisuBookKeyword') || '';
    if (presetKeyword) {
      document.getElementById('search-keyword').value = presetKeyword;
      sessionStorage.removeItem('sisuBookKeyword');
    }
    // 搜索
    const doSearch = async () => {
      const params = {
        keyword: document.getElementById('search-keyword').value.trim(),
        category_id: document.getElementById('search-category').value || undefined,
        available_only: document.getElementById('search-available').checked
      };
      this._loadBookList(params, 1);
    };
    document.getElementById('search-btn').addEventListener('click', doSearch);
    document.getElementById('search-keyword').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    // 首屏加载
    doSearch();
  },

  async _loadBookList(params, page) {
    const container = document.getElementById('book-list-content');
    if (!container) return;
    container.innerHTML = '<div class="loading-center"><div class="spinner spinner-lg"></div></div>';
    try {
      params.page = page;
      const res = await Api.get('/books', params);
      const data = res.data;
      if (!data.items.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>没有找到匹配的图书</p></div>';
        return;
      }
      let html = '<div class="book-grid">';
      data.items.forEach(b => {
        const coverHtml = b.cover_url
          ? `<img src="${Utils.escape(b.cover_url)}" alt="封面" onerror="this.parentElement.innerHTML='📖'">`
          : '📖';
        html += `
          <div class="book-card" data-book="${b.id}">
            <div class="cover">${coverHtml}</div>
            <div class="info">
              <div class="title">${Utils.escape(b.title)}</div>
              <div class="author">${Utils.escape(b.author)}</div>
              <div class="meta">
                <span>📚 ${b.available_copies}/${b.total_copies}</span>
                <span>${Utils.escape(b.category_name || '')}</span>
              </div>
            </div>
          </div>`;
      });
      html += '</div>';
      html += Utils.renderPagination(data.page, data.pages, p => this._loadBookList(params, p));
      container.innerHTML = html;
      // 绑定点击
      container.querySelectorAll('.book-card').forEach(card => {
        card.addEventListener('click', () => this.navigateTo(`/books/${card.dataset.book}`));
      });
      // 绑定分页
      container.querySelectorAll('.pagination button').forEach(btn => {
        btn.addEventListener('click', () => {
          const p = parseInt(btn.dataset.page);
          if (p) this._loadBookList(params, p);
        });
      });
    } catch (e) {
      container.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>加载失败，请确认后端已启动</p></div>';
    }
  },

  /* ================================================================
     4. 图书详情 + 副本 + 预约
     ================================================================ */
  async renderBookDetail(params) {
    const $p = this.$page();
    const isReader = Auth.getRole() === 'reader';
    $p.innerHTML = '<div class="page"><div class="loading-center"><div class="spinner spinner-lg"></div></div></div>';
    try {
      const res = await Api.get('/books/' + params.id);
      const b = res.data;
      let copiesHtml = '';
      if (b.copies) {
        copiesHtml = b.copies.map(c => `
          <tr>
            <td>${Utils.escape(c.barcode)}</td>
            <td><span class="badge ${Utils.copyStatusBadge(c.status)}">${Utils.copyStatusLabel(c.status)}</span></td>
            <td>${Utils.escape(c.location || '-')}</td>
            <td>${Utils.formatDate(c.purchase_date)}</td>
          </tr>`).join('');
      }

      $p.innerHTML = `
        <div class="page">
          <a href="#/books" style="font-size:0.9rem">← 返回检索</a>
          <div class="detail-layout mt-2">
            <div class="detail-cover">${b.cover_url ? `<img src="${Utils.escape(b.cover_url)}" alt="封面" onerror="this.parentElement.innerHTML='📖'">` : '📖'}</div>
            <div class="card card-body detail-info">
              <h2 style="margin-bottom:4px">${Utils.escape(b.title)}</h2>
              <p style="color:var(--gray-600);margin-bottom:16px">${Utils.escape(b.author)}</p>
              <dl>
                <dt>ISBN</dt><dd>${Utils.escape(b.isbn)}</dd>
                <dt>出版社</dt><dd>${Utils.escape(b.publisher || '-')}</dd>
                <dt>出版日期</dt><dd>${Utils.formatDate(b.publish_date)}</dd>
                <dt>语言</dt><dd>${Utils.escape(b.language)}</dd>
                <dt>分类</dt><dd>${Utils.escape(b.category_name || '-')}</dd>
                <dt>价格</dt><dd>${b.price ? '¥' + b.price : '-'}</dd>
                <dt>库存</dt><dd>可借 <strong>${b.available_copies}</strong> / 共 ${b.total_copies}</dd>
              </dl>
              ${b.description ? `<p class="mt-2" style="color:var(--gray-600)">${Utils.escape(b.description)}</p>` : ''}
              ${isReader ? `<button class="btn btn-primary mt-3" id="reserve-btn">📌 预约该书</button>` : ''}
            </div>
          </div>
          ${copiesHtml ? `
          <div class="card mt-3">
            <div class="card-header">📋 副本列表</div>
            <div class="table-wrap"><table><thead><tr><th>条形码</th><th>状态</th><th>位置</th><th>入库日期</th></tr></thead><tbody>${copiesHtml}</tbody></table></div>
          </div>` : ''}
        </div>`;

      // 预约按钮
      const reserveBtn = document.getElementById('reserve-btn');
      if (reserveBtn) {
        reserveBtn.addEventListener('click', async () => {
          try {
            await Api.post(`/books/${params.id}/reserve`);
            Utils.showToast('预约成功！', 'success');
            reserveBtn.disabled = true;
            reserveBtn.textContent = '已预约';
          } catch (e) { /* toast already shown */ }
        });
      }
    } catch (e) {
      $p.innerHTML = '<div class="page"><div class="empty-state"><div class="icon">⚠️</div><p>图书不存在或加载失败</p></div></div>';
    }
  },

  /* ================================================================
     5. 读者首页
     ================================================================ */
  async renderReaderDashboard() {
    const $p = this.$page();
    $p.innerHTML = '<div class="page"><div class="loading-center"><div class="spinner spinner-lg"></div></div></div>';
    try {
      const me = await Auth.fetchMe();
      const card = me.reader_card;
      $p.innerHTML = `
        <div class="page">
          <h1 class="page-title">👋 欢迎，${Utils.escape(me.real_name || me.username)}</h1>
          <div class="stat-grid">
            <div class="stat-card accent-blue">
              <span class="stat-icon">📇</span>
              <span class="stat-label">借阅证号</span>
              <span class="stat-value" style="font-size:1.2rem">${Utils.escape(card?.card_number || '-')}</span>
            </div>
            <div class="stat-card accent-green">
              <span class="stat-icon">📗</span>
              <span class="stat-label">当前在借</span>
              <span class="stat-value">${card?.current_borrow_count || 0}</span>
            </div>
            <div class="stat-card accent-yellow">
              <span class="stat-icon">📅</span>
              <span class="stat-label">借阅上限</span>
              <span class="stat-value">${card?.max_borrow_limit || 5}</span>
            </div>
            <div class="stat-card ${card?.status === 'active' ? 'accent-green' : 'accent-red'}">
              <span class="stat-icon">🪪</span>
              <span class="stat-label">借阅证状态</span>
              <span class="stat-value" style="font-size:1rem">${Utils.cardStatusLabel(card?.status)}</span>
            </div>
          </div>
          ${card?.expire_date ? `<p class="text-muted">借阅证有效期至：${Utils.formatDate(card.expire_date)}</p>` : ''}
          <div class="btn-group mt-3">
            <a href="#/books" class="btn btn-primary">📚 去借书</a>
            <a href="#/reader/borrows" class="btn btn-outline">📋 查看借阅记录</a>
            <a href="#/reader/reservations" class="btn btn-outline">📌 我的预约</a>
          </div>
        </div>`;
    } catch (e) {
      $p.innerHTML = '<div class="page"><div class="empty-state"><div class="icon">⚠️</div><p>加载失败</p></div></div>';
    }
  },

  /* ================================================================
     6. 我的借阅
     ================================================================ */
  async renderReaderBorrows() {
    const $p = this.$page();
    $p.innerHTML = '<div class="page"><h1 class="page-title">📋 我的借阅记录</h1><div id="borrow-content"><div class="loading-center"><div class="spinner spinner-lg"></div></div></div></div>';
    const me = Auth.getUser();
    try {
      const res = await Api.get(`/readers/${me.id}/borrow-history`);
      const data = res.data;
      const container = document.getElementById('borrow-content');
      if (!data.items || !data.items.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>暂无借阅记录</p></div>';
        return;
      }
      let rows = data.items.map(r => `
        <tr>
          <td>${Utils.escape(r.book_title || '-')}</td>
          <td>${Utils.escape(r.barcode || '-')}</td>
          <td>${Utils.formatDate(r.borrow_date)}</td>
          <td>${Utils.formatDate(r.due_date)}</td>
          <td>${r.return_date ? Utils.formatDate(r.return_date) : '-'}</td>
          <td><span class="badge ${Utils.borrowStatusBadge(r.status)}">${Utils.borrowStatusLabel(r.status)}</span></td>
          <td>${r.overdue_fee > 0 ? `<span class="text-danger">¥${r.overdue_fee}</span>` : '¥0'}</td>
          <td>${r.renewed_times}/${r.max_renew_times}</td>
        </tr>`).join('');
      container.innerHTML = `
        <div class="card"><div class="table-wrap">
          <table><thead><tr><th>书名</th><th>条形码</th><th>借书日期</th><th>应还日期</th><th>归还日期</th><th>状态</th><th>逾期费</th><th>续借次数</th></tr></thead><tbody>${rows}</tbody></table>
        </div></div>`;
    } catch (e) {
      document.getElementById('borrow-content').innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>加载失败</p></div>';
    }
  },

  /* ================================================================
     7. 我的预约
     ================================================================ */
  async renderReaderReservations() {
    const $p = this.$page();
    $p.innerHTML = '<div class="page"><h1 class="page-title">📌 我的预约</h1><div id="resv-content"><div class="loading-center"><div class="spinner spinner-lg"></div></div></div></div>';
    try {
      const res = await Api.get('/books/reservations');
      const list = res.data || [];
      const container = document.getElementById('resv-content');
      if (!list.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>暂无预约</p></div>';
        return;
      }
      let rows = list.map(r => `
        <tr>
          <td>${r.book_id}</td>
          <td>${Utils.formatDate(r.reserve_date)}</td>
          <td>${Utils.formatDate(r.expire_date)}</td>
          <td><span class="badge ${Utils.resvStatusBadge(r.status)}">${Utils.resvStatusLabel(r.status)}</span></td>
          <td>${r.status === 'pending' ? `<button class="btn btn-sm btn-danger cancel-resv" data-id="${r.id}">取消</button>` : '-'}</td>
        </tr>`).join('');
      container.innerHTML = `
        <div class="card"><div class="table-wrap">
          <table><thead><tr><th>图书 ID</th><th>预约日期</th><th>到期日期</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table>
        </div></div>`;
      container.querySelectorAll('.cancel-resv').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('确定取消该预约？')) return;
          try {
            await Api.put(`/books/reservations/${btn.dataset.id}/cancel`);
            Utils.showToast('已取消', 'success');
            this.renderReaderReservations();
          } catch (e) { /* toast shown */ }
        });
      });
    } catch (e) {
      document.getElementById('resv-content').innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>加载失败</p></div>';
    }
  },

  /* ================================================================
     8. 个人中心（修改密码）
     ================================================================ */
  renderProfile() {
    const user = Auth.getUser();
    const $p = this.$page();
    $p.innerHTML = `
      <div class="page">
        <h1 class="page-title">👤 个人中心</h1>
        <div class="card" style="max-width:500px">
          <div class="card-body">
            <p><strong>用户名：</strong>${Utils.escape(user?.username || '')}</p>
            <p><strong>邮箱：</strong>${Utils.escape(user?.email || '')}</p>
            <p><strong>角色：</strong>${Utils.roleLabel(user?.role || '')}</p>
          </div>
        </div>
        <div class="card mt-3" style="max-width:500px">
          <div class="card-header">🔒 修改密码</div>
          <div class="card-body">
            <form id="change-pwd-form">
              <div class="form-group"><label>原密码</label><input class="form-control" name="old_password" type="password" required></div>
              <div class="form-group"><label>新密码</label><input class="form-control" name="new_password" type="password" required></div>
              <button type="submit" class="btn btn-primary">修改密码</button>
            </form>
          </div>
        </div>
      </div>`;
    document.getElementById('change-pwd-form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      try {
        await Api.put('/auth/change-password', {
          old_password: e.target.old_password.value,
          new_password: e.target.new_password.value
        });
        Utils.showToast('密码修改成功', 'success');
        e.target.reset();
      } catch (err) { /* toast shown */ }
      btn.disabled = false;
    });
  },

  /* ================================================================
     9. 管理后台首页（统计大盘）
     ================================================================ */
  async renderAdminDashboard() {
    const $p = this.$page();
    const user = Auth.getUser() || {};
    const role = Auth.getRole();
    $p.innerHTML = `
      <div class="page page-wide">
        <div class="dashboard-hero">
          <div class="dashboard-title-block">
            <h1 class="page-title">管理首页</h1>
            <p>图书馆运营概览与关键数据</p>
          </div>
          <div class="dashboard-toolbar">
            <label class="dashboard-search">
              ${this._icon('search')}
              <input id="dashboard-global-search" placeholder="搜索图书、读者、功能..." autocomplete="off">
            </label>
            <button class="icon-btn" type="button" aria-label="通知">
              ${this._icon('bell')}
              <span class="notify-dot">6</span>
            </button>
            <button class="icon-btn" type="button" aria-label="帮助">${this._icon('help')}</button>
            <div class="admin-profile">
              <span class="admin-avatar">${Utils.escape((user.username || '管').slice(0, 1))}</span>
              <span><strong>${Utils.escape(user.real_name || user.username || '管理员')}</strong><small>${Utils.roleLabel(role || '')}</small></span>
            </div>
            <button class="icon-btn dashboard-logout" type="button" aria-label="退出登录">${this._icon('chevron')}</button>
          </div>
          <div class="dashboard-subtools">
            <span class="date-pill">${this._icon('calendar')} ${this._todayText()}</span>
            <button class="btn btn-outline" id="dashboard-refresh">${this._icon('refresh')} 刷新数据</button>
          </div>
        </div>
        <div id="overview-content"><div class="loading-center"><div class="spinner spinner-lg"></div></div></div>
      </div>`;
    document.getElementById('dashboard-global-search')?.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const keyword = e.target.value.trim();
      if (keyword) sessionStorage.setItem('sisuBookKeyword', keyword);
      this.navigateTo('/books');
    });
    document.getElementById('dashboard-refresh')?.addEventListener('click', () => this.renderAdminDashboard());
    document.querySelector('.dashboard-logout')?.addEventListener('click', () => {
      Auth.logout();
      this.navigateTo('/login');
    });
    try {
      const [overviewRes, trendRes, popularRes, readerRes, booksRes] = await Promise.allSettled([
        Api.get('/stats/overview'),
        Api.get('/stats/borrow-trend', { days: 30 }),
        Api.get('/stats/popular-books', { limit: 5 }),
        Api.get('/stats/reader-activity', { limit: 5 }),
        Api.get('/books', { page: 1, per_page: 5 })
      ]);
      if (overviewRes.status !== 'fulfilled') throw overviewRes.reason;

      const d = overviewRes.value.data || {};
      const fmt = n => Number(n || 0).toLocaleString('zh-CN');
      const cards = [
        { label: '馆藏总量', value: d.total_books || 0, unit: '册', icon: 'stack', accent: 'stat-teal', delta: `较昨日 +${d.today_borrow || 0} 册` },
        { label: '可借数量', value: d.available_copies || 0, unit: '册', icon: 'openbook', accent: 'stat-blue', delta: `可流通 ${fmt(d.available_copies || 0)} 册` },
        { label: '读者总数', value: d.total_readers || 0, unit: '人', icon: 'group', accent: 'stat-orange', delta: `活跃借阅 ${fmt(d.borrowing || 0)} 人次` },
        { label: '今日借出', value: d.today_borrow || 0, unit: '册', icon: 'clipboard', accent: 'stat-green', delta: `逾期 ${fmt(d.overdue || 0)} 条` },
        { label: '今日归还', value: d.today_return || 0, unit: '册', icon: 'clock', accent: 'stat-amber', delta: '实时同步更新' }
      ];
      const trend = trendRes.status === 'fulfilled' ? (trendRes.value.data || []) : [];
      const trendHtml = this._renderTrendSvg(trend, 30);

      const popular = popularRes.status === 'fulfilled' ? (popularRes.value.data || []) : [];
      const popularHtml = popular.map((b, i) => `
        <div class="ranking-item">
          <span class="ranking-rank">${i + 1}</span>
          ${this._bookThumb(b.title)}
          <div class="ranking-main">
            <div class="ranking-title">${Utils.escape(b.title || '-')}</div>
            <div class="ranking-sub">${Utils.escape(b.author || '')}</div>
          </div>
          <span class="ranking-meta">借阅 ${b.total_borrows || 0} 次</span>
        </div>`).join('');

      const readers = readerRes.status === 'fulfilled' ? (readerRes.value.data || []) : [];
      const readerHtml = readers.map((r, i) => `
        <div class="ranking-item">
          <span class="ranking-rank">${i + 1}</span>
          ${this._readerAvatar(r.real_name || r.username || '-', i)}
          <div class="ranking-main">
            <div class="ranking-title">${Utils.escape(r.real_name || r.username || '-')}</div>
            <div class="ranking-sub">读者证：${Utils.escape(r.card_number || '-')}</div>
          </div>
          <span class="ranking-meta">借阅 ${r.total_borrows || 0} 次</span>
        </div>`).join('');

      const bookData = booksRes.status === 'fulfilled' ? (booksRes.value.data || {}) : {};
      const latestBooks = bookData.items || [];
      const bookRows = latestBooks.map(b => `
        <tr>
          <td><div class="book-cell">${this._bookThumb(b.title, b.cover_url)}<span>${Utils.escape(b.title || '-')}</span></div></td>
          <td>${Utils.escape(b.author || '-')}</td>
          <td>${Utils.escape(b.isbn || '-')}</td>
          <td>${Utils.escape(b.category_name || '未分类')}</td>
          <td>${fmt(b.total_copies || 0)}</td>
          <td>${fmt(b.available_copies || 0)}</td>
          <td>${Utils.formatDate(b.created_at)}</td>
          <td class="table-actions">
            <button class="link-btn dashboard-edit-book" data-id="${b.id}">编辑</button>
            <button class="link-btn dashboard-copies-book" data-id="${b.id}">复制条码</button>
          </td>
        </tr>`).join('');

      document.getElementById('overview-content').innerHTML = `
        <div class="stat-grid dashboard-stat-grid">${cards.map(c => `
          <div class="stat-card ${c.accent}">
            <span class="stat-icon">${this._icon(c.icon)}</span>
            <span class="stat-label">${c.label}</span>
            <span class="stat-value">${fmt(c.value)} <small>${c.unit}</small></span>
            <span class="stat-delta">${c.delta}</span>
          </div>`).join('')}</div>
        <div class="dashboard-main-grid">
          <div class="card overview-panel trend-panel">
            <div class="card-header">
              <span>借阅趋势 <em>近30天</em></span>
              <select class="mini-select" aria-label="趋势周期"><option>近30天</option></select>
            </div>
            <div class="card-body">
              ${trendHtml}
            </div>
          </div>
          <div class="card overview-panel">
            <div class="card-header"><span>热门图书 <em>TOP 5</em></span><a href="#/admin/stats">查看全部</a></div>
            <div class="card-body ranking-list">${popularHtml || '<p class="text-muted">暂无热门图书数据</p>'}</div>
          </div>
          <div class="card overview-panel">
            <div class="card-header"><span>读者活跃榜 <em>本月</em></span><a href="#/admin/readers">查看全部</a></div>
            <div class="card-body ranking-list">${readerHtml || '<p class="text-muted">暂无读者活跃数据</p>'}</div>
          </div>
        </div>
        <div class="card dashboard-table-card mt-3">
          <div class="card-header">
            <span>图书管理 <em>最新入库</em></span>
            <div class="table-header-tools">
              <label class="table-search">${this._icon('search')}<input id="dashboard-book-search" placeholder="搜索书名、作者、ISBN..."></label>
              <button class="btn btn-primary" id="dashboard-add-book">${this._icon('plus')} 新增图书</button>
            </div>
          </div>
          <div class="table-wrap">
            <table class="dashboard-book-table">
              <thead><tr><th>书名</th><th>作者</th><th>ISBN</th><th>分类</th><th>馆藏数量</th><th>可借数量</th><th>入库日期</th><th>操作</th></tr></thead>
              <tbody>${bookRows || '<tr><td colspan="8" class="text-center text-muted">暂无图书数据</td></tr>'}</tbody>
            </table>
          </div>
          <div class="dashboard-table-footer">
            <span>共 ${fmt(bookData.total || latestBooks.length)} 条</span>
            <a href="#/admin/books">进入完整图书管理</a>
          </div>
        </div>`;
      document.getElementById('dashboard-book-search')?.addEventListener('input', e => {
        const keyword = e.target.value.trim().toLowerCase();
        document.querySelectorAll('.dashboard-book-table tbody tr').forEach(row => {
          row.style.display = row.innerText.toLowerCase().includes(keyword) ? '' : 'none';
        });
      });
      document.getElementById('dashboard-add-book')?.addEventListener('click', () => this._showBookForm());
      document.querySelectorAll('.dashboard-edit-book').forEach(btn => {
        btn.addEventListener('click', () => this._showBookForm(btn.dataset.id));
      });
      document.querySelectorAll('.dashboard-copies-book').forEach(btn => {
        btn.addEventListener('click', () => this._showCopies(btn.dataset.id));
      });
    } catch (e) {
      document.getElementById('overview-content').innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>加载失败，请检查后端和数据库</p></div>';
    }
  },

  /* ================================================================
     10. 借书
     ================================================================ */
  renderBorrowPage() {
    const $p = this.$page();
    $p.innerHTML = `
      <div class="page" style="max-width:600px">
        <h1 class="page-title">📥 借书操作</h1>
        <div class="card">
          <div class="card-body">
            <form id="borrow-form">
              <div class="form-group"><label>读者借阅证号</label><input class="form-control" name="card_number" placeholder="RC12345678" required></div>
              <div class="form-group"><label>图书副本条形码</label><input class="form-control" name="barcode" placeholder="BK-0001-C01" required></div>
              <button type="submit" class="btn btn-primary btn-block">确认借书</button>
            </form>
            <div id="borrow-result" class="mt-3"></div>
          </div>
        </div>
      </div>`;
    document.getElementById('borrow-form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true; btn.textContent = '处理中…';
      try {
        const res = await Api.post('/borrow/borrow', {
          card_number: e.target.card_number.value.trim(),
          barcode: e.target.barcode.value.trim()
        });
        const r = res.data;
        document.getElementById('borrow-result').innerHTML = `
          <div style="padding:16px;background:var(--success-light);border-radius:var(--radius)">
            <strong>✅ 借书成功</strong>
            <p class="mt-1">记录 ID：${r.id}<br>借书日期：${Utils.formatDate(r.borrow_date, 'YYYY-MM-DD HH:mm')}<br>应还日期：<strong>${Utils.formatDate(r.due_date, 'YYYY-MM-DD HH:mm')}</strong></p>
          </div>`;
        e.target.reset();
      } catch (err) {
        document.getElementById('borrow-result').innerHTML = '';
      }
      btn.disabled = false; btn.textContent = '确认借书';
    });
  },

  /* ================================================================
     11. 还书
     ================================================================ */
  renderReturnPage() {
    const $p = this.$page();
    $p.innerHTML = `
      <div class="page" style="max-width:600px">
        <h1 class="page-title">📤 还书操作</h1>
        <div class="card">
          <div class="card-body">
            <form id="return-form">
              <div class="form-group"><label>图书副本条形码</label><input class="form-control" name="barcode" placeholder="BK-0001-C01" required></div>
              <div class="form-group">
                <label>归还后副本状态</label>
                <select class="form-control" name="copy_status">
                  <option value="available">正常可借</option>
                  <option value="damaged">破损</option>
                  <option value="lost">遗失</option>
                </select>
              </div>
              <button type="submit" class="btn btn-primary btn-block">确认还书</button>
            </form>
            <div id="return-result" class="mt-3"></div>
          </div>
        </div>
      </div>`;
    document.getElementById('return-form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true; btn.textContent = '处理中…';
      try {
        const res = await Api.post('/borrow/return', {
          barcode: e.target.barcode.value.trim(),
          copy_status: e.target.copy_status.value
        });
        const r = res.data;
        const fee = r.overdue_fee > 0 ? `<br>逾期费：<strong style="color:var(--danger)">¥${r.overdue_fee}</strong>` : '';
        document.getElementById('return-result').innerHTML = `
          <div style="padding:16px;background:var(--success-light);border-radius:var(--radius)">
            <strong>✅ 还书成功</strong>
            <p class="mt-1">记录 ID：${r.id}<br>归还日期：${Utils.formatDate(r.return_date, 'YYYY-MM-DD HH:mm')}${fee}</p>
          </div>`;
        e.target.reset();
      } catch (err) {
        document.getElementById('return-result').innerHTML = '';
      }
      btn.disabled = false; btn.textContent = '确认还书';
    });
  },

  /* ================================================================
     12. 借阅记录
     ================================================================ */
  async renderRecordsPage() {
    const $p = this.$page();
    $p.innerHTML = '<div class="page page-wide"><h1 class="page-title">📋 借阅记录</h1><div id="records-content"><div class="loading-center"><div class="spinner spinner-lg"></div></div></div></div>';
    await this._loadRecords(1);
  },

  async _loadRecords(page, status = '', cardNumber = '') {
    const container = document.getElementById('records-content');
    if (!container) return;
    container.innerHTML = '<div class="loading-center"><div class="spinner spinner-lg"></div></div>';
    try {
      const params = { page, per_page: 20 };
      if (status) params.status = status;
      if (cardNumber) params.card_number = cardNumber;
      const res = await Api.get('/borrow/records', params);
      const data = res.data;
      let rows = data.items.map(r => `
        <tr>
          <td>${r.id}</td>
          <td>${Utils.escape(r.card_number || '-')}</td>
          <td>${Utils.escape(r.book_title || '-')}</td>
          <td>${Utils.escape(r.barcode || '-')}</td>
          <td>${Utils.formatDate(r.borrow_date, 'MM-DD HH:mm')}</td>
          <td>${Utils.formatDate(r.due_date, 'MM-DD')}</td>
          <td>${r.return_date ? Utils.formatDate(r.return_date, 'MM-DD') : '-'}</td>
          <td><span class="badge ${Utils.borrowStatusBadge(r.status)}">${Utils.borrowStatusLabel(r.status)}</span></td>
          <td class="text-right">${r.overdue_fee > 0 ? `<span class="text-danger">¥${r.overdue_fee}</span>` : '-'}</td>
        </tr>`).join('');

      container.innerHTML = `
        <div class="card mb-2">
          <div class="card-body">
            <div class="form-inline">
              <div class="form-group"><label>状态筛选</label><select class="form-control" id="records-status"><option value="">全部</option><option value="borrowing">借阅中</option><option value="returned">已归还</option><option value="overdue">逾期</option></select></div>
              <div class="form-group"><label>读者证号</label><input class="form-control" id="records-card" placeholder="RC..."></div>
              <button class="btn btn-outline" id="records-filter-btn">筛选</button>
            </div>
          </div>
        </div>
        <div class="card"><div class="table-wrap">
          <table><thead><tr><th>ID</th><th>读者证号</th><th>书名</th><th>条形码</th><th>借书日期</th><th>应还日期</th><th>归还日期</th><th>状态</th><th>逾期费</th></tr></thead><tbody>${rows || '<tr><td colspan="9" class="text-center text-muted">暂无数据</td></tr>'}</tbody></table>
        </div></div>
        ${Utils.renderPagination(data.page, data.pages, p => this._loadRecords(p, status, cardNumber))}`;

      // 分页绑定
      container.querySelectorAll('.pagination button').forEach(btn => {
        btn.addEventListener('click', () => {
          const p = parseInt(btn.dataset.page);
          if (p) this._loadRecords(p,
            document.getElementById('records-status')?.value || '',
            document.getElementById('records-card')?.value || '');
        });
      });
      // 筛选绑定
      const filterBtn = document.getElementById('records-filter-btn');
      if (filterBtn) {
        filterBtn.addEventListener('click', () => {
          this._loadRecords(1,
            document.getElementById('records-status')?.value || '',
            document.getElementById('records-card')?.value || '');
        });
      }
    } catch (e) {
      container.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>加载失败</p></div>';
    }
  },

  /* ================================================================
     13. 图书管理
     ================================================================ */
  async renderBookManage() {
    const $p = this.$page();
    $p.innerHTML = `
      <div class="page page-wide">
        <div class="flex-between mb-3"><h1 class="page-title" style="margin-bottom:0">📚 图书管理</h1><button class="btn btn-primary" id="add-book-btn">+ 新增图书</button></div>
        <div id="book-mgmt-content"><div class="loading-center"><div class="spinner spinner-lg"></div></div></div>
      </div>`;
    document.getElementById('add-book-btn').addEventListener('click', () => this._showBookForm());
    await this._loadBookMgmt(1);
  },

  async _loadBookMgmt(page) {
    const container = document.getElementById('book-mgmt-content');
    if (!container) return;
    container.innerHTML = '<div class="loading-center"><div class="spinner spinner-lg"></div></div>';
    try {
      const res = await Api.get('/books', { page, per_page: 15 });
      const data = res.data;
      let rows = data.items.map(b => `
        <tr>
          <td>${b.id}</td>
          <td title="${Utils.escape(b.title)}">${Utils.escape(b.title).substring(0, 30)}${b.title.length > 30 ? '…' : ''}</td>
          <td>${Utils.escape(b.isbn)}</td>
          <td>${Utils.escape(b.author)}</td>
          <td>${b.available_copies}/${b.total_copies}</td>
          <td><span class="badge badge-blue">${Utils.escape(b.category_name || '未分类')}</span></td>
          <td>
            <button class="btn btn-sm btn-outline edit-book" data-id="${b.id}">编辑</button>
            <button class="btn btn-sm btn-outline copies-book" data-id="${b.id}">副本</button>
            ${Auth.getRole() === 'admin' ? `<button class="btn btn-sm btn-danger del-book" data-id="${b.id}">删除</button>` : ''}
          </td>
        </tr>`).join('');

      container.innerHTML = `
        <div class="card"><div class="table-wrap">
          <table><thead><tr><th>ID</th><th>书名</th><th>ISBN</th><th>作者</th><th>库存</th><th>分类</th><th>操作</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="text-center text-muted">暂无数据</td></tr>'}</tbody></table>
        </div></div>
        ${Utils.renderPagination(data.page, data.pages, p => this._loadBookMgmt(p))}`;

      container.querySelectorAll('.pagination button').forEach(btn => {
        btn.addEventListener('click', () => { const p = parseInt(btn.dataset.page); if (p) this._loadBookMgmt(p); });
      });
      container.querySelectorAll('.edit-book').forEach(btn => btn.addEventListener('click', () => this._showBookForm(btn.dataset.id)));
      container.querySelectorAll('.copies-book').forEach(btn => btn.addEventListener('click', () => this._showCopies(btn.dataset.id)));
      container.querySelectorAll('.del-book').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('确定删除该图书？')) return;
          try { await Api.del('/books/' + btn.dataset.id); Utils.showToast('已删除', 'success'); this._loadBookMgmt(page); }
          catch (e) { /* toast */ }
        });
      });
    } catch (e) {
      container.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>加载失败</p></div>';
    }
  },

  async _showBookForm(bookId = null) {
    let book = null;
    let cats = [];
    if (bookId) {
      try { const res = await Api.get('/books/' + bookId); book = res.data; } catch (e) { return; }
    }
    try { const r = await Api.get('/books/categories'); cats = r.data || []; } catch (e) { /* ignore */ }
    function flatCats(list, depth = 0) {
      let h = '';
      list.forEach(c => {
        h += `<option value="${c.id}" ${book && book.category_id === c.id ? 'selected' : ''}>${'— '.repeat(depth)}${Utils.escape(c.name)}</option>`;
        if (c.children) h += flatCats(c.children, depth + 1);
      });
      return h;
    }
    Utils.showModal(
      bookId ? '编辑图书' : '新增图书',
      `<form id="book-form">
        <div class="form-row">
          <div class="form-group"><label>ISBN *</label><input class="form-control" name="isbn" value="${Utils.escape(book?.isbn || '')}" ${bookId ? 'readonly' : ''} required></div>
          <div class="form-group"><label>书名 *</label><input class="form-control" name="title" value="${Utils.escape(book?.title || '')}" required></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>作者 *</label><input class="form-control" name="author" value="${Utils.escape(book?.author || '')}" required></div>
          <div class="form-group"><label>出版社</label><input class="form-control" name="publisher" value="${Utils.escape(book?.publisher || '')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>分类</label><select class="form-control" name="category_id"><option value="">无</option>${flatCats(cats)}</select></div>
          <div class="form-group"><label>语言</label><input class="form-control" name="language" value="${Utils.escape(book?.language || '中文')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>价格</label><input class="form-control" name="price" type="number" step="0.01" value="${book?.price || ''}"></div>
          <div class="form-group"><label>出版日期</label><input class="form-control" name="publish_date" type="date" value="${book?.publish_date || ''}"></div>
        </div>
        <div class="form-group"><label>封面 URL</label><input class="form-control" name="cover_url" value="${Utils.escape(book?.cover_url || '')}"></div>
        <div class="form-group"><label>简介</label><textarea class="form-control" name="description">${Utils.escape(book?.description || '')}</textarea></div>
      </form>`,
      async () => {
        const f = document.getElementById('book-form');
        const data = {
          isbn: f.isbn.value.trim(),
          title: f.title.value.trim(),
          author: f.author.value.trim(),
          publisher: f.publisher.value.trim(),
          category_id: f.category_id.value ? parseInt(f.category_id.value) : null,
          language: f.language.value.trim(),
          price: f.price.value ? parseFloat(f.price.value) : null,
          publish_date: f.publish_date.value || null,
          cover_url: f.cover_url.value.trim(),
          description: f.description.value.trim()
        };
        if (!data.isbn || !data.title || !data.author) { Utils.showToast('ISBN、书名、作者为必填', 'warning'); return; }
        try {
          if (bookId) {
            await Api.put('/books/' + bookId, data);
          } else {
            await Api.post('/books', data);
          }
          Utils.showToast(bookId ? '图书更新成功' : '图书添加成功', 'success');
          this.renderBookManage();
        } catch (e) { /* toast */ }
      },
      bookId ? '保存' : '添加'
    );
  },

  async _showCopies(bookId) {
    let copies = [];
    try { const res = await Api.get('/books/' + bookId + '/copies'); copies = res.data || []; } catch (e) { return; }
    let rowsHtml = copies.map(c => `
      <tr>
        <td>${Utils.escape(c.barcode)}</td>
        <td><span class="badge ${Utils.copyStatusBadge(c.status)}">${Utils.copyStatusLabel(c.status)}</span></td>
        <td>${Utils.escape(c.location || '-')}</td>
        <td>${Utils.formatDate(c.purchase_date)}</td>
      </tr>`).join('');
    const overlay = Utils.showModal(
      `副本管理 · 图书 #${bookId}`,
      `<div class="table-wrap"><table><thead><tr><th>条形码</th><th>状态</th><th>位置</th><th>入库日期</th></tr></thead><tbody>${rowsHtml || '<tr><td colspan="4" class="text-center text-muted">暂无副本</td></tr>'}</tbody></table></div>
      <form id="copy-form" class="mt-2" style="border-top:1px solid var(--gray-200);padding-top:12px">
        <strong>添加副本</strong>
        <div class="form-row mt-1">
          <div class="form-group"><label>条形码</label><input class="form-control" name="barcode" required></div>
          <div class="form-group"><label>位置</label><input class="form-control" name="location" placeholder="A区3排"></div>
        </div>
        <button type="submit" class="btn btn-primary btn-sm">添加</button>
      </form>`,
      null, '关闭'
    );
    // 添加副本表单
    setTimeout(() => {
      const cf = document.getElementById('copy-form');
      if (cf) {
        cf.addEventListener('submit', async e => {
          e.preventDefault();
          const data = { barcode: cf.barcode.value.trim(), location: cf.location.value.trim() };
          if (!data.barcode) { Utils.showToast('条形码不能为空', 'warning'); return; }
          try {
            await Api.post('/books/' + bookId + '/copies', data);
            Utils.showToast('副本添加成功', 'success');
            overlay.remove();
            this._showCopies(bookId);
          } catch (e) { /* toast */ }
        });
      }
    }, 100);
  },

  /* ================================================================
     14. 读者管理
     ================================================================ */
  async renderReaderManage() {
    const $p = this.$page();
    $p.innerHTML = '<div class="page page-wide"><h1 class="page-title">👥 读者管理</h1><div id="reader-mgmt-content"><div class="loading-center"><div class="spinner spinner-lg"></div></div></div></div>';
    await this._loadReaderMgmt(1);
  },

  async _loadReaderMgmt(page, keyword = '') {
    const container = document.getElementById('reader-mgmt-content');
    if (!container) return;
    container.innerHTML = '<div class="loading-center"><div class="spinner spinner-lg"></div></div>';
    try {
      const params = { page, per_page: 20 };
      if (keyword) params.keyword = keyword;
      const res = await Api.get('/readers', params);
      const data = res.data;
      let rows = data.items.map(u => {
        const c = u.reader_card;
        return `
        <tr>
          <td>${u.id}</td>
          <td>${Utils.escape(u.username)}</td>
          <td>${Utils.escape(u.real_name || '-')}</td>
          <td>${Utils.escape(u.email)}</td>
          <td>${Utils.escape(c?.card_number || '-')}</td>
          <td><span class="badge ${Utils.cardStatusBadge(c?.status)}">${Utils.cardStatusLabel(c?.status)}</span></td>
          <td>${c?.current_borrow_count || 0}/${c?.max_borrow_limit || 5}</td>
          <td>
            <button class="btn btn-sm btn-outline renew-card" data-id="${c?.id}">续期</button>
            <button class="btn btn-sm btn-outline view-reader" data-id="${u.id}">详情</button>
          </td>
        </tr>`;
      }).join('');
      container.innerHTML = `
        <div class="card mb-2">
          <div class="card-body">
            <div class="form-inline">
              <div class="form-group"><label>搜索</label><input class="form-control" id="reader-keyword" placeholder="用户名/姓名/邮箱" value="${Utils.escape(keyword)}"></div>
              <button class="btn btn-outline" id="reader-search-btn">搜索</button>
            </div>
          </div>
        </div>
        <div class="card"><div class="table-wrap">
          <table><thead><tr><th>ID</th><th>用户名</th><th>姓名</th><th>邮箱</th><th>借阅证号</th><th>证状态</th><th>在借</th><th>操作</th></tr></thead><tbody>${rows || '<tr><td colspan="8" class="text-center text-muted">暂无数据</td></tr>'}</tbody></table>
        </div></div>
        ${Utils.renderPagination(data.page, data.pages, p => this._loadReaderMgmt(p, keyword))}`;

      container.querySelectorAll('.pagination button').forEach(btn => {
        btn.addEventListener('click', () => { const p = parseInt(btn.dataset.page); if (p) this._loadReaderMgmt(p, keyword); });
      });
      document.getElementById('reader-search-btn').addEventListener('click', () => {
        this._loadReaderMgmt(1, document.getElementById('reader-keyword').value.trim());
      });
      container.querySelectorAll('.renew-card').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('确定续期365天？')) return;
          try { await Api.put('/readers/cards/' + btn.dataset.id + '/renew'); Utils.showToast('续期成功', 'success'); this._loadReaderMgmt(page, keyword); }
          catch (e) { /* toast */ }
        });
      });
      container.querySelectorAll('.view-reader').forEach(btn => {
        btn.addEventListener('click', () => this._showReaderDetail(btn.dataset.id));
      });
    } catch (e) {
      container.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>加载失败</p></div>';
    }
  },

  async _showReaderDetail(userId) {
    try {
      const res = await Api.get('/readers/' + userId);
      const u = res.data;
      const c = u.reader_card;
      Utils.showModal(
        `读者详情：${Utils.escape(u.username)}`,
        `<dl class="detail-info">
          <dt>用户名</dt><dd>${Utils.escape(u.username)}</dd>
          <dt>姓名</dt><dd>${Utils.escape(u.real_name || '-')}</dd>
          <dt>邮箱</dt><dd>${Utils.escape(u.email)}</dd>
          <dt>手机</dt><dd>${Utils.escape(u.phone || '-')}</dd>
          <dt>角色</dt><dd>${Utils.roleLabel(u.role)}</dd>
          <dt>借阅证号</dt><dd>${Utils.escape(c?.card_number || '-')}</dd>
          <dt>证状态</dt><dd><span class="badge ${Utils.cardStatusBadge(c?.status)}">${Utils.cardStatusLabel(c?.status)}</span></dd>
          <dt>在借/上限</dt><dd>${c?.current_borrow_count || 0} / ${c?.max_borrow_limit || 5}</dd>
          <dt>有效期至</dt><dd>${Utils.formatDate(c?.expire_date)}</dd>
        </dl>`,
        null, '关闭'
      );
    } catch (e) { /* toast */ }
  },

  /* ================================================================
     15. 统计分析
     ================================================================ */
  async renderStatsPage() {
    const $p = this.$page();
    $p.innerHTML = '<div class="page page-wide"><h1 class="page-title">📈 统计分析</h1><div id="stats-content"><div class="loading-center"><div class="spinner spinner-lg"></div></div></div></div>';
    try {
      const [trendRes, popularRes, catRes, readerRes, invRes] = await Promise.all([
        Api.get('/stats/borrow-trend', { days: 30 }),
        Api.get('/stats/popular-books', { limit: 10 }),
        Api.get('/stats/category-distribution'),
        Api.get('/stats/reader-activity', { limit: 10 }),
        Api.get('/stats/inventory')
      ]);

      // 借阅趋势柱状图
      const trend = trendRes.data || [];
      const maxCount = Math.max(...trend.map(t => t.count), 1);
      let barHtml = '';
      trend.forEach(t => {
        const h = Math.round((t.count / maxCount) * 100);
        barHtml += `<div class="bar-col"><span style="font-size:0.7rem;color:var(--gray-600)">${t.count}</span><div class="bar" style="height:${h}%" title="${t.date}: ${t.count}"></div><span class="bar-label">${(t.date || '').slice(5)}</span></div>`;
      });

      // 热门图书
      const popular = popularRes.data || [];
      let popHtml = popular.map((b, i) => `
        <li><span class="rank-num">${i + 1}</span><div class="rank-info"><div class="name">${Utils.escape(b.title || '')}</div><div class="sub">${Utils.escape(b.author || '')} · ${Utils.escape(b.category_name || '')}</div></div><span class="rank-val">${b.total_borrows || 0} 次</span></li>`).join('');

      // 分类分布
      const catData = catRes.data || [];
      let catHtml = catData.map(c => `<li><span class="rank-num">📚</span><div class="rank-info"><div class="name">${Utils.escape(c.category || '')}</div></div><span class="rank-val">${c.count} 册</span></li>`).join('');

      // 活跃读者
      const readers = readerRes.data || [];
      let readerHtml = readers.map((r, i) => `
        <li><span class="rank-num">${i + 1}</span><div class="rank-info"><div class="name">${Utils.escape(r.real_name || r.username || '')}</div><div class="sub">${Utils.escape(r.card_number || '')} · 信用：${r.credit_score || '-'}</div></div><span class="rank-val">${r.total_borrows || 0} 次</span></li>`).join('');

      // 库存状态
      const inv = invRes.data || {};
      const invTotal = parseInt(inv.total) || 1;

      document.getElementById('stats-content').innerHTML = `
        <div class="grid-2">
          <div class="card"><div class="card-header">📊 近30天借阅趋势</div><div class="card-body"><div class="bar-chart">${barHtml}</div></div></div>
          <div class="card">
            <div class="card-header">📦 副本状态分布</div>
            <div class="card-body">
              <p>可借：<strong>${inv.available || 0}</strong> (${Math.round((inv.available || 0) / invTotal * 100)}%)</p>
              <p>借出：<strong>${inv.borrowed || 0}</strong> (${Math.round((inv.borrowed || 0) / invTotal * 100)}%)</p>
              <p>破损：<strong>${inv.damaged || 0}</strong> · 遗失：<strong>${inv.lost || 0}</strong> · 报废：<strong>${inv.scrapped || 0}</strong></p>
              <p class="text-muted">总副本：${invTotal}</p>
            </div>
          </div>
          <div class="card"><div class="card-header">🔥 热门图书</div><div class="card-body"><ul class="rank-list">${popHtml || '<li class="text-muted">暂无数据</li>'}</ul></div></div>
          <div class="card"><div class="card-header">📂 分类分布</div><div class="card-body"><ul class="rank-list">${catHtml || '<li class="text-muted">暂无数据</li>'}</ul></div></div>
          <div class="card" style="grid-column:1/-1"><div class="card-header">🏆 活跃读者</div><div class="card-body"><ul class="rank-list">${readerHtml || '<li class="text-muted">暂无数据</li>'}</ul></div></div>
        </div>`;
    } catch (e) {
      document.getElementById('stats-content').innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>统计数据加载失败，请确认数据库视图已创建</p></div>';
    }
  }
};

/* ====== 启动 ====== */
document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
