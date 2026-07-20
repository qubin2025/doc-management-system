// 移动端水印引擎 — 纯函数实现，buildWatermarkLines 不依赖 DOM（可单测）
import { WatermarkTemplate, WatermarkContext } from '../types';

/** 主题配色：信息栏背景与强调色 */
export const WATERMARK_THEMES: Record<WatermarkTemplate['style']['theme'], { bar: string; accent: string }> = {
  dark: { bar: 'rgba(0,0,0,0.55)', accent: '#FBBF24' },
  blue: { bar: 'rgba(30,64,175,0.60)', accent: '#93C5FD' },
  orange: { bar: 'rgba(194,65,12,0.60)', accent: '#FDBA74' },
};

/** 按模板开关生成水印文本行（纯函数） */
export function buildWatermarkLines(template: WatermarkTemplate, ctx: WatermarkContext): string[] {
  const lines: string[] = [];
  const f = template.fields;
  if (f.time && ctx.time) lines.push(ctx.time);
  if (f.project && ctx.projectName) lines.push(`项目：${ctx.projectName}`);
  if (f.address && ctx.address) lines.push(`地点：${ctx.address}`);
  if (f.coords && ctx.latitude != null && ctx.longitude != null) {
    lines.push(`坐标：${ctx.latitude.toFixed(6)}, ${ctx.longitude.toFixed(6)}`);
  }
  if (f.photographer && ctx.photographer) lines.push(`拍摄：${ctx.photographer}`);
  if (f.customText.trim()) lines.push(f.customText.trim());
  return lines;
}

/** 格式化当前时间为水印用字符串 */
export function formatWatermarkTime(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 计算等比缩放后的尺寸，长边限制 maxEdge（默认2560，规避iOS Canvas面积上限并控制体积） */
export function fitSize(w: number, h: number, maxEdge = 2560): { w: number; h: number } {
  const longEdge = Math.max(w, h);
  if (longEdge <= maxEdge) return { w, h };
  const scale = maxEdge / longEdge;
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

const MAX_BLOB_BYTES = 18 * 1024 * 1024; // 后端 multer 限制20MB，留余量

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('图片导出失败'))), 'image/jpeg', quality);
  });
}

/**
 * 在 Canvas 上绘制图片 + 底部水印信息栏，导出 JPEG Blob。
 * 超过18MB时自动降低质量重试。
 */
export async function drawWatermark(
  img: HTMLImageElement,
  template: WatermarkTemplate,
  ctx: WatermarkContext,
  canvas: HTMLCanvasElement = document.createElement('canvas')
): Promise<Blob> {
  const { w, h } = fitSize(img.naturalWidth || img.width, img.naturalHeight || img.height);
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Canvas不可用');
  g.drawImage(img, 0, 0, w, h);

  const lines = buildWatermarkLines(template, ctx);
  if (lines.length > 0) {
    const theme = WATERMARK_THEMES[template.style.theme] || WATERMARK_THEMES.dark;
    const fontSize = Math.max(14, Math.round(w * 0.028));
    const lineHeight = Math.round(fontSize * 1.45);
    const padding = Math.round(fontSize * 0.8);
    const barHeight = lines.length * lineHeight + padding * 2;

    // 底部半透明信息栏
    g.fillStyle = theme.bar;
    g.fillRect(0, h - barHeight, w, barHeight);
    // 左侧强调色竖条
    g.fillStyle = theme.accent;
    g.fillRect(padding, h - barHeight + padding, Math.max(3, Math.round(fontSize * 0.18)), barHeight - padding * 2);

    g.font = `${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    g.fillStyle = '#FFFFFF';
    g.textBaseline = 'top';
    g.shadowColor = 'rgba(0,0,0,0.4)';
    g.shadowBlur = 2;
    const textX = template.style.position === 'bottomLeft' ? padding * 2 : padding * 2;
    lines.forEach((line, i) => {
      g.fillText(line, textX, h - barHeight + padding + i * lineHeight, w - padding * 3);
    });
  }

  let quality = 0.85;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > MAX_BLOB_BYTES && quality > 0.4) {
    quality -= 0.15;
    blob = await canvasToBlob(canvas, quality);
  }
  return blob;
}

/** 从 File 加载为 HTMLImageElement */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')); };
    img.src = url;
  });
}
