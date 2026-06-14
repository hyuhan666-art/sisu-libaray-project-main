from app import db
from datetime import datetime

class Category(db.Model):
    __tablename__ = 'category'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, index=True)
    parent_id = db.Column(db.Integer, db.ForeignKey('category.id', ondelete='SET NULL'), nullable=True)
    description = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    children = db.relationship('Category', backref=db.backref('parent', remote_side=[id]), lazy='dynamic')
    books = db.relationship('Book', backref='category', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'parent_id': self.parent_id,
            'description': self.description
        }


class Book(db.Model):
    __tablename__ = 'book'

    id = db.Column(db.Integer, primary_key=True)
    isbn = db.Column(db.String(20), unique=True, nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False, index=True)
    author = db.Column(db.String(100), nullable=False, index=True)
    publisher = db.Column(db.String(100), nullable=False)
    publish_date = db.Column(db.Date, nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id', ondelete='SET NULL'), nullable=True)
    description = db.Column(db.Text)
    cover_url = db.Column(db.String(500))
    language = db.Column(db.String(20), default='中文', nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    total_copies = db.Column(db.Integer, default=0, nullable=False)
    available_copies = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    copies = db.relationship('BookCopy', backref='book', lazy='dynamic')
    reservations = db.relationship('Reservation', backref='book', lazy='dynamic')

    def to_dict(self, detail=False):
        data = {
            'id': self.id,
            'isbn': self.isbn,
            'title': self.title,
            'author': self.author,
            'publisher': self.publisher,
            'publish_date': self.publish_date.isoformat() if self.publish_date else None,
            'category_id': self.category_id,
            'category_name': self.category.name if self.category else None,
            'language': self.language,
            'price': float(self.price) if self.price else None,
            'total_copies': self.total_copies,
            'available_copies': self.available_copies,
            'cover_url': self.cover_url
        }
        if detail:
            data['description'] = self.description
        return data


class BookCopy(db.Model):
    __tablename__ = 'book_copies'

    id = db.Column(db.Integer, primary_key=True)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id', ondelete='CASCADE'), nullable=False)
    barcode = db.Column(db.String(20), unique=True, nullable=False, index=True)
    status = db.Column(
        db.Enum('available', 'borrowed', 'reserved', 'damaged', 'lost', 'scrapped'),
        default='available', nullable=False
    )
    location = db.Column(db.String(100))
    purchase_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    borrow_records = db.relationship('BorrowRecord', backref='book_copy', lazy='dynamic')
    inventory_records = db.relationship('InventoryRecord', backref='book_copy', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'book_id': self.book_id,
            'barcode': self.barcode,
            'status': self.status,
            'location': self.location,
            'purchase_date': self.purchase_date.isoformat() if self.purchase_date else None
        }


class Reservation(db.Model):
    __tablename__ = 'reservation'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id', ondelete='CASCADE'), nullable=False)
    reserve_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    expire_date = db.Column(db.DateTime, nullable=False)
    status = db.Column(
        db.Enum('pending', 'active', 'expired', 'cancelled'),
        default='pending', nullable=False
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='reservations')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'book_id': self.book_id,
            'reserve_date': self.reserve_date.isoformat() if self.reserve_date else None,
            'expire_date': self.expire_date.isoformat() if self.expire_date else None,
            'status': self.status
        }
