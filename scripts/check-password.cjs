// 上线前安全检查：验证弱密码（只输出结论，不输出哈希）
const path = require('path');
const BACKEND = path.resolve(__dirname, '..', 'backend');
const db = require(path.join(BACKEND, 'node_modules', 'better-sqlite3'))(path.join(BACKEND, 'data', 'planning.db'));
const bcrypt = require(path.join(BACKEND, 'node_modules', 'bcrypt'));
const rows = db.prepare("SELECT id, username, password_hash FROM users").all();
const weakPasswords = ['admin123', '123456', 'admin', 'password', 'Admin123', 'qubin123', '12345678', '123456789', 'test123'];
for (const r of rows) {
  let weak = '否(强密码)';
  for (const p of weakPasswords) {
    if (bcrypt.compareSync(p, r.password_hash)) { weak = '是 => "' + p + '"'; break; }
  }
  console.log('user=' + r.username + ' | 弱密码: ' + weak);
}
