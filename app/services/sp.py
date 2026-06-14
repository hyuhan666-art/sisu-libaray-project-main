"""
存储过程 / 视图调用工具 —— 跟数据库同学的成果对接
====================================================
同事写了一堆 view 和 stored procedure（视图 / 存储过程）放在 init_db.sql 里，
这些是评分硬绑定的产出（数据库优化 4 + 高级查询 8 + 统计 5 + 完整性 5 = 22 分）。
这里提供两个工具，让其他业务代码用起来跟调 Python 函数一样简单：

  call_sp(name, in_args, out_count)
      → 调存储过程，返回 OUT 参数元组
      → 例：call_sp('sp_pay_fine', [fine_id, amount], out_count=2)

  query(sql, **params) → list[dict]
      → 跑一段原生 SQL（一般是 SELECT * FROM 某个视图），结果转成字典列表
      → 例：query('SELECT * FROM book_borrowing_ranking_view LIMIT :n', n=10)

为啥不直接在 route 里写 raw SQL？
  → route 不能碰数据库（CLAUDE.md §5）。统一走 service 才能集中处理事务、
    日志、报错翻译。
"""
from typing import Any, Optional

from sqlalchemy import text

from app import db


def query(sql: str, **params: Any) -> list[dict]:
    """跑原生 SQL，返回 [{'col': val, ...}, ...]。

    用法：
        rows = query('SELECT * FROM book_category_view WHERE category_id = :cid', cid=3)
    """
    result = db.session.execute(text(sql), params or None)
    # SQLAlchemy 2.x：.mappings() 把 Row 转成 dict-like
    return [dict(row) for row in result.mappings().all()]


def call_sp(sp_name: str, in_args: Optional[list] = None, out_count: int = 0) -> tuple:
    """调一个 MySQL 存储过程，返回 OUT 参数元组。

    in_args: 传给 SP 的 IN 参数列表（顺序要跟 SP 定义一致）
    out_count: SP 里 OUT 参数的个数

    工作原理：raw_connection 拿一条物理连接 → cursor.callproc 执行 SP →
    再 SELECT @_sp_xxx_0, @_sp_xxx_1 把 OUT 参数取回来。
    """
    in_args = in_args or []
    conn = db.engine.raw_connection()
    try:
        cursor = conn.cursor()
        # callproc 会在 MySQL session 里塞临时变量 @_<sp_name>_<index>
        cursor.callproc(sp_name, list(in_args) + [0] * out_count)
        if out_count > 0:
            start = len(in_args)
            placeholders = ','.join(
                f'@_{sp_name}_{i}' for i in range(start, start + out_count)
            )
            cursor.execute(f'SELECT {placeholders}')
            out = cursor.fetchone() or ()
        else:
            out = ()
        conn.commit()
        return tuple(out)
    finally:
        conn.close()
