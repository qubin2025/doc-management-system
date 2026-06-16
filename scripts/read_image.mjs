#!/usr/bin/env node
/**
 * 图片读取与 OCR 识别 — 全局技能脚本
 * 基于 tesseract.js (纯 JS，无需外部依赖)，支持中英文 OCR
 *
 * 用法: node scripts/read_image.mjs <图片路径> [--lang chi_sim+eng]
 */

import { createWorker } from 'tesseract.js';
import { readFileSync, existsSync } from 'fs';
import { basename, resolve } from 'path';

async function main() {
  const args = process.argv.slice(2);
  const imagePath = args.find(a => !a.startsWith('--'));
  const lang = args.find(a => a.startsWith('--lang='))?.split('=')[1] || 'chi_sim+eng';

  if (!imagePath) {
    console.log('用法: node scripts/read_image.mjs <图片路径> [--lang=chi_sim+eng]');
    process.exit(1);
  }

  const absPath = resolve(imagePath);
  if (!existsSync(absPath)) {
    console.log(`错误: 文件不存在 — ${absPath}`);
    process.exit(1);
  }

  console.log(`正在识别: ${basename(absPath)}`);
  console.log(`语言: ${lang}`);
  console.log('─'.repeat(50));

  const worker = await createWorker(lang);

  try {
    const { data } = await worker.recognize(absPath);
    console.log(`识别结果:`);
    console.log('─'.repeat(50));
    console.log(data.text.trim() || '(未识别到文字)');
    console.log('─'.repeat(50));
    console.log(`置信度: ${(data.confidence || 0).toFixed(1)}%`);
  } finally {
    await worker.terminate();
  }
}

main().catch(err => {
  console.error('识别失败:', err.message);
  process.exit(1);
});
