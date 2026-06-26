/**
 * 施工现场安全巡检 — 独立端点
 * POST /api/safety/check
 * FormData上传照片 → GLM-5V分析 → 返回JGJ59对标报告
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/auth.js';
import { SAFETY_CHECKLIST } from '../config/safetyChecklist.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ dest: path.join(__dirname, '..', 'temp-images'), limits: { fileSize: 20 * 1024 * 1024 } });

const router = Router();

const SAFETY_PROMPT = `你是施工现场安全检查专家。请仔细分析这张工地照片，对照以下JGJ59-2011安全检查标准逐项判断。

检查清单:
{checklist}

输出JSON格式(只输出JSON):
{
  "summary": "整体安全评价(100字)",
  "compliance_rate": "合规率如5/18",
  "items": [
    {"id":"A01","item":"检查项","status":"compliant/non_compliant/not_visible","finding":"发现","suggestion":"建议"}
  ]
}`;

// POST /api/safety/check
router.post('/check', requireAuth, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未上传照片' });

  try {
    const imgData = fs.readFileSync(req.file.path);
    const ext = path.extname(req.file.originalname).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
    const base64 = `data:${mime};base64,${imgData.toString('base64')}`;

    const ZHIPU_KEY = process.env.ZHIPU_API_KEY;
    const checklist = (req.body.checklistIds ? SAFETY_CHECKLIST.filter(c => req.body.checklistIds.split(',').includes(c.id)) : SAFETY_CHECKLIST)
      .map(c => `- [${c.id}] ${c.item} (${c.standard}): ${c.check}`).join('\n');

    const zhipuRes = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ZHIPU_KEY}` },
      body: JSON.stringify({
        model: 'glm-5v-turbo',
        messages: [{ role: 'user', content: [
          { type: 'text', text: SAFETY_PROMPT.replace('{checklist}', checklist) },
          { type: 'image_url', image_url: { url: base64 } },
        ]}],
        max_tokens: 2048,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!zhipuRes.ok) return res.status(502).json({ error: `视觉分析失败: HTTP ${zhipuRes.status}` });

    const data = await zhipuRes.json();
    const content = data.choices?.[0]?.message?.content || '';
    // 清理think标签
    const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    // 清理临时文件
    fs.unlink(req.file.path, () => {});

    try {
      const json = JSON.parse(cleanContent.replace(/```json\n?|\n?```/g, '').trim());
      return res.json({ ok: true, report: json });
    } catch {
      return res.json({ ok: true, report: { summary: cleanContent.slice(0, 300), raw: cleanContent } });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
