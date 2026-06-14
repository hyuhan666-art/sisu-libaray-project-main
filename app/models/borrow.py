from app import db
from datetime import datetime

class BorrowRecord(db.Model):
    __tablename__ = 'borrowrecord'

    id = db.Column(db.Integer, primary_key=True)
    # NOTE: 字段名跟着同事 SQL 的拼写（少了一个 r）
    read_card_id = db.Column(db.Integer, db.ForeignKey('reader_card.id', ondelete='CASCADE'), nullable=False)
    book_copy_id = db.Column(db.Integer, db.ForeignKey('book_copies.id', ondelete='CASCADE'), nullable=False)
    librarian_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    borrow_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    due_date = db.Column(db.DateTime, nullable=False)
    return_date = db.Column(db.DateTime, nullable=True)
    return_librarian_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='SET NULL'), nullable=True)
    renewed_times = db.Column(db.Integer, default=0, nullable=False)
    max_renew_times = db.Column(db.Integer, default=2, nullable=False)
    status = db.Column(
        db.Enum('borrowing', 'returned', 'overdue', 'renewed'),
        default='borrowing', nullable=False
    )
    overdue_fee = db.Column(db.Numeric(10, 2), default=0, nullable=False)
    notes = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    librarian = db.relationship('User', foreign_keys=[librarian_id])
    return_librarian = db.relationship('User', foreign_keys=[return_librarian_id])

    def to_dict(self):
        copy = self.book_copy
        book = copy.book if copy else None
        return {
            'id': self.id,
            'read_card_id': self.read_card_id,
            'book_copy_id': self.book_copy_id,
            'book_title': book.title if book else None,
            'book_isbn': book.isbn if book else None,
            'barcode': copy.barcode if copy else None,
            'borrow_date': self.borrow_date.isoformat() if self.borrow_date else None,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'return_date': self.return_date.isoformat() if self.return_date else None,
            'renewed_times': self.renewed_times,
            'max_renew_times': self.max_renew_times,
            'status': self.status,
            'overdue_fee': float(self.overdue_fee) if self.overdue_fee else 0,
            'notes': self.notes
        }
