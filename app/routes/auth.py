"""
登录注册接口 —— 管账号的门口
============================
读者注册、登录拿 token、刷新 token、查自己是谁。
真正"创建用户 + 自动开读者卡"的逻辑很简单，所以直接写在这里没拆 service。
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from app import db
from app.models.user import User, ReaderCard
from app.utils.decorators import success_response, error_response
from datetime import date, timedelta
import random, string

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    required = ['username', 'password', 'email']
    for field in required:
        if not data.get(field):
            return error_response(f'缺少字段: {field}')

    if User.query.filter_by(username=data['username']).first():
        return error_response('用户名已存在')
    if User.query.filter_by(email=data['email']).first():
        return error_response('邮箱已注册')

    user = User(
        username=data['username'],
        email=data['email'],
        real_name=data.get('real_name', ''),
        phone=data.get('phone', ''),
        role='reader'
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.flush()

    # Auto create reader card
    card_number = 'RC' + ''.join(random.choices(string.digits, k=8))
    card = ReaderCard(
        user_id=user.id,
        card_number=card_number,
        max_borrow_limit=5,
        expire_date=date.today() + timedelta(days=365)
    )
    db.session.add(card)
    db.session.commit()

    return success_response({'user': user.to_dict(), 'card_number': card_number}, '注册成功', 201)


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data.get('username') or not data.get('password'):
        return error_response('用户名和密码不能为空')

    user = User.query.filter_by(username=data['username']).first()
    if not user or not user.check_password(data['password']):
        return error_response('用户名或密码错误', 401)
    if not user.is_active:
        return error_response('账号已被禁用', 403)

    access_token = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)
    return success_response({
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict()
    }, '登录成功')


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    access_token = create_access_token(identity=user_id)
    return success_response({'access_token': access_token})


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return error_response('用户不存在', 404)
    data = user.to_dict()
    if user.reader_card:
        data['reader_card'] = user.reader_card.to_dict()
    return success_response(data)


@auth_bp.route('/change-password', methods=['PUT'])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    data = request.get_json()
    if not user.check_password(data.get('old_password', '')):
        return error_response('原密码错误')
    user.set_password(data['new_password'])
    db.session.commit()
    return success_response(message='密码修改成功')
