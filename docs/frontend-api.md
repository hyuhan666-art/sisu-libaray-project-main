# 前端接口文档 · sisu 图书管理系统

> 后端：Flask + JWT + SQLAlchemy · MySQL · Redis
> 给前端同学对接用 · 接口已在 routes 里定义好，部分业务还在开发中

---

## 0. 基础约定

### Base URL
```
开发环境：http://localhost:5000/api
生产环境：待定
```

### 统一响应格式

**所有接口** 返回 JSON：

```json
{
  "code": 0,           // 0=成功，非0=失败
  "message": "success",
  "data": { ... }      // 成功时有，失败时无
}
```

### 认证方式

除 `登录 / 注册 / 公开图书查询` 外，所有接口需在 Header 带 JWT：

```
Authorization: Bearer <access_token>
```

token 在 `登录` 接口获取，**access_token** 默认 2 小时过期，过期后用 **refresh_token** 换新的。

### 角色

| role | 权限范围 |
|---|---|
| `reader` | 查图书、查自己借阅历史、预约、续借自己的 |
| `librarian` | 上面所有 + 借/还书、管理图书、管理读者 |
| `admin` | 全部权限 |

### 分页约定

带 `page` 和 `per_page` 的接口，响应固定字段：

```json
{
  "items": [ ... ],
  "total": 100,
  "pages": 10,
  "page": 1,
  "per_page": 10
}
```

---

## 1. 认证模块 `/api/auth`

### 1.1 注册 `POST /auth/register`

无需认证。注册成功自动创建 `reader_card`。

**请求**：
```json
{
  "username": "alice",
  "password": "secret123",
  "email": "alice@example.com",
  "real_name": "张三",      // 选填
  "phone": "13800000000"   // 选填
}
```

**响应** 201：
```json
{
  "code": 201,
  "message": "注册成功",
  "data": {
    "user": { "id": 1, "username": "alice", "role": "reader", ... },
    "card_number": "RC12345678"
  }
}
```

**业务错误**（HTTP 400）：`用户名已存在` / `邮箱已注册` / `缺少字段: xxx`

---

### 1.2 登录 `POST /auth/login`

**请求**：
```json
{ "username": "alice", "password": "secret123" }
```

**响应**：
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "access_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc...",
    "user": { "id": 1, "username": "alice", "role": "reader", ... }
  }
}
```

**业务错误**：401 `用户名或密码错误` · 403 `账号已被禁用`

---

### 1.3 刷新 Token `POST /auth/refresh`

**Header**：`Authorization: Bearer <refresh_token>`（注意是 refresh_token）

**响应**：`{ "data": { "access_token": "..." } }`

---

### 1.4 当前用户信息 `GET /auth/me`

**响应**：当前登录用户的完整信息，包括 `reader_card`（如有）。

---

### 1.5 修改密码 `PUT /auth/change-password`

**请求**：`{ "old_password": "...", "new_password": "..." }`

---

## 2. 图书模块 `/api/books`

### 2.1 图书列表 `GET /books` ⭐ MVP

无需认证。支持多条件 + 分页。

**查询参数**：

| 参数 | 类型 | 说明 |
|---|---|---|
| `keyword` | string | 关键词（书名/作者模糊匹配） |
| `category_id` | int | 分类 ID |
| `author` | string | 作者模糊匹配 |
| `isbn` | string | ISBN 模糊匹配 |
| `available_only` | bool | `true` 则只返回有库存的 |
| `page` | int | 默认 1 |
| `per_page` | int | 默认 10 |

**响应**：
```json
{
  "data": {
    "items": [
      {
        "id": 1, "isbn": "9787...", "title": "三体",
        "author": "刘慈欣", "publisher": "重庆出版社",
        "category_id": 3, "language": "中文",
        "total_copies": 5, "available_copies": 3,
        "cover_url": "https://...",
        "publish_date": "2008-01-01"
      }
    ],
    "total": 100, "pages": 10, "page": 1, "per_page": 10
  }
}
```

---

### 2.2 图书详情 `GET /books/<book_id>` ⭐ MVP

无需认证。返回完整字段 + 副本列表。

---

### 2.3 新增图书 `POST /books`

需要 `librarian` / `admin`。

**请求**：
```json
{
  "isbn": "9787...",           // 必填
  "title": "三体",             // 必填
  "author": "刘慈欣",          // 必填
  "publisher": "重庆出版社",
  "category_id": 3,
  "description": "...",
  "language": "中文",
  "price": 39.00,
  "cover_url": "...",
  "publish_date": "2008-01-01"
}
```

---

### 2.4 修改图书 `PUT /books/<book_id>`

需要 `librarian` / `admin`。可改字段同 2.3（除 ISBN）。

---

### 2.5 删除图书 `DELETE /books/<book_id>`

需要 `admin`。如有未归还副本会被拒。

---

### 2.6 分类相关

| 接口 | 方法路径 | 权限 |
|---|---|---|
| 分类树 | `GET /books/categories` | 公开 |
| 新增分类 | `POST /books/categories` | librarian+ |
| 修改分类 | `PUT /books/categories/<id>` | librarian+ |
| 删除分类 | `DELETE /books/categories/<id>` | admin |

分类支持父子关系，`GET` 返回树形结构。

---

### 2.7 图书副本

| 接口 | 说明 |
|---|---|
| `GET /books/<book_id>/copies` | 查某本书的所有副本 |
| `POST /books/<book_id>/copies` | 加副本（馆员+） |

**副本对象**：
```json
{
  "id": 10, "barcode": "BK-0001-C01",
  "status": "available",  // available/borrowed/damaged/lost/scrapped
  "location": "A区3排2层", "purchase_date": "2025-01-01"
}
```

---

### 2.8 预约

| 接口 | 说明 |
|---|---|
| `POST /books/<book_id>/reserve` | 预约某本书（登录用户） |
| `GET /books/reservations` | 查自己的预约（馆员看全部） |
| `PUT /books/reservations/<id>/cancel` | 取消预约 |

---

## 3. 借阅模块 `/api`

### 3.1 借书 `POST /borrow` ⭐ MVP

需要 `librarian` / `admin`。前端给馆员用，不是给读者用。

**请求**：
```json
{
  "card_number": "RC12345678",      // 读者借阅证号
  "barcode": "BK-0001-C01"           // 图书副本条形码
}
```

**响应** 201：
```json
{
  "data": {
    "id": 42,
    "reader_card_id": 5,
    "book_copy_id": 10,
    "borrow_date": "2026-05-29T10:00:00",
    "due_date": "2026-06-28T10:00:00",
    "status": "borrowing"
  }
}
```

**业务错误**（400）：
- `借阅证不存在` / `借阅证已过期或被暂停`
- `已达最大借阅数量 5 本`
- `图书副本不存在` / `图书不可借阅，当前状态: borrowed`

---

### 3.2 还书 `POST /return` ⭐ MVP

需要 `librarian` / `admin`。

**请求**：
```json
{
  "barcode": "BK-0001-C01",
  "copy_status": "available"   // 选填，可标 damaged 等
}
```

**响应**：
```json
{
  "data": {
    "id": 42, "return_date": "2026-06-30T10:00:00",
    "overdue_fee": 1.00,    // 逾期费（0.5 元/天）
    "status": "returned"
  }
}
```

---

### 3.3 续借 `POST /renew`

需要登录。读者只能续自己的，馆员可续任何人的。

**请求**：`{ "record_id": 42 }`

**业务规则**：每本最多续 2 次，每次 +15 天，逾期不能续。

---

### 3.4 借阅记录列表 `GET /records`

需要 `librarian` / `admin`。

**查询参数**：`status`（`borrowing/returned/overdue`）、`card_number`、分页。

---

### 3.5 逾期检查 `POST /overdue/check`

需要 `librarian` / `admin`。**触发后端扫描所有逾期记录并标记**。前端可作为"管理面板按钮"。

---

## 4. 读者模块 `/api/readers`

| 接口 | 方法路径 | 权限 | 说明 |
|---|---|---|---|
| 读者列表 | `GET /readers` | librarian+ | 支持 `keyword` + 分页 |
| 读者详情 | `GET /readers/<user_id>` | 本人或馆员+ | 含 reader_card |
| 修改读者 | `PUT /readers/<user_id>` | admin | 可改 `real_name/phone/email/is_active` |
| 借阅历史 | `GET /readers/<user_id>/borrow-history` | 本人或馆员+ | 分页 + status 筛选 |
| 借阅证列表 | `GET /readers/cards` | librarian+ | 支持 keyword |
| 借阅证续期 | `PUT /readers/cards/<card_id>/renew` | librarian+ | +365 天 |

---

## 5. 统计模块 `/api/stats`

全部需要 `librarian` / `admin`。这些是**评分里的"统计分析"模块**。

| 接口 | 返回 |
|---|---|
| `GET /stats/overview` | 馆藏总览（图书数、副本数、读者数、借阅中、逾期、今日借/还） |
| `GET /stats/borrow-trend?days=30` | 借阅趋势（按日聚合） |
| `GET /stats/popular-books?limit=10&days=30` | 热门图书排行 |
| `GET /stats/category-distribution` | 分类分布 |
| `GET /stats/reader-activity?limit=10&days=30` | 活跃读者排行 |
| `GET /stats/inventory` | 副本状态分布（available/borrowed/damaged/lost/scrapped） |

---

## 6. 错误码 & HTTP 状态

| HTTP | 含义 | 何时遇到 |
|---|---|---|
| 200/201 | 成功 | — |
| 400 | 业务校验失败 | message 里有中文原因，可直接显示给用户 |
| 401 | 未认证 / token 失效 | 前端跳登录页 |
| 403 | 权限不足 / 账号禁用 | 提示 + 不要直接跳登录 |
| 404 | 资源不存在 | — |
| 500 | 服务器异常 | 提示"系统异常"，记日志 |

**建议前端封装**：
```js
axios.interceptors.response.use(
  res => res.data,
  err => {
    const status = err.response?.status;
    if (status === 401) router.push('/login');
    return Promise.reject(err.response?.data || err);
  }
);
```

---

## 7. 字段定义速查

### User
```ts
{
  id: number,
  username: string,
  email: string,
  real_name: string | null,
  phone: string | null,
  role: 'reader' | 'librarian' | 'admin',
  is_active: boolean,
  created_at: string  // ISO
}
```

### ReaderCard
```ts
{
  id: number,
  card_number: string,         // 形如 RC12345678
  max_borrow_limit: number,    // 默认 5
  current_borrow_count: number,
  expire_date: string,         // YYYY-MM-DD
  status: 'active' | 'expired' | 'suspended'
}
```

### Book
```ts
{
  id: number, isbn: string, title: string, author: string,
  publisher: string | null, category_id: number | null,
  description: string | null, language: string,
  price: number | null, cover_url: string | null,
  publish_date: string | null,
  total_copies: number, available_copies: number
}
```

### BookCopy
```ts
{
  id: number, book_id: number, barcode: string,
  status: 'available' | 'borrowed' | 'damaged' | 'lost' | 'scrapped',
  location: string, purchase_date: string
}
```

### BorrowRecord
```ts
{
  id: number,
  reader_card_id: number,
  book_copy_id: number,
  borrow_date: string,         // ISO
  due_date: string,            // ISO
  return_date: string | null,
  status: 'borrowing' | 'returned' | 'overdue',
  renewed_times: number,
  max_renew_times: number,
  overdue_fee: number
}
```

---

## 8. MVP 优先级（开发顺序）

后端先做下面这些，前端可以**先 mock 其他接口**：

⭐ **第一批（这两天）**
- 1.1 注册 / 1.2 登录 / 1.4 me
- 2.1 图书列表 / 2.2 图书详情
- 3.1 借书 / 3.2 还书

🥈 **第二批**
- 2.6 分类树 / 2.7 副本管理
- 3.3 续借 / 3.4 借阅记录
- 4 读者模块全部
- 5 统计模块（评分要的）

🥉 **第三批**
- 2.8 预约
- 3.5 逾期检查
- 罚款相关

---

## 9. 调试 & Mock

后端起服务后，前端可以用 **Apifox / Postman** 导入这份文档测接口。

如果某接口报 500，**先看后端控制台日志**——大概率是 DB 还没建表或没启动 Redis。

后端开发同学（用户）：联系方式 / GitHub / Gitee 仓库地址 在仓库 README 里。
