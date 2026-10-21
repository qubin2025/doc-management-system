// 修改 admin/管理员 弱密码为强密码
// 用法: node update-admin-password.cjs ["指定密码"]
// 输出: 新密码写入 scripts/admin-password.txt（仅本机，勿分发）
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const BACKEND = path.resolve(__dirname, '..', 'backend');

const gen = (len = 20) => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%*';
  const all = upper + lower + digits + symbols;
  let pw = [];
  pw.push(upper[crypto.randomInt(upper.length)]);
  pw.push(lower[crypto.randomInt(lower.length)]);
  pw.push(digits[crypto.randomInt(digits.length)]);
  pw.push(symbols[crypto.randomInt(symbols.length)]);
  while (pw.length < len) pw.push(all[crypto.randomInt(all.length)]);
  for (let i = pw.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [pw[i], pw[j]] = [pw[j], pw[i]];
  }
  return pw.join('');
};

const newPassword = process.argv[2] || gen();

const db = require(path.join(BACKEND, 'node_modules', 'better-sqlite3'))(path.join(BACKEND, 'data', 'planning.db'));
const bcrypt = require(path.join(BACKEND, 'node_modules', 'bcrypt'));

const hash = bcrypt.hashSync(newPassword, 10);
const info = db.prepare('UPDATE users SET password_hash=? WHERE username IN (?,?)').run(hash, 'admin', '管理员');
const check = db.prepare("SELECT username FROM users WHERE password_hash=?").all(hash);

// 写入本地密码文件（仅供本机运维查阅）
const pwdFile = path.resolve(__dirname, 'admin-password.txt');
fs.writeFileSync(pwdFile, 'admin / 管理员 新密码: ' + newPassword + '\n生成时间: ' + new Date().toISOString() + '\n', 'utf8');

console.log('updated rows: ' + info.changes);
console.log('users: ' + JSON.stringify(check));
console.log('pwd file: ' + pwdFile);
