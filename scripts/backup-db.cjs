// SQLite WAL 安全备份
const path = require('path');
const BACKEND = path.resolve(__dirname, '..', 'backend');
const db = require(path.join(BACKEND, 'node_modules', 'better-sqlite3'))(path.join(BACKEND, 'data', 'planning.db'));
const target = process.argv[2];
db.backup(target).then(() => {
  console.log('db backup ok: ' + target);
  process.exit(0);
}).catch(e => {
  console.error('db backup failed: ' + e.message);
  process.exit(1);
});
