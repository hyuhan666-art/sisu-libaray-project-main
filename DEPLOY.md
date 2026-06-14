# 部署指南（本地运行）

整套系统 = Flask 后端 + 纯静态前端（`static/`，单页应用）+ MySQL + Redis。
后端启动后访问 **http://localhost:5000** 即可使用，前端由 Flask 一并托管，无需单独部署。

## 1. 准备数据库（Docker，推荐）

仓库自带 `docker-compose.yml`，一条命令起 MySQL 8 + Redis，并在 MySQL 首次启动时
自动执行 `init_db.sql`（建库 `sisu-library` + 表/视图/存储过程/触发器）：

```bash
docker compose up -d
# 等待约 20~40 秒让 MySQL 初始化完成（首次）
docker compose ps      # STATUS 显示 healthy 即就绪
```

> 已有本地 MySQL/Redis 的话可跳过，自行执行 `init_db.sql` 并保证：
> - MySQL: `root` / `123456` / `localhost:3306`（或用环境变量 `DATABASE_URL` 覆盖）
> - Redis: `localhost:6379`（连不上会自动降级，不影响基础功能）

## 2. 安装 Python 依赖

```bash
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac
pip install -r requirements.txt
```

## 3. 灌入演示数据（可选，但建议）

`init_db.sql` 只建结构、不含业务数据。跑下面两个脚本创建账号和样例图书：

```bash
python seed_accounts.py        # 建 admin / librarian 账号
python seed_books.py           # 建 3 个分类 + 5 本书 + 10 个副本
```

默认账号：

| 角色   | 用户名      | 密码          |
|--------|-------------|---------------|
| 管理员 | `admin`     | `Admin@123456`|
| 馆员   | `librarian` | `Lib@123456`  |

（读者可在登录页「立即注册」自助创建。）

## 4. 启动

```bash
python run.py
```

打开浏览器访问 **http://localhost:5000**，用上面的账号登录。
健康检查：http://localhost:5000/api/health

## 关机后再次启动

```bash
docker start sisu-mysql sisu-redis     # 或 docker compose up -d
python run.py
```

## 配置项

连接串和密钥在 `config.py`，可用环境变量覆盖：

| 变量             | 默认值                                                        |
|------------------|--------------------------------------------------------------|
| `DATABASE_URL`   | `mysql+pymysql://root:123456@localhost:3306/sisu-library`     |
| `SECRET_KEY`     | 内置开发用值（生产务必覆盖）                                  |
| `JWT_SECRET_KEY` | 内置开发用值（生产务必覆盖）                                  |
| `FLASK_ENV`      | `development`                                                 |
