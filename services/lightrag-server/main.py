"""
LightRAG 知识引擎微服务 — v2.5.0 AI增强版
- AI实体抽取（DeepSeek API）
- 智能文本分块（段落+Token层级）
- 知识图谱构建（实体+关系）
- 向量嵌入（通义Embedding / 降级哈希）
- 混合检索（关键词+向量+图谱三路融合）
"""
import os, re, json, hashlib, logging
from typing import List, Dict, Optional, Tuple
from collections import defaultdict
import numpy as np

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("lightrag")

# ========== 配置 ==========
DEEPSEEK_BASE = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_KEY = os.getenv("DEEPSEEK_API_KEY", "")
EMBEDDING_KEY = os.getenv("DASHSCOPE_API_KEY", "")
EMBEDDING_DIM = 768

app = FastAPI(title="LightRAG Engine v2.5", version="2.5.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ========== 数据模型 ==========
class IndexRequest(BaseModel):
    text: str
    source: str = ""
    metadata: dict = Field(default_factory=dict)

class SearchRequest(BaseModel):
    query: str
    top_k: int = 10
    mode: str = "hybrid"

class SyncRequest(BaseModel):
    nodes: List[dict] = Field(default_factory=list)
    edges: List[dict] = Field(default_factory=list)

# ========== 内存存储 ==========
documents: List[dict] = []
graph_nodes: Dict[str, dict] = {}
graph_edges: List[dict] = []
graph_adj: Dict[str, List[str]] = defaultdict(list)
vectors: List[Tuple[str, List[float]]] = []

def _hash(s: str) -> str:
    return hashlib.md5(s.encode()).hexdigest()[:12]

# ========== 1. 智能分块 ==========
class SmartChunker:
    def __init__(self, max_chunk: int = 800, overlap: int = 100):
        self.max = max_chunk; self.overlap = overlap

    def chunk(self, text: str) -> List[str]:
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        chunks, current, cur_len = [], [], 0
        for p in paragraphs:
            if cur_len + len(p) > self.max and current:
                chunks.append('\n\n'.join(current))
                current = [current[-1]] if current else []; cur_len = len(current[0]) if current else 0
            current.append(p); cur_len += len(p)
        if current: chunks.append('\n\n'.join(current))
        return chunks if chunks else [text[:2000]]

chunker = SmartChunker()

# ========== 2. AI实体抽取 ==========
ENTITY_PROMPT = """你是工程咨询领域的实体识别专家。请从文本中提取关键实体和关系。
实体类型: PROJECT, LOCATION, PERSON, ORG, STANDARD, STRUCTURE, MATERIAL, METRIC, PHASE
关系类型: CONTAINS, REFERENCES, DEPENDS_ON, LOCATED_AT, BUILT_BY, GOVERNED_BY
严格输出JSON: {"entities":[{"name":"","type":"","desc":""}],"relations":[{"from":"","to":"","type":"","desc":""}]}"""

def extract_entities_ai(text: str) -> dict:
    if not DEEPSEEK_KEY: return extract_entities_regex(text)
    try:
        resp = __import__('requests').post(
            f"{DEEPSEEK_BASE}/chat/completions",
            headers={"Content-Type":"application/json","Authorization":f"Bearer {DEEPSEEK_KEY}"},
            json={"model":"deepseek-chat","messages":[{"role":"system","content":ENTITY_PROMPT},{"role":"user","content":text[:6000]}],"temperature":0.1,"max_tokens":2000},
            timeout=30,
        )
        if resp.status_code == 200:
            content = resp.json()["choices"][0]["message"]["content"]
            m = re.search(r'\{[\s\S]*\}', content)
            if m: return json.loads(m.group())
    except Exception as e: logger.warning(f"AI实体抽取失败: {e}")
    return extract_entities_regex(text)

def extract_entities_regex(text: str) -> dict:
    entities, seen = [], set()
    for m in re.finditer(r'(DB\d{2}/T\s*\d+[\-\u2014]\d+|GB\s*\d{4,}|JGJ\s*\d+|ISO\s*\d+)', text):
        if m.group() not in seen: seen.add(m.group()); entities.append({"name":m.group(),"type":"STANDARD","desc":"标准规范"})
    for m in re.finditer(r'([\u4e00-\u9fa5]{2,}(?:市|区|县|镇|街|路|村|省|园区|新区))', text):
        name = m.group()
        if name not in seen and len(name)<=8: seen.add(name); entities.append({"name":name,"type":"LOCATION","desc":"地点"})
    for m in re.finditer(r'(\d+(?:\.\d+)?\s*(?:万|亿)?\s*(?:m[²2]|平方米|公里|km|层|吨|元|万元|亿元|%))', text):
        if m.group() not in seen: seen.add(m.group()); entities.append({"name":m.group(),"type":"METRIC","desc":"技术指标"})
    for m in re.finditer(r'([\u4e00-\u9fa5]{2,4}(?:公司|集团|中心|局|院|所|处|室|部))', text):
        name = m.group()
        if name not in seen: seen.add(name); entities.append({"name":name,"type":"ORG","desc":"组织单位"})
    relations = []
    for i, e1 in enumerate(entities):
        for e2 in entities[i+1:i+5]:
            if e1["type"] in ("STANDARD",) and e2["type"] in ("STANDARD",): continue
            relations.append({"from":e1["name"],"to":e2["name"],"type":"REFERENCES","desc":"共现"})
    return {"entities":entities[:30],"relations":relations[:50]}

# ========== 3. 向量嵌入 ==========
def get_embeddings(texts: List[str]) -> List[List[float]]:
    if EMBEDDING_KEY:
        try:
            resp = __import__('requests').post(
                "https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding",
                headers={"Content-Type":"application/json","Authorization":f"Bearer {EMBEDDING_KEY}"},
                json={"model":"text-embedding-v2","input":{"texts":texts}},
                timeout=15,
            )
            if resp.status_code == 200:
                data = resp.json()
                return [e["embedding"] for e in data.get("output",{}).get("embeddings",[])]
        except Exception as e: logger.warning(f"Embedding API失败: {e}")
    # 降级哈希
    vecs = []
    for t in texts:
        np.random.seed(hash(t) % (2**31))
        vecs.append(np.random.randn(EMBEDDING_DIM).tolist())
    return vecs

def cosine_sim(a: List[float], b: List[float]) -> float:
    da, db = np.array(a), np.array(b)
    return float(np.dot(da, db) / (np.linalg.norm(da) * np.linalg.norm(db) + 1e-10))

# ========== 4. 知识图谱操作 ==========
def kg_search_subgraph(query: str, max_depth: int = 2) -> dict:
    matched = [nid for nid, n in graph_nodes.items() if query.lower() in n.get("label","").lower()]
    if not matched: return {"nodes":[],"edges":[]}
    visited = set(matched); frontier = set(matched)
    for _ in range(max_depth):
        new_f = set()
        for nid in frontier:
            for nb in graph_adj.get(nid, []):
                if nb not in visited: visited.add(nb); new_f.add(nb)
        frontier = new_f
    sub_nodes = [graph_nodes[nid] for nid in visited if nid in graph_nodes]
    sub_edges = [e for e in graph_edges if e["from"] in visited and e["to"] in visited]
    return {"nodes":sub_nodes,"edges":sub_edges}

# ========== 5. 关键词检索 ==========
def keyword_search(query: str, docs: List[dict], top_k: int = 10) -> List[dict]:
    terms = query.lower().split()
    scored = []
    for d in docs:
        c = d.get("content","").lower()
        score = sum(c.count(t) * (3 if t in c else 1) for t in terms)
        if score > 0: scored.append((d, score))
    scored.sort(key=lambda x:-x[1])
    return [d for d,_ in scored[:top_k]]

# ========== 6. 向量检索 ==========
def vector_search(query: str, top_k: int = 10) -> List[dict]:
    q_embed = get_embeddings([query])
    if not q_embed or len(vectors) == 0: return []
    scores = [(did, cosine_sim(q_embed[0], vec)) for did, vec in vectors]
    scores.sort(key=lambda x:-x[1])
    top_ids = {did for did, sc in scores[:top_k] if sc > 0.1}
    results = []
    seen = set()
    for did in top_ids:
        for d in documents:
            if d["id"] in did or any(d["id"] in cid for cid,_ in vectors[:1]):
                if d["id"] not in seen:
                    results.append({"source":d.get("source",""),"content":d["content"][:500],"score":0.9})
                    seen.add(d["id"])
                break
    return results

# ========== API 端点 ==========

@app.get("/api/lightrag/health")
async def health():
    return {
        "status":"ok","version":"2.5.0",
        "documents":len(documents),
        "entities":len(graph_nodes),
        "relations":len(graph_edges),
        "vectors":len(vectors),
        "ai_enabled":bool(DEEPSEEK_KEY),
        "embedding_enabled":bool(EMBEDDING_KEY),
    }

@app.post("/api/lightrag/index")
async def index_document(req: IndexRequest):
    if not req.text or len(req.text) < 10:
        raise HTTPException(400, "文本过短")
    doc_id = _hash(req.text[:200] + str(len(documents)))
    chunks = chunker.chunk(req.text)
    logger.info(f"索引: {req.source or doc_id[:8]} | {len(chunks)}块 | {len(req.text)}字")
    # 实体抽取
    er = extract_entities_ai(req.text)
    for ent in er.get("entities", []):
        eid = _hash(ent["name"])
        graph_nodes[eid] = {"id":eid,"label":ent["name"],"type":ent.get("type","ENTITY"),"props":{"desc":ent.get("desc","")}}
    for rel in er.get("relations", []):
        fid = _hash(rel["from"]); tid = _hash(rel["to"])
        if fid in graph_nodes and tid in graph_nodes:
            graph_edges.append({"from":fid,"to":tid,"type":rel.get("type","REFERENCES"),"label":rel.get("desc","")})
            graph_adj[fid].append(tid); graph_adj[tid].append(fid)
    # 向量
    embeds = get_embeddings(chunks[:20])
    for i, v in enumerate(embeds): vectors.append((f"{doc_id}_c{i}", v))
    documents.append({"id":doc_id,"source":req.source,"content":req.text,"chunks":chunks,"metadata":req.metadata})
    return {"ok":True,"doc_id":doc_id,"chunks":len(chunks),"entities":len(er.get("entities",[])),"relations":len(er.get("relations",[])),"ai_mode":"ai" if DEEPSEEK_KEY else "regex"}

@app.post("/api/lightrag/search")
async def search(req: SearchRequest):
    if not req.query.strip(): raise HTTPException(400, "查询为空")
    results, modes = [], []
    if req.mode in ("keyword","hybrid"):
        results.extend(keyword_search(req.query, documents, req.top_k))
        modes.append("keyword")
    if req.mode in ("vector","hybrid") and vectors:
        results.extend(vector_search(req.query, req.top_k))
        modes.append("vector")
    if req.mode in ("graph","hybrid"):
        sg = kg_search_subgraph(req.query)
        if sg["nodes"]:
            results.append({"nodes":[{"id":n["id"],"label":n["label"],"type":n["type"]} for n in sg["nodes"]],"edges":sg["edges"],"score":0.9})
            modes.append("graph")
    return {"ok":True,"results":results[:req.top_k],"total":len(results),"modes":modes}

@app.get("/api/lightrag/graph")
async def get_graph():
    return {"ok":True,"nodes":list(graph_nodes.values()),"edges":graph_edges}

@app.post("/api/lightrag/graph/sync")
async def sync_graph(req: SyncRequest):
    for n in req.nodes:
        nid = n.get("id",_hash(n.get("label",str(n))))
        graph_nodes[nid] = {"id":nid,"label":n.get("label",""),"type":n.get("type","entity"),"props":n.get("props",{})}
    for e in req.edges:
        graph_edges.append({"from":e.get("from",""),"to":e.get("to",""),"type":e.get("type","RELATED"),"label":e.get("label","")})
        graph_adj[e.get("from","")].append(e.get("to",""))
    return {"ok":True,"nodes":len(graph_nodes),"edges":len(graph_edges)}

# ========== 文档解析 API ==========
class ParseRequest(BaseModel):
    content: str = ""  # base64编码的文件内容
    filename: str = ""
    mime_type: str = ""

@app.post("/api/lightrag/parse")
async def parse_document(req: ParseRequest):
    """解析文档文本（支持PDF/Word/TXT，增强版）"""
    import base64, tempfile, os
    text = ""
    fname = req.filename.lower()

    # 如果直接传了文本
    if req.content and not req.content.startswith(("JVBER", "UEsDB", "0M8R")):
        if len(req.content) > 100:
            return {"ok": True, "text": req.content[:50000], "method": "direct"}

    # 尝试解码 base64
    try:
        raw = base64.b64decode(req.content) if req.content else b""
    except:
        return {"ok": False, "error": "无效的文件内容"}

    if fname.endswith('.pdf') or req.mime_type == 'application/pdf':
        try:
            import pdfplumber
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
                f.write(raw); f.flush(); tmp = f.name
            try:
                with pdfplumber.open(tmp) as pdf:
                    texts = [page.extract_text() or '' for page in pdf.pages[:50]]
                text = '\n'.join(texts)
                if not text.strip():
                    text = "PDF解析结果为空（可能是扫描件，建议转Word后上传）"
            finally: os.unlink(tmp)
            return {"ok": True, "text": text[:50000], "method": "pdfplumber"}
        except ImportError:
            pass  # 降级到node端解析

    if fname.endswith(('.docx', '.doc')) or 'word' in req.mime_type:
        # docx is handled by mammoth on node side
        if not text:
            text = "(Word文档请在浏览器端解析)"
        return {"ok": True, "text": text, "method": "passthrough"}

    if fname.endswith('.txt') or req.mime_type == 'text/plain':
        try:
            text = raw.decode('utf-8')
        except:
            try: text = raw.decode('gbk')
            except: text = raw.decode('latin-1')
        return {"ok": True, "text": text[:50000], "method": "text"}

    return {"ok": False, "error": f"不支持的文件类型: {fname.split('.')[-1]}"}

@app.delete("/api/lightrag/clear")
async def clear():
    documents.clear(); graph_nodes.clear(); graph_edges.clear(); graph_adj.clear(); vectors.clear()
    return {"ok":True}

if __name__ == "__main__":
    port = int(os.getenv("LIGHTRAG_PORT","8000"))
    logger.info(f"LightRAG v2.5 :{port} | AI={'ON' if DEEPSEEK_KEY else 'OFF'} | Embed={'ON' if EMBEDDING_KEY else '降级'}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
