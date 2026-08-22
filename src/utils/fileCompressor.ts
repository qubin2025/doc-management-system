/**
 * v6.0 前端文件压缩工具
 *
 * 支持：
 * - 图片压缩（JPG/PNG/WebP）：canvas 降采样 + 质量压缩
 * - 文件类型检测与压缩建议
 *
 * 不支持（浏览器端限制）：
 * - PDF 内部图片压缩（需 pdf-lib，且扫描型PDF压缩效果有限）
 * - CAD .dwg 压缩（二进制专有格式）
 * - Office 文档内部压缩（DOCX/XLSX 已是 ZIP 容器，再压缩效果有限）
 *
 * 对于不支持的类型，提示用户使用专业工具压缩后上传。
 */

export interface CompressResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  ratio: number; // 压缩率 (0-1)
  skipped: boolean; // 是否跳过压缩（不支持的类型或压缩后更大）
}

export interface CompressOptions {
  maxWidth?: number;      // 图片最大宽度（默认 1920）
  maxHeight?: number;     // 图片最大高度（默认 1920）
  quality?: number;       // JPEG/WebP 质量 0-1（默认 0.7）
  outputFormat?: 'image/jpeg' | 'image/webp' | 'original'; // 输出格式
  onProgress?: (percent: number) => void;
}

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const DEFAULT_OPTIONS: Required<Omit<CompressOptions, 'onProgress'>> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.7,
  outputFormat: 'original',
};

/** 判断文件是否可在浏览器端压缩 */
export function isCompressible(file: File): boolean {
  return IMAGE_TYPES.includes(file.type);
}

/** 获取压缩建议文字 */
export function getCompressSuggestion(file: File): string {
  const sizeMB = file.size / 1024 / 1024;
  if (isCompressible(file)) {
    if (sizeMB > 5) {
      return `图片 ${sizeMB.toFixed(1)}MB，建议压缩后上传（可减少约 50-70% 体积）`;
    }
    return '图片文件，可选择压缩以加快上传';
  }
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    if (sizeMB > 50) {
      return `PDF ${sizeMB.toFixed(1)}MB，如为扫描件建议使用专业工具（如 Adobe/小猿）压缩图片分辨率后上传`;
    }
    return 'PDF 文件，文本型PDF无需压缩；扫描型PDF建议用专业工具压缩';
  }
  if (file.name.toLowerCase().match(/\.(dwg|dxf)$/)) {
    return `CAD图纸 ${sizeMB.toFixed(1)}MB，CAD格式无法在浏览器端压缩，将直接流式上传`;
  }
  if (file.name.toLowerCase().endsWith('.zip')) {
    return `ZIP压缩包 ${sizeMB.toFixed(1)}MB，系统将自动解压并索引内部文档`;
  }
  return '';
}

/**
 * 压缩图片文件
 * 使用 canvas 进行降采样和质量压缩
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<CompressResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = file.size;

  if (!isCompressible(file)) {
    return { file, originalSize, compressedSize: originalSize, ratio: 1, skipped: true };
  }

  opts.onProgress?.(10);

  // 加载图片
  const img = await loadImage(file);
  opts.onProgress?.(30);

  // 计算缩放后的尺寸
  let { width, height } = img;
  const scale = Math.min(1, opts.maxWidth / width, opts.maxHeight / height);
  if (scale < 1) {
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  opts.onProgress?.(50);

  // 绘制到 canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 canvas 上下文');

  // PNG 保留透明背景，JPEG 填充白色
  const outputFormat = opts.outputFormat === 'original'
    ? (file.type === 'image/png' ? 'image/png' : 'image/jpeg')
    : opts.outputFormat;

  if (outputFormat === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);

  opts.onProgress?.(70);

  // 导出为 blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('canvas 导出失败')),
      outputFormat,
      outputFormat === 'image/png' ? undefined : opts.quality
    );
  });

  opts.onProgress?.(90);

  // 如果压缩后更大，保留原文件
  if (blob.size >= originalSize) {
    return { file, originalSize, compressedSize: originalSize, ratio: 1, skipped: true };
  }

  // 生成新文件名
  const ext = outputFormat === 'image/png' ? '.png' : outputFormat === 'image/webp' ? '.webp' : '.jpg';
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const newFileName = `${baseName}_compressed${ext}`;

  const compressedFile = new File([blob], newFileName, { type: outputFormat });

  opts.onProgress?.(100);

  return {
    file: compressedFile,
    originalSize,
    compressedSize: blob.size,
    ratio: blob.size / originalSize,
    skipped: false,
  };
}

/** 加载图片为 HTMLImageElement */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };
    img.src = url;
  });
}

/** 格式化文件大小 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
