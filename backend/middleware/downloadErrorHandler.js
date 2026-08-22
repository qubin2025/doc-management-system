// 下载错误处理中间件
// 用途：统一捕获 /api/documents/download/* 路径的 4xx/5xx 错误，
//      增强日志可观测性，并对异常情况返回友好响应（不泄露敏感信息）
//
// 挂载方式：必须挂载在 documentsRouter **之前**，通过包装 res.json 拦截 4xx 响应
//   app.use('/api/documents/download', downloadErrorMiddleware);
//   app.use('/api/documents', documentsRouter);
//
// 设计原则：
//   1. 不泄露敏感信息（文件绝对路径、内部 stack）给客户端
//   2. 区分用户错误（401/403/404）和服务端错误（500），分别给出可操作建议
//   3. 安全审计：401/403 仍输出到日志（便于追查异常访问），但响应只给通用文案
//   4. 不修改路由内已有的成功响应，只增强 4xx/5xx 的日志和异常兜底

// ESM 静态导入早于 dotenv.config()，必须延迟读取 process.env
function getLogPrefix() {
  const tag = process.env.LOG_PREFIX_DOC_DOWNLOAD || 'DOC-DL';
  const env = process.env.LOG_ENV_TAG || '';
  return env ? `[${env}][${tag}]` : `[${tag}]`;
}

// 从 req 中提取 docId（兼容 app.use 子路径未解析 params 的情况）
function extractDocId(req) {
  if (req.params?.id) return req.params.id;
  // 从 path 中提取最后一段（/api/documents/download/26 → 26）
  const segs = (req.path || req.url || '').split('/').filter(Boolean);
  return segs[segs.length - 1] || 'unknown';
}

// 从 req 中提取 userId（兼容 auth 中间件前后两种情况）
function extractUserId(req) {
  return req.user?.username || req.headers['x-user'] || 'anonymous';
}

/**
 * 下载错误处理中间件
 * 1. 包装 res.json：当响应 4xx 时，记录详细日志（路由内的 res.status(404).json 会被拦截到）
 * 2. 包装 res.download：当流式下载出错时，记录 err.code 便于排查（EPIPE/ECONNABORTED 等）
 * 3. 异常兜底：路由内同步抛错且未捕获时，转 500 并返回友好响应
 *
 * 注意：req.user 由后续 requireAuth 中间件填充，必须在响应阶段而非入口阶段提取
 */
export function downloadErrorMiddleware(req, res, next) {
  // 缓存 ip 和 path（这些在入口就稳定了），user/docId 留到响应阶段再取
  const requestMeta = {
    ip: req.ip || req.socket?.remoteAddress || 'unknown',
    path: req.path || req.url,
  };

  // === 包装 res.json：拦截路由内主动发出的 4xx 响应 ===
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode >= 400) {
      // 此时 requireAuth 已执行，req.user 已填充
      const ctx = {
        docId: extractDocId(req),
        userId: extractUserId(req),
      };
      const reason = body?.error || '未指定';
      console.warn(`${getLogPrefix()} [${res.statusCode}响应] docId=${ctx.docId} user=${ctx.userId} ip=${requestMeta.ip} reason=${reason}`);
    }
    return originalJson(body);
  };

  // === 包装 res.download：拦截流式下载错误回调 ===
  const originalDownload = res.download.bind(res);
  res.download = function (path, filename, callback) {
    return originalDownload(path, filename, (err) => {
      if (err) {
        const ctx = {
          docId: extractDocId(req),
          userId: extractUserId(req),
        };
        console.error(`${getLogPrefix()} [流式下载错误] docId=${ctx.docId} user=${ctx.userId} file=${filename || path} error=${err.message} code=${err.code || 'N/A'}`);
        // 如果 headers 未发送，返回友好 JSON；已发送则只能终止连接
        if (!res.headersSent) {
          const statusCode = (err.code === 'ENOENT') ? 404 : 500;
          const safeMsg = (err.code === 'ENOENT') ? '文件不存在' : '下载失败';
          return res.status(statusCode).json({
            error: safeMsg,
            code: err.code || 'DOWNLOAD_ERROR',
            docId: ctx.docId,
            suggestion: statusCode === 404
              ? '文件不存在或已被清理，请重新上传'
              : '服务器异常，请稍后重试或联系管理员',
          });
        }
      }
      if (typeof callback === 'function') callback(err);
    });
  };

  // === 异常兜底：路由内同步抛错 ===
  try {
    next();
  } catch (err) {
    const statusCode = err.statusCode || err.status || 500;
    const safeMsg = statusCode >= 500 ? '服务器内部错误' : (err.message || '下载失败');

    const ctx = {
      docId: extractDocId(req),
      userId: extractUserId(req),
    };
    console.error(`${getLogPrefix()} [异常兜底] docId=${ctx.docId} user=${ctx.userId} ip=${requestMeta.ip} status=${statusCode} error=${err.message} code=${err.code || 'N/A'}`);
    if (statusCode >= 500) {
      console.error(`${getLogPrefix()} [异常兜底] 堆栈 ${err.stack?.split('\n').slice(0, 3).join(' | ')}`);
    }

    if (!res.headersSent) {
      return res.status(statusCode).json({
        error: safeMsg,
        code: err.code || 'DOWNLOAD_ERROR',
        docId: ctx.docId,
        suggestion: statusCode === 403
          ? '当前用户无下载权限，请联系管理员'
          : statusCode === 404
            ? '文件不存在或已被清理，请重新上传'
            : statusCode >= 500
              ? '服务器异常，请稍后重试或联系管理员'
              : '请检查请求参数',
      });
    }
  }
}

export default downloadErrorMiddleware;
