import { GuideChapter } from '../types';

export const guideChapters: GuideChapter[] = [
  // ============================================================
  // 第一章 前期工作
  // ============================================================
  {
    id: 'ch1',
    number: 1,
    title: '前期工作',
    subtitle: '项目立项 · 可行性研究 · 用地规划许可 · 建设许可 · 施工许可',
    description: '项目立项至施工许可阶段全过程管理，包含计划编制、用地规划、项目立项、报批报建、专项评估等核心工作',
    icon: 'ClipboardCheck',
    color: 'blue',
    subModules: [
      {
        id: '1.1', name: '区位规划',
        workItems: [
          { id: '1.1.1', name: '组织项目团队及参建单位实地踏勘', checked: false },
          { id: '1.1.2', name: '收集影像资料', checked: false },
          { id: '1.1.3', name: '编制道路规划方案（管线综合）', checked: false },
          { id: '1.1.4', name: '编制规划综合实施方案', checked: false },
          { id: '1.1.5', name: '落实区位规划审批', checked: false },
        ]
      },
      {
        id: '1.2', name: '工作计划',
        workItems: [
          { id: '1.2.1', name: '编制前期工作计划', checked: false },
          { id: '1.2.2', name: '明确各环节时序及前置条件', checked: false },
          { id: '1.2.3', name: '制定里程碑节点', checked: false },
          { id: '1.2.4', name: '动态跟踪与优化调整', checked: false },
        ]
      },
      {
        id: '1.3', name: '招标工作',
        workItems: [
          { id: '1.3.1', name: '编制勘察/设计/施工招标计划', checked: false },
          { id: '1.3.2', name: '编制招标方案', checked: false },
          { id: '1.3.3', name: '资格预审文件编制与发布', checked: false },
          { id: '1.3.4', name: '组织勘察单位开展勘察工作', checked: false },
          { id: '1.3.5', name: '取得勘察成果报告', checked: false },
          { id: '1.3.6', name: '施工总承包招标', checked: false },
        ]
      },
      {
        id: '1.4', name: '用地规划',
        workItems: [
          { id: '1.4.1', name: '选址意见书办理', checked: false },
          { id: '1.4.2', name: '用地预审与选址意见书', checked: false },
          { id: '1.4.3', name: '土地权属调查', checked: false },
          { id: '1.4.4', name: '拨地测量及成果报告', checked: false },
          { id: '1.4.5', name: '取得建设用地规划许可证', checked: false },
        ]
      },
      {
        id: '1.5', name: '许可办理',
        workItems: [
          { id: '1.5.1', name: '建设用地规划许可证', checked: false },
          { id: '1.5.2', name: '签订土地出让合同', checked: false },
          { id: '1.5.3', name: '缴纳相关费用', checked: false },
          { id: '1.5.4', name: '取得国有土地使用证', checked: false },
          { id: '1.5.5', name: '建设工程规划许可证', checked: false },
        ]
      },
      {
        id: '1.6', name: '项目立项',
        workItems: [
          { id: '1.6.1', name: '编制项目建议书', checked: false },
          { id: '1.6.2', name: '编制可行性研究报告', checked: false },
          { id: '1.6.3', name: '投资估算编制与审核', checked: false },
          { id: '1.6.4', name: '发改部门立项审批', checked: false },
          { id: '1.6.5', name: '取得立项批复文件', checked: false },
        ]
      },
      {
        id: '1.7', name: '报批报建',
        workItems: [
          { id: '1.7.1', name: '多规合一平台申报', checked: false },
          { id: '1.7.2', name: '规划部门方案审查', checked: false },
          { id: '1.7.3', name: '人防/消防/园林方案审查', checked: false },
          { id: '1.7.4', name: '交通影响评价审查', checked: false },
          { id: '1.7.5', name: '各部门联审通过', checked: false },
        ]
      },
      {
        id: '1.8', name: '设计申报',
        workItems: [
          { id: '1.8.1', name: '初步设计文件编制', checked: false },
          { id: '1.8.2', name: '初步设计概算报审', checked: false },
          { id: '1.8.3', name: '施工图设计文件编制', checked: false },
          { id: '1.8.4', name: '施工图审查（含人防/消防）', checked: false },
          { id: '1.8.5', name: '施工图审查合格证', checked: false },
        ]
      },
      {
        id: '1.9', name: '施工许可',
        workItems: [
          { id: '1.9.1', name: '核发招标通知书', checked: false },
          { id: '1.9.2', name: '签订施工合同', checked: false },
          { id: '1.9.3', name: '施工许可前置手续办理', checked: false },
          { id: '1.9.4', name: '质监安监备案', checked: false },
          { id: '1.9.5', name: '核发建设工程施工许可证', checked: false },
        ]
      },
      {
        id: '1.10', name: '专项评估',
        workItems: [
          { id: '1.10.1', name: '环境影响评价审批', checked: false },
          { id: '1.10.2', name: '水土保持方案审批', checked: false },
          { id: '1.10.3', name: '安全评价/安全生产条件论证', checked: false },
          { id: '1.10.4', name: '交通影响评价', checked: false },
          { id: '1.10.5', name: '地震安全性评价', checked: false },
          { id: '1.10.6', name: '文物勘察/考古调查', checked: false },
          { id: '1.10.7', name: '土壤污染状况调查', checked: false },
          { id: '1.10.8', name: '能源综合利用评估', checked: false },
        ]
      },
      {
        id: '1.11', name: '文件档案',
        workItems: [
          { id: '1.11.1', name: '建立文件档案管理制度', checked: false },
          { id: '1.11.2', name: '全过程文件统一编号归档', checked: false },
          { id: '1.11.3', name: '电子扫描件同步归档', checked: false },
          { id: '1.11.4', name: '档案验收移交准备', checked: false },
        ]
      },
    ],
    links: [
      { from: '1.1', to: '1.4', label: '区位规划→用地规划' },
      { from: '1.4', to: '1.6', label: '用地→立项' },
      { from: '1.6', to: '1.7', label: '立项→报批报建' },
      { from: '1.7', to: '1.8', label: '报建→设计申报' },
      { from: '1.8', to: '1.9', label: '设计→施工许可' },
      { from: '1.10', to: '1.6', label: '专项评估→立项(并行穿插)' },
      { from: '1.2', to: '1.3', label: '计划→招标(贯穿)' },
      { from: '1.3', to: '1.9', label: '招标→施工许可' },
      { from: '1.7', to: '1.10', label: '报建↔专项评估(并行)' },
      { from: '1.11', to: '1.9', label: '档案→施工许可(贯穿全程)' },
    ],
    forms: [
      { code: '表1.3-1', name: '前期工作计划表', fields: [
        { key: 'seq', label: '序号', type: 'text' },
        { key: 'task', label: '工作内容', type: 'textarea' },
        { key: 'dept', label: '责任单位', type: 'text' },
        { key: 'planStart', label: '计划开始', type: 'date' },
        { key: 'planEnd', label: '计划完成', type: 'date' },
        { key: 'remark', label: '备注', type: 'text' },
      ], aiPrompt: '请为项目《{name}》生成前期工作计划表，包含项目建议书、可行性研究、勘察设计等关键阶段的工作内容安排，总工期参考 {startDate} 至 {endDate}。', sampleContent: '| 序号 | 工作内容 | 责任单位 | 计划开始 | 计划完成 | 备注 |\n|------|----------|----------|----------|----------|------|\n| 1 | 项目建议书编制 | 咨询单位 | __ | __ | |\n| 2 | 可行性研究 | 咨询单位 | __ | __ | |' },
      { code: '表1.3-2', name: '项目立项审批申报记录单', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'owner', label: '建设单位', type: 'text' },
        { key: 'applyItem', label: '申报事项', type: 'textarea' },
        { key: 'applyDate', label: '申报日期', type: 'date' },
        { key: 'approvalOpinion', label: '审批意见', type: 'textarea' },
        { key: 'approver', label: '审批人', type: 'text' },
        { key: 'approvalDate', label: '审批日期', type: 'date' },
      ] },
      { code: '表1.3-3', name: '可行性研究报告评审表', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'reportUnit', label: '编制单位', type: 'text' },
        { key: 'reviewContent', label: '评审内容', type: 'textarea' },
        { key: 'reviewOpinion', label: '评审意见', type: 'textarea' },
        { key: 'expertName', label: '评审专家', type: 'text' },
        { key: 'reviewDate', label: '评审日期', type: 'date' },
      ] },
      { code: '表1.3-4', name: '专项报告评审表', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'reportType', label: '专项报告类型（环评/安评/节能/水保/交通影响等）', type: 'text' },
        { key: 'reportUnit', label: '编制单位', type: 'text' },
        { key: 'reviewOpinion', label: '评审意见', type: 'textarea' },
        { key: 'reviewDate', label: '评审日期', type: 'date' },
        { key: 'remark', label: '备注', type: 'text' },
      ] },
      { code: '表1.3-5', name: '初步设计专项论证表', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'designUnit', label: '设计单位', type: 'text' },
        { key: 'topic', label: '论证专题', type: 'text' },
        { key: 'content', label: '论证内容', type: 'textarea' },
        { key: 'conclusion', label: '论证结论', type: 'textarea' },
        { key: 'expert', label: '论证专家', type: 'text' },
        { key: 'date', label: '论证日期', type: 'date' },
      ] },
      { code: '表1.3-6', name: '初步设计优化建议表', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'item', label: '优化项目', type: 'text' },
        { key: 'original', label: '原设计内容', type: 'textarea' },
        { key: 'suggestion', label: '优化建议', type: 'textarea' },
        { key: 'reason', label: '优化理由', type: 'textarea' },
        { key: 'estimatedBenefit', label: '预计效益', type: 'text' },
      ] },
      { code: '表1.3-7', name: '初步设计概算审核报告书', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'totalEstimate', label: '概算总额（万元）', type: 'number' },
        { key: 'buildingCost', label: '建安费用（万元）', type: 'number' },
        { key: 'otherCost', label: '其他费用（万元）', type: 'number' },
        { key: 'preliminaryCost', label: '预备费（万元）', type: 'number' },
        { key: 'auditOpinion', label: '审核意见', type: 'textarea' },
        { key: 'auditor', label: '审核人', type: 'text' },
        { key: 'auditDate', label: '审核日期', type: 'date' },
      ] },
      { code: '表1.3-8', name: '施工图审查优化建议书', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'designUnit', label: '设计单位', type: 'text' },
        { key: 'reviewItem', label: '审查项目', type: 'text' },
        { key: 'issue', label: '问题描述', type: 'textarea' },
        { key: 'suggestion', label: '优化建议', type: 'textarea' },
        { key: 'priority', label: '优先级（高/中/低）', type: 'select', options: ['高', '中', '低'] },
      ] },
      { code: '表1.3-9', name: '项目合同登记台账', fields: [
        { key: 'contractNo', label: '合同编号', type: 'text' },
        { key: 'contractName', label: '合同名称', type: 'text' },
        { key: 'partyB', label: '乙方单位', type: 'text' },
        { key: 'contractAmount', label: '合同金额（万元）', type: 'number' },
        { key: 'signDate', label: '签订日期', type: 'date' },
        { key: 'contractType', label: '合同类型', type: 'select', options: ['施工', '设计', '监理', '咨询', '采购', '其他'] },
        { key: 'status', label: '履约状态', type: 'select', options: ['履行中', '已完成', '已终止'] },
        { key: 'remark', label: '备注', type: 'text' },
      ] },
      { code: '表1.3-10', name: '建设工程项目合同履约验收单', fields: [
        { key: 'contractNo', label: '合同编号', type: 'text' },
        { key: 'contractName', label: '合同名称', type: 'text' },
        { key: 'partyB', label: '乙方单位', type: 'text' },
        { key: 'completionContent', label: '完成内容', type: 'textarea' },
        { key: 'acceptanceOpinion', label: '验收意见', type: 'textarea' },
        { key: 'acceptor', label: '验收人', type: 'text' },
        { key: 'acceptDate', label: '验收日期', type: 'date' },
        { key: 'issue', label: '遗留问题', type: 'textarea' },
      ] },
    ],
  },

  // ============================================================
  // 第二章 招标采购
  // ============================================================
  {
    id: 'ch2',
    number: 2,
    title: '招标采购',
    subtitle: '招标文件 · 清单控价 · 合同管理',
    description: '招标计划编制、招标文件审核、工程量清单及控制价审核、合同审核签订等全过程采购管理',
    icon: 'FileSearch',
    color: 'amber',
    subModules: [
      {
        id: '2.1', name: '招标文件',
        workItems: [
          { id: '2.1.1', name: '拟定招标计划', checked: false },
          { id: '2.1.2', name: '编制招标方案', checked: false },
          { id: '2.1.3', name: '提供招标前置资料', checked: false },
          { id: '2.1.4', name: '编制招标文件（含合同条款）', checked: false },
          { id: '2.1.5', name: '招标控制价编制', checked: false },
          { id: '2.1.6', name: '招标文件备案', checked: false },
          { id: '2.1.7', name: '组织标前答疑', checked: false },
        ]
      },
      {
        id: '2.2', name: '清单控价',
        workItems: [
          { id: '2.2.1', name: '核对招标资料完整性与合规性', checked: false },
          { id: '2.2.2', name: '组织现场踏勘', checked: false },
          { id: '2.2.3', name: '审核工程量清单（缺项/漏项）', checked: false },
          { id: '2.2.4', name: '审核招标控制价合理性', checked: false },
          { id: '2.2.5', name: '材料设备询价定价', checked: false },
          { id: '2.2.6', name: '核对暂估项与招标文件一致性', checked: false },
          { id: '2.2.7', name: '出具工程量清单及控制价审核报告', checked: false },
        ]
      },
      {
        id: '2.3', name: '合同管理',
        workItems: [
          { id: '2.3.1', name: '编制合同管理体系策划', checked: false },
          { id: '2.3.2', name: '合同条款审核（范围/价款/工期）', checked: false },
          { id: '2.3.3', name: '签订前中标与签约合同比对', checked: false },
          { id: '2.3.4', name: '经济标/商务标核对', checked: false },
          { id: '2.3.5', name: '合同谈判与签订', checked: false },
          { id: '2.3.6', name: '合同模板库维护', checked: false },
        ]
      },
    ],
    links: [
      { from: '2.1', to: '2.2', label: '招标文件→清单控价审核' },
      { from: '2.2', to: '2.3', label: '控价审核→合同签订' },
      { from: '2.1', to: '2.3', label: '招标文件→合同条款' },
    ],
    forms: [
      { code: '表2.3-1', name: '施工总承包招标文件审核表', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'bidder', label: '投标单位', type: 'text' },
        { key: 'auditItem', label: '审核事项', type: 'textarea' },
        { key: 'auditOpinion', label: '审核意见', type: 'textarea' },
        { key: 'auditor', label: '审核人', type: 'text' },
        { key: 'auditDate', label: '审核日期', type: 'date' },
      ] },
      { code: '表2.3-2', name: '招标文件评审表', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'bidSection', label: '招标标段', type: 'text' },
        { key: 'reviewContent', label: '评审内容', type: 'textarea' },
        { key: 'reviewOpinion', label: '评审意见', type: 'textarea' },
        { key: 'reviewer', label: '评审人', type: 'text' },
        { key: 'reviewDate', label: '评审日期', type: 'date' },
      ] },
      { code: '表2.3-3', name: '工程量清单及控制价审核报告', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'totalAmount', label: '控制价总额（万元）', type: 'number' },
        { key: 'reviewScope', label: '审核范围', type: 'textarea' },
        { key: 'issues', label: '发现的问题（缺项/漏项/描述不清）', type: 'textarea' },
        { key: 'conclusion', label: '审核结论', type: 'textarea' },
        { key: 'auditor', label: '审核人', type: 'text' },
        { key: 'auditDate', label: '审核日期', type: 'date' },
      ] },
      { code: '表2.3-4', name: '合同审核表', fields: [
        { key: 'contractNo', label: '合同编号', type: 'text' },
        { key: 'partyA', label: '甲方', type: 'text' },
        { key: 'partyB', label: '乙方', type: 'text' },
        { key: 'contractAmount', label: '合同金额（万元）', type: 'number' },
        { key: 'auditPoint', label: '审核要点', type: 'textarea' },
        { key: 'risk', label: '风险提示', type: 'textarea' },
        { key: 'auditOpinion', label: '审核意见', type: 'textarea' },
        { key: 'auditor', label: '审核人', type: 'text' },
      ] },
    ],
  },

  // ============================================================
  // 第三章 工程施工
  // ============================================================
  {
    id: 'ch3',
    number: 3,
    title: '工程施工',
    subtitle: '施工准备 · 设计 · 造价 · 进度 · 质量 · 安全 · 资料 · 合约 · 支付 · 变更签证',
    description: '施工全过程管控，含开工准备、设计管理、造价进度质量安全资料合约支付、变更签证询价核价等11个子模块',
    icon: 'HardHat',
    color: 'emerald',
    subModules: [
      {
        id: '3.1', name: '开工准备',
        workItems: [
          { id: '3.1.1', name: '办理质监安监备案手续', checked: false },
          { id: '3.1.2', name: '项目施工前期策划', checked: false },
          { id: '3.1.3', name: '场地移交（控制点/围挡/临设）', checked: false },
          { id: '3.1.4', name: '审核施工组织设计', checked: false },
          { id: '3.1.5', name: '审核监理规划', checked: false },
          { id: '3.1.6', name: '施工许可证核验', checked: false },
        ]
      },
      {
        id: '3.2', name: '设计管理',
        workItems: [
          { id: '3.2.1', name: '组织设计交底与图纸会审', checked: false },
          { id: '3.2.2', name: '编制图纸清单', checked: false },
          { id: '3.2.3', name: '深化设计协调管理', checked: false },
          { id: '3.2.4', name: '设计变更必要性/可行性分析', checked: false },
          { id: '3.2.5', name: '设计变更信息台账管理', checked: false },
        ]
      },
      {
        id: '3.3', name: '造价管理',
        workItems: [
          { id: '3.3.1', name: '编制项目造价控制计划', checked: false },
          { id: '3.3.2', name: '合同价分解', checked: false },
          { id: '3.3.3', name: '预算/合同价/变更台账编制', checked: false },
          { id: '3.3.4', name: '动态造价跟踪与偏差分析', checked: false },
          { id: '3.3.5', name: '资金使用计划与支付衔接', checked: false },
          { id: '3.3.6', name: '材料设备询价核价', checked: false },
          { id: '3.3.7', name: '资金使用情况分析与预警', checked: false },
        ]
      },
      {
        id: '3.4', name: '进度管理',
        workItems: [
          { id: '3.4.1', name: '制定项目总体进度目标', checked: false },
          { id: '3.4.2', name: '审核施工总进度计划', checked: false },
          { id: '3.4.3', name: '审核阶段进度计划', checked: false },
          { id: '3.4.4', name: '关键节点预警与纠偏', checked: false },
          { id: '3.4.5', name: '进度偏差原因分析与优化建议', checked: false },
        ]
      },
      {
        id: '3.5', name: '质量管理',
        workItems: [
          { id: '3.5.1', name: '落实参建单位质量责任', checked: false },
          { id: '3.5.2', name: '监督监理单位施工过程质量检查', checked: false },
          { id: '3.5.3', name: '专项施工方案审核监督', checked: false },
          { id: '3.5.4', name: '组织分部/分项工程验收', checked: false },
          { id: '3.5.5', name: '质量缺陷与事故处理', checked: false },
          { id: '3.5.6', name: '落实建设单位质量安全首要责任', checked: false },
        ]
      },
      {
        id: '3.6', name: '安全管理',
        workItems: [
          { id: '3.6.1', name: '建立安全管理体系与制度', checked: false },
          { id: '3.6.2', name: '审核安全应急预案', checked: false },
          { id: '3.6.3', name: '安全技术交底与教育培训', checked: false },
          { id: '3.6.4', name: '危大工程方案编制/论证/实施', checked: false },
          { id: '3.6.5', name: '现场安全检查与整改闭环', checked: false },
        ]
      },
      {
        id: '3.7', name: '资料管理',
        workItems: [
          { id: '3.7.1', name: '建立资料管理制度', checked: false },
          { id: '3.7.2', name: '过程资料与工程同步收集', checked: false },
          { id: '3.7.3', name: '全过程资料台账管理', checked: false },
          { id: '3.7.4', name: '关键材料送检见证管理', checked: false },
          { id: '3.7.5', name: '电子档案扫描归档', checked: false },
        ]
      },
      {
        id: '3.8', name: '合约管理',
        workItems: [
          { id: '3.8.1', name: '合同履约监控与偏差管理', checked: false },
          { id: '3.8.2', name: '工期/费用索赔处理', checked: false },
          { id: '3.8.3', name: '合同纠纷协调处理', checked: false },
          { id: '3.8.4', name: '支付管控与风险预警', checked: false },
          { id: '3.8.5', name: '合同管理文件系统归档', checked: false },
          { id: '3.8.6', name: '履约风险预控', checked: false },
        ]
      },
      {
        id: '3.9', name: '计量支付',
        workItems: [
          { id: '3.9.1', name: '分类收集计量支付依据资料', checked: false },
          { id: '3.9.2', name: '审核工程进度款支付证书', checked: false },
          { id: '3.9.3', name: '组织工程量核定', checked: false },
          { id: '3.9.4', name: '编制工程计量审核报告', checked: false },
          { id: '3.9.5', name: '工程款支付台账管理', checked: false },
          { id: '3.9.6', name: '按合同约定支付工程款', checked: false },
        ]
      },
      {
        id: '3.10', name: '变更签证',
        workItems: [
          { id: '3.10.1', name: '变更/洽商/签证申请审核', checked: false },
          { id: '3.10.2', name: '变更费用影响分析', checked: false },
          { id: '3.10.3', name: '变更预算审核', checked: false },
          { id: '3.10.4', name: '重大变更上会审批', checked: false },
          { id: '3.10.5', name: '变更实施监督', checked: false },
          { id: '3.10.6', name: '变更/签证台账管理', checked: false },
          { id: '3.10.7', name: '组织图纸会审（变更前）', checked: false },
        ]
      },
      {
        id: '3.11', name: '询价核价',
        workItems: [
          { id: '3.11.1', name: '确定询价核价方式', checked: false },
          { id: '3.11.2', name: '新增项目核价', checked: false },
          { id: '3.11.3', name: '材料设备市场价格核实', checked: false },
          { id: '3.11.4', name: '暂估价确认', checked: false },
          { id: '3.11.5', name: '编制询价核价报告', checked: false },
        ]
      },
    ],
    links: [
      { from: '3.1', to: '3.2', label: '开工→设计管理' },
      { from: '3.2', to: '3.4', label: '设计→进度' },
      { from: '3.4', to: '3.5', label: '进度→质量' },
      { from: '3.5', to: '3.6', label: '质量→安全' },
      { from: '3.3', to: '3.9', label: '造价↔计量支付' },
      { from: '3.9', to: '3.10', label: '支付→变更签证' },
      { from: '3.10', to: '3.11', label: '变更→询价核价' },
      { from: '3.8', to: '3.7', label: '合约↔资料管理(贯穿)' },
      { from: '3.1', to: '3.3', label: '开工→造价' },
    ],
    forms: [
      { code: '表3.3-1', name: '图纸登记台账', fields: [
        { key: 'drawingNo', label: '图纸编号', type: 'text' },
        { key: 'drawingName', label: '图纸名称', type: 'text' },
        { key: 'discipline', label: '专业（建筑/结构/机电/给排水/暖通/电气）', type: 'text' },
        { key: 'version', label: '版本号', type: 'text' },
        { key: 'receiveDate', label: '收到日期', type: 'date' },
        { key: 'quantity', label: '份数', type: 'number' },
        { key: 'remark', label: '备注', type: 'text' },
      ] },
      { code: '表3.3-2', name: '图纸发放记录', fields: [
        { key: 'drawingNo', label: '图纸编号', type: 'text' },
        { key: 'receiver', label: '领用单位', type: 'text' },
        { key: 'receiverName', label: '领用人', type: 'text' },
        { key: 'issueDate', label: '发放日期', type: 'date' },
        { key: 'quantity', label: '份数', type: 'number' },
        { key: 'purpose', label: '用途', type: 'text' },
      ] },
      { code: '表3.3-3', name: '设计变更审批表', fields: [
        { key: 'changeNo', label: '变更编号', type: 'text' },
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'changeContent', label: '变更内容', type: 'textarea' },
        { key: 'changeReason', label: '变更原因', type: 'textarea' },
        { key: 'costImpact', label: '费用影响（万元）', type: 'number' },
        { key: 'scheduleImpact', label: '工期影响（天）', type: 'number' },
        { key: 'approvalOpinion', label: '审批意见', type: 'textarea' },
        { key: 'approver', label: '审批人', type: 'text' },
      ] },
      { code: '表3.3-4', name: '阶段性工程投资动态控制报告', fields: [
        { key: 'period', label: '报告周期', type: 'text' },
        { key: 'budgetTotal', label: '批复概算（万元）', type: 'number' },
        { key: 'contracted', label: '已签合同金额（万元）', type: 'number' },
        { key: 'paid', label: '已支付金额（万元）', type: 'number' },
        { key: 'changeAmount', label: '变更累计金额（万元）', type: 'number' },
        { key: 'forecast', label: '预计结算金额（万元）', type: 'number' },
        { key: 'deviation', label: '偏差分析', type: 'textarea' },
      ] },
      { code: '表3.3-5', name: '阶段性进度管理报告', fields: [
        { key: 'period', label: '报告周期', type: 'text' },
        { key: 'plannedProgress', label: '计划进度（%）', type: 'number' },
        { key: 'actualProgress', label: '实际进度（%）', type: 'number' },
        { key: 'keyMilestones', label: '关键节点完成情况', type: 'textarea' },
        { key: 'delayReason', label: '滞后原因分析', type: 'textarea' },
        { key: 'correctiveAction', label: '纠偏措施', type: 'textarea' },
        { key: 'nextPeriodPlan', label: '下期计划', type: 'textarea' },
      ] },
      { code: '表3.3-6', name: '工程质量整改通知单', fields: [
        { key: 'noticeNo', label: '通知单编号', type: 'text' },
        { key: 'contractor', label: '施工单位', type: 'text' },
        { key: 'location', label: '整改部位', type: 'text' },
        { key: 'issue', label: '质量问题描述', type: 'textarea' },
        { key: 'requirement', label: '整改要求', type: 'textarea' },
        { key: 'deadline', label: '整改期限', type: 'date' },
        { key: 'issuer', label: '签发人', type: 'text' },
        { key: 'issueDate', label: '签发日期', type: 'date' },
      ] },
      { code: '表3.3-7', name: '危大方案审批表', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'schemeName', label: '方案名称', type: 'text' },
        { key: 'riskLevel', label: '风险等级', type: 'select', options: ['一级', '二级', '三级'] },
        { key: 'expertReview', label: '专家论证意见', type: 'textarea' },
        { key: 'approvalOpinion', label: '审批意见', type: 'textarea' },
        { key: 'approver', label: '审批人', type: 'text' },
        { key: 'approvalDate', label: '审批日期', type: 'date' },
      ] },
      { code: '表3.3-8', name: '工程安全检查记录表', fields: [
        { key: 'checkDate', label: '检查日期', type: 'date' },
        { key: 'checkLocation', label: '检查部位', type: 'text' },
        { key: 'checkItem', label: '检查项目', type: 'text' },
        { key: 'finding', label: '检查发现', type: 'textarea' },
        { key: 'rectification', label: '整改要求', type: 'textarea' },
        { key: 'checker', label: '检查人', type: 'text' },
        { key: 'reviewer', label: '复查人', type: 'text' },
      ] },
      { code: '表3.3-9', name: '项目日报/周报/月报', fields: [
        { key: 'reportType', label: '报告类型（日报/周报/月报）', type: 'select', options: ['日报', '周报', '月报'] },
        { key: 'period', label: '报告周期', type: 'text' },
        { key: 'weather', label: '天气情况', type: 'text' },
        { key: 'personnel', label: '施工人员数量', type: 'number' },
        { key: 'progress', label: '本周期完成内容', type: 'textarea' },
        { key: 'quality', label: '质量管理情况', type: 'textarea' },
        { key: 'safety', label: '安全管理情况', type: 'textarea' },
        { key: 'nextPlan', label: '下周期计划', type: 'textarea' },
        { key: 'issues', label: '需协调问题', type: 'textarea' },
      ] },
      { code: '表3.3-10', name: '项目管理工作会议纪要', fields: [
        { key: 'meetingNo', label: '会议编号', type: 'text' },
        { key: 'meetingName', label: '会议名称', type: 'text' },
        { key: 'meetingDate', label: '会议日期', type: 'date' },
        { key: 'location', label: '会议地点', type: 'text' },
        { key: 'attendees', label: '参会人员', type: 'textarea' },
        { key: 'agenda', label: '会议议题', type: 'textarea' },
        { key: 'resolution', label: '会议决议', type: 'textarea' },
        { key: 'actionItems', label: '行动项及责任人', type: 'textarea' },
      ] },
      { code: '表3.3-11', name: '工程费用支付申请表', fields: [
        { key: 'applyNo', label: '申请编号', type: 'text' },
        { key: 'contractor', label: '申请单位', type: 'text' },
        { key: 'contractNo', label: '合同编号', type: 'text' },
        { key: 'period', label: '支付周期', type: 'text' },
        { key: 'completedAmount', label: '本期完成产值（万元）', type: 'number' },
        { key: 'applyAmount', label: '申请支付金额（万元）', type: 'number' },
        { key: 'deduction', label: '应扣款项（万元）', type: 'number' },
        { key: 'netAmount', label: '净支付金额（万元）', type: 'number' },
        { key: 'remark', label: '备注', type: 'textarea' },
      ] },
      { code: '表3.3-12', name: '工程咨询服务费支付申请表', fields: [
        { key: 'applyNo', label: '申请编号', type: 'text' },
        { key: 'consultant', label: '咨询单位', type: 'text' },
        { key: 'servicePeriod', label: '服务周期', type: 'text' },
        { key: 'serviceContent', label: '服务内容', type: 'textarea' },
        { key: 'applyAmount', label: '申请金额（万元）', type: 'number' },
        { key: 'remark', label: '备注', type: 'textarea' },
      ] },
      { code: '表3.3-13', name: '工程计量审核报告', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'contractor', label: '施工单位', type: 'text' },
        { key: 'measurementPeriod', label: '计量周期', type: 'text' },
        { key: 'appliedQuantity', label: '申报工程量', type: 'number' },
        { key: 'auditedQuantity', label: '审核工程量', type: 'number' },
        { key: 'auditOpinion', label: '审核意见', type: 'textarea' },
        { key: 'auditor', label: '审核人', type: 'text' },
        { key: 'auditDate', label: '审核日期', type: 'date' },
      ] },
      { code: '表3.3-14', name: '工程变更台账', fields: [
        { key: 'changeNo', label: '变更编号', type: 'text' },
        { key: 'changeName', label: '变更名称', type: 'text' },
        { key: 'applicant', label: '提出单位', type: 'text' },
        { key: 'proposalDate', label: '提出日期', type: 'date' },
        { key: 'costChange', label: '费用变更（万元）', type: 'number' },
        { key: 'status', label: '审批状态', type: 'select', options: ['待审批', '审批中', '已批准', '已驳回'] },
        { key: 'remark', label: '备注', type: 'text' },
      ] },
      { code: '表3.3-15', name: '工程洽商审批表', fields: [
        { key: 'negotiationNo', label: '洽商编号', type: 'text' },
        { key: 'topic', label: '洽商事项', type: 'textarea' },
        { key: 'proposer', label: '提出单位', type: 'text' },
        { key: 'content', label: '洽商内容', type: 'textarea' },
        { key: 'costImpact', label: '费用影响（万元）', type: 'number' },
        { key: 'approvalOpinion', label: '审批意见', type: 'textarea' },
        { key: 'approver', label: '审批人', type: 'text' },
      ] },
      { code: '表3.3-16', name: '工程签证台账', fields: [
        { key: 'visaNo', label: '签证编号', type: 'text' },
        { key: 'visaName', label: '签证名称', type: 'text' },
        { key: 'applicant', label: '提出单位', type: 'text' },
        { key: 'visaDate', label: '签证日期', type: 'date' },
        { key: 'visaAmount', label: '签证金额（万元）', type: 'number' },
        { key: 'status', label: '审批状态', type: 'select', options: ['待审批', '审批中', '已批准', '已驳回'] },
        { key: 'remark', label: '备注', type: 'text' },
      ] },
      { code: '表3.3-17', name: '签证审批表', fields: [
        { key: 'visaNo', label: '签证编号', type: 'text' },
        { key: 'visaContent', label: '签证内容', type: 'textarea' },
        { key: 'visaReason', label: '签证原因', type: 'textarea' },
        { key: 'visaAmount', label: '签证金额（万元）', type: 'number' },
        { key: 'auditor', label: '审核人', type: 'text' },
        { key: 'auditOpinion', label: '审核意见', type: 'textarea' },
        { key: 'approvalDate', label: '审批日期', type: 'date' },
      ] },
      { code: '表3.3-18', name: '材料、设备核价报告', fields: [
        { key: 'itemName', label: '材料/设备名称', type: 'text' },
        { key: 'spec', label: '规格型号', type: 'text' },
        { key: 'unit', label: '单位', type: 'text' },
        { key: 'quantity', label: '数量', type: 'number' },
        { key: 'quotedUnitPrice', label: '报价单价（元）', type: 'number' },
        { key: 'auditedUnitPrice', label: '核价单价（元）', type: 'number' },
        { key: 'reference', label: '参考依据', type: 'textarea' },
        { key: 'auditor', label: '核价人', type: 'text' },
        { key: 'auditDate', label: '核价日期', type: 'date' },
      ] },
    ],
  },

  // ============================================================
  // 第四章 竣工验收及移交
  // ============================================================
  {
    id: 'ch4',
    number: 4,
    title: '竣工验收及移交',
    subtitle: '验收计划 · 分项验收 · 资料 · 移交 · 结算 · 决算 · 缺陷责任 · 转固',
    description: '竣工验收计划编制、分项验收组织、竣工资料审核、竣工结算、档案移交、资产转固、缺陷责任期管理',
    icon: 'CheckCircle2',
    color: 'indigo',
    subModules: [
      {
        id: '4.1', name: '竣工验收计划',
        workItems: [
          { id: '4.1.1', name: '编制竣工验收计划（明确各验收时间）', checked: false },
          { id: '4.1.2', name: '编制验收方案', checked: false },
          { id: '4.1.3', name: '编制验收组名单与验收标准', checked: false },
          { id: '4.1.4', name: '重要单位工程专项验收计划', checked: false },
        ]
      },
      {
        id: '4.2', name: '分项验收',
        workItems: [
          { id: '4.2.1', name: '竣工预验收条件核查', checked: false },
          { id: '4.2.2', name: '提前7个工作日书面通知监督机构', checked: false },
          { id: '4.2.3', name: '组织各参建单位实施验收', checked: false },
          { id: '4.2.4', name: '签署验收文件', checked: false },
          { id: '4.2.5', name: '监督整改缺陷整改闭环', checked: false },
        ]
      },
      {
        id: '4.3', name: '资料验收',
        workItems: [
          { id: '4.3.1', name: '制定竣工资料管理专项方案', checked: false },
          { id: '4.3.2', name: '核查竣工资料真实性/准确性/系统性', checked: false },
          { id: '4.3.3', name: '组织收集竣工图及验收文件', checked: false },
          { id: '4.3.4', name: '竣工资料移交城建档案馆预验收', checked: false },
        ]
      },
      {
        id: '4.4', name: '实体移交',
        workItems: [
          { id: '4.4.1', name: '组织编制移交计划与范围', checked: false },
          { id: '4.4.2', name: '编制移交设备清单与使用说明书', checked: false },
          { id: '4.4.3', name: '现场实物移交验收', checked: false },
          { id: '4.4.4', name: '签署移交证书', checked: false },
          { id: '4.4.5', name: '资产转固登记', checked: false },
        ]
      },
      {
        id: '4.5', name: '竣工结算',
        workItems: [
          { id: '4.5.1', name: '审核结算资料完整性', checked: false },
          { id: '4.5.2', name: '组织现场踏勘与结算文件编制', checked: false },
          { id: '4.5.3', name: '编制结算申报通知', checked: false },
          { id: '4.5.4', name: '审核结算数据（量价费核对）', checked: false },
          { id: '4.5.5', name: '组织结算协调会', checked: false },
          { id: '4.5.6', name: '签订结算审定签署书', checked: false },
          { id: '4.5.7', name: '对比概算/预算/结算差异分析', checked: false },
          { id: '4.5.8', name: '结算文件归档', checked: false },
        ]
      },
      {
        id: '4.6', name: '竣工决算',
        workItems: [
          { id: '4.6.1', name: '确定决算申报范围与条件', checked: false },
          { id: '4.6.2', name: '收集整理决算申报材料', checked: false },
          { id: '4.6.3', name: '组织编制工程竣工决算书', checked: false },
          { id: '4.6.4', name: '审核决算文件的真实性/合规性', checked: false },
          { id: '4.6.5', name: '组织决算审核答辩', checked: false },
          { id: '4.6.6', name: '取得项目决算批复文件', checked: false },
        ]
      },
      {
        id: '4.7', name: '缺陷责任',
        workItems: [
          { id: '4.7.1', name: '建立缺陷维修管理制度', checked: false },
          { id: '4.7.2', name: '协调监督缺陷与质量事故处理', checked: false },
          { id: '4.7.3', name: '质量责任认定与整改方案审核', checked: false },
          { id: '4.7.4', name: '缺陷责任期资料归档', checked: false },
          { id: '4.7.5', name: '签署保修期满证书', checked: false },
        ]
      },
      {
        id: '4.8', name: '项目转固',
        workItems: [
          { id: '4.8.1', name: '项目验收合格后及时移交使用单位', checked: false },
          { id: '4.8.2', name: '编制固定资产清单', checked: false },
          { id: '4.8.3', name: '资产移交登记/入库', checked: false },
          { id: '4.8.4', name: '完成不动产登记', checked: false },
        ]
      },
    ],
    links: [
      { from: '4.1', to: '4.2', label: '验收计划→分项验收' },
      { from: '4.2', to: '4.3', label: '分项验收→资料验收' },
      { from: '4.3', to: '4.5', label: '资料验收→竣工结算' },
      { from: '4.5', to: '4.6', label: '竣工结算→竣工决算' },
      { from: '4.6', to: '4.8', label: '竣工决算→项目转固' },
      { from: '4.2', to: '4.4', label: '分项验收→实体移交' },
      { from: '4.4', to: '4.7', label: '移交→缺陷责任(保修期)' },
    ],
    forms: [
      { code: '表4.3-1', name: '竣工验收计划', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'acceptanceType', label: '验收类型（竣工/消防/规划/人防/环保/档案等）', type: 'text' },
        { key: 'planDate', label: '计划验收日期', type: 'date' },
        { key: 'responsible', label: '责任单位', type: 'text' },
        { key: 'preparation', label: '准备工作', type: 'textarea' },
        { key: 'remark', label: '备注', type: 'text' },
      ] },
      { code: '表4.3-2', name: '工程竣工验收会议纪要', fields: [
        { key: 'meetingDate', label: '会议日期', type: 'date' },
        { key: 'location', label: '会议地点', type: 'text' },
        { key: 'attendees', label: '参会单位及人员', type: 'textarea' },
        { key: 'projectOverview', label: '工程概况汇报', type: 'textarea' },
        { key: 'inspectionResult', label: '现场检查结果', type: 'textarea' },
        { key: 'resolution', label: '验收结论', type: 'textarea' },
        { key: 'issues', label: '需整改问题', type: 'textarea' },
      ] },
      { code: '表4.3-3', name: '竣工结算计划', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'settlementItem', label: '结算项目', type: 'text' },
        { key: 'responsible', label: '责任单位', type: 'text' },
        { key: 'planDate', label: '计划完成日期', type: 'date' },
        { key: 'remark', label: '备注', type: 'text' },
      ] },
      { code: '表4.3-4', name: '竣工结算会议纪要', fields: [
        { key: 'meetingDate', label: '会议日期', type: 'date' },
        { key: 'location', label: '会议地点', type: 'text' },
        { key: 'attendees', label: '参会人员', type: 'textarea' },
        { key: 'discussion', label: '结算讨论事项', type: 'textarea' },
        { key: 'resolution', label: '会议决议', type: 'textarea' },
        { key: 'nextSteps', label: '后续工作安排', type: 'textarea' },
      ] },
      { code: '表4.3-5', name: '竣工结算评审报告', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'contractAmount', label: '合同金额（万元）', type: 'number' },
        { key: 'settlementAmount', label: '送审结算金额（万元）', type: 'number' },
        { key: 'auditedAmount', label: '审定结算金额（万元）', type: 'number' },
        { key: 'adjustmentReason', label: '调整原因', type: 'textarea' },
        { key: 'auditOpinion', label: '审核意见', type: 'textarea' },
        { key: 'auditor', label: '审核人', type: 'text' },
        { key: 'auditDate', label: '审核日期', type: 'date' },
      ] },
      { code: '表4.3-6', name: '建设工程文件归档验收记录表', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'archiveCategory', label: '归档类别（A/B/C/D类）', type: 'text' },
        { key: 'fileCount', label: '文件数量', type: 'number' },
        { key: 'completeness', label: '完整性检查', type: 'select', options: ['齐全', '欠缺'] },
        { key: 'issue', label: '存在问题', type: 'textarea' },
        { key: 'acceptor', label: '验收人', type: 'text' },
        { key: 'acceptDate', label: '验收日期', type: 'date' },
      ] },
      { code: '表4.3-7', name: '项目资料催办表', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'docName', label: '催办资料名称', type: 'text' },
        { key: 'responsible', label: '责任单位', type: 'text' },
        { key: 'deadline', label: '提交期限', type: 'date' },
        { key: 'remark', label: '备注', type: 'text' },
      ] },
      { code: '表4.3-8', name: '项目资料催办表(续)', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'docName', label: '催办资料名称', type: 'text' },
        { key: 'responsible', label: '责任单位', type: 'text' },
        { key: 'deadline', label: '提交期限', type: 'date' },
        { key: 'status', label: '完成状态', type: 'select', options: ['未提交', '已提交', '需整改'] },
        { key: 'remark', label: '备注', type: 'text' },
      ] },
      { code: '表4.3-9', name: '竣工决算资料审核表', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'docType', label: '资料类型', type: 'text' },
        { key: 'docName', label: '资料名称', type: 'text' },
        { key: 'completeness', label: '完整性', type: 'select', options: ['齐全', '欠缺'] },
        { key: 'accuracy', label: '准确性', type: 'select', options: ['准确', '有误'] },
        { key: 'issue', label: '问题描述', type: 'textarea' },
        { key: 'auditor', label: '审核人', type: 'text' },
        { key: 'auditDate', label: '审核日期', type: 'date' },
      ] },
      { code: '表4.3-10', name: '竣工决算申报通知', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'toUnit', label: '致送单位', type: 'text' },
        { key: 'noticeContent', label: '通知内容', type: 'textarea' },
        { key: 'requiredDocs', label: '需提交资料清单', type: 'textarea' },
        { key: 'deadline', label: '提交截止日期', type: 'date' },
        { key: 'issuer', label: '签发人', type: 'text' },
        { key: 'issueDate', label: '签发日期', type: 'date' },
      ] },
      { code: '表4.3-11', name: '决算申报通知(续)', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'supplementItem', label: '补充事项', type: 'textarea' },
        { key: 'attachment', label: '附件清单', type: 'textarea' },
        { key: 'contact', label: '联系人', type: 'text' },
        { key: 'phone', label: '联系电话', type: 'text' },
        { key: 'remark', label: '备注', type: 'text' },
      ] },
      { code: '表4.3-12', name: '固定资产清单', fields: [
        { key: 'assetNo', label: '资产编号', type: 'text' },
        { key: 'assetName', label: '资产名称', type: 'text' },
        { key: 'category', label: '资产类别（房屋/设备/车辆/电子/其他）', type: 'text' },
        { key: 'originalValue', label: '原值（万元）', type: 'number' },
        { key: 'depreciation', label: '已提折旧（万元）', type: 'number' },
        { key: 'netValue', label: '净值（万元）', type: 'number' },
        { key: 'location', label: '存放地点', type: 'text' },
        { key: 'responsible', label: '使用/保管部门', type: 'text' },
      ] },
      { code: '表4.3-13', name: '工程竣工验收备案文件清单', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'docName', label: '文件名称', type: 'text' },
        { key: 'docNo', label: '文件编号', type: 'text' },
        { key: 'quantity', label: '份数', type: 'number' },
        { key: 'checked', label: '是否齐备', type: 'select', options: ['是', '否'] },
        { key: 'remark', label: '备注', type: 'text' },
      ] },
      { code: '表4.3-14', name: '工程实体移交单', fields: [
        { key: 'projectName', label: '项目名称', type: 'text' },
        { key: 'handoverUnit', label: '移交单位', type: 'text' },
        { key: 'receiveUnit', label: '接收单位', type: 'text' },
        { key: 'handoverScope', label: '移交范围及内容', type: 'textarea' },
        { key: 'attachment', label: '移交资料清单', type: 'textarea' },
        { key: 'issue', label: '遗留问题', type: 'textarea' },
        { key: 'handoverDate', label: '移交日期', type: 'date' },
        { key: 'handoverSign', label: '移交方签字', type: 'text' },
        { key: 'receiverSign', label: '接收方签字', type: 'text' },
      ] },
    ],
  },
];
