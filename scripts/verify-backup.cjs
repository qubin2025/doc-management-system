// 验证备份数据库完整性
const path = require('path');
const db = require(path.join(__dirname, '..', 'backend', 'node_modules', 'better-sqlite3'))(process.argv[2], { readonly: true });
const users = db.prepare('SELECT COUNT(*) c FROM users').get().c;
const projects = db.prepare('SELECT COUNT(*) c FROM projects').get().c;
const documents = db.prepare('SELECT COUNT(*) c FROM documents').get().c;
console.log('备份库可读: users=' + users + ' projects=' + projects + ' documents=' + documents);
db.close();
