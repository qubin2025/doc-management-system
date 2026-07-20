// 一次性脚本：纯 Node 生成 PWA 图标（蓝底圆角 + 白色相机图形）
// 用法: node scripts/generate-pwa-icons.mjs
import { deflateSync } from 'zlib';
import { writeFileSync } from 'fs';

// ---- PNG 编码（RGBA, 8bit, colortype 6）----
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // bit depth 8, RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- 图形绘制 ----
const BLUE = [59, 130, 246, 255];   // #3B82F6
const WHITE = [255, 255, 255, 255];
const DEEP = [30, 64, 175, 255];    // #1E40AF 镜头

function inRoundRect(x, y, rx, ry, rw, rh, r) {
  if (x < rx || x >= rx + rw || y < ry || y >= ry + rh) return false;
  const cx = Math.max(rx + r, Math.min(x, rx + rw - r));
  const cy = Math.max(ry + r, Math.min(y, ry + rh - r));
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r || (x >= rx + r && x < rx + rw - r) || (y >= ry + r && y < ry + rh - r);
}
const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

function drawIcon(size) {
  const s = size / 512; // 以512为基准缩放
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let color = [0, 0, 0, 0];
      // 背景圆角矩形
      if (inRoundRect(x, y, 0, 0, size, size, 100 * s)) color = BLUE;
      // 相机机身
      if (inRoundRect(x, y, 96 * s, 176 * s, 320 * s, 220 * s, 36 * s)) color = WHITE;
      // 取景器凸起
      if (inRoundRect(x, y, 196 * s, 136 * s, 120 * s, 60 * s, 20 * s)) color = WHITE;
      // 镜头外圈
      if (inCircle(x, y, 256 * s, 286 * s, 78 * s)) color = DEEP;
      // 镜头内圈
      if (inCircle(x, y, 256 * s, 286 * s, 46 * s)) color = BLUE;
      // 高光点
      if (inCircle(x, y, 238 * s, 268 * s, 12 * s)) color = WHITE;
      // 闪光灯
      if (inRoundRect(x, y, 356 * s, 200 * s, 36 * s, 24 * s, 8 * s)) color = BLUE;
      const i = (y * size + x) * 4;
      buf[i] = color[0]; buf[i + 1] = color[1]; buf[i + 2] = color[2]; buf[i + 3] = color[3];
    }
  }
  return encodePNG(size, size, buf);
}

writeFileSync('public/pwa-192.png', drawIcon(192));
writeFileSync('public/pwa-512.png', drawIcon(512));
console.log('已生成 public/pwa-192.png, public/pwa-512.png');
