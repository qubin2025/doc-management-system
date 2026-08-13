import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';

const router = Router();

/** 统一同步端点 — 将前端localStorage数据持久化到SQLite */
router.post('/', requireAuth, (req, res) => {
  const { projectName, data } = req.body;
  if (!projectName || !data) return res.status(400).json({ error: '缺少 projectName 或 data' });

  const db = getDb();
  const results = { objectives: 0, documents: 0, baselines: 0, artifacts: 0, tailoring: 0, stakeholders: 0, risks: 0, resources: 0, raci: 0, guideProgress: 0, knowledgeArtifacts: 0 };
  const username = req.user?.username || 'unknown';

  // v5.2: 将配置数据 upsert 到 project_config 表（替代原先静默丢弃）
  const CONFIG_TYPES = ['tailoring', 'stakeholders', 'risks', 'resources', 'raci', 'guideProgress', 'knowledgeArtifacts'];
  const upsertConfig = db.prepare(`
    INSERT INTO project_config (project_name, config_type, data, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(project_name, config_type) DO UPDATE SET data=excluded.data, updated_at=datetime('now')
  `);

  try {
    const tx = db.transaction(() => {
      // 同步目标
      if (data.objectives && Array.isArray(data.objectives)) {
        for (const obj of data.objectives) {
          const existing = db.prepare('SELECT id FROM objectives WHERE id = ?').get(obj.id);
          if (existing) {
            db.prepare(`UPDATE objectives SET title=?, description=?, level=?, weight=?, progress=?, status=?, linked_work_item_ids=?, parent_id=?, updated_at=datetime('now') WHERE id=?`)
              .run(obj.title, obj.description||'', obj.level, obj.weight||0, obj.progress||0, obj.status||'not-started', JSON.stringify(obj.linkedWorkItemIds||[]), obj.parentId||null, obj.id);
          } else {
            db.prepare(`INSERT OR IGNORE INTO objectives (id, project_name, parent_id, title, description, level, weight, progress, status, linked_work_item_ids)
              VALUES (?,?,?,?,?,?,?,?,?,?)`)
              .run(obj.id, projectName, obj.parentId||null, obj.title, obj.description||'', obj.level, obj.weight||0, obj.progress||0, obj.status||'not-started', JSON.stringify(obj.linkedWorkItemIds||[]));
          }
          results.objectives++;
        }
      }

      // 同步文档记录
      if (data.documents && Array.isArray(data.documents)) {
        const project = db.prepare('SELECT id FROM projects WHERE name = ?').get(projectName);
        if (project) {
          for (const doc of data.documents) {
            db.prepare(`INSERT OR IGNORE INTO documents (project_id, doc_id, file_name, upload_time, uploader, version, standard)
              VALUES (?,?,?,?,?,?,?)`)
              .run(project.id, doc.docId, doc.fileName, doc.uploadTime||new Date().toISOString(), username, doc.version||'V1.0', doc.standard||'DB11/T695-2025');
            results.documents++;
          }
        }
      }

      // 同步基线
      if (data.baselines && Array.isArray(data.baselines)) {
        for (const bl of data.baselines) {
          db.prepare(`INSERT OR IGNORE INTO baselines (id, project_name, baseline_type, version, snapshot, description, is_active, created_by)
            VALUES (?,?,?,?,?,?,?,?)`)
            .run(bl.id, projectName, bl.baselineType, bl.version||1, JSON.stringify(bl.snapshot||{}), bl.description||'', bl.isActive?1:0, username);
          results.baselines++;
        }
      }

      // 同步知识产物
      if (data.artifacts && Array.isArray(data.artifacts)) {
        for (const art of data.artifacts) {
          db.prepare(`INSERT OR IGNORE INTO knowledge_artifacts (id, project_name, artifact_type, source_type, source_id, content, metadata, vector_id, confidence)
            VALUES (?,?,?,?,?,?,?,?,?)`)
            .run(art.id, projectName, art.artifactType, art.sourceType, art.sourceId, art.content||'', JSON.stringify(art.metadata||{}), art.vectorId||null, art.confidence||1.0);
          results.artifacts++;
        }
      }

      // v5.2: 同步 6 类配置数据到 project_config 表（原先被静默丢弃）
      for (const type of CONFIG_TYPES) {
        const payload = data[type];
        if (payload === undefined || payload === null) continue;
        // tailoring 是单个对象包在数组里 [cfg]；其余是数组；统一序列化
        const jsonData = JSON.stringify(payload);
        upsertConfig.run(projectName, type, jsonData);
        results[type] = Array.isArray(payload) ? payload.length : 1;
      }
    });

    tx();
    logAudit(projectName, username, 'update', 'configuration', 'sync', { results });
    res.json({ success: true, results });
  } catch (e) {
    console.error('[Sync] Error:', e.message);
    res.status(500).json({ error: '同步失败: ' + e.message });
  }
});

/** 获取项目所有配置数据 */
router.get('/:projectName', requireAuth, (req, res) => {
  const { projectName } = req.params;
  const db = getDb();
  // 读取 project_config 表中的 6 类配置数据
  const configRows = db.prepare('SELECT config_type, data FROM project_config WHERE project_name = ?').all(projectName);
  const configData = {};
  for (const row of configRows) {
    try { configData[row.config_type] = JSON.parse(row.data); } catch { configData[row.config_type] = null; }
  }
  res.json({
    objectives: db.prepare('SELECT * FROM objectives WHERE project_name = ?').all(projectName),
    baselines: db.prepare('SELECT * FROM baselines WHERE project_name = ?').all(projectName),
    artifacts: db.prepare('SELECT * FROM knowledge_artifacts WHERE project_name = ?').all(projectName),
    docs: db.prepare('SELECT d.* FROM documents d JOIN projects p ON d.project_id = p.id WHERE p.name = ?').all(projectName),
    // v5.2: 返回配置数据
    tailoring: configData.tailoring || null,
    stakeholders: configData.stakeholders || [],
    risks: configData.risks || [],
    resources: configData.resources || [],
    raci: configData.raci || [],
    guideProgress: configData.guideProgress || [],
    knowledgeArtifacts: configData.knowledgeArtifacts || [],
  });
});

export default router;
