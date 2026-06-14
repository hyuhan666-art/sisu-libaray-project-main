from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_cors import CORS
from config import config

db = SQLAlchemy()
jwt = JWTManager()
migrate = Migrate()

def create_app(config_name='default'):
    app = Flask(__name__, static_folder='../static')
    app.config.from_object(config[config_name])

    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    from app.routes.auth import auth_bp
    from app.routes.books import books_bp
    from app.routes.readers import readers_bp
    from app.routes.borrow import borrow_bp
    from app.routes.stats import stats_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(books_bp, url_prefix='/api/books')
    app.register_blueprint(readers_bp, url_prefix='/api/readers')
    app.register_blueprint(borrow_bp, url_prefix='/api/borrow')
    app.register_blueprint(stats_bp, url_prefix='/api/stats')

    @app.route('/api/health')
    def health():
        return {'status': 'ok', 'message': 'SISU Library API is running'}

    @app.route('/')
    def serve_spa_root():
        return send_from_directory(app.static_folder, 'index.html')

    @app.route('/<path:filename>')
    def serve_static_or_spa(filename):
        """非 /api 请求 fallback 到 SPA，让前端 Hash 路由接管"""
        from flask import request
        if request.path.startswith('/api/'):
            return {'error': 'Not Found'}, 404
        # 如果是静态资源（css/js/img），走 Flask 默认 static 分发
        # 否则返回 index.html 给 SPA
        import os
        static_file = os.path.join(app.static_folder, filename)
        if os.path.isfile(static_file):
            return send_from_directory(app.static_folder, filename)
        return send_from_directory(app.static_folder, 'index.html')

    return app
