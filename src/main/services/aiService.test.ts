import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiService } from './aiService';

describe('AIService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('_replaceTemplate', () => {
    it('should replace template variables correctly', () => {
      // Accessing private method for testing purpose
      const template = 'Hello {{name}}, you spent {{amount}} on {{category}}.';
      const data = { name: 'User', amount: '100', category: 'Food' };

      const result = (aiService as any)._replaceTemplate(template, data);

      expect(result).toBe('Hello User, you spent 100 on Food.');
    });

    it('should handle multiple occurrences of the same variable', () => {
      const template = '{{name}} says hello to {{name}}.';
      const data = { name: 'Alice' };

      const result = (aiService as any)._replaceTemplate(template, data);

      expect(result).toBe('Alice says hello to Alice.');
    });
  });

  describe('getHealthStatus', () => {
    it('should return initial health status', () => {
      const status = aiService.getHealthStatus();
      expect(status).toHaveProperty('isConnected');
      expect(status).toHaveProperty('circuitOpen');
      expect(status).toHaveProperty('failureCount');
    });
  });
});
