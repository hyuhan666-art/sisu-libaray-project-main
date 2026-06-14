"""
读者管理接口 —— 管"人"那一摊
==============================
管理员用：看读者列表、改读者信息、停/启用账号、看某个读者的借阅历史。
读者卡（reader_card）= 借书凭证，跟 user 一对一。
"""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User, ReaderCard
from app.models.borrow import BorrowRecord
from app.utils.decorators import success_response, error_response, role_required
from datetime import date, timedelta

readers_bp = Blueprint('readers', __name__)

@readers_bp.route('', methods=['GET'])
@role_required('admin', 'librarian')
def list_readers():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    keyword = request.args.get('keyword', '').strip()

    query = User.query.filter_by(role='reader')
    if keyword:
        query = query.filter(
            db.or_(User.username.ilike(f'%{keyword}%'), User.real_name.ilike(f'%{keyword}%'), User.email.ilike(f'%{keyword}%'))
        )
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    items = []
    for u in pagination.items:
        d = u.to_dict()
        if u.reader_card:
            d['reader_card'] = u.reader_card.to_dict()
        items.append(d)
    return success_response({'items': items, 'total': pagination.total, 'pages': pagination.pages})

@readers_bp.route('/<int:user_id>', methods=['GET'])
@jwt_required()
def get_reader(user_id):
    requester_id = get_jwt_identity()
    requester = User.query.get(requester_id)
    if requester_id != user_id and requester.role not in ('admin', 'librarian'):
        return error_response('无权查看', 403)
    user = User.query.get_or_404(user_id)
    data = user.to_dict()
    if user.reader_card:
        data['reader_card'] = user.reader_card.to_dict()
    return success_response(data)

@readers_bp.route('/<int:user_id>', methods=['PUT'])
@role_required('admin')
def update_reader(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    for f in ['real_name', 'phone', 'email', 'is_active']:
        if f in data:
            setattr(user, f, data[f])
    db.session.commit()
    return success_response(user.to_dict())

@readers_bp.route('/<int:user_id>/borrow-history', methods=['GET'])
@jwt_required()
def borrow_history(user_id):
    requester_id = get_jwt_identity()
    requester = User.query.get(requester_id)
    if requester_id != user_id and requester.role not in ('admin', 'librarian'):
        return error_response('无权查看', 403)
    user = User.query.get_or_404(user_id)
    if not user.reader_card:
        return success_response([])
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status')
    query = BorrowRecord.query.filter_by(read_card_id=user.reader_card.id)
    if status:
        query = query.filter_by(status=status)
    pagination = query.order_by(BorrowRecord.borrow_date.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return success_response({
        'items': [r.to_dict() for r in pagination.items],
        'total': pagination.total, 'pages': pagination.pages
    })

@readers_bp.route('/cards', methods=['GET'])
@role_required('admin', 'librarian')
def list_cards():
    keyword = request.args.get('keyword', '').strip()
    query = ReaderCard.query
    if keyword:
        query = query.filter(ReaderCard.card_number.ilike(f'%{keyword}%'))
    cards = query.all()
    return success_response([c.to_dict() for c in cards])

@readers_bp.route('/cards/<int:card_id>/renew', methods=['PUT'])
@role_required('admin', 'librarian')
def renew_card(card_id):
    card = ReaderCard.query.get_or_404(card_id)
    card.expire_date = card.expire_date + timedelta(days=365)
    card.status = 'active'
    db.session.commit()
    return success_response(card.to_dict(), '借阅证续期成功')
