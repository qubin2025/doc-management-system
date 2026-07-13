import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET 列出所有可用的 MCP 工具
router.get('/tools/list', requireAuth, (_req, res) => {
  res.json({
    tools: [
      {
        name: 'ai_chat',
        description: '通用AI对话/分析，支持上下文和模型选择',
        inputSchema: { type: 'object', properties: { query: { type: 'string', description: '用户提问' } }, required: ['query'] },
      },
      {
        name: 'compute_kpi',
        description: '计算项目KPI指标（CPI/SPI/完整度/质量分）',
        inputSchema: { type: 'object', properties: { projectName: { type: 'string' } }, required: ['projectName'] },
      },
      {
        name: 'knowledge_search',
        description: '在项目知识库中语义/全文/混合搜索',
        inputSchema: { type: 'object', properties: { query: { type: 'string' }, mode: { type: 'string' } }, required: ['query'] },
      },
      {
        name: 'scan_workitems',
        description: '扫描项目工作项，检测过期/未完成',
        inputSchema: { type: 'object', properties: { projectName: { type: 'string' } }, required: ['projectName'] },
      },
      {
        name: 'fill_form',
        description: 'AI智能填写工程表单',
        inputSchema: { type: 'object', properties: { formCode: { type: 'string' }, formName: { type: 'string' }, fields: { type: 'array' } }, required: ['formCode', 'formName'] },
      },
      {
        name: 'rag_search',
        description: 'RAG检索增强问答',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      },
    ],
  });
});

// GET 健康检查
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', uptime: process.uptime() });
});

export default router;
