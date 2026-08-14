import { describe, it, expect, beforeEach } from 'vitest';
import { isKeyForTarget, collectKeysForTarget, migrateKeyOnRename } from '../data/projectKeyUtils';

// localStorage 键名生成规则 (与 App.tsx / projectAggregator.ts 同步)
function projectKey(std: string) { return `doc-mgmt-projects-${std}`; }
const STANDARDS = ['DB11/T695-2025', 'DB11/T808-2020'];

function removeProjectFromArray(list: any[], name: string) {
  return list.filter(x => (x.name || '') !== name);
}

// v5.3: 使用 projectKeyUtils.migrateKeyOnRename 模拟 App.tsx 重命名迁移
function migrateKeysOnRename(allKeys: string[], oldName: string, newName: string): { newKeys: string[]; removedKeys: string[] } {
  const newKeys: string[] = [];
  const removedKeys: string[] = [];
  for (const key of allKeys) {
    const newKey = migrateKeyOnRename(key, oldName, newName);
    if (newKey) { newKeys.push(newKey); removedKeys.push(key); }
    else { newKeys.push(key); }
  }
  return { newKeys, removedKeys };
}

describe('Project Delete — localStorage物理清除', () => {
  it('removes project from array by name', () => {
    const list = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
    expect(removeProjectFromArray(list, 'B')).toEqual([{ name: 'A' }, { name: 'C' }]);
  });

  it('handles empty array', () => {
    expect(removeProjectFromArray([], 'X')).toEqual([]);
  });

  it('handles missing project', () => {
    const list = [{ name: 'A' }];
    expect(removeProjectFromArray(list, 'Z')).toEqual([{ name: 'A' }]);
  });

  it('project key follows standard naming', () => {
    expect(projectKey('DB11/T695-2025')).toBe('doc-mgmt-projects-DB11/T695-2025');
    expect(projectKey('DB11/T808-2020')).toBe('doc-mgmt-projects-DB11/T808-2020');
  });

  it('both standards keys are different', () => {
    expect(projectKey(STANDARDS[0])).not.toBe(projectKey(STANDARDS[1]));
  });
});

describe('v5.3 精确前缀匹配 — 杜绝子串误伤', () => {
  beforeEach(() => localStorage.clear());

  it('isKeyForTarget: 精确匹配项目级键', () => {
    expect(isKeyForTarget('guide-天宝北街-chapter-ch1-done', '天宝北街')).toBe(true);
    expect(isKeyForTarget('plan-files-天宝北街', '天宝北街')).toBe(true);
    expect(isKeyForTarget('tailoring-config-天宝北街', '天宝北街')).toBe(true);
  });

  it('isKeyForTarget: 不匹配其他项目的键', () => {
    expect(isKeyForTarget('guide-小红门-chapter-ch1-done', '天宝北街')).toBe(false);
    expect(isKeyForTarget('plan-files-小红门', '天宝北街')).toBe(false);
  });

  it('❗ 删除"桥"项目不误删"天桥改造"项目的键', () => {
    // 场景：存在两个项目"桥"和"天桥改造"，删除"桥"时不应误伤"天桥改造"
    localStorage.setItem('guide-桥-chapter-ch1-done', '[]');
    localStorage.setItem('guide-天桥改造-chapter-ch1-done', '[]');
    localStorage.setItem('plan-files-桥', '[]');
    localStorage.setItem('plan-files-天桥改造', '[]');

    // 精确收集"桥"的键
    const keysToRemove = collectKeysForTarget('桥');
    expect(keysToRemove).toContain('guide-桥-chapter-ch1-done');
    expect(keysToRemove).toContain('plan-files-桥');
    // ❗ 关键断言：天桥改造的键不在删除列表中
    expect(keysToRemove).not.toContain('guide-天桥改造-chapter-ch1-done');
    expect(keysToRemove).not.toContain('plan-files-天桥改造');

    // 执行删除
    keysToRemove.forEach(k => localStorage.removeItem(k));
    expect(localStorage.getItem('guide-桥-chapter-ch1-done')).toBeNull();
    expect(localStorage.getItem('plan-files-桥')).toBeNull();
    // ❗ 天桥改造的数据完好无损
    expect(localStorage.getItem('guide-天桥改造-chapter-ch1-done')).not.toBeNull();
    expect(localStorage.getItem('plan-files-天桥改造')).not.toBeNull();
  });

  it('❗ 删除"测试"项目不误删"测试1"和"测试2"项目的键', () => {
    localStorage.setItem('guide-测试-chapter-ch1-done', '[]');
    localStorage.setItem('guide-测试1-chapter-ch1-done', '[]');
    localStorage.setItem('guide-测试2-chapter-ch1-done', '[]');

    const keysToRemove = collectKeysForTarget('测试');
    expect(keysToRemove).toContain('guide-测试-chapter-ch1-done');
    expect(keysToRemove).not.toContain('guide-测试1-chapter-ch1-done');
    expect(keysToRemove).not.toContain('guide-测试2-chapter-ch1-done');
  });

  it('空目标名不匹配任何键', () => {
    localStorage.setItem('guide-天宝北街-chapter-ch1', '[]');
    expect(isKeyForTarget('guide-天宝北街-chapter-ch1', '')).toBe(false);
    expect(collectKeysForTarget('')).toEqual([]);
  });
});

describe('v5.3 项目重命名 — 精确前缀迁移', () => {
  it('重命名时精确迁移项目级键', () => {
    const allKeys = [
      'guide-旧项目名-chapter-ch1-done',
      'guide-旧项目名-chapter-ch1-modules',
      'plan-files-旧项目名',
      'tailoring-config-旧项目名',
      'guide-其他项目-chapter-ch1-done',   // 不应被迁移
      'doc-system-auth',                    // 不应被迁移
    ];
    const { newKeys, removedKeys } = migrateKeysOnRename(allKeys, '旧项目名', '新项目名');

    // 旧键被移除
    expect(removedKeys).toContain('guide-旧项目名-chapter-ch1-done');
    expect(removedKeys).toContain('plan-files-旧项目名');
    expect(removedKeys).toContain('tailoring-config-旧项目名');
    // 新键已生成
    expect(newKeys).toContain('guide-新项目名-chapter-ch1-done');
    expect(newKeys).toContain('plan-files-新项目名');
    expect(newKeys).toContain('tailoring-config-新项目名');
    // 其他项目的键不受影响
    expect(newKeys).toContain('guide-其他项目-chapter-ch1-done');
    expect(removedKeys).not.toContain('guide-其他项目-chapter-ch1-done');
    // 非项目键不受影响
    expect(newKeys).toContain('doc-system-auth');
    expect(removedKeys).not.toContain('doc-system-auth');
  });

  it('❗ 重命名"桥"→"天桥"不误迁移"天桥改造"的键', () => {
    const allKeys = [
      'guide-桥-chapter-ch1-done',
      'guide-天桥改造-chapter-ch1-done',
      'plan-files-桥',
      'plan-files-天桥改造',
    ];
    const { newKeys, removedKeys } = migrateKeysOnRename(allKeys, '桥', '天桥');

    // "桥"的键被迁移到"天桥"
    expect(newKeys).toContain('guide-天桥-chapter-ch1-done');
    expect(removedKeys).toContain('guide-桥-chapter-ch1-done');
    // ❗ "天桥改造"的键不受影响
    expect(newKeys).toContain('guide-天桥改造-chapter-ch1-done');
    expect(removedKeys).not.toContain('guide-天桥改造-chapter-ch1-done');
  });
});
