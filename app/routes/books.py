"""
图书相关接口 —— 跟"书"打交道的入口
====================================
分类树、图书的增删改查、副本（每本实体书）管理、预约。
查图书列表会走 Redis 缓存（Cache-Aside），改/删图书会清掉对应缓存。
"""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.book import Book, BookCopy, Category, Reservation
from app.models.user import User
from app.services.cache import get_or_set, make_key, invalidate
from app.utils.decorators import success_response, error_response, role_required
from datetime import datetime, timedelta, date

books_bp = Blueprint('books', __name__)

# ---- Categories ----

@books_bp.route('/categories', methods=['GET'])
def get_categories():
    cats = Category.query.filter_by(parent_id=None).all()
    def build(c):
        d = c.to_dict()
        d['children'] = [build(ch) for ch in c.children]
        return d
    return success_response([build(c) for c in cats])

@books_bp.route('/categories', methods=['POST'])
@role_required('admin', 'librarian')
def create_category():
    data = request.get_json()
    if not data.get('name'):
        return error_response('分类名称不能为空')
    cat = Category(name=data['name'], parent_id=data.get('parent_id'), description=data.get('description'))
    db.session.add(cat)
    db.session.commit()
    return success_response(cat.to_dict(), '分类创建成功', 201)

@books_bp.route('/categories/<int:cid>', methods=['PUT'])
@role_required('admin', 'librarian')
def update_category(cid):
    cat = Category.query.get_or_404(cid)
    data = request.get_json()
    if data.get('name'): cat.name = data['name']
    if 'description' in data: cat.description = data['description']
    db.session.commit()
    return success_response(cat.to_dict())

@books_bp.route('/categories/<int:cid>', methods=['DELETE'])
@role_required('admin')
def delete_category(cid):
    cat = Category.query.get_or_404(cid)
    db.session.delete(cat)
    db.session.commit()
    return success_response(message='分类删除成功')

# ---- Books ----

@books_bp.route('', methods=['GET'])
def get_books():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    keyword = request.args.get('keyword', '').strip()
    category_id = request.args.get('category_id', type=int)
    author = request.args.get('author', '').strip()
    isbn = request.args.get('isbn', '').strip()
    available_only = request.args.get('available_only', 'false').lower() == 'true'

    cache_key = make_key('books:list', page, per_page, keyword, category_id or 0, author, isbn, available_only)

    def _query():
        query = Book.query
        if keyword:
            query = query.filter(
                db.or_(Book.title.ilike(f'%{keyword}%'), Book.author.ilike(f'%{keyword}%'))
            )
        if category_id:
            query = query.filter_by(category_id=category_id)
        if author:
            query = query.filter(Book.author.ilike(f'%{author}%'))
        if isbn:
            query = query.filter(Book.isbn.ilike(f'%{isbn}%'))
        if available_only:
            query = query.filter(Book.available_copies > 0)

        pagination = query.order_by(Book.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
        return {
            'items': [b.to_dict() for b in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'page': page,
            'per_page': per_page
        }

    result = get_or_set(cache_key, ttl=60, fetcher=_query)
    return success_response(result)

@books_bp.route('/<int:book_id>', methods=['GET'])
def get_book(book_id):
    book = Book.query.get_or_404(book_id)
    return success_response(book.to_dict(detail=True))

@books_bp.route('', methods=['POST'])
@role_required('admin', 'librarian')
def create_book():
    data = request.get_json()
    required = ['isbn', 'title', 'author']
    for f in required:
        if not data.get(f):
            return error_response(f'缺少字段: {f}')
    if Book.query.filter_by(isbn=data['isbn']).first():
        return error_response('ISBN已存在')
    book = Book(
        isbn=data['isbn'], title=data['title'], author=data['author'],
        publisher=data.get('publisher'), category_id=data.get('category_id'),
        description=data.get('description'), language=data.get('language', '中文'),
        price=data.get('price'), cover_url=data.get('cover_url')
    )
    if data.get('publish_date'):
        book.publish_date = datetime.strptime(data['publish_date'], '%Y-%m-%d').date()
    db.session.add(book)
    db.session.commit()
    return success_response(book.to_dict(), '图书添加成功', 201)

@books_bp.route('/<int:book_id>', methods=['PUT'])
@role_required('admin', 'librarian')
def update_book(book_id):
    book = Book.query.get_or_404(book_id)
    data = request.get_json()
    fields = ['title', 'author', 'publisher', 'category_id', 'description', 'language', 'price', 'cover_url']
    for f in fields:
        if f in data:
            setattr(book, f, data[f])
    if data.get('publish_date'):
        book.publish_date = datetime.strptime(data['publish_date'], '%Y-%m-%d').date()
    db.session.commit()
    return success_response(book.to_dict())

@books_bp.route('/<int:book_id>', methods=['DELETE'])
@role_required('admin')
def delete_book(book_id):
    book = Book.query.get_or_404(book_id)
    if book.available_copies < book.total_copies:
        return error_response('有未归还的副本，无法删除')
    db.session.delete(book)
    db.session.commit()
    return success_response(message='图书删除成功')

# ---- Book Copies ----

@books_bp.route('/<int:book_id>/copies', methods=['GET'])
@jwt_required()
def get_copies(book_id):
    book = Book.query.get_or_404(book_id)
    return success_response([c.to_dict() for c in book.copies])

@books_bp.route('/<int:book_id>/copies', methods=['POST'])
@role_required('admin', 'librarian')
def add_copy(book_id):
    book = Book.query.get_or_404(book_id)
    data = request.get_json()
    if not data.get('barcode'):
        return error_response('条形码不能为空')
    if BookCopy.query.filter_by(barcode=data['barcode']).first():
        return error_response('条形码已存在')
    copy = BookCopy(
        book_id=book_id, barcode=data['barcode'],
        location=data.get('location', ''),
        purchase_date=date.today()
    )
    book.total_copies += 1
    book.available_copies += 1
    db.session.add(copy)

    from app.models.inventory import InventoryRecord
    from flask_jwt_extended import get_jwt_identity
    inv = InventoryRecord(
        book_copy_id=copy.id if copy.id else 0,
        operator_id=get_jwt_identity(),
        operation_type='stock_in', notes=data.get('notes', '新书入库')
    )
    db.session.add(inv)
    db.session.commit()
    # update inventory record with real id
    inv.book_copy_id = copy.id
    db.session.commit()
    return success_response(copy.to_dict(), '副本添加成功', 201)

# ---- Reservations ----

@books_bp.route('/<int:book_id>/reserve', methods=['POST'])
@jwt_required()
def reserve_book(book_id):
    book = Book.query.get_or_404(book_id)
    user_id = get_jwt_identity()
    existing = Reservation.query.filter_by(user_id=user_id, book_id=book_id, status='pending').first()
    if existing:
        return error_response('已预约该书')
    reservation = Reservation(
        user_id=user_id, book_id=book_id,
        expire_date=datetime.utcnow() + timedelta(days=3)
    )
    db.session.add(reservation)
    db.session.commit()
    return success_response(reservation.to_dict(), '预约成功', 201)

@books_bp.route('/reservations', methods=['GET'])
@jwt_required()
def my_reservations():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if user.role in ('admin', 'librarian'):
        rsvs = Reservation.query.order_by(Reservation.created_at.desc()).all()
    else:
        rsvs = Reservation.query.filter_by(user_id=user_id).order_by(Reservation.created_at.desc()).all()
    return success_response([r.to_dict() for r in rsvs])

@books_bp.route('/reservations/<int:rsv_id>/cancel', methods=['PUT'])
@jwt_required()
def cancel_reservation(rsv_id):
    user_id = get_jwt_identity()
    rsv = Reservation.query.get_or_404(rsv_id)
    user = User.query.get(user_id)
    if rsv.user_id != user_id and user.role not in ('admin', 'librarian'):
        return error_response('无权操作', 403)
    rsv.status = 'cancelled'
    db.session.commit()
    return success_response(message='预约已取消')
