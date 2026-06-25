/**
 * 施工现场安全检查清单 — 基于 JGJ59-2011 + 地方标准
 * GLM-4V 视觉模型逐项对标分析
 */
export const SAFETY_CHECKLIST = [
  { id: 'A01', category: '个人防护', item: '安全帽佩戴', standard: 'JGJ59-2011 3.0.3', check: '现场人员是否全部正确佩戴安全帽' },
  { id: 'A02', category: '个人防护', item: '安全带使用', standard: 'JGJ59-2011 3.0.4', check: '高处作业人员是否系挂安全带，挂点是否牢固' },
  { id: 'A03', category: '个人防护', item: '安全网设置', standard: 'JGJ59-2011 3.0.5', check: '外立面安全网是否完整无破损，绑扎是否牢固' },
  { id: 'B01', category: '脚手架', item: '脚手架基础', standard: 'JGJ59-2011 5.0.2', check: '脚手架基础是否坚实平整，排水是否通畅' },
  { id: 'B02', category: '脚手架', item: '连墙件', standard: 'JGJ59-2011 5.0.3', check: '连墙件设置间距和数量是否符合要求，是否松动' },
  { id: 'B03', category: '脚手架', item: '脚手板', standard: 'JGJ59-2011 5.0.4', check: '脚手板是否铺满铺稳，无探头板，无断裂' },
  { id: 'B04', category: '脚手架', item: '防护栏杆', standard: 'JGJ59-2011 5.0.5', check: '作业层临边是否设置1.2m防护栏杆和挡脚板' },
  { id: 'C01', category: '基坑工程', item: '边坡支护', standard: 'JGJ59-2011 6.0.2', check: '基坑边坡支护是否按方案实施，有无裂缝变形' },
  { id: 'C02', category: '基坑工程', item: '排水措施', standard: 'JGJ59-2011 6.0.3', check: '基坑周边排水沟是否畅通，有无积水' },
  { id: 'C03', category: '基坑工程', item: '临边防护', standard: 'JGJ59-2011 6.0.4', check: '基坑临边是否设置警示带或硬质围挡' },
  { id: 'D01', category: '模板支架', item: '支撑体系', standard: 'JGJ59-2011 7.0.2', check: '模板支撑体系是否按方案搭设，立杆间距和步距是否符合' },
  { id: 'D02', category: '模板支架', item: '剪刀撑', standard: 'JGJ59-2011 7.0.3', check: '是否设置水平剪刀撑和竖向剪刀撑' },
  { id: 'E01', category: '施工用电', item: '配电箱', standard: 'JGJ59-2011 8.0.2', check: '配电箱是否上锁，有无防雨措施，接地是否完好' },
  { id: 'E02', category: '施工用电', item: '电缆敷设', standard: 'JGJ59-2011 8.0.3', check: '电缆是否架空或埋地敷设，有无拖地破损' },
  { id: 'F01', category: '起重机械', item: '限位装置', standard: 'JGJ59-2011 9.0.2', check: '塔吊/施工电梯限位器是否灵敏有效' },
  { id: 'F02', category: '起重机械', item: '吊索具', standard: 'JGJ59-2011 9.0.3', check: '钢丝绳/吊带是否磨损超标，卸扣是否完好' },
  { id: 'G01', category: '文明施工', item: '材料堆放', standard: 'JGJ59-2011 12.0.2', check: '材料是否分类堆放整齐，有无超高堆放' },
  { id: 'G02', category: '文明施工', item: '场地整洁', standard: 'JGJ59-2011 12.0.3', check: '作业面是否干净整洁，建筑垃圾是否及时清理' },
  { id: 'G03', category: '文明施工', item: '消防器材', standard: 'JGJ59-2011 12.0.4', check: '灭火器是否在有效期内，消防通道是否畅通' },
];

export const VISION_SAFETY_PROMPT = `你是一名持有国家注册安全工程师资格的施工现场安全专家。
请仔细分析这张工地现场照片，对照以下安全检查清单逐项判断：

【检查清单】
{checklist}

【输出要求】
严格按JSON格式输出，每项包含判定结果：

{
  "summary": "整体评价(50字内)",
  "compliance_rate": "合规率(如 6/18)",
  "items": [
    {
      "id": "A01",
      "item": "检查项名称",
      "standard": "标准编号",
      "visible": true/false,
      "status": "compliant/non_compliant/not_visible/uncertain",
      "finding": "具体发现(30字内)",
      "suggestion": "整改建议(30字内)"
    }
  ]
}`;
