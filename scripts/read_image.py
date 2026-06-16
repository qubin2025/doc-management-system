#!/usr/bin/env python3
"""图片读取与 OCR 识别工具 — 全局技能脚本
用法: python scripts/read_image.py <图片路径> [--lang chi_sim+eng]
"""

import sys
import os
import argparse
from PIL import Image

def read_image_info(path):
    """读取图片基本信息"""
    img = Image.open(path)
    return {
        'format': img.format,
        'size': img.size,
        'mode': img.mode,
        'width': img.width,
        'height': img.height,
        'dpi': img.info.get('dpi', 'N/A'),
    }

def ocr_with_tesseract(path, lang='eng'):
    """使用 Tesseract OCR 提取文字"""
    try:
        import pytesseract
        pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        img = Image.open(path)
        text = pytesseract.image_to_string(img, lang=lang)
        return text.strip()
    except ImportError:
        return None
    except Exception as e:
        return f"[Tesseract 错误: {e}]"

def ocr_with_cnocr(path):
    """使用 CnOCR 提取文字（中文优化）"""
    try:
        from cnocr import CnOcr
        ocr = CnOcr()
        img = Image.open(path)
        if img.mode == 'RGBA':
            img = img.convert('RGB')
        out = ocr.ocr(img)
        lines = []
        for item in out:
            if 'text' in item:
                lines.append(item['text'])
            elif isinstance(item, dict):
                lines.append(item.get('text', str(item)))
            else:
                lines.append(str(item))
        return '\n'.join(lines).strip()
    except ImportError:
        return None
    except Exception as e:
        return f"[CnOCR 错误: {e}]"

def main():
    parser = argparse.ArgumentParser(description='图片读取与 OCR 识别')
    parser.add_argument('path', help='图片文件路径')
    parser.add_argument('--lang', default='eng', help='Tesseract 语言 (默认: eng)')
    parser.add_argument('--tesseract-only', action='store_true', help='仅使用 Tesseract')
    parser.add_argument('--cnocr-only', action='store_true', help='仅使用 CnOCR')
    args = parser.parse_args()

    path = args.path
    if not os.path.exists(path):
        print(f"错误: 文件不存在 — {path}")
        sys.exit(1)

    # 1. 图片基本信息
    info = read_image_info(path)
    print("=" * 60)
    print(f"图片信息: {os.path.basename(path)}")
    print(f"  格式: {info['format']}  |  尺寸: {info['width']}×{info['height']}  |  模式: {info['mode']}")
    print("=" * 60)

    # 2. OCR 文字提取
    text = None

    if not args.tesseract_only:
        text = ocr_with_cnocr(path)
        if text and not text.startswith('['):
            print(f"\n[CnOCR 识别结果]:")
            print(text)

    if text is None or text.startswith('[') or text == '':
        tesseract_text = ocr_with_tesseract(path, args.lang)
        if tesseract_text:
            print(f"\n[Tesseract 识别结果 ({args.lang})]:")
            print(tesseract_text)
        elif text is None:
            print("\n[OCR 不可用] Tesseract 和 CnOCR 均未正确配置")
        elif text == '':
            print("\n[OCR 结果为空] 图片中可能不包含可识别文字")
        elif text.startswith('['):
            print(f"\n{text}")

if __name__ == '__main__':
    main()
