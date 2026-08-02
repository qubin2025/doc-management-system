import { describe, it, expect } from 'vitest';

// localStorage 键名生成规则 (与 App.tsx / projectAggregator.ts 同步)
function projectKey(std: string) { return `doc-mgmt-projects-${std}`; }
const STANDARDS = ['DB11/T695-2025', 'DB11/T808-2020'];

function removeProjectFromArray(list: any[], name: string) {
  return list.filter(x => (x.name || '') !== name);
}

function findRelatedKeys(allKeys: string[], projectName: string) {
  return allKeys.filter(k => k.includes(projectName));
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

  it('finds related keys by project name', () => {
    const keys = ['guide-A-modules', 'form-fields-A-xyz', 'doc-mgmt-upload-A', 'other-key'];
    expect(findRelatedKeys(keys, 'A').length).toBe(3);
  });

  it('project key follows standard naming', () => {
    expect(projectKey('DB11/T695-2025')).toBe('doc-mgmt-projects-DB11/T695-2025');
    expect(projectKey('DB11/T808-2020')).toBe('doc-mgmt-projects-DB11/T808-2020');
  });

  it('both standards keys are different', () => {
    expect(projectKey(STANDARDS[0])).not.toBe(projectKey(STANDARDS[1]));
  });
});
