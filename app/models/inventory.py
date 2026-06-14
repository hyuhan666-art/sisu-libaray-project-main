from app import db
from datetime import datetime

class InventoryRecord(db.Model):
    __tablename__ = 'inventoryrecord'

    id = db.Column(db.Integer, primary_key=True)
    book_copy_id = db.Column(db.Integer, db.ForeignKey('book_copies.id', ondelete='CASCADE'), nullable=False)
    operator_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    operation_type = db.Column(
        db.Enum('stock_in', 'inventory_check', 'damaged', 'scrapped', 'lost', 'borrowed', 'returned'),
        nullable=False
    )
    operation_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    notes = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    operator = db.relationship('User', backref='inventory_operations')

    def to_dict(self):
        return {
            'id': self.id,
            'book_copy_id': self.book_copy_id,
            'operator_id': self.operator_id,
            'operation_type': self.operation_type,
            'operation_date': self.operation_date.isoformat() if self.operation_date else None,
            'notes': self.notes
        }
