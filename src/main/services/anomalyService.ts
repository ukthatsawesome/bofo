/**
 * Anomaly Detection Service
 *
 * Detects unusual patterns in financial transactions:
 * - Unusual amounts (statistically significant deviations)
 * - New merchants/categories
 * - Duplicate charges
 * - Subscription price increases
 */

import type { Transaction } from '../database/types';

export interface Anomaly {
  type: 'unusual_amount' | 'new_category' | 'duplicate' | 'price_increase';
  severity: 'low' | 'medium' | 'high';
  transactionId: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface CategoryStats {
  category: string;
  count: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const squareDiffs = values.map((value) => Math.pow(value - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
}

export const AnomalyService = {
  /**
   * Detect anomalies in a new transaction based on historical patterns
   */
  detectAnomalies(
    transaction: Transaction,
    history: Transaction[],
    categoryStats: Map<string, CategoryStats>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const stats = categoryStats.get(transaction.category);
    if (stats && stats.count >= 5) {
      const zScore =
        stats.stdDev > 0 ? Math.abs(transaction.amount - stats.mean) / stats.stdDev : 0;

      if (zScore > 3) {
        anomalies.push({
          type: 'unusual_amount',
          severity: 'high',
          transactionId: transaction.id,
          message: `Amount ${transaction.amount.toFixed(2)} is significantly unusual for ${transaction.category} (typically ${stats.mean.toFixed(2)} ± ${stats.stdDev.toFixed(2)})`,
          details: { zScore, mean: stats.mean, stdDev: stats.stdDev },
        });
      } else if (zScore > 2) {
        anomalies.push({
          type: 'unusual_amount',
          severity: 'medium',
          transactionId: transaction.id,
          message: `Amount ${transaction.amount.toFixed(2)} is higher than usual for ${transaction.category} (average: ${stats.mean.toFixed(2)})`,
          details: { zScore, mean: stats.mean, stdDev: stats.stdDev },
        });
      }
    }

    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - 90);

    const recentInCategory = history.filter(
      (t) => t.category === transaction.category && new Date(t.start_date) >= recentCutoff
    );

    if (recentInCategory.length === 0 && transaction.type === 'expense') {
      anomalies.push({
        type: 'new_category',
        severity: 'low',
        transactionId: transaction.id,
        message: `First ${transaction.category} expense in 90 days`,
      });
    }

    const duplicates = this.checkForDuplicates(transaction, history);
    if (duplicates.length > 0) {
      anomalies.push({
        type: 'duplicate',
        severity: 'medium',
        transactionId: transaction.id,
        message: `Possible duplicate: ${duplicates.length} similar ${transaction.category} transaction(s) in the last 7 days`,
        details: { duplicateIds: duplicates.map((d) => d.id) },
      });
    }

    return anomalies;
  },

  /**
   * Check for potential duplicate transactions
   */
  checkForDuplicates(transaction: Transaction, history: Transaction[]): Transaction[] {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    return history.filter(
      (t) =>
        t.id !== transaction.id &&
        t.amount === transaction.amount &&
        t.category === transaction.category &&
        t.type === transaction.type &&
        new Date(t.start_date) >= weekAgo
    );
  },

  /**
   * Calculate statistics for each category from transaction history
   */
  calculateCategoryStats(transactions: Transaction[]): Map<string, CategoryStats> {
    const categoryMap = new Map<string, number[]>();

    for (const tx of transactions) {
      if (tx.type !== 'expense') continue;

      const amounts = categoryMap.get(tx.category) || [];
      amounts.push(tx.amount);
      categoryMap.set(tx.category, amounts);
    }

    const statsMap = new Map<string, CategoryStats>();

    for (const [category, amounts] of categoryMap) {
      const count = amounts.length;
      const mean = amounts.reduce((a, b) => a + b, 0) / count;
      const stdDev = calculateStdDev(amounts, mean);
      const min = Math.min(...amounts);
      const max = Math.max(...amounts);

      statsMap.set(category, {
        category,
        count,
        mean: Math.round(mean * 100) / 100,
        stdDev: Math.round(stdDev * 100) / 100,
        min,
        max,
      });
    }

    return statsMap;
  },

  /**
   * Detect subscription price increases
   */
  detectPriceIncreases(
    currentAmount: number,
    description: string,
    history: Transaction[]
  ): Anomaly | null {
    const similar = history.filter(
      (t) =>
        t.description &&
        t.description.toLowerCase().includes(description.toLowerCase().split(' ')[0])
    );

    if (similar.length > 0) {
      const lastAmount = similar.sort(
        (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      )[0].amount;

      if (currentAmount > lastAmount) {
        const increase = ((currentAmount - lastAmount) / lastAmount) * 100;
        if (increase >= 5) {
          return {
            type: 'price_increase',
            severity: increase >= 20 ? 'high' : 'medium',
            transactionId: 0, // Will be set by caller
            message: `Price increase detected: ${description} increased by ${increase.toFixed(0)}% (${lastAmount.toFixed(2)} → ${currentAmount.toFixed(2)})`,
            details: { oldAmount: lastAmount, newAmount: currentAmount, increasePercent: increase },
          };
        }
      }
    }

    return null;
  },
};
