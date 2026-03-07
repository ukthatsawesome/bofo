import { describe, it, expect } from 'vitest';
import { AnomalyService, type CategoryStats } from '../main/services/anomalyService';
import type { Transaction } from '../main/database/types';

describe('Anomaly Detection', () => {
  describe('detectAnomalies', () => {
    const createTransaction = (overrides: Partial<Transaction> = {}): Transaction => {
      const base = {
        id: 1,
        account_id: 1,
        to_account_id: null,
        type: 'expense' as const,
        category: 'Food',
        amount: 50,
        description: 'Test transaction',
        attachment: null,
        frequency: 'once',
        start_date: new Date().toISOString().split('T')[0],
        end_date: null,
        currency: 'USD',
        exchange_rate: 1,
        to_amount: null,
        tags: '',
        is_active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return { ...base, ...overrides } as Transaction;
    };

    it('should return empty array for normal transactions', () => {
      const tx = createTransaction({ amount: 25 });

      const history: Transaction[] = [
        createTransaction({
          id: 99,
          amount: 20,
          start_date: new Date().toISOString().split('T')[0],
        }),
      ];
      const stats = new Map<string, CategoryStats>([
        ['Food', { category: 'Food', count: 10, mean: 25, stdDev: 5, min: 15, max: 35 }],
      ]);

      const anomalies = AnomalyService.detectAnomalies(tx, history, stats);

      expect(anomalies.length).toBe(0);
    });

    it('should detect unusual amount when > 2σ from mean', () => {
      const tx = createTransaction({ amount: 500 });
      const history: Transaction[] = [];
      const stats = new Map<string, CategoryStats>([
        ['Food', { category: 'Food', count: 20, mean: 25, stdDev: 10, min: 10, max: 50 }],
      ]);

      const anomalies = AnomalyService.detectAnomalies(tx, history, stats);

      expect(anomalies.length).toBeGreaterThanOrEqual(1);
      expect(anomalies.some((a) => a.type === 'unusual_amount')).toBe(true);
    });

    it('should detect high severity for > 3σ deviation', () => {
      const tx = createTransaction({ amount: 1000 });
      const history: Transaction[] = [];
      const stats = new Map<string, CategoryStats>([
        ['Food', { category: 'Food', count: 50, mean: 30, stdDev: 10, min: 10, max: 60 }],
      ]);

      const anomalies = AnomalyService.detectAnomalies(tx, history, stats);

      const amountAnomaly = anomalies.find((a) => a.type === 'unusual_amount');
      expect(amountAnomaly).toBeDefined();
      expect(amountAnomaly?.severity).toBe('high');
    });

    it('should detect new category', () => {
      const tx = createTransaction({ category: 'NewCategory' });
      const history: Transaction[] = [];
      const stats = new Map<string, CategoryStats>();

      const anomalies = AnomalyService.detectAnomalies(tx, history, stats);

      expect(anomalies.some((a) => a.type === 'new_category')).toBe(true);
    });
  });

  describe('checkForDuplicates', () => {
    it('should detect duplicates in last 7 days', () => {
      const today = new Date().toISOString().split('T')[0];
      const tx = {
        id: 2,
        amount: 50,
        category: 'Food',
        type: 'expense',
        start_date: today,
      } as any;

      const history = [
        { id: 1, amount: 50, category: 'Food', type: 'expense', start_date: today },
      ] as any[];

      const duplicates = AnomalyService.checkForDuplicates(tx, history);

      expect(duplicates.length).toBe(1);
    });

    it('should not detect duplicates with different amounts', () => {
      const today = new Date().toISOString().split('T')[0];
      const tx = { id: 2, amount: 50, category: 'Food', type: 'expense', start_date: today } as any;
      const history = [
        { id: 1, amount: 75, category: 'Food', type: 'expense', start_date: today },
      ] as any[];

      const duplicates = AnomalyService.checkForDuplicates(tx, history);

      expect(duplicates.length).toBe(0);
    });
  });

  describe('calculateCategoryStats', () => {
    it('should calculate correct statistics', () => {
      const transactions = [
        { type: 'expense', category: 'Food', amount: 20 },
        { type: 'expense', category: 'Food', amount: 30 },
        { type: 'expense', category: 'Food', amount: 25 },
        { type: 'expense', category: 'Transport', amount: 100 },
      ] as any[];

      const stats = AnomalyService.calculateCategoryStats(transactions);

      expect(stats.has('Food')).toBe(true);
      expect(stats.has('Transport')).toBe(true);

      const foodStats = stats.get('Food');
      expect(foodStats?.count).toBe(3);
      expect(foodStats?.mean).toBe(25);
    });

    it('should ignore income transactions', () => {
      const transactions = [
        { type: 'income', category: 'Salary', amount: 5000 },
        { type: 'expense', category: 'Food', amount: 25 },
      ] as any[];

      const stats = AnomalyService.calculateCategoryStats(transactions);

      expect(stats.has('Salary')).toBe(false);
      expect(stats.has('Food')).toBe(true);
    });
  });
});
