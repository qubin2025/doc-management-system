import { describe, it, expect, beforeEach } from 'vitest';
import { setAuthToken, getAuthToken, getBackupUrl } from '../data/api';

describe('API layer', () => {
  beforeEach(() => {
    // Clear localStorage and reset token for each test
    localStorage.clear();
    setAuthToken('');
  });

  describe('setAuthToken / getAuthToken', () => {
    it('should set and return the auth token', () => {
      setAuthToken('test-token-123');
      expect(getAuthToken()).toBe('test-token-123');
    });

    it('should persist token to localStorage', () => {
      setAuthToken('persisted-token');
      expect(localStorage.getItem('doc-system-token')).toBe('persisted-token');
    });

    it('should clear token when setting empty string', () => {
      setAuthToken('temp-token');
      setAuthToken('');
      expect(getAuthToken()).toBe('');
      expect(localStorage.getItem('doc-system-token')).toBeNull();
    });
  });

  describe('getBackupUrl', () => {
    it('should return correct all-backup URL without project', () => {
      const url = getBackupUrl();
      expect(url).toContain('/api/backup/all');
    });

    it('should return project-specific backup URL', () => {
      const url = getBackupUrl(42);
      expect(url).toContain('/api/backup/project/42');
    });

    it('should include token when authenticated', () => {
      setAuthToken('my-token');
      const url = getBackupUrl();
      expect(url).toContain('token=my-token');
    });

    it('should not include token parameter when not authenticated', () => {
      const url = getBackupUrl();
      expect(url).not.toContain('token=');
    });
  });
});
