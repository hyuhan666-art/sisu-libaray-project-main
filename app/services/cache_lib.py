"""
图书馆管理系统 - Redis 缓存模块
==================================
基于 Cache-Aside 策略，为 MySQL 提供热数据缓存、排行榜、分布式锁、
消息队列等功能。

依赖：pip install redis
用法：from redis_cache import cache
"""

import json
import random
import hashlib
import logging
from functools import wraps
from typing import Any, Optional, Union
from datetime import timedelta

import redis
from redis import ConnectionPool

logger = logging.getLogger("redis_cache")

# ============================================================================
# 常量定义
# ============================================================================

DEFAULT_TTL = 3600              # 默认过期时间：1 小时
STATIC_TTL = 7200               # 静态数据过期时间：2 小时
CONFIG_TTL = 86400              # 配置数据过期时间：24 小时
RANKING_TTL = 300               # 排行榜刷新间隔：5 分钟
LOCK_TTL = 10                   # 分布式锁超时：10 秒
SESSION_TTL = 7200              # 会话过期时间：2 小时
NULL_CACHE_TTL = 60             # 空值缓存时间：60 秒（防穿透）
RATE_LIMIT_TTL = 60             # 限流窗口：60 秒
TTL_JITTER = 600                # TTL 随机偏移范围：±600 秒


# ============================================================================
# Redis 连接管理
# ============================================================================

class RedisClient:
    """Redis 客户端单例，管理连接池"""

    _instance: Optional["RedisClient"] = None
    _pool: Optional[ConnectionPool] = None

    def __init__(self, host="127.0.0.1", port=6379, db=0,
                 password=None, max_connections=50):
        if RedisClient._pool is None:
            RedisClient._pool = ConnectionPool(
                host=host, port=port, db=db, password=password,
                max_connections=max_connections,
                decode_responses=True,       # 自动解码为字符串
                socket_connect_timeout=3,
                socket_timeout=3,
            )
        self._client = redis.Redis(connection_pool=RedisClient._pool)

    @property
    def client(self) -> redis.Redis:
        return self._client

    def ping(self) -> bool:
        try:
            return self._client.ping()
        except redis.RedisError:
            return False


# ============================================================================
# Lua 脚本（保证原子性）
# ============================================================================

# 安全释放分布式锁：只有持有锁的客户端才能释放
UNLOCK_SCRIPT = """
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end
"""

# 固定窗口限流：当前窗口内计数 +1，超过 limit 则拒绝
RATE_LIMIT_SCRIPT = """
local current = redis.call("INCR", KEYS[1])
if current == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
end
if current > tonumber(ARGV[2]) then
    return 0
end
return 1
"""


# ============================================================================
# 缓存装饰器
# ============================================================================

def cached(entity: str, ttl: int = DEFAULT_TTL):
    """
    自动缓存函数返回值的装饰器。

    用法:
        @cached("book", ttl=3600)
        def get_book_by_id(book_id):
            return db.query("SELECT * FROM book WHERE id = ?", book_id)

    原理:
        1. 先查 Redis 缓存，命中则直接返回
        2. 未命中则执行原函数，将结果写入 Redis 后返回
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 用参数构建缓存 key
            key_parts = [str(a) for a in args]
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            cache_key = f"cache:{entity}:{':'.join(key_parts)}"

            # 1. 查缓存
            try:
                cached_data = cache._client.client.get(cache_key)
                if cached_data is not None:
                    if cached_data == "__NULL__":
                        return None
                    return json.loads(cached_data)
            except redis.RedisError:
                pass  # Redis 出错则降级查数据库

            # 2. 查数据库
            result = func(*args, **kwargs)

            # 3. 回填缓存
            try:
                if result is not None:
                    cache._client.client.setex(
                        cache_key,
                        _with_jitter(ttl),
                        json.dumps(result, default=str)
                    )
                else:
                    # 空值缓存，防穿透
                    cache._client.client.setex(
                        cache_key, NULL_CACHE_TTL, "__NULL__"
                    )
            except redis.RedisError:
                pass

            return result
        return wrapper
    return decorator


# ============================================================================
# 核心缓存类
# ============================================================================

class LibraryCache:
    """图书馆系统缓存操作类，封装所有 Redis 操作"""

    def __init__(self, host="127.0.0.1", port=6379, db=0):
        self._client = RedisClient(host, port, db)

    # ------------------------------------------------------------------
    # 基础操作：Cache-Aside 读
    # ------------------------------------------------------------------

    def get_hash(self, entity: str, entity_id: int) -> Optional[dict]:
        """
        从缓存读取 Hash 对象。
        命中返回 dict，未命中返回 None。
        """
        try:
            key = f"cache:{entity}:{entity_id}"
            data = self._client.client.hgetall(key)
            return data if data else None
        except redis.RedisError as e:
            logger.warning(f"Redis 读取失败 {key}: {e}")
            return None

    def get_hash_field(self, entity: str, entity_id: int,
                       field: str) -> Optional[str]:
        """从缓存读取 Hash 的单个字段"""
        try:
            key = f"cache:{entity}:{entity_id}"
            return self._client.client.hget(key, field)
        except redis.RedisError as e:
            logger.warning(f"Redis 读取失败 {key}.{field}: {e}")
            return None

    def set_hash(self, entity: str, entity_id: int,
                 data: dict, ttl: int = DEFAULT_TTL):
        """写入 Hash 缓存"""
        try:
            key = f"cache:{entity}:{entity_id}"
            self._client.client.hset(key, mapping=data)
            self._client.client.expire(key, _with_jitter(ttl))
        except redis.RedisError as e:
            logger.warning(f"Redis 写入失败 {key}: {e}")

    # ------------------------------------------------------------------
    # 基础操作：Cache-Aside 写失效
    # ------------------------------------------------------------------

    def invalidate(self, entity: str, entity_id: int):
        """
        删除缓存（写操作后调用）。
        原则：只删不更新，下次读时自动从 MySQL 回填。
        """
        try:
            key = f"cache:{entity}:{entity_id}"
            self._client.client.delete(key)
        except redis.RedisError as e:
            logger.warning(f"Redis 删除失败 {key}: {e}")

    def invalidate_many(self, *keys: str):
        """批量删除缓存"""
        try:
            if keys:
                self._client.client.delete(*keys)
        except redis.RedisError as e:
            logger.warning(f"Redis 批量删除失败: {e}")

    # ------------------------------------------------------------------
    # 系统配置操作（特殊的 Hash：key 是固定的）
    # ------------------------------------------------------------------

    def get_config(self, setting_key: str) -> Optional[str]:
        """获取单个系统配置"""
        try:
            return self._client.client.hget("cache:system_config", setting_key)
        except redis.RedisError:
            return None

    def get_all_configs(self) -> dict:
        """获取全部系统配置"""
        try:
            return self._client.client.hgetall("cache:system_config")
        except redis.RedisError:
            return {}

    def set_config(self, setting_key: str, value: str):
        """更新单个系统配置"""
        try:
            self._client.client.hset("cache:system_config", setting_key, value)
        except redis.RedisError as e:
            logger.warning(f"更新配置失败: {e}")

    # ------------------------------------------------------------------
    # 分布式锁
    # ------------------------------------------------------------------

    def acquire_lock(self, operation: str, resource_id: int,
                     ttl: int = LOCK_TTL) -> Optional[str]:
        """
        获取分布式锁。

        参数:
            operation: 操作类型，如 "borrow" / "return"
            resource_id: 资源ID，如副本ID
            ttl: 锁超时时间（秒）

        返回:
            成功返回 lock_value（用于解锁），失败返回 None
        """
        lock_key = f"lock:{operation}:{resource_id}"
        lock_value = _generate_lock_value()
        try:
            ok = self._client.client.set(lock_key, lock_value, nx=True, ex=ttl)
            return lock_value if ok else None
        except redis.RedisError as e:
            logger.warning(f"获取锁失败 {lock_key}: {e}")
            return None

    def release_lock(self, operation: str, resource_id: int,
                     lock_value: str) -> bool:
        """
        释放分布式锁（原子操作）。
        只释放自己持有的锁，不会误删他人的锁。
        """
        lock_key = f"lock:{operation}:{resource_id}"
        try:
            unlock = self._client.client.register_script(UNLOCK_SCRIPT)
            result = unlock(keys=[lock_key], args=[lock_value])
            return result == 1
        except redis.RedisError as e:
            logger.warning(f"释放锁失败 {lock_key}: {e}")
            return False

    # ------------------------------------------------------------------
    # 计数器
    # ------------------------------------------------------------------

    def incr_counter(self, counter_name: str) -> int:
        """计数器 +1，返回新值"""
        try:
            return self._client.client.incr(counter_name)
        except redis.RedisError:
            return -1

    def decr_counter(self, counter_name: str) -> int:
        """计数器 -1，返回新值"""
        try:
            return self._client.client.decr(counter_name)
        except redis.RedisError:
            return -1

    def get_counter(self, counter_name: str) -> int:
        """获取计数器当前值"""
        try:
            val = self._client.client.get(counter_name)
            return int(val) if val else 0
        except (redis.RedisError, ValueError):
            return 0

    # ------------------------------------------------------------------
    # 排行榜（Sorted Set）
    # ------------------------------------------------------------------

    def update_ranking(self, ranking_name: str, member: str,
                       score: float):
        """更新排行榜中的分数"""
        try:
            self._client.client.zadd(
                f"ranking:{ranking_name}", {member: score}
            )
        except redis.RedisError as e:
            logger.warning(f"更新排行榜失败: {e}")

    def get_top_n(self, ranking_name: str, n: int = 10,
                  with_scores: bool = True) -> list:
        """获取排行榜 Top N（降序）"""
        try:
            key = f"ranking:{ranking_name}"
            result = self._client.client.zrevrange(
                key, 0, n - 1, withscores=with_scores
            )
            return result
        except redis.RedisError:
            return []

    def get_rank(self, ranking_name: str, member: str) -> Optional[int]:
        """获取某个成员的排名（从0开始，0=第一名）"""
        try:
            rank = self._client.client.zrevrank(
                f"ranking:{ranking_name}", member
            )
            return rank
        except redis.RedisError:
            return None

    # ------------------------------------------------------------------
    # 集合索引（Set）
    # ------------------------------------------------------------------

    def add_to_set(self, set_key: str, *members: str):
        """向集合添加成员"""
        try:
            self._client.client.sadd(set_key, *members)
        except redis.RedisError as e:
            logger.warning(f"SADD 失败: {e}")

    def remove_from_set(self, set_key: str, *members: str):
        """从集合移除成员"""
        try:
            self._client.client.srem(set_key, *members)
        except redis.RedisError as e:
            logger.warning(f"SREM 失败: {e}")

    def get_set_members(self, set_key: str) -> set:
        """获取集合所有成员"""
        try:
            return self._client.client.smembers(set_key)
        except redis.RedisError:
            return set()

    def get_set_size(self, set_key: str) -> int:
        """获取集合大小"""
        try:
            return self._client.client.scard(set_key)
        except redis.RedisError:
            return 0

    # ------------------------------------------------------------------
    # 用户会话
    # ------------------------------------------------------------------

    def create_session(self, user_id: int,
                       ttl: int = SESSION_TTL) -> str:
        """创建用户会话，返回 token"""
        token = _generate_token(user_id)
        try:
            self._client.client.setex(
                f"session:{token}", ttl, str(user_id)
            )
        except redis.RedisError as e:
            logger.warning(f"创建会话失败: {e}")
        return token

    def validate_session(self, token: str) -> Optional[int]:
        """验证会话，返回 user_id 或 None"""
        try:
            uid = self._client.client.get(f"session:{token}")
            return int(uid) if uid else None
        except (redis.RedisError, ValueError):
            return None

    def destroy_session(self, token: str):
        """销毁会话（登出）"""
        try:
            self._client.client.delete(f"session:{token}")
        except redis.RedisError:
            pass

    # ------------------------------------------------------------------
    # API 限流
    # ------------------------------------------------------------------

    def check_rate_limit(self, api_name: str, user_id: int,
                         max_requests: int = 60) -> bool:
        """
        检查 API 限流。
        返回 True 表示允许通过，False 表示被限流。
        """
        now = _current_minute()
        key = f"ratelimit:{api_name}:{user_id}:{now}"
        try:
            rate_limit = self._client.client.register_script(RATE_LIMIT_SCRIPT)
            result = rate_limit(keys=[key], args=[RATE_LIMIT_TTL, max_requests])
            return result == 1
        except redis.RedisError:
            return True  # Redis 故障时放行，保证可用性

    # ------------------------------------------------------------------
    # 消息队列
    # ------------------------------------------------------------------

    def push_to_queue(self, queue_name: str, message: dict):
        """向消息队列推送消息"""
        try:
            self._client.client.lpush(
                f"queue:{queue_name}", json.dumps(message, default=str)
            )
        except redis.RedisError as e:
            logger.warning(f"队列推送失败: {e}")

    def pop_from_queue(self, queue_name: str,
                       timeout: int = 5) -> Optional[dict]:
        """从消息队列阻塞取出消息"""
        try:
            result = self._client.client.brpop(
                f"queue:{queue_name}", timeout
            )
            if result:
                return json.loads(result[1])
        except (redis.RedisError, json.JSONDecodeError):
            pass
        return None


# ============================================================================
# 业务级缓存操作
# ============================================================================

class LibraryBusinessCache(LibraryCache):
    """
    图书馆业务缓存层。
    在基础缓存操作之上，封装借书、还书、续借等业务流程中的缓存处理。
    """

    # ------------------------------------------------------------------
    # 借书：缓存失效 + 计数器更新
    # ------------------------------------------------------------------

    def on_borrow_success(self, user_id: int, card_id: int,
                          book_id: int, copy_id: int):
        """借书成功后调用：批量失效相关缓存"""
        self.invalidate_many(
            f"cache:book_copy:{copy_id}",
            f"cache:book:{book_id}",
            f"cache:reader_card:{card_id}",
            f"cache:borrow:{book_id}",           # 后续新增的 borrow 记录
            f"set:user:{user_id}:active_borrows",
        )
        # 更新计数器
        self.incr_counter(f"counter:user:{user_id}:borrow_count")
        self.incr_counter(f"counter:book:{book_id}:active_borrows")
        # 更新排行榜
        self.update_ranking("book:borrow_count", str(book_id),
                            self.get_borrow_count_from_db(book_id))

    # ------------------------------------------------------------------
    # 还书：缓存失效 + 预约通知
    # ------------------------------------------------------------------

    def on_return_success(self, user_id: int, card_id: int,
                          book_id: int, copy_id: int,
                          borrow_id: int):
        """还书成功后调用"""
        self.invalidate_many(
            f"cache:book_copy:{copy_id}",
            f"cache:book:{book_id}",
            f"cache:borrow:{borrow_id}",
            f"cache:reader_card:{card_id}",
            f"set:user:{user_id}:active_borrows",
        )
        self.decr_counter(f"counter:user:{user_id}:borrow_count")
        self.decr_counter(f"counter:book:{book_id}:active_borrows")

        # 检查是否有活跃预约，有则推送通知
        reservation_count = self.get_set_size(
            f"set:book:{book_id}:active_reservations"
        )
        if reservation_count > 0:
            self.push_to_queue("reservation_notify", {
                "book_id": book_id,
                "copy_id": copy_id,
                "action": "book_available"
            })

    # ------------------------------------------------------------------
    # 续借：缓存失效
    # ------------------------------------------------------------------

    def on_renew_success(self, borrow_id: int):
        """续借成功后调用"""
        self.invalidate("borrow", borrow_id)
        # 续借排行榜热度 +1（可选）
        # self.update_ranking("book:hot_current", str(book_id), new_score)

    # ------------------------------------------------------------------
    # 预约：缓存更新
    # ------------------------------------------------------------------

    def on_reservation_created(self, reservation_id: int, user_id: int,
                               book_id: int):
        """创建预约成功后调用"""
        self.invalidate_many(
            f"cache:reservation:{reservation_id}",
            f"set:book:{book_id}:active_reservations",
        )

    def on_reservation_cancelled(self, reservation_id: int, book_id: int):
        """取消预约后调用"""
        self.invalidate(f"cache:reservation:{reservation_id}")
        self.remove_from_set(
            f"set:book:{book_id}:active_reservations", str(reservation_id)
        )

    # ------------------------------------------------------------------
    # 工具方法
    # ------------------------------------------------------------------

    def get_borrow_count_from_db(self, book_id: int) -> float:
        """
        从数据库获取某书的借阅总次数，用于回填排行榜。
        注：此处为占位，实际应调用你的 MySQL 查询。
        """
        # TODO: 替换为实际的数据库查询
        # from db import query
        # return query("SELECT COUNT(*) FROM borrowrecord ... WHERE book_id = ?", book_id)
        return 0.0


# ============================================================================
# 工具函数
# ============================================================================

def _with_jitter(base_ttl: int) -> int:
    """TTL 添加随机偏移，防止缓存雪崩"""
    jitter = random.randint(0, TTL_JITTER)
    return base_ttl + jitter


def _generate_lock_value() -> str:
    """生成分布式锁的唯一标识"""
    return hashlib.md5(str(random.getrandbits(128)).encode()).hexdigest()


def _generate_token(user_id: int) -> str:
    """生成用户会话 Token"""
    raw = f"{user_id}:{random.getrandbits(256)}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _current_minute() -> str:
    """返回当前分钟标识（用于限流窗口）"""
    from datetime import datetime
    return datetime.now().strftime("%Y%m%d%H%M")


# ============================================================================
# 全局单例
# ============================================================================

cache = LibraryBusinessCache(host="127.0.0.1", port=6379, db=0)


# ============================================================================
# 使用示例（可直接运行测试）
# ============================================================================

if __name__ == "__main__":
    # 检查 Redis 连接
    if cache.ping():
        print("Redis 连接成功！\n")
    else:
        print("Redis 未连接，请先启动 Redis 服务。\n")
        print("Windows 启动命令：redis-server")
        print("或按 Win+R，输入 services.msc，找到 Redis 服务并启动。\n")
        exit(1)

    # ----- 示例 1：系统配置 -----
    borrow_days = cache.get_config("borrow_days")
    print(f"借阅天数配置: {borrow_days} 天")

    # ----- 示例 2：缓存读取 -----
    user = cache.get_hash("user", 1)
    print(f"用户1缓存: {user}")

    # ----- 示例 3：排行榜 -----
    top_books = cache.get_top_n("book:borrow_count", 5)
    print(f"借阅排行 Top 5: {top_books}")

    # ----- 示例 4：计数器 -----
    total_users = cache.get_counter("counter:stats:total_users")
    print(f"系统总用户数: {total_users}")

    # ----- 示例 5：分布式锁 -----
    lock_val = cache.acquire_lock("borrow", 5)
    if lock_val:
        print(f"获取锁成功: {lock_val[:8]}...")
        cache.release_lock("borrow", 5, lock_val)
        print("释放锁成功")

    # ----- 示例 6：会话 -----
    token = cache.create_session(1)
    print(f"创建会话: {token[:16]}...")
    uid = cache.validate_session(token)
    print(f"验证会话: user_id={uid}")

    # ----- 示例 7：限流 -----
    for i in range(5):
        ok = cache.check_rate_limit("test_api", 1, max_requests=3)
        print(f"限流测试 {i+1}: {'通过' if ok else '被拦截'}")

    # ----- 示例 8：消息队列 -----
    cache.push_to_queue("overdue_notify", {
        "user_id": 1,
        "real_name": "张三",
        "overdue_count": 2,
        "overdue_fee": 15.00
    })
    msg = cache.pop_from_queue("overdue_notify", timeout=1)
    print(f"队列消息: {msg}")

    print("\n所有示例执行完毕！")
