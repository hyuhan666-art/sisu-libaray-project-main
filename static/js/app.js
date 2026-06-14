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
        <a href="#/books" class="navbar-brand">📖 SISU 图书馆</a>
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

  _renderSidebar() {
    const role = Auth.getRole();
    const user = Auth.getUser();
    return `
      <aside class="sidebar">
        <div class="sidebar-brand"><span class="icon">📖</span><span>SISU 图书馆</span></div>
        <nav class="sidebar-nav">
          <a href="#/admin/dashboard"><span class="nav-icon">📊</span><span>管理首页</span></a>
          <a href="#/admin/borrow"><span class="nav-icon">📥</span><span>借书</span></a>
          <a href="#/admin/return"><span class="nav-icon">📤</span><span>还书</span></a>
          <a href="#/admin/records"><span class="nav-icon">📋</span><span>借阅记录</span></a>
          <div class="nav-section">管理</div>
          <a href="#/admin/books"><span class="nav-icon">📚</span><span>图书管理</span></a>
          <a href="#/admin/readers"><span class="nav-icon">👥</span><span>读者管理</span></a>
          <a href="#/admin/stats"><span class="nav-icon">📈</span><span>统计分析</span></a>
          <div class="nav-section">其他</div>
          <a href="#/books"><span class="nav-icon">🔍</span><span>图书检索</span></a>
          <a href="#/profile"><span class="nav-icon">👤</span><span>个人中心</span></a>
        </nav>
        <div class="sidebar-footer">
          👤 ${Utils.escape(user?.username || '')} · ${Utils.roleLabel(role || '')}<br>
          <a href="#" class="logout-btn" style="color:var(--gray-500);font-size:0.75rem">退出登录</a>
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
    $p.innerHTML = '<div class="page page-wide"><h1 class="page-title">📊 馆藏总览</h1><div id="overview-content"><div class="loading-center"><div class="spinner spinner-lg"></div></div></div></div>';
    try {
      const res = await Api.get('/stats/overview');
      const d = res.data || {};
      const cards = [
        { label: '总图书数', value: d.total_books || 0, icon: '📚', accent: 'accent-blue' },
        { label: '总副本数', value: d.total_copies || 0, icon: '📦', accent: 'accent-blue' },
        { label: '可借副本', value: d.available_copies || 0, icon: '✅', accent: 'accent-green' },
        { label: '读者数', value: d.total_readers || 0, icon: '👥', accent: 'accent-blue' },
        { label: '借阅中', value: d.borrowing || 0, icon: '📗', accent: 'accent-yellow' },
        { label: '逾期中', value: d.overdue || 0, icon: '⚠️', accent: 'accent-red' },
        { label: '今日借书', value: d.today_borrow || 0, icon: '📥', accent: 'accent-green' },
        { label: '今日还书', value: d.today_return || 0, icon: '📤', accent: 'accent-green' },
      ];
      document.getElementById('overview-content').innerHTML = `
        <div class="stat-grid">${cards.map(c => `
          <div class="stat-card ${c.accent}">
            <span class="stat-icon">${c.icon}</span>
            <span class="stat-label">${c.label}</span>
            <span class="stat-value">${c.value}</span>
          </div>`).join('')}</div>
        <div class="btn-group">
          <button class="btn btn-outline" id="check-overdue-btn">🔍 扫描逾期</button>
        </div>
        <p class="text-muted mt-1" id="overdue-msg"></p>
      </div>`;
      document.getElementById('check-overdue-btn').addEventListener('click', async () => {
        try {
          const r = await Api.post('/borrow/overdue/check');
          document.getElementById('overdue-msg').textContent = r.message || `已标记 ${r.data?.updated || 0} 条逾期`;
        } catch (e) { /* toast */ }
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
