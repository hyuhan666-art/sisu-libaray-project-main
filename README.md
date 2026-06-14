# SISU Library Management System - Backend

图书管理系统后端 API，基于 Flask 框架开发。

## 技术栈

| 层面 | 技术 |
|------|------|
| 后端框架 | Flask 3.0.3 |
| ORM | Flask-SQLAlchemy |
| 认证 | Flask-JWT-Extended (JWT) |
| 数据库迁移 | Flask-Migrate |
| 跨域支持 | Flask-CORS |
| 数据库 | MySQL 8.0+ |

## 项目结构

```
sisu-libaray-project/
├── app/
│   ├── __init__.py          # Flask 应用工厂
│   ├── models/
│   │   ├── user.py          # 用户表、借阅证表
│   │   ├── book.py          # 图书、分类、副本、预约表
│   │   ├── borrow.py        # 借阅记录表
│   │   └── inventory.py     # 库存操作记录表
│   ├── routes/
│   │   ├── auth.py          # 注册/登录/权限
│   │   ├── books.py         # 图书管理、分类、预约
│   │   ├── readers.py       # 读者管理、借阅历史
│   │   ├── borrow.py        # 借书/还书/续借
│   │   └── stats.py         # 统计报表
│   └── utils/
│       └── decorators.py    # 角色权限装饰器
├── config.py                # 配置（开发/生产）
├── run.py                   # 启动入口
├── requirements.txt         # Python 依赖
└── init_db.sql              # 数据库初始化 SQL
```

## 数据库设计

### 数据表说明

| 表名 | 说明 |
|------|------|
| `users` | 用户表（读者 / 图书管理员 / 系统管理员） |
| `reader_cards` | 借阅证表（与用户一对一） |
| `categories` | 图书分类表（支持多级分类） |
| `books` | 图书信息表（ISBN、书名、作者等） |
| `book_copies` | 图书副本表（每本实体书独立条码） |
| `borrow_records` | 借阅记录表（借书/还书/续借/逾期） |
| `reservations` | 预约记录表 |
| `inventory_records` | 库存操作记录（入库/盘点/报废） |

### 用户角色与权限

| 角色 | 权限说明 |
|------|----------|
| `reader` | 注册/登录、搜索图书、借阅历史、续借、预约 |
| `librarian` | 图书管理、借书办理、还书办理、读者查询 |
| `admin` | 全部权限，含用户管理、统计报表、系统配置 |

## 快速开始

### 1. 安装依赖

```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
```

### 2. 创建数据库

```sql
CREATE DATABASE sisu_library CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. 配置数据库连接

修改 `config.py` 中的连接字符串，或设置环境变量：

```bash
export DATABASE_URL="mysql+pymysql://root:your_password@localhost:3306/sisu_library"
export SECRET_KEY="your-secret-key"
export JWT_SECRET_KEY="your-jwt-secret-key"
```

### 4. 数据库迁移

```bash
flask db init
flask db migrate -m "initial"
flask db upgrade
```

### 5. 启动服务

```bash
python run.py
```

服务地址：`http://localhost:5000`
健康检查：`http://localhost:5000/api/health`

## API 接口总览

### 认证 `/api/auth`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/register` | 读者注册（自动创建借阅证） | 公开 |
| POST | `/login` | 登录，返回 JWT Token | 公开 |
| POST | `/refresh` | 刷新 Access Token | 已登录 |
| GET | `/me` | 获取当前用户信息 | 已登录 |
| PUT | `/change-password` | 修改密码 | 已登录 |

### 图书 `/api/books`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/` | 图书列表（多条件搜索） | 公开 |
| POST | `/` | 新增图书 | 馆员/管理员 |
| GET | `/:id` | 图书详情 | 公开 |
| PUT | `/:id` | 修改图书 | 馆员/管理员 |
| DELETE | `/:id` | 删除图书 | 管理员 |
| GET | `/categories` | 分类树 | 公开 |
| POST | `/categories` | 新增分类 | 馆员/管理员 |
| GET | `/:id/copies` | 副本列表 | 已登录 |
| POST | `/:id/copies` | 添加副本（入库） | 馆员/管理员 |
| POST | `/:id/reserve` | 预约图书 | 已登录 |
| GET | `/reservations` | 预约记录 | 已登录 |
| PUT | `/reservations/:id/cancel` | 取消预约 | 已登录 |

### 借阅 `/api/borrow`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/borrow` | 借书（扫借阅证+条码） | 馆员/管理员 |
| POST | `/return` | 还书（扫条码） | 馆员/管理员 |
| POST | `/renew` | 续借 | 已登录 |
| GET | `/records` | 借阅记录列表 | 馆员/管理员 |
| POST | `/overdue/check` | 检查并标记逾期 | 馆员/管理员 |

### 读者 `/api/readers`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/` | 读者列表 | 馆员/管理员 |
| GET | `/:id` | 读者详情 | 馆员/管理员/本人 |
| PUT | `/:id` | 修改读者信息 | 管理员 |
| GET | `/:id/borrow-history` | 借阅历史 | 馆员/管理员/本人 |
| GET | `/cards` | 借阅证列表 | 馆员/管理员 |
| PUT | `/cards/:id/renew` | 借阅证续期 | 馆员/管理员 |

### 统计 `/api/stats`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/overview` | 总览数据 | 馆员/管理员 |
| GET | `/borrow-trend` | 借阅趋势（按天） | 馆员/管理员 |
| GET | `/popular-books` | 热门图书排行 | 馆员/管理员 |
| GET | `/category-distribution` | 分类图书分布 | 馆员/管理员 |
| GET | `/reader-activity` | 读者活跃度排行 | 馆员/管理员 |
| GET | `/inventory` | 库存状态统计 | 馆员/管理员 |

## 请求示例

```bash
# 登录
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123456"}'

# 搜索图书（模糊查询）
curl "http://localhost:5000/api/books?keyword=Python&available_only=true"

# 借书（需馆员 Token）
curl -X POST http://localhost:5000/api/borrow/borrow \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"card_number":"RC12345678","barcode":"BC00001"}'
```
