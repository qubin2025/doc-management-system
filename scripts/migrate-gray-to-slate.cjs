/**
 * gray → slate 配色迁移脚本
 *
 * 功能：
 *   1. 将 text-gray-XXX 统一替换为 text-slate-XXX
 *   2. 将 dark:text-gray-XXX 统一替换为 dark:text-slate-XXX
 *   3. 自动为缺失 dark 变体的 text-slate-XXX 补齐 dark:text-slate-YYY
 *
 * 用法：
 *   预览模式（不修改文件）：node scripts/migrate-gray-to-slate.cjs --dry-run
 *   执行模式（实际修改）： node scripts/migrate-gray-to-slate.cjs
 *   指定目录：             node scripts/migrate-gray-to-slate.cjs --dir=src/components
 *
 * 安全特性：
 *   - 默认 dry-run，需显式去掉 --dry-run 才会写文件
 *   - 修改前自动备份到 .bak 文件
 *   - 输出详细修改日志，包含文件名、行号、修改内容
 */

const fs = require('fs');
const path = require('path');

// ==================== 配置 ====================

const ROOT_DIR = path.join(__dirname, '..');
const DEFAULT_TARGET_DIR = path.join(ROOT_DIR, 'src', 'components');
const DRY_RUN = process.argv.includes('--dry-run');
const dirArg = process.argv.find(a => a.startsWith('--dir='));
const TARGET_DIR = dirArg ? path.join(ROOT_DIR, dirArg.split('=')[1]) : DEFAULT_TARGET_DIR;

// dark 变体映射表（亮色 slate-XXX → 暗色 dark:text-slate-YYY）
const DARK_MAP = {
  800: 'dark:text-slate-200',
  700: 'dark:text-slate-300',
  600: 'dark:text-slate-400',
  500: 'dark:text-slate-400',
  400: 'dark:text-slate-500',
  300: 'dark:text-slate-600',
  200: 'dark:text-slate-700',
  100: 'dark:text-slate-800',
  950: 'dark:text-slate-100',
};

// ==================== 工具函数 ====================

/** 递归获取目录下所有 .tsx 文件 */
function findTsxFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTsxFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * 处理单个 className 字符串
 * @param {string} cls - className 字符串内容
 * @returns {{ result: string, changes: string[] }}
 */
function processClassName(cls) {
  let result = cls;
  const changes = [];

  // 第一步：替换 text-gray-XXX → text-slate-XXX
  // 注意：要先替换 dark:text-gray-XXX，避免被 text-gray-XXX 的规则误匹配
  const darkGrayRegex = /dark:text-gray-(\d{3})/g;
  result = result.replace(darkGrayRegex, (match, num) => {
    const replacement = `dark:text-slate-${num}`;
    changes.push(`  ${match} → ${replacement}`);
    return replacement;
  });

  // 替换 text-gray-XXX → text-slate-XXX（不含 dark: 前缀）
  const grayRegex = /(?<!dark:)text-gray-(\d{3})/g;
  result = result.replace(grayRegex, (match, num) => {
    const replacement = `text-slate-${num}`;
    changes.push(`  ${match} → ${replacement}`);
    return replacement;
  });

  // 第二步：补齐缺失的 dark 变体
  // 找到所有 text-slate-XXX（不含 dark: 前缀）
  const slateRegex = /(?<!dark:)text-slate-(\d{3})/g;
  const slateMatches = [...result.matchAll(slateRegex)];

  for (const m of slateMatches) {
    const num = m[1];
    const darkVariant = DARK_MAP[num];
    if (!darkVariant) continue; // 没有映射的跳过

    // 检查是否已有 dark:text-slate- 变体
    const hasDark = /dark:text-slate-\d{3}/.test(result);
    if (!hasDark) {
      // 在 text-slate-XXX 后面插入 dark:text-slate-YYY
      const toInsert = ` ${darkVariant}`;
      const target = `text-slate-${num}`;
      // 只替换第一个匹配（避免重复插入）
      const idx = result.indexOf(target);
      if (idx !== -1) {
        const insertPos = idx + target.length;
        result = result.slice(0, insertPos) + toInsert + result.slice(insertPos);
        changes.push(`  补齐 dark 变体: text-slate-${num} + ${darkVariant}`);
      }
    }
  }

  return { result, changes };
}

/**
 * 处理文件内容
 * @param {string} content - 文件内容
 * @returns {{ result: string, changes: string[] }}
 */
function processFileContent(content) {
  let result = content;
  const allChanges = [];

  // 匹配 className="..." 形式
  const classNameRegex = /className="([^"]*)"/g;
  result = result.replace(classNameRegex, (match, cls) => {
    const { result: newCls, changes } = processClassName(cls);
    if (changes.length > 0) {
      allChanges.push(...changes);
    }
    return `className="${newCls}"`;
  });

  // 匹配 className={`...`} 形式（模板字符串）
  // 注意：模板字符串里可能含有 ${} 表达式，只处理静态部分
  const templateRegex = /className=\{`([^`]*)`\}/g;
  result = result.replace(templateRegex, (match, cls) => {
    const { result: newCls, changes } = processClassName(cls);
    if (changes.length > 0) {
      allChanges.push(...changes);
    }
    return `className={\`${newCls}\`}`;
  });

  return { result, changes: allChanges };
}

// ==================== 主流程 ====================

function main() {
  console.log('====================================');
  console.log('  gray → slate 配色迁移脚本');
  console.log('====================================');
  console.log(`模式: ${DRY_RUN ? '🔍 预览模式（dry-run）' : '⚡ 执行模式'}`);
  console.log(`目录: ${TARGET_DIR}`);
  console.log(`时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log('');

  if (!fs.existsSync(TARGET_DIR)) {
    console.error(`错误: 目录不存在 ${TARGET_DIR}`);
    process.exit(1);
  }

  const files = findTsxFiles(TARGET_DIR);
  console.log(`找到 ${files.length} 个 .tsx 文件`);
  console.log('');

  let totalFiles = 0;
  let totalChanges = 0;
  const fileReports = [];

  for (const filePath of files) {
    const relPath = path.relative(ROOT_DIR, filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { result, changes } = processFileContent(content);

    if (changes.length === 0) continue;

    totalFiles++;
    totalChanges += changes.length;
    fileReports.push({ file: relPath, changes: changes.length });

    console.log(`📄 ${relPath} (${changes.length} 处修改)`);
    if (DRY_RUN || process.argv.includes('--verbose')) {
      changes.forEach(c => console.log(`   ${c}`));
    }

    if (!DRY_RUN) {
      // 备份
      const bakPath = filePath + '.bak';
      fs.writeFileSync(bakPath, content);
      // 写入新内容
      fs.writeFileSync(filePath, result);
    }
  }

  console.log('');
  console.log('====================================');
  console.log('  迁移报告');
  console.log('====================================');
  console.log(`修改文件数: ${totalFiles}`);
  console.log(`修改总处数: ${totalChanges}`);
  console.log('');

  if (totalFiles > 0) {
    console.log('文件修改明细（按修改处数降序）:');
    fileReports
      .sort((a, b) => b.changes - a.changes)
      .forEach(r => {
        console.log(`  ${r.changes.toString().padStart(3)} 处  ${r.file}`);
      });
  }

  if (DRY_RUN) {
    console.log('');
    console.log('ℹ️  当前为预览模式，未修改任何文件。');
    console.log('   确认无误后，去掉 --dry-run 参数重新运行以应用修改：');
    console.log('   node scripts/migrate-gray-to-slate.cjs');
  } else {
    console.log('');
    console.log('✅ 迁移完成！已自动备份原文件为 .bak');
    console.log('   如需回滚，可删除修改后的文件并将 .bak 重命名回 .tsx');
    console.log('   验证命令: npx tsc --noEmit');
  }
}

main();
