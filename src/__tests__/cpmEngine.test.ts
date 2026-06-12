import { describe, it, expect } from 'vitest';
import { computeCpm, parseScheduleFromRows, CpmTask } from '../data/cpmEngine';

describe('CPM Engine', () => {
  describe('computeCpm', () => {
    it('should compute ES/EF for a single task with no predecessors', () => {
      const tasks: CpmTask[] = [{ id: '1', name: 'Task 1', duration: 5, predecessors: [] }];
      const result = computeCpm(tasks);
      expect(result.tasks[0].es).toBe(0);
      expect(result.tasks[0].ef).toBe(5);
      expect(result.tasks[0].critical).toBe(true);
      expect(result.totalDuration).toBe(5);
    });

    it('should compute correct forward pass for sequential tasks', () => {
      const tasks: CpmTask[] = [
        { id: 'A', name: 'Start', duration: 3, predecessors: [] },
        { id: 'B', name: 'Middle', duration: 4, predecessors: ['A'] },
        { id: 'C', name: 'End', duration: 2, predecessors: ['B'] },
      ];
      const result = computeCpm(tasks);
      expect(result.tasks[0].es).toBe(0);
      expect(result.tasks[0].ef).toBe(3);
      expect(result.tasks[1].es).toBe(3);
      expect(result.tasks[1].ef).toBe(7);
      expect(result.tasks[2].es).toBe(7);
      expect(result.tasks[2].ef).toBe(9);
      expect(result.totalDuration).toBe(9);
    });

    it('should compute ES as max of all predecessors EF', () => {
      const tasks: CpmTask[] = [
        { id: 'A', name: 'A', duration: 3, predecessors: [] },
        { id: 'B', name: 'B', duration: 5, predecessors: [] },
        { id: 'C', name: 'C', duration: 2, predecessors: ['A', 'B'] },
      ];
      const result = computeCpm(tasks);
      // C depends on A (EF=3) and B (EF=5), so ES = max(3,5) = 5
      expect(result.tasks[2].es).toBe(5);
      expect(result.tasks[2].ef).toBe(7);
    });

    it('should compute critical path correctly', () => {
      const tasks: CpmTask[] = [
        { id: 'A', name: 'A', duration: 3, predecessors: [] },
        { id: 'B', name: 'B', duration: 2, predecessors: [] },
        { id: 'C', name: 'C', duration: 4, predecessors: ['A'] },
        { id: 'D', name: 'D', duration: 1, predecessors: ['A', 'B'] },
      ];
      const result = computeCpm(tasks);
      const criticalIds = result.criticalPath;
      // A(3)+C(4)=7 is the longest path
      expect(criticalIds).toContain('A');
      expect(criticalIds).toContain('C');
      expect(result.totalDuration).toBe(7);
    });

    it('should handle tasks with float (non-critical)', () => {
      const tasks: CpmTask[] = [
        { id: 'A', name: 'A', duration: 5, predecessors: [] },
        { id: 'B', name: 'B', duration: 3, predecessors: [] },
        { id: 'C', name: 'C', duration: 2, predecessors: ['A', 'B'] },
      ];
      const result = computeCpm(tasks);
      // A(5) is longer than B(3), so B has float
      const taskB = result.tasks.find(t => t.id === 'B')!;
      expect(taskB.float).toBeGreaterThan(0);
      expect(taskB.critical).toBe(false);
      const taskA = result.tasks.find(t => t.id === 'A')!;
      expect(taskA.float).toBe(0);
      expect(taskA.critical).toBe(true);
    });

    it('should handle parallel paths', () => {
      const tasks: CpmTask[] = [
        { id: 'S', name: 'Start', duration: 0, predecessors: [] },
        { id: 'A', name: 'Path A1', duration: 4, predecessors: ['S'] },
        { id: 'B', name: 'Path B1', duration: 6, predecessors: ['S'] },
        { id: 'A2', name: 'Path A2', duration: 3, predecessors: ['A'] },
        { id: 'B2', name: 'Path B2', duration: 2, predecessors: ['B'] },
        { id: 'E', name: 'End', duration: 1, predecessors: ['A2', 'B2'] },
      ];
      const result = computeCpm(tasks);
      // Path B: S(0)+B(6)+B2(2)+E(1)=9 is critical
      // Path A: S(0)+A(4)+A2(3)+E(1)=8 has float
      const taskA = result.tasks.find(t => t.id === 'A')!;
      expect(taskA.critical).toBe(false);
      const taskB = result.tasks.find(t => t.id === 'B')!;
      expect(taskB.critical).toBe(true);
      expect(result.totalDuration).toBe(9);
    });
  });

  describe('parseScheduleFromRows', () => {
    it('should parse valid rows into CpmTask array', () => {
      const rows = [
        ['1', 'Task 1', '5', '2025-01-01', '2025-01-06', '', '100'],
        ['2', 'Task 2', '3', '2025-01-06', '2025-01-09', '1', '50'],
      ];
      const tasks = parseScheduleFromRows(rows);
      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('1');
      expect(tasks[0].duration).toBe(5);
      expect(tasks[0].predecessors).toEqual([]);
      expect(tasks[1].predecessors).toEqual(['1']);
    });

    it('should handle comma-separated predecessors', () => {
      const rows = [['3', 'Task 3', '2', '', '', '1,2', '0']];
      const tasks = parseScheduleFromRows(rows);
      expect(tasks[0].predecessors).toEqual(['1', '2']);
    });

    it('should skip empty rows', () => {
      const rows = [
        ['1', 'Valid', '5'],
        [null, null],
        ['2', 'Also Valid', '3'],
      ];
      const tasks = parseScheduleFromRows(rows);
      expect(tasks).toHaveLength(2);
    });

    it('should default duration to 1 if invalid', () => {
      const rows = [['1', 'Task', 'invalid', '', '', '']];
      const tasks = parseScheduleFromRows(rows);
      expect(tasks[0].duration).toBe(1);
    });
  });
});
