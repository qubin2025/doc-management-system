"""
PaddleOCR 统一文档解析服务 — v2.5.0
全格式覆盖: PDF(文字+扫描件) | DOC/DOCX | XLS/XLSX | 图片(OCR) | TXT
全局解析入口，替代 pdfjs+mammoth+xlsx+AI Vision 拼凑方案
"""
import os, tempfile, logging, base64, io, sys, time, platform
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

_BOOT_T0 = time.time()

def _bootlog(level: str, msg: str, detail: str = ""):
    ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    tail = f" | {detail}" if detail else ""
    line = f"{ts} [PADDLEOCR] {level.upper():<6} {msg}{tail}"
    if level in ("error", "fatal", "warn"):
        print(line, file=sys.stderr, flush=True)
    else:
        print(line, flush=True)

_bootlog("phase", "0: BOOTSTRAP")
_bootlog("info",  "cwd", os.getcwd())
_bootlog("info",  "python", f"{sys.version.split()[0]}  platform={platform.platform()}")
_bootlog("info",  "pid",    f"{os.getpid()}  executable={sys.executable}")
_bootlog("info",  "argv",   " ".join(sys.argv))

try:
    import uvicorn
    _bootlog("ok", "FastAPI & uvicorn import", "ok")
except Exception as _e:
    _bootlog("fatal", "FastAPI import FAILED", f"{type(_e).__name__}: {_e}")
    _bootlog("info", "HINT", "pip install fastapi uvicorn pydantic python-multipart pdfplumber python-docx openpyxl xlrd Pillow numpy")
    _bootlog("info", "HINT", "OCR引擎: pip install easyocr   (or paddleocr / pytesseract)")
    sys.exit(2)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("paddleparser")

_bootlog("phase", "1: FASTAPI INIT")
try:
    app = FastAPI(title="PaddleOCR Document Parser v2.5", version="2.5.0")
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
    _bootlog("ok", "FastAPI app created", "CORS=*")
except Exception as _e:
    _bootlog("fatal", "FastAPI app create FAILED", f"{type(_e).__name__}: {_e}")
    sys.exit(3)

# 延迟初始化(优先EasyOCR→PaddleOCR→tesseract)
_ocr = None
_ocr_engine = None  # 'easyocr' | 'paddleocr' | 'tesseract' | None

_bootlog("phase", "2: OCR ENGINE LAZY-INIT")
_bootlog("info", "OCR engine will initialize lazily", "chain: EasyOCR → PaddleOCR → Tesseract")


# ========== v5.6: 启动时预加载 OCR 模型 ==========
# 通过 FastAPI lifespan 在 uvicorn 启动前预加载,避免首次请求触发 lazy-init 阻塞
@app.on_event("startup")
async def _preload_ocr_on_startup():
    _bootlog("phase", "2.0: OCR PRELOAD ON STARTUP")
    t0 = time.time()
    try:
        ocr = get_ocr()
        if ocr is not None:
            _bootlog("ok", "OCR model preloaded on startup", f"engine={_ocr_engine}  elapsed={time.time()-t0:.2f}s")
        else:
            _bootlog("warn", "OCR engine unavailable at startup", "图像/扫描件解析将不可用")
    except Exception as e:
        _bootlog("warn", "OCR preload failed (lazy-init still works on first call)", f"{type(e).__name__}: {str(e)[:120]}")


def get_ocr():
    global _ocr, _ocr_engine
    if _ocr is not None:
        return _ocr if _ocr is not False else None

    _bootlog("phase", "2.1: OCR INIT — 1st call")

    # 1) EasyOCR（最稳定，模型内置pip包）
    _bootlog("info", "Try: EasyOCR")
    try:
        t0 = time.time()
        import easyocr
        _ocr = easyocr.Reader(['ch_sim', 'en'], gpu=False, verbose=False)
        _ocr_engine = 'easyocr'
        _bootlog("ok", "EasyOCR initialized", f"{time.time()-t0:.2f}s  languages=ch_sim+en  gpu=False")
        logger.info("EasyOCR 初始化完成 (中文+英文)")
        return _ocr
    except Exception as e:
        _bootlog("warn", "EasyOCR failed", f"{type(e).__name__}: {str(e)[:120]}")
        logger.warning(f"EasyOCR失败: {e}")

    # 2) PaddleOCR（需要联网下载模型）
    _bootlog("info", "Try: PaddleOCR")
    try:
        t0 = time.time()
        os.environ.setdefault('PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK', 'True')
        from paddleocr import PaddleOCR
        _ocr = PaddleOCR(lang='ch', use_doc_orientation_classify=False, use_doc_unwarping=False)
        _ocr_engine = 'paddleocr'
        _bootlog("ok", "PaddleOCR initialized", f"{time.time()-t0:.2f}s")
        logger.info("PaddleOCR 初始化完成")
        return _ocr
    except Exception as e:
        _bootlog("warn", "PaddleOCR failed", f"{type(e).__name__}: {str(e)[:120]}")
        logger.warning(f"PaddleOCR失败: {e}")

    # 3) Tesseract（最后降级）
    _bootlog("info", "Try: Tesseract")
    try:
        t0 = time.time()
        import pytesseract
        _ocr = pytesseract
        _ocr_engine = 'tesseract'
        _bootlog("ok", "Tesseract OCR available", f"{time.time()-t0:.2f}s")
        logger.info("Tesseract OCR 可用")
        return _ocr
    except Exception as e:
        _bootlog("warn", "Tesseract failed", f"{type(e).__name__}: {str(e)[:120]}")
        logger.warning(f"Tesseract失败: {e}")

    _ocr = False
    _bootlog("warn", "All OCR engines unavailable", "解析图片/扫描件需要至少安装1种OCR：pip install easyocr")
    return None

# ========== 数据模型 ==========
class ParseRequest(BaseModel):
    content: str = ""        # base64编码的文件内容
    filename: str = ""
    mime_type: str = ""
    max_chars: int = 50000  # 最大返回字符数

class ParseResponse(BaseModel):
    ok: bool
    text: str = ""
    pages: int = 0
    tables: int = 0
    method: str = ""
    error: str = ""
    ocr_pages: int = 0      # 使用OCR的页数

# ========== 核心解析函数 ==========

def _decode_file(content: str) -> bytes:
    """解码base64文件内容"""
    if not content: return b""
    # 如果已经是纯文本
    if not any(content.startswith(p) for p in ("JVBER", "UEsDB", "0M8R", "iVBOR", "/9j/")):
        return content.encode("utf-8")
    try:
        return base64.b64decode(content)
    except:
        return content.encode("utf-8")

def parse_pdf_text(raw: bytes, max_chars: int = 50000) -> tuple[str, int, int]:
    """解析文字型PDF (pdfplumber)"""
    import pdfplumber
    text_parts = []
    page_count = 0
    table_count = 0
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
        f.write(raw); f.flush(); tmp = f.name
    try:
        with pdfplumber.open(tmp) as pdf:
            for page in pdf.pages[:100]:
                page_count += 1
                pt = page.extract_text()
                if pt: text_parts.append(pt)
                # 提取表格
                tables = page.extract_tables()
                for t in tables:
                    if t:
                        text_parts.append(_table_to_text(t))
                        table_count += 1
                if sum(len(t) for t in text_parts) >= max_chars: break
    finally:
        os.unlink(tmp)
    text = '\n'.join(text_parts)
    return text, page_count, table_count

def parse_pdf_ocr(raw: bytes, max_chars: int = 50000) -> tuple[str, int]:
    """OCR解析图片型PDF"""
    ocr = get_ocr()
    if not ocr: return "", 0
    from PIL import Image
    import numpy as np
    import fitz  # pymupdf
    text_parts = []
    ocr_pages = 0
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
        f.write(raw); f.flush(); tmp = f.name
    try:
        doc = fitz.open(tmp)
        for page_num in range(min(len(doc), 50)):
            page = doc[page_num]
            page_text = page.get_text()
            if page_text.strip() and len(page_text) > 100:
                text_parts.append(page_text)
            else:
                pix = page.get_pixmap(dpi=200)
                img = Image.open(io.BytesIO(pix.tobytes("png"))).convert('RGB')
                img_arr = np.array(img)
                # 引擎适配
                if _ocr_engine == 'easyocr':
                    results = ocr.readtext(img_arr)
                    ocr_text = '\n'.join(text for _, text, conf in results if conf > 0.3)
                elif _ocr_engine == 'paddleocr':
                    result = ocr.ocr(img_arr, cls=True)
                    ocr_text = '\n'.join(line[1][0] for line in result[0] if line) if result and result[0] else ''
                elif _ocr_engine == 'tesseract':
                    ocr_text = ocr.image_to_string(img, lang='chi_sim+eng')
                else:
                    ocr_text = ''
                if ocr_text.strip():
                    text_parts.append(ocr_text)
                    ocr_pages += 1
            if sum(len(t) for t in text_parts) >= max_chars: break
    finally:
        os.unlink(tmp)
    return '\n'.join(text_parts), ocr_pages

def parse_docx_text(raw: bytes, max_chars: int = 50000) -> str:
    """解析 .docx"""
    from docx import Document
    with tempfile.NamedTemporaryFile(suffix='.docx', delete=False) as f:
        f.write(raw); f.flush(); tmp = f.name
    try:
        doc = Document(tmp)
        text = '\n'.join(p.text for p in doc.paragraphs if p.text.strip())
        # 提取表格
        for table in doc.tables:
            for row in table.rows:
                row_text = ' | '.join(cell.text for cell in row.cells if cell.text.strip())
                if row_text.strip(): text += '\n' + row_text
        return text[:max_chars]
    finally: os.unlink(tmp)

def parse_doc_text(raw: bytes) -> str:
    """解析 .doc (通过python-docx无法处理旧版，尝试提取文本)"""
    # .doc二进制格式: 尝试提取可读文本段
    text = raw.decode('latin-1', errors='ignore')
    # 提取可读中英文片段
    import re
    parts = re.findall(r'[\u4e00-\u9fa5a-zA-Z0-9\s\-,.;:!?+/%=()\[\]{}]{3,}', text)
    return '\n'.join(p for p in parts if len(p) > 5)[:50000]

def parse_xlsx_text(raw: bytes, max_chars: int = 50000) -> str:
    """解析 .xlsx"""
    import openpyxl
    with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as f:
        f.write(raw); f.flush(); tmp = f.name
    try:
        wb = openpyxl.load_workbook(tmp, data_only=True)
        text_parts = []
        for sname in wb.sheetnames:
            ws = wb[sname]
            text_parts.append(f"\n## {sname}")
            for row in ws.iter_rows(values_only=True):
                row_text = ' | '.join(str(c) for c in row if c is not None)
                if row_text.strip(): text_parts.append(row_text)
            if sum(len(t) for t in text_parts) >= max_chars: break
        return '\n'.join(text_parts)[:max_chars]
    finally: os.unlink(tmp)

def parse_xls_text(raw: bytes, max_chars: int = 50000) -> str:
    """解析 .xls"""
    import xlrd
    with tempfile.NamedTemporaryFile(suffix='.xls', delete=False) as f:
        f.write(raw); f.flush(); tmp = f.name
    try:
        wb = xlrd.open_workbook(tmp)
        text_parts = []
        for sname in wb.sheet_names():
            ws = wb.sheet_by_name(sname)
            text_parts.append(f"\n## {sname}")
            for row_idx in range(min(ws.nrows, 1000)):
                row_text = ' | '.join(str(ws.cell_value(row_idx, c)) for c in range(ws.ncols) if ws.cell_value(row_idx, c))
                if row_text.strip(): text_parts.append(row_text)
            if sum(len(t) for t in text_parts) >= max_chars: break
        return '\n'.join(text_parts)[:max_chars]
    finally: os.unlink(tmp)

def parse_image_ocr(raw: bytes) -> str:
    """OCR识别图片(自动选择引擎)"""
    ocr = get_ocr()
    if not ocr: return ""
    from PIL import Image
    import numpy as np
    img = Image.open(io.BytesIO(raw)).convert('RGB')
    img_arr = np.array(img)

    if _ocr_engine == 'easyocr':
        results = ocr.readtext(img_arr)
        return '\n'.join(text for _, text, conf in results if conf > 0.3)
    elif _ocr_engine == 'paddleocr':
        result = ocr.ocr(img_arr, cls=True)
        if result and result[0]:
            return '\n'.join(line[1][0] for line in result[0] if line)
    elif _ocr_engine == 'tesseract':
        return ocr.image_to_string(img, lang='chi_sim+eng')
    return ""

def _table_to_text(table: list) -> str:
    """表格转文本"""
    lines = []
    for row in table:
        if row and any(c for c in row if c):
            lines.append(' | '.join(str(c) if c else '' for c in row))
    return '\n'.join(lines)


# ========== API 端点 ==========
_bootlog("phase", "3: ROUTES")
_bootlog("info", "Registering /api/parse/* endpoints", "health·document  total=2")

@app.get("/api/parse/health")
async def health():
    ocr = get_ocr()
    return {
        "status": "ok",
        "version": "2.5.0",
        "ocr_available": ocr is not None,
        "ocr_engine": _ocr_engine or "none",
        "formats": ["pdf","doc","docx","xls","xlsx","png","jpg","jpeg","bmp","tiff","txt","csv"],
    }
_bootlog("ok", "Mounted GET", "/api/parse/health  (lazy-triggers OCR init)")

@app.post("/api/parse/document")
async def parse_document(req: ParseRequest):
    """
    统一文档解析入口
    支持: PDF(文字+扫描件) | DOC | DOCX | XLS | XLSX | 图片 | TXT | CSV
    """
    raw = _decode_file(req.content)
    fname = req.filename.lower()
    mime = req.mime_type.lower()
    max_chars = req.max_chars

    logger.info(f"解析请求: {fname} ({len(raw)} bytes)")

    # === PDF ===
    if fname.endswith('.pdf') or mime == 'application/pdf' or 'pdf' in mime:
        # 第一步: 文字提取
        text, pages, tables = parse_pdf_text(raw, max_chars)
        if text.strip() and len(text.strip()) > 200:
            return {"ok": True, "text": text[:max_chars], "pages": pages, "tables": tables, "method": "pdfplumber+文字层"}

        # 第二步: OCR(扫描件)
        logger.info("文字层为空，启动OCR...")
        ocr_text, ocr_pages = parse_pdf_ocr(raw, max_chars)
        if ocr_text.strip():
            return {"ok": True, "text": ocr_text[:max_chars], "pages": pages, "tables": tables, "ocr_pages": ocr_pages, "method": "PaddleOCR(扫描件)"}
        return {"ok": False, "error": "PDF解析失败：既无文字层，OCR也未识别到内容。请确认文件并非损坏的扫描件。"}

    # === DOCX ===
    if fname.endswith('.docx') or 'officedocument.wordprocessingml' in mime or 'word' in fname:
        try:
            text = parse_docx_text(raw, max_chars)
            if text.strip(): return {"ok": True, "text": text[:max_chars], "method": "python-docx"}
        except Exception as e:
            logger.warning(f"docx解析失败: {e}")

    # === DOC (旧版) ===
    if fname.endswith('.doc') and not fname.endswith('.docx'):
        text = parse_doc_text(raw)
        if text.strip() and len(text) > 100:
            return {"ok": True, "text": text[:max_chars], "method": "binary-extract(.doc)"}
        return {"ok": False, "error": "无法解析旧版.doc文件。请用Word打开后另存为.docx格式再上传。"}

    # === XLSX ===
    if fname.endswith('.xlsx') or 'spreadsheetml' in mime:
        try:
            text = parse_xlsx_text(raw, max_chars)
            if text.strip(): return {"ok": True, "text": text[:max_chars], "method": "openpyxl"}
        except Exception as e:
            logger.warning(f"xlsx解析失败: {e}")

    # === XLS (旧版) ===
    if fname.endswith('.xls') and not fname.endswith('.xlsx'):
        try:
            text = parse_xls_text(raw, max_chars)
            if text.strip(): return {"ok": True, "text": text[:max_chars], "method": "xlrd"}
        except Exception as e:
            logger.warning(f"xls解析失败: {e}")

    # === 图片 OCR ===
    if fname.endswith(('.png','.jpg','.jpeg','.bmp','.tiff','.webp','.gif')) or mime.startswith('image/'):
        try:
            text = parse_image_ocr(raw)
            if text.strip(): return {"ok": True, "text": text[:max_chars], "method": "PaddleOCR(图片)"}
        except Exception as e:
            logger.warning(f"图片OCR失败: {e}")
        return {"ok": False, "error": "图片OCR未识别到文字。请确认图片清晰且包含可识别文字。"}

    # === 纯文本 ===
    if fname.endswith(('.txt','.csv','.md','.json','.xml','.html')):
        try:
            text = raw.decode('utf-8')
        except:
            try: text = raw.decode('gbk')
            except: text = raw.decode('latin-1', errors='ignore')
        return {"ok": True, "text": text[:max_chars], "method": "text"}

    # 未知格式降级
    try:
        text = raw.decode('utf-8')
        if len(text) > 50: return {"ok": True, "text": text[:max_chars], "method": "text(fallback)"}
    except: pass

    return {"ok": False, "error": f"不支持的文件格式: {fname.split('.')[-1] if '.' in fname else '未知'}"}
_bootlog("ok", "Mounted POST", "/api/parse/document  (handles pdf/doc/docx/xls/xlsx/img/txt)")

_bootlog("ok", "All routes mounted", "count=2")

# ========== 启动 ==========
_bootlog("phase", "4: UVICORN STARTUP")
if __name__ == "__main__":
    try:
        import numpy as np  # noqa: F401 — 启动时预先检查 numpy
        _bootlog("ok", "NumPy pre-check", f"version={np.__version__}")
    except Exception as _e:
        _bootlog("warn", "NumPy not available (will lazily import)", f"{type(_e).__name__}: {_e}")

    port = int(os.getenv("PADDLEOCR_PORT", "8001"))
    host = os.getenv("PADDLEOCR_HOST", "0.0.0.0")
    log_level = os.getenv("PADDLEOCR_LOG_LEVEL", "info")
    _bootlog("info", "About to call uvicorn.run", f"host={host}  port={port}  log_level={log_level}")
    _bootlog("ok",   "Start summary", f"PaddleOCR Parser v2.5 :{port}  readyTime={time.time()-_BOOT_T0:.2f}s")
    try:
        uvicorn.run(app, host=host, port=port, log_level=log_level)
    except OSError as _e:
        if "address already in use" in str(_e).lower():
            _bootlog("fatal", f"PORT {port} ALREADY IN USE (EADDRINUSE)", "→ 请先关闭占用进程: netstat -ano | findstr :"+str(port))
        else:
            _bootlog("fatal", "uvicorn.run OSError", f"{type(_e).__name__}: {_e}")
        sys.exit(4)
    except KeyboardInterrupt:
        _bootlog("info", "KeyboardInterrupt — exiting")
        sys.exit(0)
    except Exception as _e:
        _bootlog("fatal", "uvicorn.run UNEXPECTED", f"{type(_e).__name__}: {_e}")
        sys.exit(5)
    finally:
        _bootlog("info", "uvicorn.run returned", f"totalRun={time.time()-_BOOT_T0:.2f}s")
