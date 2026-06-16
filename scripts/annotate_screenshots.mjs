import sharp from 'sharp';
import { mkdirSync } from 'fs';

const IN = 'docs/v1.7.0/screenshots';
const OUT = 'docs/v1.7.0/screenshots/annotated';
mkdirSync(OUT, { recursive: true });

// SVG overlay helpers
function circle(cx, cy, r, stroke = '#EF4444', width = 3, fill = 'none') {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${stroke}" stroke-width="${width}" fill="${fill}" />`;
}

function rect(x, y, w, h, stroke = '#EF4444', width = 3, fill = 'none', rx = 6) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" stroke="${stroke}" stroke-width="${width}" fill="${fill}" rx="${rx}" />`;
}

function label(x, y, text, color = '#EF4444', fontSize = 18) {
  const lines = text.split('\n');
  return lines.map((l, i) =>
    `<text x="${x}" y="${y + i * 22}" fill="${color}" font-size="${fontSize}" font-weight="bold" font-family="PingFang SC,Microsoft YaHei,sans-serif">${l}</text>`
  ).join('');
}

function marker(num, x, y, bg = '#EF4444', size = 24) {
  return `<circle cx="${x}" cy="${y}" r="${size/2}" fill="${bg}" />
    <text x="${x}" y="${y + size/4}" fill="white" font-size="${size/2 + 2}" font-weight="bold" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,sans-serif">${num}</text>`;
}

async function annotate(filename, svgContent) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900">
    ${svgContent}
  </svg>`;
  await sharp(`${IN}/${filename}.png`)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .toFile(`${OUT}/${filename}.png`);
  console.log(`  ✅ ${filename}.png`);
}

async function main() {
  console.log('开始标注截图...\n');

  // ==================== 01-login ====================
  await annotate('01-login', [
    marker(1, 70, 30), label(95, 38, '顶部品牌Logo和系统名称'),
    marker(2, 70, 588), label(95, 596, '登录表单：用户名+密码输入框'),
    marker(3, 70, 680), label(95, 688, '登录按钮（提交）'),
    marker(4, 70, 730), label(95, 738, '账号注册入口'),
    rect(490, 555, 460, 210, '#3B82F6', 3), label(500, 525, '核心操作区'),
    rect(160, 615, 310, 85, '#F59E0B', 2), label(170, 610, '安全提示区域'),
    marker(5, 1270, 30), label(1295, 38, '模块点亮网格（40模块状态展示）'),
  ].join(''));

  // ==================== 02-project-list ====================
  await annotate('02-project-list', [
    marker(1, 350, 65), label(375, 73, '搜索栏：按名称筛选项目'),
    marker(2, 950, 65), label(975, 73, '项目总数 + 创建项目按钮'),
    marker(3, 170, 220), label(195, 228, '项目卡片：名称、进度条、创建时间'),
    marker(4, 740, 220), label(765, 228, '指南完成百分比进度条'),
    rect(110, 175, 610, 120, '#3B82F6', 2), label(120, 165, '项目卡片区域（可点击进入）'),
    marker(5, 1270, 830), label(1295, 838, '底部AI输入框'),
    marker(6, 350, 835), label(375, 838, '文件上传+图片上传+字符计数'),
  ].join(''));

  // ==================== 03-doc-management ====================
  await annotate('03-doc-management', [
    marker(1, 70, 130), label(95, 138, '左侧分类目录：A/B/C/D类资料导航'),
    marker(2, 400, 130), label(425, 138, '资料表格：名称、编号、归档单位'),
    marker(3, 400, 210), label(425, 218, '上传按钮：选择文件上传到此条目'),
    marker(4, 400, 260), label(425, 268, '版本信息：V1.0/V2.0...'),
    marker(5, 70, 65), label(95, 73, '规程切换：建筑/市政标准'),
    marker(6, 750, 65), label(775, 73, '搜索/筛选/导出/下载工具栏'),
    rect(340, 150, 1000, 600, '#3B82F6', 2), label(350, 140, '资料数据表格区域'),
  ].join(''));

  // ==================== 04-guide-modules ====================
  await annotate('04-guide-modules', [
    marker(1, 70, 130), label(95, 138, '章标题+副标题'),
    marker(2, 500, 108), label(525, 116, '进度条：已选/总量 + 撤销按钮'),
    marker(3, 70, 185), label(95, 193, '标签切换：工作模块/逻辑图/附表清单'),
    marker(4, 70, 260), label(95, 268, '子模块卡片：编号+名称+操作按钮'),
    rect(60, 240, 340, 300, '#3B82F6', 2), label(420, 250, '子模块卡片（可点击名称重命名）'),
    marker(5, 160, 295), label(185, 303, '一键全选/取消 按钮'),
    marker(6, 260, 295), label(285, 303, '保存为模板 按钮'),
    marker(7, 300, 295), label(325, 303, '添加自定义工作项 按钮'),
    marker(8, 70, 340), label(95, 348, '工作项：蓝色勾选=计划 / 绿色=已完成'),
    marker(9, 200, 340), label(225, 348, '📎附件数量（可点击展开）'),
    rect(60, 315, 340, 350, '#10B981', 2), label(420, 310, '工作项操作区'),
  ].join(''));

  // ==================== 05-guide-logic ====================
  await annotate('05-guide-logic', [
    marker(1, 70, 185), label(95, 193, '编辑模式按钮：启用后可拖拽节点和连线'),
    marker(2, 300, 185), label(325, 193, '缩放控制：25%-200% + 适应页面'),
    marker(3, 500, 185), label(525, 193, '重置按钮：恢复默认布局'),
    marker(4, 70, 240), label(95, 248, 'draw.io 流程图编辑器（可拖拽/连线/编辑）'),
    rect(40, 250, 1360, 550, '#3B82F6', 3), label(50, 240, 'draw.io 嵌入式逻辑图编辑区'),
    marker(5, 100, 400), label(125, 408, '工作项卡片节点'),
    marker(6, 480, 400), label(505, 408, '连线：蓝色虚线=计划 / 绿色实线=完成'),
    marker(7, 70, 215), label(95, 223, '同步连线按钮（保存到工作模块）'),
  ].join(''));

  // ==================== 06-guide-forms ====================
  await annotate('06-guide-forms', [
    marker(1, 70, 185), label(95, 193, '附表编号 + 表格名称'),
    marker(2, 500, 220), label(525, 228, '当前状态标签'),
    marker(3, 700, 220), label(725, 228, '样本按钮：预览模板格式'),
    marker(4, 790, 220), label(815, 228, '上传按钮：提交实际表单文件'),
    marker(5, 880, 220), label(905, 228, '编辑按钮：在线编辑+AI自动填写'),
    rect(40, 200, 1360, 400, '#3B82F6', 2), label(50, 190, '附表清单表格'),
    marker(6, 70, 680), label(95, 688, '附表总数统计'),
  ].join(''));

  // ==================== 07-dashboard ====================
  await annotate('07-dashboard', [
    marker(1, 200, 200), label(225, 208, 'CPI 成本绩效指数卡片'),
    marker(2, 500, 200), label(525, 208, 'SPI 进度绩效指数卡片'),
    marker(3, 800, 200), label(825, 208, '完整度评分卡片'),
    marker(4, 1100, 200), label(1125, 208, '质量评分卡片'),
    rect(150, 170, 1200, 200, '#3B82F6', 2), label(160, 160, 'KPI指标卡片区（4项核心指标）'),
    marker(5, 70, 450), label(95, 458, '告警列表：异常指标自动研判'),
    marker(6, 700, 450), label(725, 458, '多项目选择器（切换对比）'),
    marker(7, 70, 65), label(95, 73, '返回按钮 + 仪表盘标题'),
  ].join(''));

  // ==================== 08-project-edit ====================
  await annotate('08-project-edit', [
    marker(1, 500, 100), label(525, 108, '编辑对话框标题'),
    marker(2, 400, 155), label(425, 163, 'AI自动填写按钮'),
    marker(3, 580, 155), label(605, 163, 'AI分析报告按钮'),
    rect(370, 145, 650, 45, '#8B5CF6', 2), label(380, 135, 'AI智能辅助操作区'),
    marker(4, 370, 210), label(395, 218, '项目概况文本编辑区'),
    marker(5, 370, 340), label(395, 348, '指标字段：面积/规模/投资/管线'),
    marker(6, 370, 430), label(395, 438, '项目概况文件上传区域'),
    marker(7, 370, 510), label(395, 518, '自定义字段添加按钮'),
    rect(350, 190, 730, 500, '#3B82F6', 2), label(360, 180, '编辑表单区域'),
    marker(8, 1110, 625), label(1135, 633, '保存按钮'),
  ].join(''));

  // ==================== 09-ai-chat ====================
  await annotate('09-ai-chat', [
    marker(1, 70, 130), label(95, 138, 'AI模型选择器'),
    marker(2, 70, 65), label(95, 73, '返回按钮 + AI助手标题'),
    marker(3, 100, 300), label(125, 308, '对话消息区域（用户/AI交替）'),
    rect(50, 170, 1340, 500, '#8B5CF6', 2), label(60, 160, 'AI对话区域'),
    marker(4, 70, 830), label(95, 838, '输入框：输入问题按Enter发送'),
    marker(5, 1100, 830), label(1125, 838, '文件上传按钮'),
    marker(6, 1200, 830), label(1225, 838, '发送按钮'),
  ].join(''));

  console.log('\n✅ 全部9张标注截图完成！');
}

main().catch(console.error);
