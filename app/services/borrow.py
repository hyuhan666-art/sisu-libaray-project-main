"""
借/还/续 业务逻辑 —— 项目里最值钱的代码
==========================================
答辩 C 位的三件事都在这里：
  borrow_book()  借书：抢 Redis 锁 → 校验读者卡和副本 → 扣库存、写借阅记录、写库存审计
  return_book()  还书：抢 Redis 锁 → 算逾期 → 改副本状态、补审计、超期开罚单
  renew_book()   续借：校验次数和逾期 → 把到期日往后挪 15 天
  mark_overdue() 批量把已经过期但还没标 overdue 的记录刷一遍

为什么不去调同事的 sp_borrow_book？
  → 这块是用户主讲的部分，用 Python 写答辩能讲清楚每一步（锁、事务、审计），
    SP 在数据库里留着作为评分材料。

异常约定：
  BusinessError  业务校验不通过，比如"借阅证过期"、"已达最大借阅数"
  LockTimeout    抢不到 Redis 锁（在 cache.py 里定义）
  route 层负责把异常翻译成 HTTP 响应。
"""
from datetime import datetime, timedelta

from app import db
from app.models.user import ReaderCard
from app.models.book import BookCopy
from app.models.borrow import BorrowRecord
from app.models.inventory import InventoryRecord
from app.models.fine import Fine
from app.services.cache import lock as redis_lock  # noqa: F401 — re-exported via route

BORROW_DAYS = 30
RENEW_DAYS = 15
MAX_RENEW_TIMES = 2
OVERDUE_FEE_PER_DAY = 0.5  # 元/天


class BusinessError(Exception):
    """业务校验失败，message 会被原样返回给前端。"""
    pass


def borrow_book(card_number: str, barcode: str, librarian_id: int) -> BorrowRecord:
    """借书。返回新建的 BorrowRecord。"""
    if not card_number or not barcode:
        raise BusinessError('借阅证号和图书条形码不能为空')

    card = ReaderCard.query.filter_by(card_number=card_number).first()
    if not card:
        raise BusinessError('借阅证不存在')
    if not card.is_valid():
        raise BusinessError('借阅证已过期或被暂停')
    if card.current_borrow_count >= card.max_borrow_limit:
        raise BusinessError(f'已达最大借阅数量 {card.max_borrow_limit} 本')

    copy = BookCopy.query.filter_by(barcode=barcode).first()
    if not copy:
        raise BusinessError('图书副本不存在')

    # 抢锁：防止两个馆员同时扫同一本书条形码扣两次库存
    with redis_lock('borrow', copy.id, ttl=5):
        # 锁内 refresh：可能在等锁期间副本被别人借走了
        db.session.refresh(copy)
        if copy.status != 'available':
            raise BusinessError(f'图书不可借阅，当前状态: {copy.status}')

        record = BorrowRecord(
            read_card_id=card.id,
            book_copy_id=copy.id,
            librarian_id=librarian_id,
            due_date=datetime.utcnow() + timedelta(days=BORROW_DAYS),
            max_renew_times=MAX_RENEW_TIMES,
        )
        copy.status = 'borrowed'
        copy.book.available_copies -= 1
        card.current_borrow_count += 1
        db.session.add(record)
        db.session.flush()  # 拿 record.id 用于审计日志

        db.session.add(InventoryRecord(
            book_copy_id=copy.id,
            operator_id=librarian_id,
            operation_type='borrowed',
            notes=f'借出 (record_id={record.id})',
        ))
        db.session.commit()
        return record


def return_book(barcode: str, librarian_id: int, copy_status: str = 'available') -> BorrowRecord:
    """还书。copy_status 默认 available，也可以传 damaged 标坏本。"""
    if not barcode:
        raise BusinessError('图书条形码不能为空')

    copy = BookCopy.query.filter_by(barcode=barcode).first()
    if not copy:
        raise BusinessError('图书副本不存在')

    with redis_lock('return', copy.id, ttl=5):
        # 找这本副本最近一条还没还的记录（borrowing 或 overdue 都算）
        record = (BorrowRecord.query
                  .filter_by(book_copy_id=copy.id, status='borrowing')
                  .order_by(BorrowRecord.borrow_date.desc())
                  .first())
        if not record:
            record = (BorrowRecord.query
                      .filter_by(book_copy_id=copy.id, status='overdue')
                      .order_by(BorrowRecord.borrow_date.desc())
                      .first())
        if not record:
            raise BusinessError('未找到借阅记录')

        now = datetime.utcnow()
        record.return_date = now
        record.return_librarian_id = librarian_id
        record.status = 'returned'

        # 算逾期 → 开罚单
        if now > record.due_date:
            overdue_days = (now - record.due_date).days
            overdue_fee = round(overdue_days * OVERDUE_FEE_PER_DAY, 2)
            record.overdue_fee = overdue_fee
            db.session.add(Fine(
                user_id=record.reader_card.user_id,
                borrow_record_id=record.id,
                fine_amount=overdue_fee,
            ))

        copy.status = copy_status
        if copy_status == 'available':
            copy.book.available_copies += 1
        record.reader_card.current_borrow_count -= 1

        db.session.add(InventoryRecord(
            book_copy_id=copy.id,
            operator_id=librarian_id,
            operation_type='returned',
            notes=f'归还 (record_id={record.id})',
        ))
        db.session.commit()
        return record


def renew_book(record_id: int, user_id: int, user_role: str) -> BorrowRecord:
    """续借。读者本人或管理员/馆员都可以发起。"""
    record = BorrowRecord.query.get(record_id)
    if not record:
        raise BusinessError('借阅记录不存在')

    if record.reader_card.user_id != user_id and user_role not in ('admin', 'librarian'):
        raise BusinessError('无权续借')
    if record.status != 'borrowing':
        raise BusinessError('该借阅记录不支持续借')
    if record.renewed_times >= record.max_renew_times:
        raise BusinessError(f'已达最大续借次数 {record.max_renew_times} 次')
    if datetime.utcnow() > record.due_date:
        raise BusinessError('图书已逾期，请先归还')

    record.due_date = record.due_date + timedelta(days=RENEW_DAYS)
    record.renewed_times += 1
    db.session.commit()
    return record


def mark_overdue() -> int:
    """批量把过期但还在 borrowing 的记录刷成 overdue。返回更新条数。"""
    now = datetime.utcnow()
    records = (BorrowRecord.query
               .filter_by(status='borrowing')
               .filter(BorrowRecord.due_date < now)
               .all())
    for r in records:
        r.status = 'overdue'
    db.session.commit()
    return len(records)
