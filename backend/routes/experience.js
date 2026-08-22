import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { enqueueKbSync, SYNC_SOURCE, getQueueStats } from '../middleware/kbSyncTrigger.js';

const router = Router();

// ========== Feature: AI辅助经验提取 (深度语义分析) ==========
function analyzeWithAI(projectName, params) {
  const { objectives, completedItems, totalItems } = params;

  // Compute basic stats
  const avgProgress = completedItems.length > 0
    ? completedItems.reduce((s, o) => s + (o.progress || 0), 0) / completedItems.length
    : 0;
  const totalWeight = completedItems.reduce((s, o) => s + (o.weight || 0), 0);

  // Cluster by level
  const levelCounts = {};
  for (const o of completedItems) {
    const lvl = o.level || 'unknown';
    levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
  }

  // Time analysis: days between first created and last updated among completed
  let avgDuration = 0;
  if (completedItems.length > 0) {
    const durations = completedItems.map(o => {
      if (o.created_at && o.updated_at) {
        return (new Date(o.updated_at) - new Date(o.created_at)) / (1000 * 60 * 60 * 24);
      }
      return 0;
    }).filter(d => d > 0);
    avgDuration = durations.length > 0 ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length * 10) / 10 : 0;
  }

  // Categorize title keywords for pattern mining
  const keywords = {
    risk: ['风险', '安全', '隐患', '事故', '危险', '应急', '隐患'],
    quality: ['质量', '验收', '检测', '合格', '不合格', '检查', '检验'],
    schedule: ['进度', '延期', '工期', '滞后', '计划', '里程碑'],
    cost: ['成本', '预算', '费用', '造价', '变更', '索赔'],
    compliance: ['合规', '审批', '备案', '许可', '资质', '规范', '标准'],
    resource: ['物资', '设备', '材料', '人工', '分包', '供应商'],
  };

  const categorizedPatterns = {};
  for (const [cat, kws] of Object.entries(keywords)) {
    const matched = completedItems.filter(o => kws.some(kw => (o.title || '').includes(kw)));
    if (matched.length > 0) {
      categorizedPatterns[cat] = {
        count: matched.length,
        items: matched.map(o => o.title),
      };
    }
  }

  // Sort toptitles by occurrence
  const titleFreq = {};
  for (const o of completedItems) {
    titleFreq[o.title] = (titleFreq[o.title] || 0) + 1;
  }
  const topItems = Object.entries(titleFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([t, c]) => ({ title: t, count: c }));

  // Generate AI-like pattern descriptions (deterministic — good for MVP)
  const patterns = [];

  // Pattern: completion rate analysis
  if (totalItems > 0) {
    const rate = Math.round(completedItems.length / totalItems * 100);
    patterns.push({
      type: 'completion_rate',
      title: '目标完成率',
      description: `项目「${projectName}」的目标完成率为 ${rate}%（${completedItems.length}/${totalItems}），整体进度 ${Math.round(avgProgress * 100)}%。`,
      severity: rate >= 80 ? 'healthy' : rate >= 50 ? 'warning' : 'critical',
      agentHint: `在类似项目中，通常需确保80%以上的目标按期完成。当前完成率为${rate}%，${rate >= 80 ? '表现良好' : '建议重点关注剩余未完成目标'}`,
    });
  }

  // Pattern: risk patterns
  if (categorizedPatterns.risk) {
    patterns.push({
      type: 'risk',
      title: '常见风险模式',
      description: `已完成目标中含 ${categorizedPatterns.risk.count} 项与安全/风险相关的工作项：${categorizedPatterns.risk.items.slice(0, 3).join('、')}等。`,
      severity: 'warning',
      agentHint: `在类似项目中，安全风险相关的目标需要持续跟踪。建议在后续项目中建立风险评估预警机制，对高风险项设置专题监控。`,
    });
  }

  // Pattern: quality focus
  if (categorizedPatterns.quality) {
    patterns.push({
      type: 'quality',
      title: '质量控制模式',
      description: `验收/检测类工作项 ${categorizedPatterns.quality.count} 项已完成，涵盖：${categorizedPatterns.quality.items.slice(0, 3).join('、')}等。`,
      severity: 'healthy',
      agentHint: `在类似项目中，质量控制体系应覆盖全过程。当前验收项已完成，建议将验收标准沉淀为模板，供后续项目复用。`,
    });
  }

  // Pattern: duration analysis
  if (avgDuration > 0) {
    patterns.push({
      type: 'duration',
      title: '平均完成周期',
      description: `已完成目标的平均完成周期约 ${avgDuration} 天，涉及 ${completedItems.length} 个目标节点。`,
      severity: avgDuration > 30 ? 'warning' : 'healthy',
      agentHint: `在类似项目中，目标的平均完成周期为${avgDuration}天。${avgDuration > 30 ? '建议通过裁剪优化减少关键路径长度' : '周期控制合理，可作为后期项目排期的参考基线'}`,
    });
  }

  // Pattern: level distribution
  if (Object.keys(levelCounts).length > 0) {
    const levelDesc = Object.entries(levelCounts)
      .map(([lvl, cnt]) => {
        const labelMap = { root: '总目标', phase: '阶段目标', deliverable: '交付物', 'work-item': '工作包' };
        return `${labelMap[lvl] || lvl}${cnt}项`;
      })
      .join('、');
    patterns.push({
      type: 'level_distribution',
      title: '目标层级分布',
      description: `已完成目标中，${levelDesc}。`,
      severity: 'info',
      agentHint: `在类似项目中，工作包级别(work-item)的目标占比应最高，确保目标可量化可执行。`,
    });
  }

  // Pattern: cost if applicable
  if (categorizedPatterns.cost) {
    patterns.push({
      type: 'cost',
      title: '成本控制模式',
      description: `涉及成本管控的目标 ${categorizedPatterns.cost.count} 项已闭环：${categorizedPatterns.cost.items.slice(0, 3).join('、')}等。`,
      severity: 'healthy',
      agentHint: `在类似项目中，成本变更和索赔管理是重点领域。建议将成本偏差阈值设定为5%-10%，超限自动预警。`,
    });
  }

  return {
    patterns,
    metrics: {
      totalItems,
      completedCount: completedItems.length,
      avgProgress: Math.round(avgProgress * 100),
      avgDurationDays: avgDuration,
      totalWeight,
      topItems: topItems.slice(0, 5),
      levelDistribution: levelCounts,
    },
  };
}

// ========== POST /api/experience/extract ==========
router.post('/extract', requireAuth, (req, res) => {
  try {
    const db = getDb();
    
    // Query all distinct projects that have objectives
    const projectNames = db.prepare(
      'SELECT DISTINCT project_name FROM objectives'
    ).all().map(r => r.project_name);

    if (projectNames.length === 0) {
      return res.json({
        success: true,
        message: '暂无已完成项目数据',
        experiences: [],
        extracted: 0,
      });
    }

    const allExperiences = [];

    for (const projectName of projectNames) {
      // Get all objectives for this project
      const allItems = db.prepare(
        'SELECT * FROM objectives WHERE project_name = ? ORDER BY created_at ASC'
      ).all(projectName);

      const completedItems = allItems.filter(o => o.status === 'completed');
      const totalItems = allItems.length;

      if (completedItems.length === 0) continue;

      // Deduplicate: remove old experiences for this project
      db.prepare('DELETE FROM project_experiences WHERE project_name = ?').run(projectName);

      // Run analysis
      const analysis = analyzeWithAI(projectName, { objectives: allItems, completedItems, totalItems });

      // Store each pattern
      for (const pattern of analysis.patterns) {
        const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        db.prepare(
          `INSERT INTO project_experiences (id, project_name, category, title, description, patterns, metrics, reference_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        ).run(
          id,
          projectName,
          pattern.type,
          pattern.title,
          pattern.description,
          JSON.stringify([pattern]),
          JSON.stringify(analysis.metrics),
          completedItems.length
        );
        allExperiences.push({
          id,
          projectName,
          category: pattern.type,
          title: pattern.title,
          description: pattern.description,
          patterns: [pattern],
          metrics: analysis.metrics,
          referenceCount: completedItems.length,
        });
        // v5.7 迭代1: 触发知识库同步入队（异步向量化入库）
        try {
          const eq = enqueueKbSync(projectName, SYNC_SOURCE.EXPERIENCE, id, 'upsert', 0);
          console.log(`[kbSync][experience] 入队: projectName=${projectName}, recordId=${id}, result=${JSON.stringify(eq)}`);
        } catch (e) {
          console.error(`[kbSync][experience] 入队异常: recordId=${id}, ${e.message}`);
        }
      }
      // 项目级入队汇总
      try {
        const stats = getQueueStats(projectName);
        console.log(`[kbSync][experience] 项目 ${projectName} 入队汇总: ${analysis.patterns.length} 条 pattern, 队列=${JSON.stringify(stats)}`);
      } catch (e) {
        console.error(`[kbSync][experience] 汇总异常: ${e.message}`);
      }
    }

    // Aggregate cross-project patterns
    const aggregatedPatterns = {};
    for (const exp of allExperiences) {
      for (const pat of exp.patterns) {
        if (!aggregatedPatterns[pat.type]) {
          aggregatedPatterns[pat.type] = { ...pat, projects: [], totalRefs: 0 };
        }
        if (!aggregatedPatterns[pat.type].projects.includes(exp.projectName)) {
          aggregatedPatterns[pat.type].projects.push(exp.projectName);
        }
        aggregatedPatterns[pat.type].totalRefs += exp.referenceCount;
      }
    }

    res.json({
      success: true,
      message: `成功从 ${projectNames.length} 个项目中提取 ${allExperiences.length} 条经验`,
      experiences: allExperiences,
      aggregated: Object.values(aggregatedPatterns),
      extracted: allExperiences.length,
    });
  } catch (e) {
    console.error('[Experience] extract error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ========== GET /api/experience/list ==========
router.get('/list', requireAuth, (req, res) => {
  try {
    const db = getDb();
    
    const { category, keyword, project, limit = 50, offset = 0 } = req.query;

    let sql = 'SELECT * FROM project_experiences WHERE 1=1';
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (project) {
      sql += ' AND project_name = ?';
      params.push(project);
    }

    if (keyword) {
      sql += ' AND (title LIKE ? OR description LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const rows = db.prepare(sql).all(...params);
    const countRow = db.prepare(
      sql.replace('SELECT *', 'SELECT COUNT(*) as cnt').replace('ORDER BY created_at DESC LIMIT ? OFFSET ?', '')
    ).get(...params.slice(0, -2));

    // Aggregate cross-project patterns from results
    const typeAgg = {};
    for (const r of rows) {
      const ps = JSON.parse(r.patterns || '[]');
      for (const p of ps) {
        if (!typeAgg[p.type]) {
          typeAgg[p.type] = { type: p.type, title: p.title, count: 0, projects: [] };
        }
        typeAgg[p.type].count++;
        if (!typeAgg[p.type].projects.includes(r.project_name)) {
          typeAgg[p.type].projects.push(r.project_name);
        }
      }
    }

    const items = rows.map(r => ({
      id: r.id,
      projectName: r.project_name,
      category: r.category,
      title: r.title,
      description: r.description,
      patterns: JSON.parse(r.patterns || '[]'),
      metrics: JSON.parse(r.metrics || '{}'),
      referenceCount: r.reference_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    const categories = [...new Set(rows.map(r => r.category))];

    res.json({
      items,
      total: countRow?.cnt || 0,
      categories,
      aggregated: Object.values(typeAgg),
    });
  } catch (e) {
    console.error('[Experience] list error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ========== DELETE /api/experience/:id ==========
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const db = getDb();
    
    const existing = db.prepare('SELECT * FROM project_experiences WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: '经验记录不存在' });

    db.prepare('DELETE FROM project_experiences WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/experience/:id/status — 审批知识条目 (admin)
router.put('/:id/status', requireAuth, (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: '仅管理员' });
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: '无效状态，可选: approved/rejected/pending' });
  }
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM project_experiences WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: '知识条目不存在' });
    // 使用 metrics JSON 存储审批状态
    let metrics = {};
    try { metrics = JSON.parse(existing.metrics || '{}'); } catch {}
    metrics.status = status;
    metrics.reviewedBy = req.user?.username;
    metrics.reviewedAt = new Date().toISOString();
    db.prepare('UPDATE project_experiences SET metrics = ? WHERE id = ?').run(JSON.stringify(metrics), req.params.id);
    res.json({ success: true, message: `已${status === 'approved' ? '通过' : status === 'rejected' ? '驳回' : '重置为待审核'}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
