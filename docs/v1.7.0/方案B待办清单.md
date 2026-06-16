# 🔮 方案B — 项目交付前必须完成

> 以下四项需创建独立的 Python 微服务（FastAPI + LightRAG），通过 HTTP API 与主 Node.js 系统通信。

---

## B-1: LightRAG 知识引擎微服务 [高优先级 | 3天]

**目标**：文档→自动实体抽取+图谱构建+混合检索

**技术栈**：Python 3.11+ / FastAPI / LightRAG / Neo4j

**接口设计**：
```python
POST /api/lightrag/index    # 文档索引（自动分块+实体抽取+图谱构建）
POST /api/lightrag/search   # 混合检索（BM25+向量+图谱）
GET  /api/lightrag/graph/{doc_id}  # 文档关联图谱子图
```

**实现步骤**：
1. `pip install lightrag-hku fastapi uvicorn`
2. 创建 `services/lightrag-server/main.py`
3. Docker容器化 → docker-compose新增 lightrag 服务
4. Node.js前端 api.ts 新增 `searchLightRAG()` 调用

---

## B-2: LanceDB 向量存储迁移 [中优先级 | 1天]

**目标**：替代 localStorage，支持大规模文档（>1000篇）

**技术栈**：Python / LanceDB / 通义Embedding

**实现步骤**：
1. `pip install lancedb`
2. 创建 `services/lightrag-server/vector_store.py`
3. 从 localStorage 迁移现有向量数据到 LanceDB
4. 更新 api.ts 向量化调用指向微服务

---

## B-3: unstructured.io 专业解析 [中优先级 | 1.5天]

**目标**：PDF表格/扫描件/复杂排版处理（加强版）

**技术栈**：Python / unstructured.io / tesseract OCR

**实现步骤**：
1. `pip install unstructured[pdf,docx,xlsx]`
2. 创建 `services/lightrag-server/document_parser.py`
3. API: POST /api/lightrag/parse（接收文件，返回结构化文本）
4. Node.js前端 ConstructionReview 等模块调用

---

## B-4: 混合检索API对接 [高优先级 | 0.5天]

**目标**：Node.js前端 ↔ Python微服务HTTP通信

**实现步骤**：
1. api.ts 新增 `searchHybrid(query)` 函数
2. KnowledgeBase.tsx 搜索栏增加"混合检索"模式
3. 三审查模块优先调混合检索，失败降级现有方案

---

## 项目交付前 Checklist

- [ ] B-1: LightRAG 微服务可运行，POST /search 返回结果
- [ ] B-2: LanceDB 数据迁移完成，向量检索可正常使用
- [ ] B-3: unstructured.io 可解析扫描件PDF
- [ ] B-4: Node.js前端可通过混合检索获取结果
- [ ] 端到端测试：上传PDF → LightRAG解析 → 混合检索 → 知识图谱查询 → AI生成回答
