from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from app.models.user import User

def role_required(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.get(user_id)
            if not user or not user.is_active:
                return jsonify({'error': '用户不存在或已禁用'}), 403
            if user.role not in roles:
                return jsonify({'error': '权限不足'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator

def success_response(data=None, message='success', code=200):
    resp = {'code': code, 'message': message}
    if data is not None:
        resp['data'] = data
    return jsonify(resp), code

def error_response(message='error', code=400):
    return jsonify({'code': code, 'message': message}), code
