// 移动端水印模板存取 — localStorage 为主（数据主权），云端同步为辅
import { WatermarkTemplate } from '../types';

const TEMPLATES_KEY = 'mobile-watermark-templates';
const ACTIVE_KEY = 'mobile-watermark-active-template';
const MAX_TEMPLATES = 30;

/** 默认模板 */
export function defaultTemplate(): WatermarkTemplate {
  return {
    id: 'default',
    name: '工程标准水印',
    fields: { time: true, project: true, coords: true, address: true, photographer: true, customText: '' },
    style: { position: 'bottom', theme: 'dark' },
    updatedAt: new Date().toISOString(),
  };
}

function isValidTemplate(t: any): t is WatermarkTemplate {
  return t && typeof t.id === 'string' && typeof t.name === 'string'
    && t.fields && typeof t.fields.time === 'boolean'
    && t.style && typeof t.style.theme === 'string';
}

/** 读取本地模板列表（非法数据容错返回 [默认模板]） */
export function loadTemplates(): WatermarkTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (!raw) return [defaultTemplate()];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [defaultTemplate()];
    const valid = arr.filter(isValidTemplate);
    return valid.length > 0 ? valid : [defaultTemplate()];
  } catch {
    return [defaultTemplate()];
  }
}

/** 保存模板列表到本地（超上限截断，保留最新） */
export function saveTemplates(templates: WatermarkTemplate[]): void {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates.slice(0, MAX_TEMPLATES)));
}

/** 新增/更新单个模板（按 id 覆盖），返回最新列表 */
export function upsertTemplate(t: WatermarkTemplate): WatermarkTemplate[] {
  const list = loadTemplates();
  const idx = list.findIndex(x => x.id === t.id);
  const next = { ...t, updatedAt: new Date().toISOString() };
  if (idx >= 0) list[idx] = next;
  else list.unshift(next);
  saveTemplates(list);
  return list;
}

/** 删除模板 */
export function removeTemplate(id: string): WatermarkTemplate[] {
  const list = loadTemplates().filter(t => t.id !== id);
  saveTemplates(list);
  return list;
}

/** 当前激活模板 id */
export function getActiveTemplateId(): string {
  return localStorage.getItem(ACTIVE_KEY) || 'default';
}

export function setActiveTemplateId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

/** 获取当前激活模板（找不到则回退第一个/默认） */
export function getActiveTemplate(): WatermarkTemplate {
  const list = loadTemplates();
  return list.find(t => t.id === getActiveTemplateId()) || list[0] || defaultTemplate();
}

/**
 * 合并云端模板到本地列表（纯函数，可单测）。
 * 规则：按 name 去重，本地优先（数据主权）；云端新名称的模板追加到末尾。
 */
export function mergeCloudTemplates(local: WatermarkTemplate[], cloud: WatermarkTemplate[]): WatermarkTemplate[] {
  const localNames = new Set(local.map(t => t.name));
  const merged = [...local];
  for (const c of cloud) {
    if (!isValidTemplate(c)) continue;
    if (!localNames.has(c.name)) {
      merged.push(c);
      localNames.add(c.name);
    }
  }
  return merged.slice(0, MAX_TEMPLATES);
}
