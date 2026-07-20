// 水印模板编辑页 — 本地为主（数据主权），云端同步为辅
import React, { useState } from 'react';
import { ArrowLeft, Plus, Trash2, DownloadCloud, Check, Loader2 } from 'lucide-react';
import { WatermarkTemplate } from '../types';
import {
  loadTemplates, upsertTemplate, removeTemplate, saveTemplates,
  getActiveTemplateId, setActiveTemplateId, mergeCloudTemplates, defaultTemplate,
} from '../lib/templates';
import { saveTemplateCloud, listTemplatesCloud } from '../data/mobileApi';

interface Props {
  template: WatermarkTemplate;
  onChange: (t: WatermarkTemplate) => void;
  onBack: () => void;
}

const FIELD_LABELS: { key: keyof WatermarkTemplate['fields']; label: string }[] = [
  { key: 'time', label: '拍摄时间' },
  { key: 'project', label: '项目名称' },
  { key: 'coords', label: '经纬度坐标' },
  { key: 'address', label: '位置描述' },
  { key: 'photographer', label: '拍摄人' },
];

const THEMES: { key: WatermarkTemplate['style']['theme']; label: string; cls: string }[] = [
  { key: 'dark', label: '深色', cls: 'bg-slate-800' },
  { key: 'blue', label: '蓝色', cls: 'bg-blue-700' },
  { key: 'orange', label: '橙色', cls: 'bg-orange-600' },
];

const TemplateEditor: React.FC<Props> = ({ template, onChange, onBack }) => {
  const [list, setList] = useState<WatermarkTemplate[]>(() => loadTemplates());
  const [current, setCurrent] = useState<WatermarkTemplate>(template);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');

  const applyChange = (next: WatermarkTemplate) => {
    setCurrent(next);
    const newList = upsertTemplate(next);
    setList(newList);
    if (getActiveTemplateId() === next.id) onChange(next);
  };

  const selectTemplate = (t: WatermarkTemplate) => {
    setCurrent(t);
    setActiveTemplateId(t.id);
    onChange(t);
  };

  const addTemplate = () => {
    const t: WatermarkTemplate = {
      ...defaultTemplate(),
      id: `tpl-${Date.now()}`,
      name: `模板${list.length + 1}`,
    };
    const newList = upsertTemplate(t);
    setList(newList);
    selectTemplate(t);
  };

  const deleteTemplate = (id: string) => {
    if (id === 'default') return;
    const newList = removeTemplate(id);
    setList(newList);
    if (current.id === id) selectTemplate(newList[0] || defaultTemplate());
  };

  // 保存到云端（本地已实时保存，云端失败不影响本地）
  const syncToCloud = async () => {
    setSyncing(true);
    setMsg('');
    try {
      await saveTemplateCloud(current);
      setMsg('已同步到云端');
    } catch (err: any) {
      setMsg(`云端同步失败：${err.message}（本地已保存）`);
    } finally {
      setSyncing(false);
    }
  };

  // 从云端拉取合并（按名称去重，本地优先）
  const pullFromCloud = async () => {
    setSyncing(true);
    setMsg('');
    try {
      const cloud = await listTemplatesCloud();
      const merged = mergeCloudTemplates(loadTemplates(), cloud);
      saveTemplates(merged);
      setList(merged);
      setMsg(`已拉取云端模板（共${merged.length}个）`);
    } catch (err: any) {
      setMsg(`拉取失败：${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-2 py-2 flex items-center gap-1 sticky top-0 z-10">
        <button onClick={onBack} className="p-2.5 rounded-lg active:bg-slate-100">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="flex-1 text-base font-semibold text-slate-800">水印模板</h1>
        <button onClick={pullFromCloud} disabled={syncing} className="p-2.5 rounded-lg active:bg-slate-100 disabled:opacity-50" aria-label="从云端拉取">
          <DownloadCloud className="w-5 h-5 text-slate-600" />
        </button>
      </header>

      <main className="flex-1 p-4 space-y-4">
        {/* 模板列表 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {list.map(t => (
            <button
              key={t.id}
              onClick={() => selectTemplate(t)}
              className={`shrink-0 px-4 h-10 rounded-xl text-sm flex items-center gap-1.5 border ${
                current.id === t.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'
              }`}
            >
              {current.id === t.id && <Check className="w-3.5 h-3.5" />}
              {t.name}
            </button>
          ))}
          <button onClick={addTemplate} className="shrink-0 w-10 h-10 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-400 active:bg-slate-100">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* 模板名称 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={current.name}
              onChange={e => applyChange({ ...current, name: e.target.value })}
              className="flex-1 h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="模板名称"
            />
            {current.id !== 'default' && (
              <button onClick={() => deleteTemplate(current.id)} className="p-2.5 rounded-lg text-red-500 active:bg-red-50" aria-label="删除模板">
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* 字段开关 */}
          <div className="space-y-1">
            {FIELD_LABELS.map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                <span className="text-sm text-slate-700">{label}</span>
                <input
                  type="checkbox"
                  checked={current.fields[key] as boolean}
                  onChange={e => applyChange({ ...current, fields: { ...current.fields, [key]: e.target.checked } })}
                  className="w-5 h-5 accent-blue-600"
                />
              </label>
            ))}
          </div>

          {/* 自定义文字 */}
          <input
            type="text"
            value={current.fields.customText}
            onChange={e => applyChange({ ...current, fields: { ...current.fields, customText: e.target.value } })}
            className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="自定义水印文字（如：某某咨询公司）"
          />

          {/* 主题 */}
          <div className="flex gap-3">
            {THEMES.map(t => (
              <button
                key={t.key}
                onClick={() => applyChange({ ...current, style: { ...current.style, theme: t.key } })}
                className={`flex-1 h-11 rounded-xl text-sm text-white ${t.cls} ${current.style.theme === t.key ? 'ring-2 ring-offset-2 ring-blue-500' : 'opacity-70'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {msg && <div className="text-xs text-slate-600 bg-slate-100 rounded-lg px-3 py-2">{msg}</div>}

        <button
          onClick={syncToCloud}
          disabled={syncing}
          className="w-full h-12 rounded-xl bg-blue-600 text-white text-base font-medium flex items-center justify-center gap-2 active:bg-blue-700 disabled:opacity-60"
        >
          {syncing && <Loader2 className="w-4 h-4 animate-spin" />}
          同步当前模板到云端
        </button>
        <p className="text-center text-xs text-slate-400">模板实时保存在本机，云端同步用于多设备共享</p>
      </main>
    </div>
  );
};

export default TemplateEditor;
