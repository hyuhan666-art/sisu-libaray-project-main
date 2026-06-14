"""
借/还/续 接口 —— HTTP 接入层（瘦版）
======================================
真正的业务规则全在 app/services/borrow.py 里，这里只做三件事：
  1) 从 request 里把参数挖出来
  2) 调 BorrowService（services/borrow.py）
  3) 把结果或异常包成统一 JSON

为啥这么分？答辩时讲："route 不写业务规则" —— 业务搬家、加 CLI、加定时任务
都能复用 service，route 只是 HTTP 这一种入口。
"""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.models.user import User
from app.models.borrow import BorrowRecord
from app.models.user import ReaderCard
from app.services import borrow as borrow_service
from app.services.borrow import BusinessError
from app.services.cache import LockTimeout
from app.utils.decorators import success_response, error_response, role_required

borrow_bp = Blueprint('borrow', __name__)


@borrow_bp.route('/borrow', methods=['POST'])
@role_required('admin', 'librarian')
def borrow_book():
    data = request.get_json() or {}
    try:
        record = borrow_service.borrow_book(
            card_number=data.get('card_number'),
            barcode=data.get('barcode'),
            librarian_id=get_jwt_identity(),
        )
        return success_response(record.to_dict(), '借书成功', 201)
    except BusinessError as e:
        return error_response(str(e))
    except LockTimeout:
        return error_response('操作太频繁，请稍后重试', 409)


@borrow_bp.route('/return', methods=['POST'])
@role_required('admin', 'librarian')
def return_book():
    data = request.get_json() or {}
    try:
        record = borrow_service.return_book(
            barcode=data.get('barcode'),
            librarian_id=get_jwt_identity(),
            copy_status=data.get('copy_status', 'available'),
        )
        return success_response(record.to_dict(), '还书成功')
    except BusinessError as e:
        return error_response(str(e))
    except LockTimeout:
        return error_response('操作太频繁，请稍后重试', 409)


@borrow_bp.route('/renew', methods=['POST'])
@jwt_required()
def renew_book():
    data = request.get_json() or {}
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    try:
        record = borrow_service.renew_book(
            record_id=data.get('record_id'),
            user_id=user_id,
            user_role=user.role if user else None,
        )
        return success_response(record.to_dict(), '续借成功')
    except BusinessError as e:
        # "无权续借"按 403 返回，其他业务错按 400
        code = 403 if str(e) == '无权续借' else 400
        return error_response(str(e), code)


@borrow_bp.route('/records', methods=['GET'])
@role_required('admin', 'librarian')
def list_records():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status')
    card_number = request.args.get('card_number', '').strip()

    query = BorrowRecord.query
    if status:
        query = query.filter_by(status=status)
    if card_number:
        card = ReaderCard.query.filter_by(card_number=card_number).first()
        if not card:
            return success_response({'items': [], 'total': 0})
        query = query.filter_by(read_card_id=card.id)

    pagination = (query.order_by(BorrowRecord.borrow_date.desc())
                  .paginate(page=page, per_page=per_page, error_out=False))
    return success_response({
        'items': [r.to_dict() for r in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
    })


@borrow_bp.route('/overdue/check', methods=['POST'])
@role_required('admin', 'librarian')
def check_overdue():
    """触发一次逾期扫描，把过期未还的记录标成 overdue。"""
    updated = borrow_service.mark_overdue()
    return success_response({'updated': updated}, f'已标记 {updated} 条逾期记录')
