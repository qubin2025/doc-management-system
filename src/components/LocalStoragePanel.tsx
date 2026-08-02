import React, { useEffect, useState } from 'react';

interface KeyInfo { key: string; size: number; category: string; relatedProjects: string[]; value: string; }

function fmtSize(b: number) { return b > 1024 ? (b / 1024).toFixed(1) + ' KB' : b + ' B'; }

const CATEGORY_MAP: [RegExp, string][] = [
  [/^doc-mgmt-projects-/, '项目列表'],
  [/^doc-mgmt-upload-/, '上传数据'],
  [/guide-.*(-modules|-done)/, '指南数据'],
  [/^form-/, '表单数据'],
  [/^desktop-/, '日报/问题'],
  [/^(objective-|tailoring-)/, '目标/裁剪'],
  [/^(experience-|stakeholder|contract-)/, '经验/干系人/合同'],
  [/^(doc-system-auth|doc-system-token|document-management)/, '认证/配置'],
  [/^mobile-/, '手机端数据'],
  [/^knowledge-graph/, '知识图谱'],
];

function classify(k: string): string {
  for (const [re, cat] of CATEGORY_MAP) { if (re.test(k)) return cat; }
  return '其他';
}

const LocalStoragePanel: React.FC = () => {
  const [keys, setKeys] = useState<KeyInfo[]>([]);
  const [projectNames, setProjectNames] = useState<Set<string>>(new Set());
  const [orphans, setOrphans] = useState<string[]>([]);
  const [totalSize, setTotalSize] = useState(0);

  useEffect(() => {
    const allKeys: KeyInfo[] = [];
    const names = new Set<string>();
    let tSize = 0;

    // 提取项目名
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('doc-mgmt-projects-')) {
        try { const v = JSON.parse(localStorage.getItem(k) || '[]'); if (Array.isArray(v)) v.forEach((p: any) => { if (p.name) names.add(p.name); }); } catch {}
      }
    }

    // 扫描全部键
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k) || '';
      const size = new Blob([v]).size;
      tSize += size;
      const related: string[] = [];
      for (const pn of names) { if (k.includes(pn) || v.includes(pn)) related.push(pn); }
      allKeys.push({ key: k, size, category: classify(k), relatedProjects: related, value: v.slice(0, 80) });
    }

    // 找孤立数据
    const referenced = new Set<string>();
    allKeys.forEach(k => { if (!['认证/配置'].includes(k.category)) { const t = k.key + k.value; names.forEach(pn => { if (t.includes(pn)) referenced.add(pn); }); } });
    const orphanList: string[] = [];
    names.forEach(pn => { if (!referenced.has(pn)) orphanList.push(pn); });

    // 从上传键提取孤立标准key
    allKeys.forEach(k => {
      const m = k.key.match(/doc-mgmt-upload-([A-Z0-9/\\-]+)/);
      if (m && m[1] && !names.has(m[1])) orphanList.push(m[1]);
    });

    setKeys(allKeys);
    setProjectNames(names);
    setOrphans([...new Set(orphanList)]);
    setTotalSize(tSize);
  }, []);

  const handleCleanProject = (name: string) => {
    if (!confirm('确定删除项目"' + name + '"的全部 localStorage 数据？')) return;
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('doc-mgmt-projects-')) {
        try { const v = JSON.parse(localStorage.getItem(k) || '[]'); if (Array.isArray(v)) { localStorage.setItem(k, JSON.stringify(v.filter((x: any) => (x.name || '') !== name))); } } catch {}
      }
      if (k.includes(name)) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
    window.location.reload();
  };

  const handleCleanOrphan = () => {
    if (!confirm('确定清除全部孤立数据？')) return;
    let count = 0;
    const os = new Set(orphans);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k) continue;
      for (const o of os) { if (k.includes(o)) { localStorage.removeItem(k); count++; break; } }
    }
    window.location.reload();
  };

  const handleCleanAll = () => {
    if (!confirm('⚠ 确定重置全部项目数据？认证信息保留。')) return;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k === 'doc-system-auth' || k === 'doc-system-token' || k === 'document-management-standard') continue;
      localStorage.removeItem(k);
    }
    window.location.reload();
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
        <div className="bg-white rounded-lg border p-3"><span className="text-gray-500">总条目</span><div className="text-xl font-bold">{keys.length}</div></div>
        <div className="bg-white rounded-lg border p-3"><span className="text-gray-500">总占用</span><div className="text-xl font-bold">{fmtSize(totalSize)}</div></div>
        <div className="bg-white rounded-lg border p-3"><span className="text-gray-500">项目数</span><div className="text-xl font-bold">{projectNames.size}</div></div>
      </div>

      {orphans.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-red-700 mb-2">👻 孤立数据 ({orphans.length} 处)</h4>
          <div className="flex flex-wrap gap-1 mb-3">
            {orphans.map(o => <span key={o} className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">{o}</span>)}
          </div>
          <button onClick={handleCleanOrphan} className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600">清除孤立数据</button>
        </div>
      )}

      {projectNames.size > 0 && (
        <div className="bg-white rounded-lg border mb-4">
          <div className="px-4 py-3 border-b bg-gray-50"><h4 className="text-sm font-semibold">项目列表中的项目</h4></div>
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="text-left px-4 py-2 font-medium text-gray-500">项目名</th><th className="text-left px-4 py-2 font-medium text-gray-500">关联键数</th><th className="text-left px-4 py-2 font-medium text-gray-500">关联大小</th><th className="text-right px-4 py-2 font-medium text-gray-500">操作</th></tr></thead>
            <tbody>
              {[...projectNames].map(pn => {
                const rel = keys.filter(k => k.relatedProjects.includes(pn));
                return (
                  <tr key={pn} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{pn}</td><td className="px-4 py-2 text-gray-500">{rel.length} 条</td><td className="px-4 py-2 text-gray-500">{fmtSize(rel.reduce((s, k) => s + k.size, 0))}</td>
                    <td className="px-4 py-2 text-right"><button onClick={() => handleCleanProject(pn)} className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">清除</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h4 className="text-sm font-semibold">全部键值 ({keys.length})</h4>
          <button onClick={handleCleanAll} className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600">重置全部</button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b sticky top-0 bg-gray-50"><th className="text-left px-4 py-2 font-medium text-gray-500 w-2/5">键名</th><th className="text-left px-4 py-2 font-medium text-gray-500">分类</th><th className="text-left px-4 py-2 font-medium text-gray-500">大小</th><th className="text-left px-4 py-2 font-medium text-gray-500">内容预览</th></tr></thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.key} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs break-all">{k.key}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{k.category}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{fmtSize(k.size)}</td>
                  <td className="px-4 py-2 text-xs text-gray-400 break-all max-w-xs truncate">{k.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LocalStoragePanel;
