import { describe, it, expect, beforeEach } from 'vitest';
import { buildWatermarkLines, formatWatermarkTime, fitSize } from '../mobile/lib/watermark';
import {
  loadTemplates, saveTemplates, upsertTemplate, defaultTemplate,
  mergeCloudTemplates, getActiveTemplate, setActiveTemplateId,
} from '../mobile/lib/templates';
import { WatermarkTemplate, WatermarkContext } from '../mobile/types';

const fullContext: WatermarkContext = {
  time: '2026-07-17 10:30:00',
  projectName: '测试大厦项目',
  latitude: 39.908722,
  longitude: 116.397499,
  address: '3号楼基坑东侧',
  photographer: '张工',
};

function makeTemplate(overrides?: Partial<WatermarkTemplate['fields']>): WatermarkTemplate {
  const t = defaultTemplate();
  return { ...t, fields: { ...t.fields, ...overrides } };
}

describe('Mobile watermark engine', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('buildWatermarkLines', () => {
    it('全开关+自定义文字时生成6行且格式正确', () => {
      const lines = buildWatermarkLines(makeTemplate({ customText: '某某咨询公司' }), fullContext);
      expect(lines).toHaveLength(6);
      expect(lines[0]).toBe('2026-07-17 10:30:00');
      expect(lines[1]).toBe('项目：测试大厦项目');
      expect(lines[2]).toBe('地点：3号楼基坑东侧');
      expect(lines[3]).toBe('坐标：39.908722, 116.397499');
      expect(lines[4]).toBe('拍摄：张工');
      expect(lines[5]).toBe('某某咨询公司');
    });

    it('关闭 coords/address 后不含经纬度与地点行', () => {
      const lines = buildWatermarkLines(makeTemplate({ coords: false, address: false }), fullContext);
      expect(lines.some(l => l.startsWith('坐标'))).toBe(false);
      expect(lines.some(l => l.startsWith('地点'))).toBe(false);
      expect(lines).toHaveLength(3); // 时间/项目/拍摄
    });

    it('定位失败(经纬度null)时即使开关打开也跳过坐标行', () => {
      const lines = buildWatermarkLines(makeTemplate(), { ...fullContext, latitude: null, longitude: null });
      expect(lines.some(l => l.startsWith('坐标'))).toBe(false);
    });
  });

  describe('模板本地存取', () => {
    it('round-trip：保存后读取深度一致', () => {
      const t = { ...defaultTemplate(), id: 'tpl-1', name: '夜间巡检' };
      upsertTemplate(t);
      const loaded = loadTemplates();
      const found = loaded.find(x => x.id === 'tpl-1');
      expect(found).toBeDefined();
      expect(found!.name).toBe('夜间巡检');
      expect(found!.fields).toEqual(t.fields);
    });

    it('localStorage 存非法JSON时容错返回默认模板', () => {
      localStorage.setItem('mobile-watermark-templates', '{broken json!!');
      const list = loadTemplates();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('default');
    });

    it('激活模板id不存在时回退到第一个模板', () => {
      saveTemplates([defaultTemplate()]);
      setActiveTemplateId('nonexistent-id');
      expect(getActiveTemplate().id).toBe('default');
    });
  });

  describe('mergeCloudTemplates 云端合并', () => {
    it('按名称去重且本地优先', () => {
      const local = [{ ...defaultTemplate(), id: 'local-1', name: '标准水印' }];
      const cloud = [
        { ...defaultTemplate(), id: 'cloud-1', name: '标准水印' },   // 重名，应丢弃
        { ...defaultTemplate(), id: 'cloud-2', name: '云端专用' },   // 新名称，应追加
      ];
      const merged = mergeCloudTemplates(local, cloud);
      expect(merged).toHaveLength(2);
      expect(merged[0].id).toBe('local-1'); // 本地优先保留
      expect(merged[1].name).toBe('云端专用');
    });

    it('云端非法条目被跳过', () => {
      const merged = mergeCloudTemplates([defaultTemplate()], [{ bad: true } as any]);
      expect(merged).toHaveLength(1);
    });
  });

  describe('工具函数', () => {
    it('formatWatermarkTime 输出 yyyy-MM-dd HH:mm:ss 格式', () => {
      const s = formatWatermarkTime(new Date(2026, 6, 17, 9, 5, 3));
      expect(s).toBe('2026-07-17 09:05:03');
    });

    it('fitSize 长边超限时等比缩放，未超限时原样返回', () => {
      expect(fitSize(4000, 3000, 2560)).toEqual({ w: 2560, h: 1920 });
      expect(fitSize(1920, 1080, 2560)).toEqual({ w: 1920, h: 1080 });
    });
  });
});
