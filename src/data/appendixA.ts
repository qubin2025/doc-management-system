import { DocumentItem } from '../types';

// 附录A 工程资料名称、分类及归档保存表
export const appendixAData: DocumentItem[] = [
  // ==================== A类 基建文件 ====================
  // A1 决策立项文件
  { id: 'A1-1', category: 'A类', subCategory: 'A1', subCategoryName: '决策立项文件', name: '项目建议书(代可行性研究报告)', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-2', category: 'A类', subCategory: 'A1', subCategoryName: '决策立项文件', name: '项目建议书(代可行性研究报告)的批复文件', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-3', category: 'A类', subCategory: 'A1', subCategoryName: '决策立项文件', name: '关于立项的会议纪要、相关批准文件', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-4', category: 'A类', subCategory: 'A1', subCategoryName: '决策立项文件', name: '专家论证意见', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A1-5', category: 'A类', subCategory: 'A1', subCategoryName: '决策立项文件', name: '项目评价/评估研究资料', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  
  // A2 建设用地文件
  { id: 'A2-1', category: 'A类', subCategory: 'A2', subCategoryName: '建设用地文件', name: '多规合一意见函、意见函附件及附图', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A2-2', category: 'A类', subCategory: 'A2', subCategoryName: '建设用地文件', name: '建设项目用地预审与选址意见书', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A2-3', category: 'A类', subCategory: 'A2', subCategoryName: '建设用地文件', name: '建设工程规划用地测量成果', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A2-4', category: 'A类', subCategory: 'A2', subCategoryName: '建设用地文件', name: '国有土地使用证、不动产权证书', tableCode: '', standard: '中华人民共和国国土资源部令第63号', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A2-5', category: 'A类', subCategory: 'A2', subCategoryName: '建设用地文件', name: '北京市城镇建设用地批准文件', tableCode: '', standard: '《中华人民共和国土地管理法》', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  
  // A3 勘察设计文件
  { id: 'A3-1', category: 'A类', subCategory: 'A3', subCategoryName: '勘察设计文件', name: '工程地质勘察报告、文物勘察报告', tableCode: '', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'A3-2', category: 'A类', subCategory: 'A3', subCategoryName: '勘察设计文件', name: '土壤氡浓度检测报告', tableCode: '', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'A3-3', category: 'A类', subCategory: 'A3', subCategoryName: '勘察设计文件', name: '建筑用地钉桩通知单', tableCode: '', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'A3-4', category: 'A类', subCategory: 'A3', subCategoryName: '勘察设计文件', name: '验线合格文件', tableCode: '', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'A3-5', category: 'A类', subCategory: 'A3', subCategoryName: '勘察设计文件', name: '施工图设计文件审查意见', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A3-6', category: 'A类', subCategory: 'A3', subCategoryName: '勘察设计文件', name: '初步设计图及说明', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: 'A3-7', category: 'A类', subCategory: 'A3', subCategoryName: '勘察设计文件', name: '设计计算书', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: 'A3-8', category: 'A类', subCategory: 'A3', subCategoryName: '勘察设计文件', name: '特殊建设工程消防设计审查意见书', tableCode: '', standard: '中华人民共和国住房和城乡建设部令第58号', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A3-9', category: 'A类', subCategory: 'A3', subCategoryName: '勘察设计文件', name: '人防、环保等有关主管部门审核意见', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A3-10', category: 'A类', subCategory: 'A3', subCategoryName: '勘察设计文件', name: '施工图审查通知书', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  
  // A4 招标投标与合同文件
  { id: 'A4-1', category: 'A类', subCategory: 'A4', subCategoryName: '招标投标与合同文件', name: '勘察招标投标文件', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: 'A4-2', category: 'A类', subCategory: 'A4', subCategoryName: '招标投标与合同文件', name: '设计招标投标文件', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: 'A4-3', category: 'A类', subCategory: 'A4', subCategoryName: '招标投标与合同文件', name: '施工招标投标文件', tableCode: '', standard: '', archiveUnits: { construction: true, supervision: false, constructionUnit: true, archive: false } },
  { id: 'A4-4', category: 'A类', subCategory: 'A4', subCategoryName: '招标投标与合同文件', name: '监理招标投标文件', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: false } },
  { id: 'A4-5', category: 'A类', subCategory: 'A4', subCategoryName: '招标投标与合同文件', name: '监测/检测招标投标文件', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: 'A4-6', category: 'A类', subCategory: 'A4', subCategoryName: '招标投标与合同文件', name: '其他招标投标文件', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: 'A4-7', category: 'A类', subCategory: 'A4', subCategoryName: '招标投标与合同文件', name: '勘察合同', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: 'A4-8', category: 'A类', subCategory: 'A4', subCategoryName: '招标投标与合同文件', name: '设计合同', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: 'A4-9', category: 'A类', subCategory: 'A4', subCategoryName: '招标投标与合同文件', name: '施工合同', tableCode: '', standard: '', archiveUnits: { construction: true, supervision: false, constructionUnit: true, archive: false } },
  { id: 'A4-10', category: 'A类', subCategory: 'A4', subCategoryName: '招标投标与合同文件', name: '监理合同', tableCode: '', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'A4-11', category: 'A类', subCategory: 'A4', subCategoryName: '招标投标与合同文件', name: '中标通知书', tableCode: '', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  
  // A5 开工文件
  { id: 'A5-1', category: 'A类', subCategory: 'A5', subCategoryName: '开工文件', name: '建设工程规划许可证、附件及附图', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: true } },
  { id: 'A5-2', category: 'A类', subCategory: 'A5', subCategoryName: '开工文件', name: '建筑工程施工许可证及附件', tableCode: '', standard: '中华人民共和国住房和城乡建设部令第52号', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  
  // A6 商务文件
  { id: 'A6-1', category: 'A类', subCategory: 'A6', subCategoryName: '商务文件', name: '工程投资估算文件', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: 'A6-2', category: 'A类', subCategory: 'A6', subCategoryName: '商务文件', name: '工程设计概算', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: 'A6-3', category: 'A类', subCategory: 'A6', subCategoryName: '商务文件', name: '施工图预算', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: false } },
  { id: 'A6-4', category: 'A类', subCategory: 'A6', subCategoryName: '商务文件', name: '工程结算', tableCode: '', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  
  // A7 竣工验收及备案文件
  { id: 'A7-1', category: 'A类', subCategory: 'A7', subCategoryName: '竣工验收及备案文件', name: '北京市建筑工程竣工档案验收自检报告', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A7-2', category: 'A类', subCategory: 'A7', subCategoryName: '竣工验收及备案文件', name: '北京市建设工程施工联合验收综合告知承诺书', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A7-3', category: 'A类', subCategory: 'A7', subCategoryName: '竣工验收及备案文件', name: '建筑工程消防施工质量查验方案', tableCode: '', standard: 'DB11/T2000', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A7-4', category: 'A类', subCategory: 'A7', subCategoryName: '竣工验收及备案文件', name: '建筑工程消防施工质量查验报告', tableCode: '', standard: 'DB11/T2000', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A7-5', category: 'A类', subCategory: 'A7', subCategoryName: '竣工验收及备案文件', name: '工程竣工验收方案', tableCode: '', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'A7-6', category: 'A类', subCategory: 'A7', subCategoryName: '竣工验收及备案文件', name: '工程竣工验收组检查意见表', tableCode: '表A7-1', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'A7-7', category: 'A类', subCategory: 'A7', subCategoryName: '竣工验收及备案文件', name: '工程竣工验收记录', tableCode: '表A7-2', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'A7-8', category: 'A类', subCategory: 'A7', subCategoryName: '竣工验收及备案文件', name: '建设工程施工验收备案表或联合验收通过意见书', tableCode: '', standard: '中华人民共和国住房和城乡建设部令第2号', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'A7-9', category: 'A类', subCategory: 'A7', subCategoryName: '竣工验收及备案文件', name: '工程竣工验收报告', tableCode: '', standard: '中华人民共和国住房和城乡建设部令第2号', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A7-10', category: 'A类', subCategory: 'A7', subCategoryName: '竣工验收及备案文件', name: '建设工程档案验收意见书', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A7-11', category: 'A类', subCategory: 'A7', subCategoryName: '竣工验收及备案文件', name: '《房屋建筑工程质量保修书》', tableCode: '', standard: '中华人民共和国住房和城乡建设部令第2号', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'A7-12', category: 'A类', subCategory: 'A7', subCategoryName: '竣工验收及备案文件', name: '《住宅质量保证书》《住宅使用说明书》', tableCode: '', standard: '中华人民共和国住房和城乡建设部令第2号', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: 'A7-13', category: 'A类', subCategory: 'A7', subCategoryName: '竣工验收及备案文件', name: '建设工程规划、消防、节能、人防等部门的验收合格文件', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A7-14', category: 'A类', subCategory: 'A7', subCategoryName: '竣工验收及备案文件', name: '分户验收、业主查验相关资料', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  
  // A8 其他文件
  { id: 'A8-1', category: 'A类', subCategory: 'A8', subCategoryName: '其他文件', name: '工程开工前原貌、竣工后照片', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A8-2', category: 'A类', subCategory: 'A8', subCategoryName: '其他文件', name: '工程开工、施工、竣工的录音录像资料', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A8-3', category: 'A类', subCategory: 'A8', subCategoryName: '其他文件', name: '工程变形监测资料', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },
  { id: 'A8-4', category: 'A类', subCategory: 'A8', subCategoryName: '其他文件', name: '室内环境检测报告', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A8-5', category: 'A类', subCategory: 'A8', subCategoryName: '其他文件', name: '工程竣工测量资料', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A8-6', category: 'A类', subCategory: 'A8', subCategoryName: '其他文件', name: '建设工程概况(建筑工程类)', tableCode: '表A8-1', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A8-7', category: 'A类', subCategory: 'A8',subCategoryName: '其他文件', name: '工程建设各方授权书、承诺书及永久性标识图片', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A8-8', category: 'A类', subCategory: 'A8', subCategoryName: '其他文件', name: '建设工程质量终身责任基本信息表', tableCode: '表A8-2', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: true } },
  { id: 'A8-9', category: 'A类', subCategory: 'A8', subCategoryName: '其他文件', name: '建筑工程使用说明书', tableCode: '', standard: '', archiveUnits: { construction: false, supervision: false, constructionUnit: true, archive: false } },

  // ==================== B类 监理资料 ====================
  { id: 'B-1', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '总监理工程师任命书', tableCode: '表B-1', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'B-2', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '监理单位检查考核记录', tableCode: '', standard: 'DB11/T382', archiveUnits: { construction: false, supervision: true, constructionUnit: false, archive: false } },
  { id: 'B-3', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '监理规划', tableCode: '', standard: 'GB/T50319', archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: false } },
  { id: 'B-4', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '监理日志', tableCode: '', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'B-5', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '监理实施细则', tableCode: '', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'B-6', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '第一次工地会议纪要', tableCode: '', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'B-7', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '监理例会纪要', tableCode: '', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'B-8', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '专题会议纪要', tableCode: '', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'B-9', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '工程开工令', tableCode: '表B-2', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'B-10', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '监理报告', tableCode: '表B-3', standard: 'GB/T50319', archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: false } },
  { id: 'B-11', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '监理通知单', tableCode: '表B-4', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'B-12', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '工程暂停令', tableCode: '表B-5', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'B-13', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '工程复工令', tableCode: '表B-6', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'B-14', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '监理月报', tableCode: '', standard: 'GB/T50319', archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: false } },
  { id: 'B-15', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '旁站记录', tableCode: '表B-7', standard: 'GB/T50319', archiveUnits: { construction: false, supervision: true, constructionUnit: false, archive: false } },
  { id: 'B-16', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '见证人告知书', tableCode: '表B-8', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'B-17', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '材料见证记录', tableCode: '表B-9', standard: 'GB/T50319', archiveUnits: { construction: false, supervision: true, constructionUnit: false, archive: false } },
  { id: 'B-18', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '实体检验见证记录', tableCode: '表B-10', standard: 'GB/T50319', archiveUnits: { construction: false, supervision: true, constructionUnit: false, archive: false } },
  { id: 'B-19', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '平行检验记录', tableCode: '表B-11', standard: 'GB/T50319', archiveUnits: { construction: false, supervision: true, constructionUnit: false, archive: false } },
  { id: 'B-20', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '工程质量评估报告', tableCode: '', standard: 'GB/T50319', archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: true } },
  { id: 'B-21', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '工程款支付证书', tableCode: '表B-12', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'B-22', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '竣工结算监理审核报告', tableCode: '', standard: 'GB/T50319', archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: false } },
  { id: 'B-23', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '工作联系单', tableCode: '表B-13', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'B-24', category: 'B类', subCategory: 'B', subCategoryName: '监理资料', name: '监理工作总结', tableCode: '', standard: 'GB/T50319', archiveUnits: { construction: false, supervision: true, constructionUnit: true, archive: false } },

  // ==================== C类 施工资料 ====================
  // C1 施工管理资料
  { id: 'C1-1', category: 'C类', subCategory: 'C1', subCategoryName: '施工管理资料', name: '施工现场质量管理检查记录', tableCode: '表C1-1', standard: 'GB50300', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C1-2', category: 'C类', subCategory: 'C1', subCategoryName: '施工管理资料', name: '施工日志', tableCode: '表C1-2', standard: '', archiveUnits: { construction: true, supervision: false, constructionUnit: false, archive: false } },
  { id: 'C1-3', category: 'C类', subCategory: 'C1', subCategoryName: '施工管理资料', name: '施工组织设计/(专项)施工方案报审表', tableCode: '表C1-3', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C1-4', category: 'C类', subCategory: 'C1', subCategoryName: '施工管理资料', name: '施工进度计划报审表', tableCode: '表C1-4', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C1-5', category: 'C类', subCategory: 'C1', subCategoryName: '施工管理资料', name: '工程开工报审表', tableCode: '表C1-5', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C1-6', category: 'C类', subCategory: 'C1', subCategoryName: '施工管理资料', name: '工程复工报审表', tableCode: '表C1-6', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C1-7', category: 'C类', subCategory: 'C1', subCategoryName: '施工管理资料', name: '工程临时/最终延期报审表', tableCode: '表C1-7', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C1-8', category: 'C类', subCategory: 'C1', subCategoryName: '施工管理资料', name: '分包单位资格报审表', tableCode: '表C1-8', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C1-9', category: 'C类', subCategory: 'C1', subCategoryName: '施工管理资料', name: '索赔意向通知书', tableCode: '表C1-9', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C1-10', category: 'C类', subCategory: 'C1', subCategoryName: '施工管理资料', name: '费用索赔报审表', tableCode: '表C1-10', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C1-11', category: 'C类', subCategory: 'C1', subCategoryName: '施工管理资料', name: '工程款支付报审表', tableCode: '表C1-11', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C1-12', category: 'C类', subCategory: 'C1', subCategoryName: '施工管理资料', name: '工程变更费用报审表', tableCode: '表C1-12', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C1-13', category: 'C类', subCategory: 'C1', subCategoryName: '施工管理资料', name: '监理通知回复单', tableCode: '表C1-13', standard: 'GB/T50319', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C1-14', category: 'C类', subCategory: 'C1', subCategoryName: '施工管理资料', name: '施工检测试验计划', tableCode: '', standard: 'JGJ190', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C1-15', category: 'C类', subCategory: 'C1', subCategoryName: '施工管理资料', name: '分项工程和检验批的划分方案', tableCode: '', standard: 'GB50300', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C1-16', category: 'C类', subCategory: 'C1', subCategoryName: '施工管理资料', name: '专业承包单位资质证书及相关专业人员岗位证书', tableCode: '', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },

  // C2 施工技术资料
  { id: 'C2-1', category: 'C类', subCategory: 'C2', subCategoryName: '施工技术资料', name: '施工组织设计及施工方案', tableCode: '', standard: 'DB11/T363', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C2-2', category: 'C类', subCategory: 'C2', subCategoryName: '施工技术资料', name: '技术交底记录', tableCode: '表C2-1', standard: 'DB11/T363', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C2-3', category: 'C类', subCategory: 'C2', subCategoryName: '施工技术资料', name: '图纸会审记录', tableCode: '表C2-2', standard: 'DB11/T363', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C2-4', category: 'C类', subCategory: 'C2', subCategoryName: '施工技术资料', name: '设计变更通知单', tableCode: '表C2-3', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C2-5', category: 'C类', subCategory: 'C2', subCategoryName: '施工技术资料', name: '工程变更洽商记录', tableCode: '表C2-4', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },

  // C3 施工测量记录
  { id: 'C3-1', category: 'C类', subCategory: 'C3', subCategoryName: '施工测量记录', name: '工程定位测量记录', tableCode: '表C3-1', standard: 'GB 50026', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C3-2', category: 'C类', subCategory: 'C3', subCategoryName: '施工测量记录', name: '基槽平面及标高实测记录', tableCode: '表C3-2', standard: 'GB 50202', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C3-3', category: 'C类', subCategory: 'C3', subCategoryName: '施工测量记录', name: '楼层平面放线及标高实测记录', tableCode: '表C3-3', standard: 'GB 50026', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C3-4', category: 'C类', subCategory: 'C3', subCategoryName: '施工测量记录', name: '楼层平面标高抄测记录', tableCode: '表C3-4', standard: 'GB 50026', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C3-5', category: 'C类', subCategory: 'C3', subCategoryName: '施工测量记录', name: '建筑物垂直度、标高测量记录', tableCode: '表C3-5', standard: 'DB11/T 446', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C3-6', category: 'C类', subCategory: 'C3', subCategoryName: '施工测量记录', name: '变形观测记录', tableCode: '', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },

  // C5 施工记录资料
  { id: 'C5-1', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '隐蔽工程验收记录', tableCode: '表C5-1', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C5-2', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '交接检查记录', tableCode: '表C5-2', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C5-3', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '地基验槽检查记录', tableCode: '表C5-3', standard: 'GB 50202', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-4', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '地基处理记录', tableCode: '表C5-4', standard: 'GB 50202', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-5', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '地基钎探记录(应附图)', tableCode: '表C5-5', standard: 'GB 50202', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C5-6', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '混凝土浇灌申请书', tableCode: '表C5-6', standard: 'GB 50666', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C5-7', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '混凝土拆模申请单', tableCode: '表C5-7', standard: 'GB 50666', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C5-8', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '混凝土养护测温记录(应附图)', tableCode: '表C5-8', standard: 'GB 50666', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C5-9', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '大体积混凝土测温记录(应附图)', tableCode: '表C5-9', standard: 'GB 50666', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C5-10', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '构件安装记录', tableCode: '表C5-10', standard: 'GB 50666', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C5-11', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '焊接材料烘焙记录', tableCode: '表C5-11', standard: 'GB 50666', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C5-12', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '地下工程渗漏水检测记录', tableCode: '表C5-12', standard: 'GB 50208', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C5-13', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '防水工程试水检查记录', tableCode: '表C5-13', standard: 'GB 50210', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C5-14', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '通风(烟)道检查记录', tableCode: '表C5-14', standard: 'GB 50210', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C5-15', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '预应力筋张拉记录', tableCode: '表C5-15', standard: 'GB 50666', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C5-16', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '有粘结预应力结构灌浆记录', tableCode: '表C5-16', standard: 'GB 50666', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C5-17', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '钢筋螺纹加工现场检查记录', tableCode: '表C5-17', standard: 'GB 50204', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C5-18', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '混凝土养护记录', tableCode: '表C5-18', standard: 'GB 50204', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C5-19', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '600℃·d结构实体检验温度记录', tableCode: '表C5-19-1', standard: 'GB 50204', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C5-20', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '600℃·d实体检验等效龄期计算表', tableCode: '表C5-19-2', standard: 'GB 50204', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C5-21', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '外窗淋水试验检查记录', tableCode: '表C5-20', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C5-22', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '幕墙注胶检查记录', tableCode: '', standard: 'GB 50210', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C5-23', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '基坑支护变形监测记录', tableCode: '', standard: 'GB 50202', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C5-24', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '桩(地)基施工记录', tableCode: '', standard: 'GB 50202', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C5-25', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '网架(索膜)施工记录', tableCode: '', standard: 'GB 50205', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C5-26', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '钢结构施工记录', tableCode: '', standard: 'GB 50205', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C5-27', category: 'C类', subCategory: 'C5', subCategoryName: '施工记录资料', name: '施工记录(通用)', tableCode: '表C5-21', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },

  // C6 施工试验资料
  { id: 'C6-1', category: 'C类', subCategory: 'C6', subCategoryName: '施工试验资料', name: '土工击实试验报告', tableCode: '', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C6-2', category: 'C类', subCategory: 'C6', subCategoryName: '施工试验资料', name: '回填土试验报告', tableCode: '', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C6-3', category: 'C类', subCategory: 'C6', subCategoryName: '施工试验资料', name: '钢筋焊接试验报告', tableCode: '', standard: 'GB 50204', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C6-4', category: 'C类', subCategory: 'C6', subCategoryName: '施工试验资料', name: '钢筋机械连接试验报告', tableCode: '', standard: 'GB 50204', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C6-5', category: 'C类', subCategory: 'C6', subCategoryName: '施工试验资料', name: '砂浆配合比申请单、通知单', tableCode: '', standard: 'GB 50203', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C6-6', category: 'C类', subCategory: 'C6', subCategoryName: '施工试验资料', name: '砂浆抗压强度试验报告', tableCode: '', standard: 'GB 50203', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C6-7', category: 'C类', subCategory: 'C6', subCategoryName: '施工试验资料', name: '砌筑砂浆强度检验评定记录', tableCode: '表C6-1', standard: 'GB 50203', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C6-8', category: 'C类', subCategory: 'C6', subCategoryName: '施工试验资料', name: '混凝土配合比通知单', tableCode: '', standard: 'GB 50204', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C6-9', category: 'C类', subCategory: 'C6', subCategoryName: '施工试验资料', name: '混凝土抗压强度试验报告', tableCode: '', standard: 'GB 50204', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C6-10', category: 'C类', subCategory: 'C6', subCategoryName: '施工试验资料', name: '混凝土强度检验评定记录', tableCode: '表C6-2', standard: 'GB/T 50107', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C6-11', category: 'C类', subCategory: 'C6', subCategoryName: '施工试验资料', name: '混凝土抗渗试验报告', tableCode: '', standard: 'GB 50208', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C6-12', category: 'C类', subCategory: 'C6', subCategoryName: '施工试验资料', name: '饰面砖粘结强度试验报告', tableCode: '', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C6-13', category: 'C类', subCategory: 'C6', subCategoryName: '施工试验资料', name: '超声波探伤报告', tableCode: '', standard: 'GB 50205', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C6-14', category: 'C类', subCategory: 'C6', subCategoryName: '施工试验资料', name: '超声波探伤记录', tableCode: '', standard: 'GB 50205', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C6-15', category: 'C类', subCategory: 'C6', subCategoryName: '施工试验资料', name: '钢构件射线探伤报告', tableCode: '', standard: 'GB 50205', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C6-16', category: 'C类', subCategory: 'C6', subCategoryName: '施工试验资料', name: '锚杆、土钉锁定力(抗拔力)试验报告', tableCode: '', standard: 'GB 50202', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C6-17', category: 'C类', subCategory: 'C6', subCategoryName: '施工试验资料', name: '地基承载力检验报告', tableCode: '', standard: 'GB 50202', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C6-18', category: 'C类', subCategory: 'C6', subCategoryName: '施工试验资料', name: '桩基检测报告', tableCode: '', standard: 'GB 50202', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },

  // C7 过程验收资料
  { id: 'C7-1', category: 'C类', subCategory: 'C7', subCategoryName: '过程验收资料', name: '结构实体混凝土强度检验记录(回弹-取芯法)', tableCode: '表C7-1', standard: 'GB 50204', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C7-2', category: 'C类', subCategory: 'C7', subCategoryName: '过程验收资料', name: '钢筋保护层厚度检测报告', tableCode: '表C7-2', standard: 'GB 50204', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C7-3', category: 'C类', subCategory: 'C7', subCategoryName: '过程验收资料', name: '混凝土结构实体位置与尺寸偏差检验记录', tableCode: '表C7-3', standard: 'GB 50204', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C7-4', category: 'C类', subCategory: 'C7', subCategoryName: '过程验收资料', name: '检验批质量验收记录', tableCode: '表C7-4', standard: 'GB 50300', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C7-5', category: 'C类', subCategory: 'C7', subCategoryName: '过程验收资料', name: '检验批现场验收检查原始记录', tableCode: '表C7-5', standard: 'GB 50300', archiveUnits: { construction: true, supervision: true, constructionUnit: false, archive: false } },
  { id: 'C7-6', category: 'C类', subCategory: 'C7', subCategoryName: '过程验收资料', name: '分项工程质量验收记录', tableCode: '表C7-6', standard: 'GB 50300', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C7-7', category: 'C类', subCategory: 'C7', subCategoryName: '过程验收资料', name: '分部工程质量验收记录', tableCode: '表C7-7', standard: 'GB 50300', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C7-8', category: 'C类', subCategory: 'C7', subCategoryName: '过程验收资料', name: '节能工程现场实体检验报告', tableCode: '', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C7-9', category: 'C类', subCategory: 'C7', subCategoryName: '过程验收资料', name: '消防工程施工质量验收记录', tableCode: '表C7-8', standard: 'DB11/T 2000', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },

  // C8 工程竣工质量验收资料
  { id: 'C8-1', category: 'C类', subCategory: 'C8', subCategoryName: '工程竣工质量验收资料', name: '单位工程质量竣工验收记录', tableCode: '表C8-1', standard: 'GB 50300', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C8-2', category: 'C类', subCategory: 'C8', subCategoryName: '工程竣工质量验收资料', name: '单位工程质量控制资料核查记录', tableCode: '表C8-2', standard: 'GB 50300', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C8-3', category: 'C类', subCategory: 'C8', subCategoryName: '工程竣工质量验收资料', name: '单位工程安全和功能检验资料核查及主要功能抽查记录', tableCode: '表C8-3', standard: 'GB 50300', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C8-4', category: 'C类', subCategory: 'C8', subCategoryName: '工程竣工质量验收资料', name: '单位工程观感质量检查记录', tableCode: '表C8-4', standard: 'GB 50300', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C8-5', category: 'C类', subCategory: 'C8', subCategoryName: '工程竣工质量验收资料', name: '单位工程竣工验收报审表', tableCode: '表C8-5', standard: 'GB/T 50319', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: false } },
  { id: 'C8-6', category: 'C类', subCategory: 'C8', subCategoryName: '工程竣工质量验收资料', name: '工程竣工报告', tableCode: '', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },
  { id: 'C8-7', category: 'C类', subCategory: 'C8', subCategoryName: '工程竣工质量验收资料', name: '工程概况表', tableCode: '表C8-6', standard: '', archiveUnits: { construction: true, supervision: true, constructionUnit: true, archive: true } },

  // ==================== D类 竣工图 ====================
  { id: 'D-1', category: 'D类', subCategory: 'D', subCategoryName: '竣工图', name: '竣工图', tableCode: '', standard: '', archiveUnits: { construction: true, supervision: false, constructionUnit: true, archive: true } },
];

// 获取所有子类别
export const getSubCategories = () => {
  const subCategories = new Map<string, { name: string; category: string }>();
  appendixAData.forEach(item => {
    if (!subCategories.has(item.subCategory)) {
      subCategories.set(item.subCategory, {
        name: item.subCategoryName,
        category: item.category
      });
    }
  });
  return subCategories;
};

// 匹配文档类别
export const matchDocumentCategory = (fileName: string): DocumentItem[] => {
  const keywords = fileName.toLowerCase().replace(/\.[^/.]+$/, '');
  const matches: { item: DocumentItem; score: number }[] = [];

  appendixAData.forEach(item => {
    let score = 0;
    const docName = item.name.toLowerCase();
    const keywords_lower = keywords.toLowerCase();
    
    // 完全匹配
    if (docName.includes(keywords_lower) || keywords_lower.includes(docName)) {
      score = 100;
    } else {
      // 关键词匹配
      const docWords = docName.split(/[、，。（）()]/).filter(w => w.length > 2);
      docWords.forEach(word => {
        if (keywords_lower.includes(word)) {
          score += word.length * 2;
        }
      });
    }
    
    if (score > 0) {
      matches.push({ item, score });
    }
  });

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(m => m.item);
};
