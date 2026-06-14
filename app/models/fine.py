from app import db
from datetime import datetime

class Fine(db.Model):
    __tablename__ = 'fine'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    borrow_record_id = db.Column(db.Integer, db.ForeignKey('borrowrecord.id', ondelete='CASCADE'), nullable=False)
    fine_amount = db.Column(db.Numeric(10, 2), nullable=False)
    paid_amount = db.Column(db.Numeric(10, 2), default=0, nullable=False)
    status = db.Column(
        db.Enum('unpaid', 'partial', 'paid'),
        default='unpaid', nullable=False
    )
    paid_at = db.Column(db.DateTime, nullable=True)
    operator_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='SET NULL'), nullable=True)
    notes = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', foreign_keys=[user_id], backref='fines')
    borrow_record = db.relationship('BorrowRecord', backref='fines')
    operator = db.relationship('User', foreign_keys=[operator_id])

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'borrow_record_id': self.borrow_record_id,
            'fine_amount': float(self.fine_amount),
            'paid_amount': float(self.paid_amount),
            'remaining': float(self.fine_amount - self.paid_amount),
            'status': self.status,
            'paid_at': self.paid_at.isoformat() if self.paid_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
