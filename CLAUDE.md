# sisu-libaray-project · 项目级 Claude 指令

> 给未来每一次会话的 Claude 的"开门必读"。打开这个项目前先读完。

---

## 1. 项目背景（最高优先级）

- 这是 **C 题：图书管理系统** 比赛/课程命题项目，**100 分制评分**，会答辩
- 用户是工程小白，**学习项目**：要懂工程、能讲明白每一步
- 团队：用户（后端） + 一位负责数据库的同学 + 前端同学
- 每次动手前用一两句中文说明"我正在做什么、对应业务的哪个环节"

> ⚠️ 不要因为"任务看起来简单"就跳过解释直接埋头写。

---

## 2. 评分细则（指导技术选择）

| 板块 | 分数 | 谁负责 |
|---|---|---|
| 数据库设计（表结构 8 + 关系 8 + 约束 5 + 优化 4） | 25 | 同事的 SQL |
| 基础功能（登录 8 + 图书管理 12 + 借阅 10 + 完整性 5） | 35 | 借/还书 = 用户的 Python；其余混合 |
| 高级功能（高级查询 8 + 读者服务 7 + 统计 5） | 20 | 查询/统计 = 同事的视图/SP |
| 工程能力（全栈整合 8 + 部署 6 + 商业价值 6） | 20 | 用户 + 前端协作 |

**关键判断**：数据库优化分（4）+ 高级查询（8）+ 统计（5）+ 完整性（5）= **22 分** 跟同事 SQL 的视图/SP/触发器强绑定，**必须保留**。

---

## 3. 架构决策：混合方案 C（已锁定）

| 决策点 | 选择 | 理由 |
|---|---|---|
| 后端框架 | Flask + SQLAlchemy | 已有骨架 |
| **借/还书业务** | **Python 写**（routes + services） | 用户主讲、答辩能讲清楚、可加 Redis 锁 |
| **高级查询/统计** | **调同事的视图/SP** | 评分 + 同事产出不浪费 |
| **数据完整性** | **同事的触发器自动维护** | 评分 + 简化 Python 代码 |
| 表结构 | 同事 `table.sql` 为准 | 视图/SP/触发器都写死了表名 |
| 表命名 | 跟同事走（`user / borrowrecord / inventoryrecord`） | 不规范但不能改 |
| 缓存/锁 | Redis（同事的 `cache_lib.py`） | 借书加锁、查询缓存 |
| 接口风格 | RESTful JSON `{code, message, data}` | 骨架已确立 |

### 同事产出的处理

- **`legacy/db_v1/table.sql`** → 改名搬回项目根做 `init_db.sql`，是建库脚本兼事实之源
- **`app/services/cache_lib.py`** → 同事的 redis 模块，业务代码包一层后调用

---

## 4. 表名映射（事实之源 = 同事 SQL）

骨架现有的 model 命名要**改名对齐 SQL**：

| 骨架现在 | 改成 |
|---|---|
| `users` | `user` |
| `reader_cards` | `reader_card` |
| `borrow_records` | `borrowrecord` |
| `book_copies` | `book_copies` ✓ |
| `inventory_records` | `inventoryrecord` |
| `books` | `book` |
| `categories` | `category` |
| `reservations` | `reservation` |
| `fines` | `fine` |
| `system_configs` | `system_config` |

> 看到命名不一致觉得"该统一"——**忍住**。改了视图/SP/触发器就废了。

---

## 5. 业务层组织

```
app/
├── models/          ← 表的镜像，命名对齐 SQL
├── routes/          ← HTTP 接入：解析参数、调 service、组装响应
├── services/
│   ├── cache_lib.py ← 同事的 redis（不动）
│   ├── cache.py     ← 包装 cache_lib：get_or_set / invalidate
│   ├── borrow.py    ← BorrowService：借/还/续 业务逻辑
│   └── sp.py        ← 统一封装调用同事 SP 的工具
└── utils/
```

**核心原则**：
- routes 不写业务规则，只调 service
- service 不知道 HTTP
- 借/还书走 Python `BorrowService`
- 复杂查询/统计走 `sp.py` 调用同事的视图/SP

---

## 6. Redis 使用范围

| 用途 | 用在哪 | 备注 |
|---|---|---|
| 分布式锁 | 借书前锁 `book:{barcode}`（TTL 5s） | 防并发双扣 |
| Cache-Aside | 查图书接口（TTL 60s） | key 用 `books:list:{md5(querystring)}` |

MVP 不引入：限流、排行榜、消息队列、Session（JWT 已够）。

---

## 7. 错误处理规范

| 异常类 | HTTP | 何时 |
|---|---|---|
| `BusinessError` | 400 | 业务校验失败，message 直接展示给用户 |
| `JWTError` | 401 | Token 失效 |
| `PermissionError` | 403 | 角色不够 / 账号禁用 |
| `NotFound` | 404 | 资源不存在 |
| `LockTimeout` | 409 | 拿不到分布式锁 |
| 未捕获 | 500 | 记日志，对外只说"服务器错误" |

统一响应格式：`{ "code": 0, "message": "...", "data": {...} }`

---

## 8. SP / 视图调用范式

调同事的存储过程必须走 `app/services/sp.py`：

```python
def call_sp(sp_name, in_args, out_count):
    conn = db.engine.raw_connection()
    try:
        cursor = conn.cursor()
        cursor.callproc(sp_name, in_args + [0]*out_count)
        cursor.execute(f"SELECT " + ",".join(f"@_{sp_name}_{i}" for i in range(len(in_args), len(in_args)+out_count)))
        out = cursor.fetchone()
        conn.commit()
        return out
    finally:
        conn.close()
```

调视图直接 `SELECT * FROM v_xxx`，可用 SQLAlchemy 原生 SQL。

---

## 9. 项目结构

```
sisu-libaray-project/
├── CLAUDE.md            ← 本文件
├── README.md
├── init_db.sql          ← 同事的 SQL（事实之源，建库脚本）
├── config.py
├── run.py
├── requirements.txt
├── migrations/          ← Flask-Migrate（如保留 ORM 迁移）
├── docs/
│   ├── frontend-api.md  ← 给前端的接口文档
│   └── specs/           ← 设计文档（如有）
└── app/
    ├── __init__.py
    ├── models/
    ├── routes/
    │   ├── auth.py
    │   ├── books.py
    │   ├── borrow.py
    │   ├── readers.py
    │   └── stats.py
    ├── services/
    │   ├── cache_lib.py / cache.py
    │   ├── borrow.py
    │   └── sp.py
    └── utils/
```

---

## 10. 沟通风格（用户偏好）

- **结论先于细节**：先说"对应什么业务/功能"，再讲技术
- **英文术语正常用**：用户在主动学英文，不需要每次中文对照
- **用表格做映射**：用户是映射型学习者，表格优于段落
- **读数必带置信度**：说"X 是 Y"时，标明依据
- **质疑用户输入**：用户说的不一定对/全，该追问就追问
- **不写赘述总结**：用户能看 diff，结尾别堆"我刚才做了 ABC"
- **快速执行模式**：用户明确要快时，跳过反复确认，直接做、做完汇报关键点

---

## 11. 禁止事项

- ❌ 改同事 SQL 里的表名/字段名"为了规范"
- ❌ 把同事的视图/SP 用 Python 重写"为了好读"
- ❌ 在 route 里直接操作 model（必须走 service）
- ❌ 跳过分布式锁"测试时图方便"
- ❌ 借/还书去调同事的 `sp_borrow_book / sp_return_book`（这两个我们用 Python 实现，保留 SP 在数据库里作为评分材料）
- ❌ 跳过解释直接写代码"因为这一段很简单"

---

## 12. 环境

- OS: Windows 11 (bash via WSL)
- Python: D:\python3.11\python.exe
- 项目目录: C:\Users\L\Projects\sisu-libaray-project\
- 数据库: MySQL（连接信息见 `config.py`）
- Redis: 本地默认端口 6379

---

## 13. 当前阶段（2026-05-29）

**前端文档已交付** → `docs/frontend-api.md`

**待办**（按依赖顺序）：
- [ ] 把 `legacy/db_v1/table.sql` 改名搬到根目录 `init_db.sql`，建库
- [ ] models 改名对齐 SQL（user/borrowrecord/...）
- [ ] 写 `services/cache.py`、`services/sp.py`、`services/borrow.py`
- [ ] 重构 `routes/borrow.py`（走 service + Redis 锁）
- [ ] 重构 `routes/books.py`（加缓存）
- [ ] 重构 `routes/stats.py`（改调同事视图）
- [ ] E2E 测试：登录 → 借 → 还 → 查 → 统计
- [ ] 推 GitHub + Gitee
- [ ] 答辩讲稿
