"""
services 包 —— 业务逻辑层
==========================
真正"干活"的地方。route 把请求转成参数交给 service，service 操作数据库/Redis
后把结果返回。service 不知道 HTTP 长什么样，也不用管返回 JSON。

  cache_lib.py  同事写的 Redis 工具包（不改）
  cache.py      在 cache_lib 上包一层方便业务调用：拿锁、读缓存
  borrow.py     借/还书的核心规则（待建，从 routes/borrow.py 里搬过来）
  sp.py         统一封装"调同事的存储过程/视图"的工具（待建）
"""
