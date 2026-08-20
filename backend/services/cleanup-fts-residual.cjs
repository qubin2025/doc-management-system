const db = require('better-sqlite3')('data/planning.db');
console.log('=== 清理 FTS5 残留数据 ===');
console.log('清理前:');
console.log('  vector_embeddings:', db.prepare('SELECT COUNT(*) as c FROM vector_embeddings').get().c);
console.log('  vector_embeddings_fts:', db.prepare('SELECT COUNT(*) as c FROM vector_embeddings_fts').get().c);

// FTS5 虚拟表的 UNINDEXED 列不支持 LIKE/GLOB 查询，需要用子查询方式
// 方案: 找出 FTS5 中存在但 vector_embeddings 中不存在的记录（孤儿记录）
const r = db.prepare(`
  DELETE FROM vector_embeddings_fts
  WHERE external_id NOT IN (SELECT id FROM vector_embeddings)
`).run();
console.log('清理孤儿 FTS5 记录:', r.changes, '条');

console.log('清理后:');
console.log('  vector_embeddings:', db.prepare('SELECT COUNT(*) as c FROM vector_embeddings').get().c);
console.log('  vector_embeddings_fts:', db.prepare('SELECT COUNT(*) as c FROM vector_embeddings_fts').get().c);

// 一致性验证
const vec = db.prepare('SELECT COUNT(*) as c FROM vector_embeddings').get().c;
const fts = db.prepare('SELECT COUNT(*) as c FROM vector_embeddings_fts').get().c;
if (vec === fts) {
  console.log('✅ 数据一致性检查通过:', vec, '条');
} else {
  console.log('⚠️ 数据不一致: vec=' + vec + ', fts=' + fts);
}
