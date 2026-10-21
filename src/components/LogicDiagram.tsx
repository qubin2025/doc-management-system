import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { GuideLink } from '../types';

interface Props {
  subModules: any[];
  checkedItems: Set<string>;
  completedItems: Set<string>;
  links: GuideLink[];
  zoomLevel: number;
  onLinksChange?: (links: GuideLink[]) => void;
}

// ============ draw.io XML 生成 ============
interface DrawioData { xml: string; cellToItem: Map<number, string>; itemToCell: Map<string, number>; }

function buildDrawioData(subModules: any[], checkedItems: Set<string>, completedItems: Set<string>, links: GuideLink[]): DrawioData {
  const smGroups = new Map<string, { name: string; items: any[] }>();
  subModules.forEach((sm: any) => {
    const items = sm.workItems.filter((wi: any) => checkedItems.has(wi.id));
    if (items.length) smGroups.set(sm.id, { name: sm.name, items });
  });
  const cellToItem = new Map<number, string>();
  const itemToCell = new Map<string, number>();
  let cellId = 3;
  const cells: string[] = [];
  let colX = 60;
  const CW = 260, CG = 30;

  smGroups.forEach((g: any, smId: string) => {
    const n = g.items.length;
    const sid = cellId++;
    cells.push(`<mxCell id="${sid}" value="${smId}. ${x(g.name||smId)}" style="swimlane;whiteSpace=wrap;html=1;fillColor=#EFF6FF;strokeColor=#3B82F6;fontStyle=1;startSize=30;swimlaneFillColor=#fafafa;fontSize=14;" vertex="1" parent="1"><mxGeometry x="${colX}" y="60" width="${CW}" height="${n*160+60}" as="geometry"/></mxCell>`);
    g.items.forEach((wi: any, idx: number) => {
      const done = completedItems.has(wi.id);
      const iid = cellId++;
      cellToItem.set(iid, wi.id);
      itemToCell.set(wi.id, iid);
      cells.push(`<mxCell id="${iid}" value="${x(wi.name)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${done?'#D1FAE5':'#EFF6FF'};strokeColor=${done?'#10B981':'#3B82F6'};strokeWidth=${done?3:2};dashed=${done?0:1};fontSize=14;align=center;" vertex="1" parent="${sid}"><mxGeometry x="10" y="${50+idx*150}" width="${CW-20}" height="52" as="geometry"/></mxCell>`);
    });
    colX += CW + CG;
  });
  links.forEach((link: any) => {
    const sc = itemToCell.get(link.from), tc = itemToCell.get(link.to);
    if (!sc || !tc) return;
    const bothDone = completedItems.has(link.from) && completedItems.has(link.to);
    cells.push(`<mxCell id="${cellId++}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=${bothDone?'#10B981':'#3B82F6'};strokeWidth=${bothDone?4:3};dashed=${bothDone?0:1};exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;fontSize=14;" edge="1" parent="1" source="${sc}" target="${tc}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
  });
  return { xml: `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('')}</root></mxGraphModel>`, cellToItem, itemToCell };
}
function x(s: string): string { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ============ 保存时解析 draw.io 连线 → GuideLinks ============
function parseDrawioEdges(saveXml: string, cellToItem: Map<number, string>, existingLinks: GuideLink[]): GuideLink[] {
  const newLinks: GuideLink[] = [];
  const existingSet = new Set(existingLinks.map(l => `${l.from}-${l.to}`));
  const re = /<mxCell[^>]*id="(\d+)"[^>]*edge="1"[^>]*source="(\d+)"[^>]*target="(\d+)"[^/]*\/?>/g;
  let m;
  while ((m = re.exec(saveXml)) !== null) {
    const fromId = cellToItem.get(Number(m[2])), toId = cellToItem.get(Number(m[3]));
    if (fromId && toId && !existingSet.has(`${fromId}-${toId}`)) {
      newLinks.push({ from: fromId, to: toId, isCustom: true });
      existingSet.add(`${fromId}-${toId}`);
    }
  }
  return newLinks;
}

// ============ 主组件 ============
// draw.io embed URL — 开发代理优先，生产直连（多镜像回退）
// saveAndExit=1: 显示保存按钮，点击后发送 save 事件给父窗口
const DRAWIO_MIRRORS = [
  '/drawio-proxy/?embed=1&proto=json&lang=zh&saveAndExit=1&noSaveBtn=0',
  'https://embed.diagrams.net/?embed=1&proto=json&lang=zh&saveAndExit=1&noSaveBtn=0',
  'https://viewer.diagrams.net/?embed=1&proto=json&lang=zh&saveAndExit=1&noSaveBtn=0',
];
const DRAWIO_URL = import.meta.env.DEV ? DRAWIO_MIRRORS[0] : DRAWIO_MIRRORS[1];

const LogicDiagram: React.FC<Props> = (props) => {
  const { subModules, checkedItems, completedItems, links, zoomLevel, onLinksChange } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [drawioReady, setDrawioReady] = useState(false);
  const [drawioMirror, setDrawioMirror] = useState(0);
  const [drawioFailed, setDrawioFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const mapRef = useRef<DrawioData>({ xml: '', cellToItem: new Map(), itemToCell: new Map() });
  const latestXmlRef = useRef<string>('');

  const data = useMemo(
    () => buildDrawioData(subModules, checkedItems, completedItems, links),
    [subModules, checkedItems, completedItems, links]
  );
  mapRef.current = data;
  latestXmlRef.current = data.xml;

  const sendToDrawio = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(JSON.stringify({ action: 'load', xml: latestXmlRef.current, autosave: 1 }), '*');
  }, []);
  const fitToWindow = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(JSON.stringify({ action: 'setViewport', scale: 1, center: true }), '*');
  }, []);

  // 导出为 PNG
  const handleExportPng = useCallback(() => {
    if (!iframeRef.current?.contentWindow || exporting) return;
    setExporting(true);
    iframeRef.current.contentWindow.postMessage(JSON.stringify({ action: 'export', format: 'png', spinKey: 'png', scale: 2 }), '*');
  }, [exporting]);

  // 导出为 SVG
  const handleExportSvg = useCallback(() => {
    if (!iframeRef.current?.contentWindow || exporting) return;
    setExporting(true);
    iframeRef.current.contentWindow.postMessage(JSON.stringify({ action: 'export', format: 'svg', spinKey: 'svg' }), '*');
  }, [exporting]);
  const syncFromDrawio = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(JSON.stringify({ action: 'export', format: 'xmlsvg', spinKey: 's' }), '*');
  }, []);

  useEffect(() => {
    let done = false;
    const handler = (e: MessageEvent) => {
      const isDrawio = e.origin.includes('diagrams.net') || e.origin.includes('draw.io') || e.origin === window.location.origin;
      if (!isDrawio) return;
      let msg: any;
      try { msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }

      // draw.io 初始化完成后，加载 XML 数据
      if (msg.event === 'init' && !done) {
        done = true;
        setDrawioReady(true);
        // 延迟加载 XML，确保 draw.io 完全就绪
        setTimeout(() => sendToDrawio(), 300);
        setTimeout(fitToWindow, 900);
        return;
      }

      // 处理导出结果
      if (msg.event === 'export' && msg.data) {
        setExporting(false);
        const link = document.createElement('a');
        link.download = `时序逻辑图_${new Date().toISOString().slice(0,10)}.${msg.format === 'svg' ? 'svg' : 'png'}`;
        link.href = `data:image/${msg.format || 'png'};base64,${msg.data}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // 保存事件：同步连线
      const saveXml = msg.xml || msg.data;
      if (saveXml && typeof saveXml === 'string' && saveXml.includes('<mxGraphModel') && onLinksChange) {
        if (msg.event === 'save' || msg.event === 'autosave') {
          const newEdges = parseDrawioEdges(saveXml, mapRef.current.cellToItem, links);
          if (newEdges.length > 0) onLinksChange([...links, ...newEdges]);
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [sendToDrawio, fitToWindow]); // eslint-disable-line

  // draw.io 就绪或数据变化时，加载 XML 到编辑器
  useEffect(() => {
    if (!drawioReady) return;
    sendToDrawio();
    setTimeout(fitToWindow, 600);
  }, [drawioReady, data.xml, sendToDrawio, fitToWindow]);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 flex-wrap">
        <span>编辑连线后，点击"同步连线"保存；可导出 PNG/SVG 图片</span>
        <button onClick={() => { syncFromDrawio(); }} className="px-3 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-[11px] font-medium shrink-0">同步连线</button>
        <button onClick={handleExportPng} disabled={exporting} className="px-3 py-0.5 bg-green-500 text-white rounded hover:bg-green-600 text-[11px] font-medium shrink-0 disabled:opacity-50">
          {exporting ? '导出中...' : '导出 PNG'}
        </button>
        <button onClick={handleExportSvg} disabled={exporting} className="px-3 py-0.5 bg-gray-500 text-white rounded hover:bg-gray-600 text-[11px] font-medium shrink-0 disabled:opacity-50">
          导出 SVG
        </button>
      </div>
      <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}>
        {drawioFailed ? (
          <div className="flex items-center justify-center h-[650px] bg-gray-50 border rounded-lg text-gray-500 text-sm">
            draw.io 无法加载（网络限制），请检查网络或在开发模式下使用代理
          </div>
        ) : (
        <iframe ref={iframeRef} src={drawioMirror > 0 ? DRAWIO_MIRRORS[drawioMirror] : DRAWIO_URL}
          onError={() => { if (drawioMirror < DRAWIO_MIRRORS.length - 1) { setDrawioMirror(drawioMirror + 1); } else { setDrawioFailed(true); } }}
          style={{ width: '100%', height: '650px', border: '1px solid #e5e7eb', borderRadius: '8px' }}
          title="流程图编辑器" />
        )}
      </div>
    </div>
  );
};

export default LogicDiagram;
