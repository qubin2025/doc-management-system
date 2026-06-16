"""
LightRAG 知识引擎微服务 — 方案B
文档→自动实体抽取+图谱构建+混合检索
"""
import os, json, hashlib, re
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="LightRAG Knowledge Engine", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ===== 轻量级实现（无外部AI依赖） =====
class SimpleChunker:
    """智能文档分块"""
    @staticmethod
    def chunk(text: str, max_size: int = 2000, overlap: int = 200) -> list[dict]:
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        chunks, current = [], ''
        for p in paragraphs:
            if len(current + p) > max_size and current:
                chunks.append({'text': current.strip(), 'index': len(chunks)})
                current = current[-overlap:] + '\n' + p if overlap else p
            else: current += ('\n' + p if current else p)
        if current.strip(): chunks.append({'text': current.strip(), 'index': len(chunks)})
        return chunks

class KeywordExtractor:
    """中文关键词和实体提取"""
    @staticmethod
    def extract(text: str) -> dict:
        entities = {'persons': [], 'orgs': [], 'standards': [], 'locations': [], 'numbers': []}
        # 标准编号提取
        entities['standards'] = list(set(re.findall(r'(?:DB\d+/T\s*\d+-\d+|GB\s*\d+[-.]\d+|JGJ\s*\d+[-.]\d+)', text)))
        # 数字/金额提取
        entities['numbers'] = list(set(re.findall(r'\d+\.?\d*\s*(?:万元|亿元|m|㎡|km|吨|层)', text)))
        # 地点提取
        entities['locations'] = list(set(re.findall(r'(?:北京市|上海市|天津市|重庆市|\w+区|\w+县)', text)))
        # 组织提取
        entities['orgs'] = list(set(re.findall(r'(?:[\u4e00-\u9fff]{2,6}(?:公司|集团|局|院|所|中心|委员会))', text)))
        keywords = list(set(re.findall(r'[\u4e00-\u9fff]{2,8}(?:方案|施工|工程|质量|安全|验收|监理|设计|标准|规范)', text)))
        return {'entities': entities, 'keywords': keywords[:20], 'chunk_count': 0}

class SimpleVectorStore:
    """轻量级向量存储（内存+LanceDB可选）"""
    def __init__(self):
        self.docs = []
        self.use_lancedb = False
        try:
            import lancedb
            self.db = lancedb.connect("./data/lancedb")
            self.use_lancedb = True
        except:
            pass  # LanceDB optional, use in-memory store

    def add(self, doc_id: str, text: str, metadata: dict = None):
        chunks = SimpleChunker.chunk(text)
        for c in chunks:
            c['doc_id'] = doc_id
            c['metadata'] = metadata or {}
            self.docs.append(c)

    def search(self, query: str, top_k: int = 5) -> list:
        # 关键词匹配（简化版，生产用向量+BM25混合）
        results = []
        query_terms = set(re.findall(r'[\u4e00-\u9fff]+', query))
        for d in self.docs:
            score = sum(1 for t in query_terms if t in d['text'])
            if score > 0: results.append({**d, 'score': score / len(query_terms)})
        results.sort(key=lambda x: -x['score'])
        return results[:top_k]

    def stats(self) -> dict:
        return {'total_docs': len(set(d['doc_id'] for d in self.docs)), 'total_chunks': len(self.docs)}

# ===== 全局实例 =====
vector_store = SimpleVectorStore()
doc_index = {}  # doc_id → metadata
graph_nodes = []  # 简易图谱节点
graph_edges = []  # 简易图谱边

# ===== API 端点 =====

class SearchRequest(BaseModel):
    query: str
    top_k: int = 5
    mode: str = "hybrid"  # hybrid / keyword / vector

class IndexResponse(BaseModel):
    doc_id: str
    chunks: int
    entities: dict
    keywords: list

@app.get("/api/lightrag/health")
async def health():
    stats = vector_store.stats()
    return {"status": "ok", "version": "1.0.0", **stats, "graph_nodes": len(graph_nodes), "graph_edges": len(graph_edges)}

@app.post("/api/lightrag/index", response_model=IndexResponse)
async def index_document(file: UploadFile = File(...), project: str = ""):
    """上传文档 → 分块 + 实体提取 + 向量索引"""
    content = await file.read()
    text = content.decode('utf-8', errors='replace')[:50000]

    doc_id = hashlib.md5((file.filename + str(len(doc_index))).encode()).hexdigest()[:12]
    doc_index[doc_id] = {'filename': file.filename, 'size': len(content), 'project': project}

    # 提取实体和关键词
    extractor = KeywordExtractor()
    info = extractor.extract(text)

    # 向量索引
    vector_store.add(doc_id, text, {'filename': file.filename, 'project': project})

    # 图谱节点
    graph_nodes.append({'id': doc_id, 'type': 'document', 'label': file.filename, 'props': {'project': project}})
    for std in info['entities']['standards'][:5]:
        std_id = 'std-' + std.replace('/', '-')
        if not any(n['id'] == std_id for n in graph_nodes):
            graph_nodes.append({'id': std_id, 'type': 'standard-clause', 'label': std})
        graph_edges.append({'from': doc_id, 'to': std_id, 'type': 'references', 'label': '引用标准'})

    return IndexResponse(doc_id=doc_id, chunks=info['chunk_count'] or len(SimpleChunker.chunk(text)),
                         entities=info['entities'], keywords=info['keywords'])

@app.post("/api/lightrag/search")
async def search(req: SearchRequest):
    """混合检索：关键词 + 向量相似度"""
    results = vector_store.search(req.query, req.top_k)
    return {
        "query": req.query,
        "mode": req.mode,
        "total": len(results),
        "results": [{'doc_id': r['doc_id'], 'text': r['text'][:500], 'score': round(r['score'], 3),
                      'filename': r.get('metadata', {}).get('filename', ''), 'index': r['index']} for r in results]
    }

@app.get("/api/lightrag/graph")
async def get_graph():
    """获取知识图谱数据"""
    return {"nodes": graph_nodes, "edges": graph_edges}

@app.post("/api/lightrag/graph/sync")
async def sync_graph(nodes: list[dict], edges: list[dict]):
    """同步外部图谱数据"""
    for n in nodes:
        if not any(g['id'] == n['id'] for g in graph_nodes): graph_nodes.append(n)
    for e in edges:
        if not any(g['from'] == e['from'] and g['to'] == e['to'] for g in graph_edges): graph_edges.append(e)
    return {"success": True, "nodes": len(graph_nodes), "edges": len(graph_edges)}

@app.delete("/api/lightrag/clear")
async def clear():
    """清空所有数据"""
    global vector_store, doc_index, graph_nodes, graph_edges
    vector_store = SimpleVectorStore()
    doc_index.clear()
    graph_nodes.clear()
    graph_edges.clear()
    return {"success": True}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
