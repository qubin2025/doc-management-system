// DB11/T 808-2020 附录A 市政基础设施工程资料管理规范
// 完整数据定义

export interface DocumentItem {
  id: string;
  category: string;
  subCategory: string;
  subCategoryName: string;
  name: string;
  tableCode: string;
  standard: string;
  archiveUnits: {
    construction: boolean;
    supervision: boolean;
    constructionUnit: boolean;
    archive: boolean;
  };
}

// ============================================================
// A类 基建文件
// ============================================================
const a1Data: DocumentItem[] = [
  { id: 'A1-1', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '项目建议书批复文件及项目建议书', tableCode: '', standard: '发改部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-2', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '可行性研究报告批复文件及可行性研究报告', tableCode: '', standard: '发改部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-3', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '专家论证意见、项目评估文件', tableCode: '', standard: '发改部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-4', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '有关立项的会议纪要、领导批示等', tableCode: '', standard: '发改部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-5', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '选址意见书及附图', tableCode: '', standard: '规划部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-6', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '建设用地预审意见', tableCode: '', standard: '国土部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-7', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '建设用地批准文件', tableCode: '', standard: '国土部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-8', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '国有土地使用证', tableCode: '', standard: '国土部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-9', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '建设用地规划许可证及附图', tableCode: '', standard: '规划部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-10', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '地形测量和拨地测量成果报告', tableCode: '', standard: '规划部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-11', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '规划条件及附图', tableCode: '', standard: '规划部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-12', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '建设用地钉桩通知单', tableCode: '', standard: '规划部门', archiveUnits: { construction: true, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-13', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '环境影响评价报告及批复文件', tableCode: '', standard: '环保部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-14', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '水土保持方案及批复文件', tableCode: '', standard: '水务部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-15', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '防洪影响评价报告及批复', tableCode: '', standard: '水务部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-16', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '交通影响评价报告及批复', tableCode: '', standard: '交通部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-17', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '节能审查意见', tableCode: '', standard: '发改部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-18', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '文物调查、勘探保护文件', tableCode: '', standard: '文物部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-19', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '地下管线探测成果报告', tableCode: '', standard: '管线管理部门', archiveUnits: { construction: true, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-20', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '拆迁补偿安置文件', tableCode: '', standard: '住建部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: 'A1-21', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '建设工程规划许可证及附图', tableCode: '', standard: '规划部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-22', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '临时建设工程规划许可证', tableCode: '', standard: '规划部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: 'A1-23', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '临时用地审批文件', tableCode: '', standard: '国土部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: 'A1-24', category: 'A', subCategory: 'A1', subCategoryName: '立项用地规划许可文件', name: '地质灾害危险性评估报告', tableCode: '', standard: '国土部门', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
];


// A2
const a2Data: DocumentItem[] = [
  { id: "A2-1", category: "A", subCategory: "A2", subCategoryName: "建设许可文件", name: "勘察招标文件及投标文件", tableCode: "", standard: "建设部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: "A2-2", category: "A", subCategory: "A2", subCategoryName: "建设许可文件", name: "设计招标文件及投标文件", tableCode: "", standard: "建设部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: "A2-3", category: "A", subCategory: "A2", subCategoryName: "建设许可文件", name: "监理招标文件及投标文件", tableCode: "", standard: "建设部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: "A2-4", category: "A", subCategory: "A2", subCategoryName: "建设许可文件", name: "施工招标文件及投标文件", tableCode: "", standard: "建设部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: "A2-5", category: "A", subCategory: "A2", subCategoryName: "建设许可文件", name: "勘察合同", tableCode: "", standard: "建设部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: "A2-6", category: "A", subCategory: "A2", subCategoryName: "建设许可文件", name: "设计合同", tableCode: "", standard: "建设部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: "A2-7", category: "A", subCategory: "A2", subCategoryName: "建设许可文件", name: "监理合同", tableCode: "", standard: "建设部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: "A2-8", category: "A", subCategory: "A2", subCategoryName: "建设许可文件", name: "施工合同", tableCode: "", standard: "建设部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: "A2-9", category: "A", subCategory: "A2", subCategoryName: "建设许可文件", name: "建设项目设计概算及批复", tableCode: "", standard: "发改部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: "A2-10", category: "A", subCategory: "A2", subCategoryName: "建设许可文件", name: "初步设计审批文件", tableCode: "", standard: "建设部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A2-11", category: "A", subCategory: "A2", subCategoryName: "建设许可文件", name: "施工图设计文件审查意见书", tableCode: "", standard: "审图机构", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A2-12", category: "A", subCategory: "A2", subCategoryName: "建设许可文件", name: "施工图设计文件审查合格书", tableCode: "", standard: "审图机构", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A2-13", category: "A", subCategory: "A2", subCategoryName: "建设许可文件", name: "建设工程规划许可证(含附件及附图)", tableCode: "", standard: "规划部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A2-14", category: "A", subCategory: "A2", subCategoryName: "建设许可文件", name: "消防设计审查意见书", tableCode: "", standard: "消防部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A2-15", category: "A", subCategory: "A2", subCategoryName: "建设许可文件", name: "人民防空工程建设审批文件", tableCode: "", standard: "人防部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A2-16", category: "A", subCategory: "A2", subCategoryName: "建设许可文件", name: "超限高层建筑工程抗震设防专项审查意见", tableCode: "", standard: "建设部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
];
const a3Data: DocumentItem[] = [
  { id: "A3-1", category: "A", subCategory: "A3", subCategoryName: "施工许可文件", name: "建设工程施工许可证", tableCode: "", standard: "建设部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A3-2", category: "A", subCategory: "A3", subCategoryName: "施工许可文件", name: "工程质量监督登记表", tableCode: "", standard: "质量监督机构", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A3-3", category: "A", subCategory: "A3", subCategoryName: "施工许可文件", name: "建设工程施工图设计文件审查备案表", tableCode: "", standard: "建设部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A3-4", category: "A", subCategory: "A3", subCategoryName: "施工许可文件", name: "工程建设项目安全生产备案表", tableCode: "", standard: "安监部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A3-5", category: "A", subCategory: "A3", subCategoryName: "施工许可文件", name: "施工中标通知书", tableCode: "", standard: "建设部门", archiveUnits: { construction: true, supervision: false, constructionUnit: true, archive: false } },
  { id: "A3-6", category: "A", subCategory: "A3", subCategoryName: "施工许可文件", name: "监理中标通知书", tableCode: "", standard: "建设部门", archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: false } },
  { id: "A3-7", category: "A", subCategory: "A3", subCategoryName: "施工许可文件", name: "建筑工程施工合同及补充协议", tableCode: "", standard: "建设部门", archiveUnits: { construction: true, supervision: false, constructionUnit: true, archive: false } },
  { id: "A3-8", category: "A", subCategory: "A3", subCategoryName: "施工许可文件", name: "建设工程监理合同及补充协议", tableCode: "", standard: "建设部门", archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: false } },
  { id: "A3-9", category: "A", subCategory: "A3", subCategoryName: "施工许可文件", name: "与工程有关的其他合同文件", tableCode: "", standard: "相关单位", archiveUnits: { construction: true, supervision: false, constructionUnit: true, archive: false } },
  { id: "A3-10", category: "A", subCategory: "A3", subCategoryName: "施工许可文件", name: "法定代表人授权书", tableCode: "", standard: "建设单位", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: "A3-11", category: "A", subCategory: "A3", subCategoryName: "施工许可文件", name: "工程质量终身责任承诺书", tableCode: "", standard: "建设部门", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "A3-12", category: "A", subCategory: "A3", subCategoryName: "施工许可文件", name: "工程勘察文件质量合格证明", tableCode: "", standard: "勘察单位", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: "A3-13", category: "A", subCategory: "A3", subCategoryName: "施工许可文件", name: "工程设计文件质量合格证明", tableCode: "", standard: "设计单位", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: "A3-14", category: "A", subCategory: "A3", subCategoryName: "施工许可文件", name: "地上/地下管线及建(构)筑物资料移交单", tableCode: "", standard: "建设单位", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "A3-15", category: "A", subCategory: "A3", subCategoryName: "施工许可文件", name: "工程定位测量交接文件", tableCode: "", standard: "建设单位", archiveUnits: { construction: true, supervision: false, constructionUnit: true, archive: true } },
  { id: "A3-16", category: "A", subCategory: "A3", subCategoryName: "施工许可文件", name: "施工组织设计审查批准文件", tableCode: "", standard: "监理单位", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "A3-17", category: "A", subCategory: "A3", subCategoryName: "施工许可文件", name: "图纸会审记录", tableCode: "", standard: "参建各方", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "A3-18", category: "A", subCategory: "A3", subCategoryName: "施工许可文件", name: "设计交底记录", tableCode: "", standard: "设计单位", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "A3-19", category: "A", subCategory: "A3", subCategoryName: "施工许可文件", name: "第一次工地会议纪要", tableCode: "", standard: "监理单位", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "A3-20", category: "A", subCategory: "A3", subCategoryName: "施工许可文件", name: "施工现场质量管理检查记录", tableCode: "", standard: "监理单位", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
];
const a4Data: DocumentItem[] = [
  { id: "A4-1", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "工程竣工验收报告", tableCode: "", standard: "建设单位", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A4-2", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "单位工程质量竣工验收记录", tableCode: "", standard: "建设单位", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "A4-3", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "规划验收合格证", tableCode: "", standard: "规划部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A4-4", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "消防验收意见书", tableCode: "", standard: "消防部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A4-5", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "环保验收文件", tableCode: "", standard: "环保部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A4-6", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "人防工程验收文件", tableCode: "", standard: "人防部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A4-7", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "园林绿化验收文件", tableCode: "", standard: "园林部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A4-8", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "工程质量保修书", tableCode: "", standard: "施工单位", archiveUnits: { construction: true, supervision: false, constructionUnit: true, archive: true } },
  { id: "A4-9", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "住宅质量保证书", tableCode: "", standard: "建设单位", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A4-10", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "住宅使用说明书", tableCode: "", standard: "建设单位", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A4-11", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "建设工程竣工验收备案表", tableCode: "", standard: "建设部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A4-12", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "建设工程档案验收意见书", tableCode: "", standard: "档案部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A4-13", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "防雷装置竣工验收合格证", tableCode: "", standard: "气象部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A4-14", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "室内环境质量检测报告", tableCode: "", standard: "检测机构", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A4-15", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "建筑节能专项验收报告", tableCode: "", standard: "建设部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A4-16", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "电梯验收检验报告", tableCode: "", standard: "质监部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A4-17", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "竣工决算文件", tableCode: "", standard: "建设单位", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: "A4-18", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "竣工结算审核意见书", tableCode: "", standard: "审计部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: "A4-19", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "建设工程档案预验收意见", tableCode: "", standard: "档案部门", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A4-20", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "建设工程竣工验收联系单", tableCode: "", standard: "建设单位", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A4-21", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "工程质量评估报告", tableCode: "", standard: "监理单位", archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: true } },
  { id: "A4-22", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "勘察单位工程质量检查报告", tableCode: "", standard: "勘察单位", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A4-23", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "设计单位工程质量检查报告", tableCode: "", standard: "设计单位", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "A4-24", category: "A", subCategory: "A4", subCategoryName: "竣工验收备案文件", name: "施工单位工程质量竣工报告", tableCode: "", standard: "施工单位", archiveUnits: { construction: true, supervision: false, constructionUnit: true, archive: true } },
];

// ============================================================
// B类 监理资料
// ============================================================
const b1Data: DocumentItem[] = [
  { id: "B1-1", category: "B", subCategory: "B1", subCategoryName: "监理管理资料", name: "总监理工程师任命书", tableCode: "监表B1-1", standard: "DB11/T 808", archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: false } },
  { id: "B1-2", category: "B", subCategory: "B1", subCategoryName: "监理管理资料", name: "项目监理机构设置/人员调整通知书", tableCode: "监表B1-2", standard: "DB11/T 808", archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: false } },
  { id: "B1-3", category: "B", subCategory: "B1", subCategoryName: "监理管理资料", name: "监理规划", tableCode: "监表B1-3", standard: "DB11/T 808", archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: true } },
  { id: "B1-4", category: "B", subCategory: "B1", subCategoryName: "监理管理资料", name: "监理实施细则", tableCode: "监表B1-4", standard: "DB11/T 808", archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: false } },
  { id: "B1-5", category: "B", subCategory: "B1", subCategoryName: "监理管理资料", name: "监理月报", tableCode: "监表B1-5", standard: "DB11/T 808", archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: false } },
  { id: "B1-6", category: "B", subCategory: "B1", subCategoryName: "监理管理资料", name: "监理会议纪要", tableCode: "监表B1-6", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "B1-7", category: "B", subCategory: "B1", subCategoryName: "监理管理资料", name: "监理日志", tableCode: "监表B1-7", standard: "DB11/T 808", archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: false } },
  { id: "B1-8", category: "B", subCategory: "B1", subCategoryName: "监理管理资料", name: "监理工作总结", tableCode: "监表B1-8", standard: "DB11/T 808", archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: true } },
  { id: "B1-9", category: "B", subCategory: "B1", subCategoryName: "监理管理资料", name: "工程开工令", tableCode: "监表B1-9", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "B1-10", category: "B", subCategory: "B1", subCategoryName: "监理管理资料", name: "工程暂停令", tableCode: "监表B1-10", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
];

const b2Data: DocumentItem[] = [
  { id: "B2-1", category: "B", subCategory: "B2", subCategoryName: "监理工作记录", name: "监理通知单", tableCode: "监表B2-1", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "B2-2", category: "B", subCategory: "B2", subCategoryName: "监理工作记录", name: "监理通知回复单", tableCode: "监表B2-2", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "B2-3", category: "B", subCategory: "B2", subCategoryName: "监理工作记录", name: "工程暂停令", tableCode: "监表B2-3", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "B2-4", category: "B", subCategory: "B2", subCategoryName: "监理工作记录", name: "工程复工令", tableCode: "监表B2-4", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "B2-5", category: "B", subCategory: "B2", subCategoryName: "监理工作记录", name: "工程复工报审表", tableCode: "监表B2-5", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "B2-6", category: "B", subCategory: "B2", subCategoryName: "监理工作记录", name: "旁站记录", tableCode: "监表B2-6", standard: "DB11/T 808", archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: false } },
  { id: "B2-7", category: "B", subCategory: "B2", subCategoryName: "监理工作记录", name: "平行检验记录", tableCode: "监表B2-7", standard: "DB11/T 808", archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: false } },
  { id: "B2-8", category: "B", subCategory: "B2", subCategoryName: "监理工作记录", name: "巡视记录", tableCode: "监表B2-8", standard: "DB11/T 808", archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: false } },
  { id: "B2-9", category: "B", subCategory: "B2", subCategoryName: "监理工作记录", name: "见证取样和送检见证人备案书", tableCode: "监表B2-9", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "B2-10", category: "B", subCategory: "B2", subCategoryName: "监理工作记录", name: "见证记录", tableCode: "监表B2-10", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "B2-11", category: "B", subCategory: "B2", subCategoryName: "监理工作记录", name: "不合格项处置记录", tableCode: "监表B2-11", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "B2-12", category: "B", subCategory: "B2", subCategoryName: "监理工作记录", name: "施工进度计划报审表", tableCode: "监表B2-12", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "B2-13", category: "B", subCategory: "B2", subCategoryName: "监理工作记录", name: "工程款支付证书", tableCode: "监表B2-13", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "B2-14", category: "B", subCategory: "B2", subCategoryName: "监理工作记录", name: "工程款支付报审表", tableCode: "监表B2-14", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "B2-15", category: "B", subCategory: "B2", subCategoryName: "监理工作记录", name: "费用索赔报审表", tableCode: "监表B2-15", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "B2-16", category: "B", subCategory: "B2", subCategoryName: "监理工作记录", name: "工程临时/最终延期报审表", tableCode: "监表B2-16", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "B2-17", category: "B", subCategory: "B2", subCategoryName: "监理工作记录", name: "分包单位资质报审表", tableCode: "监表B2-17", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "B2-18", category: "B", subCategory: "B2", subCategoryName: "监理工作记录", name: "施工组织设计/方案报审表", tableCode: "监表B2-18", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "B2-19", category: "B", subCategory: "B2", subCategoryName: "监理工作记录", name: "工程质量事故报告书", tableCode: "监表B2-19", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "B2-20", category: "B", subCategory: "B2", subCategoryName: "监理工作记录", name: "工程变更费用报审表", tableCode: "监表B2-20", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
];

const b3Data: DocumentItem[] = [
  { id: "B3-1", category: "B", subCategory: "B3", subCategoryName: "竣工验收监理资料", name: "单位工程竣工验收报告", tableCode: "监表B3-1", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "B3-2", category: "B", subCategory: "B3", subCategoryName: "竣工验收监理资料", name: "竣工移交证书", tableCode: "监表B3-2", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "B3-3", category: "B", subCategory: "B3", subCategoryName: "竣工验收监理资料", name: "工程质量评估报告", tableCode: "监表B3-3", standard: "DB11/T 808", archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: true } },
];

const b4Data: DocumentItem[] = [
  { id: "B4-1", category: "B", subCategory: "B4", subCategoryName: "其它资料", name: "工作联系单", tableCode: "监表B4-1", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "B4-2", category: "B", subCategory: "B4", subCategoryName: "其它资料", name: "工程变更单", tableCode: "监表B4-2", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
];

// ============================================================
// C类 施工资料
// ============================================================
const c1Data: DocumentItem[] = [
  { id: "C1-1", category: "C", subCategory: "C1", subCategoryName: "施工管理资料", name: "工程概况表", tableCode: "施表C1-1", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C1-2", category: "C", subCategory: "C1", subCategoryName: "施工管理资料", name: "工程里程碑计划表", tableCode: "施表C1-2", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "C1-3", category: "C", subCategory: "C1", subCategoryName: "施工管理资料", name: "施工日志", tableCode: "施表C1-3", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: false, constructionUnit: false, archive: false } },
  { id: "C1-4", category: "C", subCategory: "C1", subCategoryName: "施工管理资料", name: "工程质量事故记录", tableCode: "施表C1-4", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C1-5", category: "C", subCategory: "C1", subCategoryName: "施工管理资料", name: "施工现场质量管理检查记录", tableCode: "施表C1-5", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "C1-6", category: "C", subCategory: "C1", subCategoryName: "施工管理资料", name: "其他施工管理资料", tableCode: "施表C1-6", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: false, constructionUnit: false, archive: false } },
];

const c2Data: DocumentItem[] = [
  { id: "C2-1", category: "C", subCategory: "C2", subCategoryName: "施工技术资料", name: "施工组织设计", tableCode: "施表C2-1", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "C2-2", category: "C", subCategory: "C2", subCategoryName: "施工技术资料", name: "施工方案", tableCode: "施表C2-2", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "C2-3", category: "C", subCategory: "C2", subCategoryName: "施工技术资料", name: "图纸会审记录", tableCode: "施表C2-3", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C2-4", category: "C", subCategory: "C2", subCategoryName: "施工技术资料", name: "设计交底记录", tableCode: "施表C2-4", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C2-5", category: "C", subCategory: "C2", subCategoryName: "施工技术资料", name: "技术交底记录", tableCode: "施表C2-5", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: false, constructionUnit: false, archive: false } },
  { id: "C2-6", category: "C", subCategory: "C2", subCategoryName: "施工技术资料", name: "工程洽商记录", tableCode: "施表C2-6", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C2-7", category: "C", subCategory: "C2", subCategoryName: "施工技术资料", name: "设计变更通知单", tableCode: "施表C2-7", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C2-8", category: "C", subCategory: "C2", subCategoryName: "施工技术资料", name: "设计变更洽商记录", tableCode: "施表C2-8", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C2-9", category: "C", subCategory: "C2", subCategoryName: "施工技术资料", name: "危险性较大的分部分项工程专家论证报告", tableCode: "施表C2-9", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C2-10", category: "C", subCategory: "C2", subCategoryName: "施工技术资料", name: "四新技术应用记录", tableCode: "施表C2-10", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "C2-11", category: "C", subCategory: "C2", subCategoryName: "施工技术资料", name: "其他施工技术资料", tableCode: "施表C2-11", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: false, constructionUnit: false, archive: false } },
];
const c3Data: DocumentItem[] = [
  { id: "C3-1", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "工程材料/构配件/设备报审表", tableCode: "施表C3-1", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "C3-2", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "材料进场检验记录", tableCode: "施表C3-2", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "C3-3", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "设备开箱检验记录", tableCode: "施表C3-3", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "C3-4-1", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "钢材出厂合格证及检验报告", tableCode: "施表C3-4-1", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-2", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "钢筋机械连接接头型式检验报告", tableCode: "施表C3-4-2", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-3", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "预应力筋出厂合格证及检验报告", tableCode: "施表C3-4-3", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-4", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "预应力锚具/夹具/连接器出厂合格证及检验报告", tableCode: "施表C3-4-4", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-5", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "水泥出厂合格证及检验报告", tableCode: "施表C3-4-5", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-6", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "砖及砌块出厂合格证及检验报告", tableCode: "施表C3-4-6", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-7", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "砂/石出厂合格证及检验报告", tableCode: "施表C3-4-7", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-8", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "掺合料出厂合格证及检验报告", tableCode: "施表C3-4-8", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-9", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "外加剂出厂合格证及检验报告", tableCode: "施表C3-4-9", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-10", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "防水材料出厂合格证及检验报告", tableCode: "施表C3-4-10", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-11", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "沥青出厂合格证及检验报告", tableCode: "施表C3-4-11", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-12", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "沥青混合料出厂合格证及检验报告", tableCode: "施表C3-4-12", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-13", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "石灰出厂合格证及检验报告", tableCode: "施表C3-4-13", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-14", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "土工合成材料出厂合格证及检验报告", tableCode: "施表C3-4-14", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-15", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "预应力锚索出厂合格证及检验报告", tableCode: "施表C3-4-15", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-16", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "支座出厂合格证及检验报告", tableCode: "施表C3-4-16", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-17", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "伸缩装置出厂合格证及检验报告", tableCode: "施表C3-4-17", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-18", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "管材/管件出厂合格证及检验报告", tableCode: "施表C3-4-18", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-19", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "阀门出厂合格证及检验报告", tableCode: "施表C3-4-19", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-20", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "混凝土构件出厂合格证", tableCode: "施表C3-4-20", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-21", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "钢构件出厂合格证", tableCode: "施表C3-4-21", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-22", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "焊接材料出厂合格证及检验报告", tableCode: "施表C3-4-22", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-23", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "电缆/电线出厂合格证及检验报告", tableCode: "施表C3-4-23", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-24", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "电气设备出厂合格证及检验报告", tableCode: "施表C3-4-24", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-25", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "灯具出厂合格证及检验报告", tableCode: "施表C3-4-25", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-26", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "设备(仪器)出厂合格证及检验报告", tableCode: "施表C3-4-26", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-27", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "保温材料出厂合格证及检验报告", tableCode: "施表C3-4-27", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-28", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "防腐材料出厂合格证及检验报告", tableCode: "施表C3-4-28", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-29", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "涂料出厂合格证及检验报告", tableCode: "施表C3-4-29", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C3-4-30", category: "C", subCategory: "C3", subCategoryName: "工程物资资料", name: "其他物资出厂合格证及检验报告", tableCode: "施表C3-4-30", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
];
const c4Data: DocumentItem[] = [
  { id: "C4-1", category: "C", subCategory: "C4", subCategoryName: "施工测量监测资料", name: "工程定位测量记录", tableCode: "施表C4-1", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C4-2", category: "C", subCategory: "C4", subCategoryName: "施工测量监测资料", name: "测量复核记录", tableCode: "施表C4-2", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C4-3", category: "C", subCategory: "C4", subCategoryName: "施工测量监测资料", name: "沉降观测记录", tableCode: "施表C4-3", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C4-4", category: "C", subCategory: "C4", subCategoryName: "施工测量监测资料", name: "基坑支护结构顶部水平位移监测记录", tableCode: "施表C4-4", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C4-5", category: "C", subCategory: "C4", subCategoryName: "施工测量监测资料", name: "基坑支护结构顶部沉降监测记录", tableCode: "施表C4-5", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C4-6", category: "C", subCategory: "C4", subCategoryName: "施工测量监测资料", name: "隧道内壁位移监测记录", tableCode: "施表C4-6", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C4-7", category: "C", subCategory: "C4", subCategoryName: "施工测量监测资料", name: "隧道拱顶下沉监测记录", tableCode: "施表C4-7", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C4-8", category: "C", subCategory: "C4", subCategoryName: "施工测量监测资料", name: "隧道收敛监测记录", tableCode: "施表C4-8", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C4-9", category: "C", subCategory: "C4", subCategoryName: "施工测量监测资料", name: "其他施工测量监测资料", tableCode: "施表C4-9", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
];
// C5-1
const c5_1Data: DocumentItem[] = [
  { id: "C5-1-1", category: "C", subCategory: "C5-1", subCategoryName: "通用记录", name: "隐蔽工程验收记录", tableCode: "施表C5-1-1", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C5-1-2", category: "C", subCategory: "C5-1", subCategoryName: "通用记录", name: "交接检查记录", tableCode: "施表C5-1-2", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: "C5-1-3", category: "C", subCategory: "C5-1", subCategoryName: "通用记录", name: "中间验收记录", tableCode: "施表C5-1-3", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C5-1-4", category: "C", subCategory: "C5-1", subCategoryName: "通用记录", name: "施工检查记录(通用)", tableCode: "施表C5-1-4", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
];
const c5_2Data: DocumentItem[] = [
  { id: "C5-2-1", category: "C", subCategory: "C5-2", subCategoryName: "基础/主体结构工程通用施工记录", name: "地基处理记录", tableCode: "施表C5-2-1", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C5-2-2", category: "C", subCategory: "C5-2", subCategoryName: "基础/主体结构工程通用施工记录", name: "地基验槽记录", tableCode: "施表C5-2-2", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C5-2-3", category: "C", subCategory: "C5-2", subCategoryName: "基础/主体结构工程通用施工记录", name: "地基钎探记录", tableCode: "施表C5-2-3", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C5-2-4", category: "C", subCategory: "C5-2", subCategoryName: "基础/主体结构工程通用施工记录", name: "桩基施工记录", tableCode: "施表C5-2-4", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C5-2-5", category: "C", subCategory: "C5-2", subCategoryName: "基础/主体结构工程通用施工记录", name: "灌注桩成孔施工记录", tableCode: "施表C5-2-5", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C5-2-6", category: "C", subCategory: "C5-2", subCategoryName: "基础/主体结构工程通用施工记录", name: "灌注桩混凝土灌注记录", tableCode: "施表C5-2-6", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C5-2-7", category: "C", subCategory: "C5-2", subCategoryName: "基础/主体结构工程通用施工记录", name: "地下连续墙成槽施工记录", tableCode: "施表C5-2-7", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C5-2-8", category: "C", subCategory: "C5-2", subCategoryName: "基础/主体结构工程通用施工记录", name: "地下连续墙混凝土灌注记录", tableCode: "施表C5-2-8", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C5-2-9", category: "C", subCategory: "C5-2", subCategoryName: "基础/主体结构工程通用施工记录", name: "防水工程施工记录", tableCode: "施表C5-2-9", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C5-2-10", category: "C", subCategory: "C5-2", subCategoryName: "基础/主体结构工程通用施工记录", name: "钢筋隐蔽工程检查验收记录", tableCode: "施表C5-2-10", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C5-2-11", category: "C", subCategory: "C5-2", subCategoryName: "基础/主体结构工程通用施工记录", name: "预应力张拉记录", tableCode: "施表C5-2-11", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C5-2-12", category: "C", subCategory: "C5-2", subCategoryName: "基础/主体结构工程通用施工记录", name: "预应力孔道灌浆记录", tableCode: "施表C5-2-12", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C5-2-13", category: "C", subCategory: "C5-2", subCategoryName: "基础/主体结构工程通用施工记录", name: "混凝土浇筑记录", tableCode: "施表C5-2-13", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C5-2-14", category: "C", subCategory: "C5-2", subCategoryName: "基础/主体结构工程通用施工记录", name: "混凝土养护记录", tableCode: "施表C5-2-14", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-2-16', category: 'C', subCategory: 'C5-2', subCategoryName: '基础/主体结构工程通用施工记录', name: '焊接材料烘焙记录', tableCode: '施表C5-2-16', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C5-2-17', category: 'C', subCategory: 'C5-2', subCategoryName: '基础/主体结构工程通用施工记录', name: '钢结构安装施工记录', tableCode: '施表C5-2-17', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-2-18', category: 'C', subCategory: 'C5-2', subCategoryName: '基础/主体结构工程通用施工记录', name: '高强度螺栓连接施工记录', tableCode: '施表C5-2-18', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-2-19', category: 'C', subCategory: 'C5-2', subCategoryName: '基础/主体结构工程通用施工记录', name: '箱涵顶进记录', tableCode: '施表C5-2-19', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-2-20', category: 'C', subCategory: 'C5-2', subCategoryName: '基础/主体结构工程通用施工记录', name: '基坑支护结构施工记录', tableCode: '施表C5-2-20', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-2-21', category: 'C', subCategory: 'C5-2', subCategoryName: '基础/主体结构工程通用施工记录', name: '锚杆施工记录', tableCode: '施表C5-2-21', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-2-22', category: 'C', subCategory: 'C5-2', subCategoryName: '基础/主体结构工程通用施工记录', name: '土钉墙施工记录', tableCode: '施表C5-2-22', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-2-23', category: 'C', subCategory: 'C5-2', subCategoryName: '基础/主体结构工程通用施工记录', name: '沉井下沉施工记录', tableCode: '施表C5-2-23', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-2-24', category: 'C', subCategory: 'C5-2', subCategoryName: '基础/主体结构工程通用施工记录', name: '沉井封底施工记录', tableCode: '施表C5-2-24', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-2-25', category: 'C', subCategory: 'C5-2', subCategoryName: '基础/主体结构工程通用施工记录', name: '模板安装检查记录', tableCode: '施表C5-2-25', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C5-2-26', category: 'C', subCategory: 'C5-2', subCategoryName: '基础/主体结构工程通用施工记录', name: '模板拆除申请及验收记录', tableCode: '施表C5-2-26', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C5-2-27', category: 'C', subCategory: 'C5-2', subCategoryName: '基础/主体结构工程通用施工记录', name: '构件吊装施工记录', tableCode: '施表C5-2-27', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-2-28', category: 'C', subCategory: 'C5-2', subCategoryName: '基础/主体结构工程通用施工记录', name: '后浇带施工记录', tableCode: '施表C5-2-28', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-2-29', category: 'C', subCategory: 'C5-2', subCategoryName: '基础/主体结构工程通用施工记录', name: '其他基础/主体结构工程施工记录', tableCode: '施表C5-2-29', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
];

const c5_3Data: DocumentItem[] = [
  { id: 'C5-3-1', category: 'C', subCategory: 'C5-3', subCategoryName: '道路、桥梁工程施工记录', name: '路基压实度检测报告汇总表', tableCode: '施表C5-3-1', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-3-2', category: 'C', subCategory: 'C5-3', subCategoryName: '道路、桥梁工程施工记录', name: '路面结构层施工记录', tableCode: '施表C5-3-2', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-3-3', category: 'C', subCategory: 'C5-3', subCategoryName: '道路、桥梁工程施工记录', name: '沥青混合料摊铺记录', tableCode: '施表C5-3-3', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-3-4', category: 'C', subCategory: 'C5-3', subCategoryName: '道路、桥梁工程施工记录', name: '桥梁上部结构施工记录', tableCode: '施表C5-3-4', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-3-5', category: 'C', subCategory: 'C5-3', subCategoryName: '道路、桥梁工程施工记录', name: '桥梁下部结构施工记录', tableCode: '施表C5-3-5', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-3-6', category: 'C', subCategory: 'C5-3', subCategoryName: '道路、桥梁工程施工记录', name: '其他道路、桥梁工程施工记录', tableCode: '施表C5-3-6', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
];

const c5_4Data: DocumentItem[] = [
  { id: 'C5-4-1', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '管道沟槽开挖施工记录', tableCode: '施表C5-4-1', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4-2', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '管道基础施工记录', tableCode: '施表C5-4-2', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4-3', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '管道安装施工记录', tableCode: '施表C5-4-3', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4-4', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '管道接口处理记录', tableCode: '施表C5-4-4', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4-5', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '管道回填施工记录', tableCode: '施表C5-4-5', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4-6', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '管道严密性试验记录', tableCode: '施表C5-4-6', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4-7', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '管道冲洗消毒记录', tableCode: '施表C5-4-7', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4-8', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '管道CCTV检测记录', tableCode: '施表C5-4-8', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4-9', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '顶管施工记录', tableCode: '施表C5-4-9', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4-10', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '盾构隧道掘进施工记录', tableCode: '施表C5-4-10', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4-11', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '盾构隧道管片拼装记录', tableCode: '施表C5-4-11', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4-12', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '盾构隧道注浆记录', tableCode: '施表C5-4-12', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4-13', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '浅埋暗挖隧道施工记录', tableCode: '施表C5-4-13', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4-14', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '隧道初期支护施工记录', tableCode: '施表C5-4-14', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4-15', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '隧道二次衬砌施工记录', tableCode: '施表C5-4-15', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4-16', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '检查井施工记录', tableCode: '施表C5-4-16', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4-17', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '管道焊接施工记录', tableCode: '施表C5-4-17', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4-18', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '管道防腐层施工记录', tableCode: '施表C5-4-18', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4-19', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '管道保温层施工记录', tableCode: '施表C5-4-19', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4-20', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '管道穿越施工记录', tableCode: '施表C5-4-20', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4-21', category: 'C', subCategory: 'C5-4', subCategoryName: '管(隧)道工程施工记录', name: '其他管(隧)道工程施工记录', tableCode: '施表C5-4-21', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
];


const c5_5Data: DocumentItem[] = [
  { id: 'C5-5-1', category: 'C', subCategory: 'C5-5', subCategoryName: '厂(场)、站设备安装工程施工记录', name: '设备基础交接验收记录', tableCode: '施表C5-5-1', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-5-2', category: 'C', subCategory: 'C5-5', subCategoryName: '厂(场)、站设备安装工程施工记录', name: '设备开箱检验记录', tableCode: '施表C5-5-2', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C5-5-3', category: 'C', subCategory: 'C5-5', subCategoryName: '厂(场)、站设备安装工程施工记录', name: '设备安装记录', tableCode: '施表C5-5-3', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-5-4', category: 'C', subCategory: 'C5-5', subCategoryName: '厂(场)、站设备安装工程施工记录', name: '设备单机试运转记录', tableCode: '施表C5-5-4', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-5-5', category: 'C', subCategory: 'C5-5', subCategoryName: '厂(场)、站设备安装工程施工记录', name: '设备联动试运转记录', tableCode: '施表C5-5-5', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-5-6', category: 'C', subCategory: 'C5-5', subCategoryName: '厂(场)、站设备安装工程施工记录', name: '水池满水试验记录', tableCode: '施表C5-5-6', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-5-7', category: 'C', subCategory: 'C5-5', subCategoryName: '厂(场)、站设备安装工程施工记录', name: '污泥消化池气密性试验记录', tableCode: '施表C5-5-7', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-5-8', category: 'C', subCategory: 'C5-5', subCategoryName: '厂(场)、站设备安装工程施工记录', name: '管道吹扫/清洗记录', tableCode: '施表C5-5-8', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-5-9', category: 'C', subCategory: 'C5-5', subCategoryName: '厂(场)、站设备安装工程施工记录', name: '管道压力试验记录', tableCode: '施表C5-5-9', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-5-10', category: 'C', subCategory: 'C5-5', subCategoryName: '厂(场)、站设备安装工程施工记录', name: '管道/设备防腐施工记录', tableCode: '施表C5-5-10', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-5-11', category: 'C', subCategory: 'C5-5', subCategoryName: '厂(场)、站设备安装工程施工记录', name: '管道/设备绝热施工记录', tableCode: '施表C5-5-11', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-5-12', category: 'C', subCategory: 'C5-5', subCategoryName: '厂(场)、站设备安装工程施工记录', name: '仪表校准记录', tableCode: '施表C5-5-12', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-5-13', category: 'C', subCategory: 'C5-5', subCategoryName: '厂(场)、站设备安装工程施工记录', name: '自动化控制系统调试记录', tableCode: '施表C5-5-13', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-5-14', category: 'C', subCategory: 'C5-5', subCategoryName: '厂(场)、站设备安装工程施工记录', name: '起重设备安装记录', tableCode: '施表C5-5-14', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-5-15', category: 'C', subCategory: 'C5-5', subCategoryName: '厂(场)、站设备安装工程施工记录', name: '水泵安装记录', tableCode: '施表C5-5-15', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-5-16', category: 'C', subCategory: 'C5-5', subCategoryName: '厂(场)、站设备安装工程施工记录', name: '风机安装记录', tableCode: '施表C5-5-16', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-5-17', category: 'C', subCategory: 'C5-5', subCategoryName: '厂(场)、站设备安装工程施工记录', name: '格栅安装记录', tableCode: '施表C5-5-17', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-5-18', category: 'C', subCategory: 'C5-5', subCategoryName: '厂(场)、站设备安装工程施工记录', name: '刮泥机安装记录', tableCode: '施表C5-5-18', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-5-19', category: 'C', subCategory: 'C5-5', subCategoryName: '厂(场)、站设备安装工程施工记录', name: '其他厂(场)/站设备安装工程施工记录', tableCode: '施表C5-5-19', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
];

const c5_6Data: DocumentItem[] = [
  { id: 'C5-6-1', category: 'C', subCategory: 'C5-6', subCategoryName: '电气安装工程施工记录', name: '电气设备交接试验记录', tableCode: '施表C5-6-1', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-6-2', category: 'C', subCategory: 'C5-6', subCategoryName: '电气安装工程施工记录', name: '电缆敷设记录', tableCode: '施表C5-6-2', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-6-3', category: 'C', subCategory: 'C5-6', subCategoryName: '电气安装工程施工记录', name: '电缆接头制作记录', tableCode: '施表C5-6-3', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-6-4', category: 'C', subCategory: 'C5-6', subCategoryName: '电气安装工程施工记录', name: '电气照明通电试运行记录', tableCode: '施表C5-6-4', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-6-5', category: 'C', subCategory: 'C5-6', subCategoryName: '电气安装工程施工记录', name: '电气设备空载试运行记录', tableCode: '施表C5-6-5', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-6-6', category: 'C', subCategory: 'C5-6', subCategoryName: '电气安装工程施工记录', name: '接地电阻测试记录', tableCode: '施表C5-6-6', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-6-7', category: 'C', subCategory: 'C5-6', subCategoryName: '电气安装工程施工记录', name: '绝缘电阻测试记录', tableCode: '施表C5-6-7', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-6-8', category: 'C', subCategory: 'C5-6', subCategoryName: '电气安装工程施工记录', name: '漏电保护装置检测记录', tableCode: '施表C5-6-8', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-6-9', category: 'C', subCategory: 'C5-6', subCategoryName: '电气安装工程施工记录', name: '防雷接地装置检测记录', tableCode: '施表C5-6-9', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-6-10', category: 'C', subCategory: 'C5-6', subCategoryName: '电气安装工程施工记录', name: '变压器安装记录', tableCode: '施表C5-6-10', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-6-11', category: 'C', subCategory: 'C5-6', subCategoryName: '电气安装工程施工记录', name: '高低压开关柜安装记录', tableCode: '施表C5-6-11', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-6-12', category: 'C', subCategory: 'C5-6', subCategoryName: '电气安装工程施工记录', name: '母线安装记录', tableCode: '施表C5-6-12', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-6-13', category: 'C', subCategory: 'C5-6', subCategoryName: '电气安装工程施工记录', name: '其他电气安装工程施工记录', tableCode: '施表C5-6-13', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
];

// C6
const c6_1Data: DocumentItem[] = [
  { id: 'C6-1-1', category: 'C', subCategory: 'C6-1', subCategoryName: '施工试验检测报告(通用)', name: '施工试验检测计划', tableCode: '施表C6-1-1', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
];

const c6_2Data: DocumentItem[] = [
  { id: 'C6-2-1', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '土工击实试验报告', tableCode: '施表C6-2-1', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-2', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '土工压实度试验报告', tableCode: '施表C6-2-2', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-3', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '地基承载力试验报告', tableCode: '施表C6-2-3', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-4', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '桩基检测报告', tableCode: '施表C6-2-4', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-5', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '钢筋连接试验报告', tableCode: '施表C6-2-5', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-6', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '钢筋机械连接工艺检验报告', tableCode: '施表C6-2-6', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-7', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '钢筋焊接工艺试验报告', tableCode: '施表C6-2-7', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-8', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '混凝土配合比设计报告', tableCode: '施表C6-2-8', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-9', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '混凝土试块强度试验报告', tableCode: '施表C6-2-9', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-10', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '混凝土强度统计评定表', tableCode: '施表C6-2-10', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-11', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '混凝土抗渗试验报告', tableCode: '施表C6-2-11', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-12', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '混凝土抗冻试验报告', tableCode: '施表C6-2-12', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-13', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '砂浆配合比设计报告', tableCode: '施表C6-2-13', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-14', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '砂浆试块强度试验报告', tableCode: '施表C6-2-14', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-15', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '焊缝无损检测报告', tableCode: '施表C6-2-15', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-16', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '高强度螺栓连接摩擦面抗滑移系数试验报告', tableCode: '施表C6-2-16', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-17', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '钢结构防腐涂料检测报告', tableCode: '施表C6-2-17', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-18', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '钢结构防火涂料检测报告', tableCode: '施表C6-2-18', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-19', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '结构实体钢筋保护层厚度检测报告', tableCode: '施表C6-2-19', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-20', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '结构实体混凝土强度检测报告', tableCode: '施表C6-2-20', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-21', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '后置埋件抗拔强度检测报告', tableCode: '施表C6-2-21', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-22', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '回弹法检测混凝土强度报告', tableCode: '施表C6-2-22', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-23', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '钻芯法检测混凝土强度报告', tableCode: '施表C6-2-23', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-24', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '锚杆抗拔承载力检测报告', tableCode: '施表C6-2-24', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-2-25', category: 'C', subCategory: 'C6-2', subCategoryName: '基础/主体结构工程', name: '其他基础/主体结构工程试验检测报告', tableCode: '施表C6-2-25', standard: 'DB11/T 808', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
];

const c6_3Data: DocumentItem[] = [  { id: "C6-3-1", category: "C", subCategory: "C6-3", subCategoryName: "道路、桥梁工程", name: "路基路面弯沉值检测报告", tableCode: "施表C6-3-1", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-3-2", category: "C", subCategory: "C6-3", subCategoryName: "道路、桥梁工程", name: "路面平整度检测报告", tableCode: "施表C6-3-2", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-3-3", category: "C", subCategory: "C6-3", subCategoryName: "道路、桥梁工程", name: "路面抗滑性能检测报告", tableCode: "施表C6-3-3", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-3-4", category: "C", subCategory: "C6-3", subCategoryName: "道路、桥梁工程", name: "沥青混合料配合比设计报告", tableCode: "施表C6-3-4", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-3-5", category: "C", subCategory: "C6-3", subCategoryName: "道路、桥梁工程", name: "沥青混合料马歇尔试验报告", tableCode: "施表C6-3-5", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-3-6", category: "C", subCategory: "C6-3", subCategoryName: "道路、桥梁工程", name: "桥梁动静载试验报告", tableCode: "施表C6-3-6", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-3-7", category: "C", subCategory: "C6-3", subCategoryName: "道路、桥梁工程", name: "桥梁支座检测报告", tableCode: "施表C6-3-7", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-3-8", category: "C", subCategory: "C6-3", subCategoryName: "道路、桥梁工程", name: "预应力孔道摩阻试验报告", tableCode: "施表C6-3-8", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-3-9", category: "C", subCategory: "C6-3", subCategoryName: "道路、桥梁工程", name: "其他道路/桥梁工程试验检测报告", tableCode: "施表C6-3-9", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
];

const c6_4Data: DocumentItem[] = [
  { id: "C6-4-1", category: "C", subCategory: "C6-4", subCategoryName: "管(隧)道工程", name: "管道水压试验报告", tableCode: "施表C6-4-1", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-4-2", category: "C", subCategory: "C6-4", subCategoryName: "管(隧)道工程", name: "管道严密性试验报告", tableCode: "施表C6-4-2", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-4-3", category: "C", subCategory: "C6-4", subCategoryName: "管(隧)道工程", name: "管道闭水试验报告", tableCode: "施表C6-4-3", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-4-4", category: "C", subCategory: "C6-4", subCategoryName: "管(隧)道工程", name: "管道闭气试验报告", tableCode: "施表C6-4-4", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-4-5", category: "C", subCategory: "C6-4", subCategoryName: "管(隧)道工程", name: "管道注水试验报告", tableCode: "施表C6-4-5", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-4-6", category: "C", subCategory: "C6-4", subCategoryName: "管(隧)道工程", name: "管道焊缝无损检测报告", tableCode: "施表C6-4-6", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-4-7", category: "C", subCategory: "C6-4", subCategoryName: "管(隧)道工程", name: "管道防腐层检测报告", tableCode: "施表C6-4-7", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-4-8", category: "C", subCategory: "C6-4", subCategoryName: "管(隧)道工程", name: "管道冲洗消毒水质检测报告", tableCode: "施表C6-4-8", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-4-9", category: "C", subCategory: "C6-4", subCategoryName: "管(隧)道工程", name: "管道CCTV检测评估报告", tableCode: "施表C6-4-9", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-4-10", category: "C", subCategory: "C6-4", subCategoryName: "管(隧)道工程", name: "隧道衬砌厚度检测报告", tableCode: "施表C6-4-10", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-4-11", category: "C", subCategory: "C6-4", subCategoryName: "管(隧)道工程", name: "隧道衬砌背后空洞检测报告", tableCode: "施表C6-4-11", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-4-12", category: "C", subCategory: "C6-4", subCategoryName: "管(隧)道工程", name: "隧道渗漏水检测报告", tableCode: "施表C6-4-12", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-4-13", category: "C", subCategory: "C6-4", subCategoryName: "管(隧)道工程", name: "土体变形监测报告", tableCode: "施表C6-4-13", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-4-14", category: "C", subCategory: "C6-4", subCategoryName: "管(隧)道工程", name: "地下水监测报告", tableCode: "施表C6-4-14", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-4-15", category: "C", subCategory: "C6-4", subCategoryName: "管(隧)道工程", name: "其他管(隧)道工程试验检测报告", tableCode: "施表C6-4-15", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
];

const c6_5Data: DocumentItem[] = [
  { id: "C6-5-1", category: "C", subCategory: "C6-5", subCategoryName: "厂(场)、站工程", name: "设备单机试运转试验报告", tableCode: "施表C6-5-1", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-5-2", category: "C", subCategory: "C6-5", subCategoryName: "厂(场)、站工程", name: "设备联动试运转试验报告", tableCode: "施表C6-5-2", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-5-3", category: "C", subCategory: "C6-5", subCategoryName: "厂(场)、站工程", name: "管道吹扫/冲洗试验报告", tableCode: "施表C6-5-3", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-5-4", category: "C", subCategory: "C6-5", subCategoryName: "厂(场)、站工程", name: "管道压力试验报告", tableCode: "施表C6-5-4", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-5-5", category: "C", subCategory: "C6-5", subCategoryName: "厂(场)、站工程", name: "设备安装精度检测报告", tableCode: "施表C6-5-5", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-5-6", category: "C", subCategory: "C6-5", subCategoryName: "厂(场)、站工程", name: "自动化控制系统调试报告", tableCode: "施表C6-5-6", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-5-7", category: "C", subCategory: "C6-5", subCategoryName: "厂(场)、站工程", name: "电气设备交接试验报告", tableCode: "施表C6-5-7", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-5-8", category: "C", subCategory: "C6-5", subCategoryName: "厂(场)、站工程", name: "水池满水试验报告", tableCode: "施表C6-5-8", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-5-9", category: "C", subCategory: "C6-5", subCategoryName: "厂(场)、站工程", name: "污泥消化池气密性试验报告", tableCode: "施表C6-5-9", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-5-10", category: "C", subCategory: "C6-5", subCategoryName: "厂(场)、站工程", name: "其他厂(场)/站工程试验检测报告", tableCode: "施表C6-5-10", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
];

const c6_6Data: DocumentItem[] = [
  { id: "C6-6-1", category: "C", subCategory: "C6-6", subCategoryName: "电气设备安装调试工程", name: "电气设备绝缘电阻测试报告", tableCode: "施表C6-6-1", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-6-2", category: "C", subCategory: "C6-6", subCategoryName: "电气设备安装调试工程", name: "接地电阻测试报告", tableCode: "施表C6-6-2", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-6-3", category: "C", subCategory: "C6-6", subCategoryName: "电气设备安装调试工程", name: "继电保护整定调试报告", tableCode: "施表C6-6-3", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-6-4", category: "C", subCategory: "C6-6", subCategoryName: "电气设备安装调试工程", name: "变压器交接试验报告", tableCode: "施表C6-6-4", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-6-5", category: "C", subCategory: "C6-6", subCategoryName: "电气设备安装调试工程", name: "高低压开关柜调试报告", tableCode: "施表C6-6-5", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-6-6", category: "C", subCategory: "C6-6", subCategoryName: "电气设备安装调试工程", name: "电缆耐压试验报告", tableCode: "施表C6-6-6", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-6-7", category: "C", subCategory: "C6-6", subCategoryName: "电气设备安装调试工程", name: "防雷及接地装置检测报告", tableCode: "施表C6-6-7", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-6-8", category: "C", subCategory: "C6-6", subCategoryName: "电气设备安装调试工程", name: "电气照明全负荷试验报告", tableCode: "施表C6-6-8", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C6-6-9", category: "C", subCategory: "C6-6", subCategoryName: "电气设备安装调试工程", name: "其他电气设备安装调试试验报告", tableCode: "施表C6-6-9", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
];

// C7
const c7Data: DocumentItem[] = [
  { id: "C7-1", category: "C", subCategory: "C7", subCategoryName: "施工质量验收资料", name: "检验批质量验收记录汇总表", tableCode: "施表C7-1", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C7-2", category: "C", subCategory: "C7", subCategoryName: "施工质量验收资料", name: "分项工程质量验收记录汇总表", tableCode: "施表C7-2", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C7-3", category: "C", subCategory: "C7", subCategoryName: "施工质量验收资料", name: "分部(子分部)工程质量验收记录", tableCode: "施表C7-3", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C7-4", category: "C", subCategory: "C7", subCategoryName: "施工质量验收资料", name: "单位(子单位)工程质量竣工验收记录", tableCode: "施表C7-4", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
];

// C8
const c8Data: DocumentItem[] = [
  { id: "C8-1", category: "C", subCategory: "C8", subCategoryName: "工程竣工验收资料", name: "单位(子单位)工程质量竣工验收记录", tableCode: "施表C8-1", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C8-2", category: "C", subCategory: "C8", subCategoryName: "工程竣工验收资料", name: "单位(子单位)工程质量控制资料核查记录", tableCode: "施表C8-2", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C8-3", category: "C", subCategory: "C8", subCategoryName: "工程竣工验收资料", name: "单位(子单位)工程安全和功能检验资料核查及主要功能抽查记录", tableCode: "施表C8-3", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C8-4", category: "C", subCategory: "C8", subCategoryName: "工程竣工验收资料", name: "单位(子单位)工程观感质量检查记录", tableCode: "施表C8-4", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C8-5", category: "C", subCategory: "C8", subCategoryName: "工程竣工验收资料", name: "工程质量竣工报告(施工单位)", tableCode: "施表C8-5", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: false, constructionUnit: true, archive: true } },
  { id: "C8-6", category: "C", subCategory: "C8", subCategoryName: "工程竣工验收资料", name: "施工总结", tableCode: "施表C8-6", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: false, constructionUnit: true, archive: false } },
  { id: "C8-7", category: "C", subCategory: "C8", subCategoryName: "工程竣工验收资料", name: "竣工图编制说明", tableCode: "施表C8-7", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "C8-8", category: "C", subCategory: "C8", subCategoryName: "工程竣工验收资料", name: "其他工程竣工验收资料", tableCode: "施表C8-8", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: false, constructionUnit: true, archive: false } },
];

// ============================================================
// D类 竣工图
// ============================================================
const dData: DocumentItem[] = [
  { id: "D-1", category: "D", subCategory: "D1", subCategoryName: "竣工图", name: "竣工图(含电子文件)", tableCode: "", standard: "施工单位编制", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
];

// ============================================================
// E类 组卷和归档资料
// ============================================================
const e1Data: DocumentItem[] = [
  { id: "E1-1", category: "E", subCategory: "E1", subCategoryName: "工程资料总目录卷", name: "工程资料总目录", tableCode: "", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "E1-2", category: "E", subCategory: "E1", subCategoryName: "工程资料总目录卷", name: "工程资料总目录汇总表", tableCode: "", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
];

const e2Data: DocumentItem[] = [
  { id: "E2-1", category: "E", subCategory: "E2", subCategoryName: "工程资料封面和目录及备考", name: "工程资料封面", tableCode: "", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "E2-2", category: "E", subCategory: "E2", subCategoryName: "工程资料封面和目录及备考", name: "工程资料卷内目录", tableCode: "", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "E2-3", category: "E", subCategory: "E2", subCategoryName: "工程资料封面和目录及备考", name: "工程资料卷内备考表", tableCode: "", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
];

const e3Data: DocumentItem[] = [
  { id: "E3-1", category: "E", subCategory: "E3", subCategoryName: "城市建设档案封面和目录及备考", name: "城市建设档案封面", tableCode: "", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "E3-2", category: "E", subCategory: "E3", subCategoryName: "城市建设档案封面和目录及备考", name: "城市建设档案卷内目录", tableCode: "", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "E3-3", category: "E", subCategory: "E3", subCategoryName: "城市建设档案封面和目录及备考", name: "城市建设档案卷内备考表", tableCode: "", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
];

const e4Data: DocumentItem[] = [
  { id: "E4-1", category: "E", subCategory: "E4", subCategoryName: "工程资料、档案移交书", name: "工程资料移交书", tableCode: "", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "E4-2", category: "E", subCategory: "E4", subCategoryName: "工程资料、档案移交书", name: "工程档案移交书", tableCode: "", standard: "DB11/T 808", archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: "E4-3", category: "E", subCategory: "E4", subCategoryName: "工程资料、档案移交书", name: "城市建设档案移交书", tableCode: "", standard: "DB11/T 808", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: "E4-4", category: "E", subCategory: "E4", subCategoryName: "工程资料、档案移交书", name: "城市建设档案缩微品移交书", tableCode: "", standard: "DB11/T 808", archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
];

// ============================================================
// 导出汇总
// ============================================================
export const appendixA_Municipal: DocumentItem[] = [
  ...a1Data,
  ...a2Data,
  ...a3Data,
  ...a4Data,
  ...b1Data,
  ...b2Data,
  ...b3Data,
  ...b4Data,
  ...c1Data,
  ...c2Data,
  ...c3Data,
  ...c4Data,
  ...c5_1Data,
  ...c5_2Data,
  ...c5_3Data,
  ...c5_4Data,
  ...c5_5Data,
  ...c5_6Data,
  ...c6_1Data,
  ...c6_2Data,
  ...c6_3Data,
  ...c6_4Data,
  ...c6_5Data,
  ...c6_6Data,
  ...c7Data,
  ...c8Data,
  ...dData,
  ...e1Data,
  ...e2Data,
  ...e3Data,
  ...e4Data,
];

export default appendixA_Municipal;
