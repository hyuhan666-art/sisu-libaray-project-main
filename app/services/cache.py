"""
业务层缓存接口 —— 给业务代码用的"傻瓜版" Redis
=================================================
同事的 cache_lib.py 功能多但调用麻烦，这里包一层简单的：
  1) lock(key)        借书前抢一把锁，防止两个人同时扣库存
  2) get_or_set(key)  查图书时先看 Redis 有没有，没有再查 MySQL 顺手存进 Redis
  3) invalidate(key)  改/删图书后把缓存清掉，下次查会回 MySQL 拿新数据
"""

import json
import hashlib
import logging
from typing import Any, Callable, Optional
from app.services.cache_lib import LibraryBusinessCache

logger = logging.getLogger(__name__)

_cache_instance: Optional[LibraryBusinessCache] = None


class LockTimeout(Exception):
    """获取分布式锁失败"""
    pass


def get_cache() -> LibraryBusinessCache:
    """单例：第一次调用时连 Redis，之后复用"""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = LibraryBusinessCache()
    return _cache_instance


class lock:
    """
    分布式锁的 context manager 用法：

        with lock('borrow', copy_id, ttl=5):
            # 临界区代码
            ...

    拿不到锁会抛 LockTimeout。
    """

    def __init__(self, operation: str, resource_id, ttl: int = 5):
        self.operation = operation
        self.resource_id = resource_id
        self.ttl = ttl
        self.value: Optional[str] = None
        self.cache = get_cache()

    def __enter__(self):
        self.value = self.cache.acquire_lock(self.operation, self.resource_id, self.ttl)
        if not self.value:
            raise LockTimeout(f"操作太频繁，请稍后重试 ({self.operation}:{self.resource_id})")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.value:
            self.cache.release_lock(self.operation, self.resource_id, self.value)


def get_or_set(key: str, ttl: int, fetcher: Callable[[], Any]) -> Any:
    """
    Cache-Aside 读取：
        1. 先查 Redis
        2. 命中 → 直接返回
        3. 未命中 → 调 fetcher() 取真实数据 → 回写 Redis → 返回

    示例：
        data = get_or_set(
            key=f"books:list:{md5(qs)}",
            ttl=60,
            fetcher=lambda: query_books_from_db(...)
        )
    """
    cache = get_cache()
    try:
        cached = cache._client.client.get(key)
        if cached is not None:
            logger.debug(f"cache HIT  {key}")
            return json.loads(cached)
    except Exception as e:
        logger.warning(f"cache read error {key}: {e}")

    logger.debug(f"cache MISS {key}")
    value = fetcher()
    try:
        cache._client.client.setex(key, ttl, json.dumps(value, default=str))
    except Exception as e:
        logger.warning(f"cache write error {key}: {e}")
    return value


def invalidate(*keys: str):
    """删除一个或多个缓存 key"""
    cache = get_cache()
    try:
        cache._client.client.delete(*keys)
    except Exception as e:
        logger.warning(f"cache invalidate error {keys}: {e}")


def make_key(prefix: str, *parts) -> str:
    """生成缓存 key。把参数拼起来 md5，便于 querystring 当 key 的场景"""
    raw = ":".join(str(p) for p in parts)
    digest = hashlib.md5(raw.encode()).hexdigest()[:16]
    return f"{prefix}:{digest}"
