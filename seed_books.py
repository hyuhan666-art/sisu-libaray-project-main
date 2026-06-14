# -*- coding: utf-8 -*-
from app import create_app, db
from app.models.book import Category, Book, BookCopy
from datetime import date
app = create_app('development')
app.config['SQLALCHEMY_ECHO'] = False
with app.app_context():
    if Book.query.count() > 0:
        print('books already seeded:', Book.query.count()); raise SystemExit
    cats = {}
    for name in ['计算机', '文学', '历史']:
        c = Category(name=name, description=name+'类图书')
        db.session.add(c); db.session.flush(); cats[name] = c.id
    db.session.commit()
    books = [
        ('9787111128069','深入理解计算机系统','Randal E. Bryant','机械工业出版社','2016-11-01','计算机',139.00, 3),
        ('9787121362460','Python编程从入门到实践','Eric Matthes','人民邮电出版社','2019-05-01','计算机',89.00, 2),
        ('9787020024759','红楼梦','曹雪芹','人民文学出版社','1996-12-01','文学',59.70, 2),
        ('9787108009821','万历十五年','黄仁宇','三联书店','1997-05-01','历史',25.00, 1),
        ('9787544253994','百年孤独','加西亚·马尔克斯','南海出版公司','2011-06-01','文学',39.50, 2),
    ]
    n_copy = 0
    for isbn,title,author,pub,pdate,cat,price,ncopies in books:
        b = Book(isbn=isbn,title=title,author=author,publisher=pub,
                 publish_date=date.fromisoformat(pdate),category_id=cats[cat],
                 price=price,language='中文',total_copies=0,available_copies=0)
        db.session.add(b); db.session.flush()
        for i in range(ncopies):
            db.session.add(BookCopy(book_id=b.id,barcode=f'BC{b.id:03d}{i+1:03d}',
                                    location='A区',purchase_date=date.today(),status='available'))
            n_copy += 1
        db.session.commit()
    # 触发器已维护计数，重读验证
    rows = db.session.execute(db.text('select title,total_copies,available_copies from book')).fetchall()
    print('books:', Book.query.count(), 'copies:', n_copy)
    for r in rows: print(' ', r[0], 'total=',r[1],'avail=',r[2])
