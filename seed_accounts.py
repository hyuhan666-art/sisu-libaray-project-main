from app import create_app, db
from app.models.user import User, ReaderCard
from datetime import date, timedelta
import random, string

app = create_app('development')
with app.app_context():
    accounts = [
        ('admin', 'Admin@123456', 'admin@sisu.edu', 'System Admin', 'admin'),
        ('librarian', 'Lib@123456', 'librarian@sisu.edu', 'Head Librarian', 'librarian'),
    ]
    for username, pwd, email, name, role in accounts:
        if User.query.filter_by(username=username).first():
            print(f'skip {username} (exists)'); continue
        u = User(username=username, email=email, real_name=name, phone='13900000000', role=role)
        u.set_password(pwd)
        db.session.add(u); db.session.flush()
        if role == 'reader':
            card = ReaderCard(user_id=u.id, card_number='RC'+''.join(random.choices(string.digits,k=8)),
                              max_borrow_limit=5, expire_date=date.today()+timedelta(days=365))
            db.session.add(card)
        db.session.commit()
        print(f'created {role}: {username} / {pwd}')
    print('users now:', User.query.count())
