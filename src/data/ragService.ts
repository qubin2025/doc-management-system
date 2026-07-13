// RAG 检索增强生成 — 查询→向量化→Top-K检索→拼接上下文→AI回答

import * as api from './api';
import { vectorStore, VectorDoc } from './vectorStore';
import * as documentParser from './documentParser';
import { autoChunk } from './chunker';

/** 索引文档：文件→文本→分块→向量→存储 (P0-2: 整合chunker) */
export async function indexDocument(
  file: File,
  projectName: string,
): Promise<{ text: string; chunks: number }> {
  const text = await documentParser.parseDocument(file);
  if (!text || text.trim().length === 0) {
    throw new Error('文档内容为空，无法索引');
  }

  // 智能分块（修复chunker未使用的问题）
  const chunks = autoChunk(text, 1500);

  // 逐块向量化并存储
  let indexedCount = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const embedding = await api.embedText(chunk.text, 'document');
      if (embedding && embedding.length > 0) {
        vectorStore.addDocument(chunk.text, embedding, {
          projectName,
          fileName: file.name,
          fileType: file.type,
          chunkIndex: i,
          chunkCount: chunks.length,
          uploadTime: new Date().toISOString(),
        });
        indexedCount++;
      }
    } catch { /* skip failed chunk */ }
  }

  return { text: text.slice(0, 200), chunks: indexedCount };
}

/** RAG查询：用户问题→向量化→检索相关文档→拼接上下文→增强AI回答 */
export async function ragQuery(
  userMessage: string,
  projectName: string,
  options?: {
    topK?: number;
    systemPrompt?: string;
    model?: string;
  },
): Promise<{
  answer: string;
  sources: VectorDoc[];
}> {
  const topK = options?.topK || 3;

  // 1. 查询向量化（使用 query 模式）
  const queryEmbedding = await api.embedText(userMessage, 'query');

  // 2. 检索相关文档
  const relatedDocs = vectorStore.search(queryEmbedding, projectName, topK);
  const sources = relatedDocs;

  // 3. 构建上下文
  let contextStr = '';
  if (relatedDocs.length > 0) {
    contextStr = relatedDocs
      .map((d, i) => `[参考资料${i + 1}] 来源: ${d.metadata?.fileName || '未知文档'}\n${d.text}`)
      .join('\n\n---\n\n');
  }

  // 4. 构建增强消息
  const augmentedMessages = [{
    role: 'user' as const,
    content: contextStr
      ? `以下是已上传项目文档的相关内容，请基于这些内容回答用户问题。如果参考资料不足以回答问题，请明确说明。\n\n${contextStr}\n\n用户问题: ${userMessage}`
      : userMessage,
  }];

  // 5. 调用AI（使用增强上下文）
  const systemPrompt = options?.systemPrompt ||
    `你是全过程工程咨询管理系统的AI助手。当前项目: ${projectName}。
请基于提供的参考资料回答问题，引用时标注来源。如果参考资料中没有相关信息，请如实告知。`;

  const answer = await api.aiChat(augmentedMessages, systemPrompt, {
    projectName,
    model: options?.model,
  });

  return { answer, sources };
}

/** 获取项目索引统计 */
export function getIndexStats(projectName: string): { count: number; sizeKB: number } {
  return vectorStore.stats(projectName);
}

/** 清空项目索引 */
export function clearProjectIndex(projectName: string): void {
  vectorStore.clearProject(projectName);
}
