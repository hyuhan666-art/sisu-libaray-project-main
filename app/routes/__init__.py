"""
routes 包 —— HTTP 接入层
========================
每个 .py 是一组接口（一个 Blueprint），按业务领域分文件：
  auth.py    登录注册
  books.py   图书 / 分类 / 副本 / 预约
  borrow.py  借 / 还 / 续（核心业务）
  readers.py 读者管理
  stats.py   统计报表

route 的职责只有三件事：
  1) 解析请求参数（request.json / request.args）
  2) 调 service 干活
  3) 包装成统一 JSON 返回（{code, message, data}）
🚫 route 里不写业务规则，看见 if/else 判断业务条件就说明写错位置了。
"""
