from app import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, date

class User(db.Model):
    __tablename__ = 'user'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(20), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(50), unique=True, nullable=False)
    real_name = db.Column(db.String(20))
    phone = db.Column(db.String(20))
    role = db.Column(db.Enum('librarian', 'reader', 'admin'), nullable=False, default='reader')
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    reader_card = db.relationship('ReaderCard', backref='user', uselist=False, lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'real_name': self.real_name,
            'phone': self.phone,
            'role': self.role,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class ReaderCard(db.Model):
    __tablename__ = 'reader_card'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False, unique=True)
    card_number = db.Column(db.String(20), unique=True, nullable=False, index=True)
    max_borrow_limit = db.Column(db.Integer, default=5, nullable=False)
    current_borrow_count = db.Column(db.Integer, default=0, nullable=False)
    expire_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), default='active', nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    borrow_records = db.relationship('BorrowRecord', backref='reader_card', lazy='dynamic')

    def is_valid(self):
        return self.status == 'active' and self.expire_date >= date.today()

    def to_dict(self):
        return {
            'id': self.id,
            'card_number': self.card_number,
            'max_borrow_limit': self.max_borrow_limit,
            'current_borrow_count': self.current_borrow_count,
            'expire_date': self.expire_date.isoformat() if self.expire_date else None,
            'status': self.status
        }
