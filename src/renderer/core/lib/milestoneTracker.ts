/**
 * Milestone Tracker
 * Tracks user achievements and shows encouraging notifications
 */

export interface Milestones {
  firstTransaction: boolean;
  tenTransactions: boolean;
  thirtyDays: boolean;
  firstGoal: boolean;
  budgetSet: boolean;
  firstForecast: boolean;
  weekStreak: boolean;
}

export class MilestoneTracker {
  private milestones: Milestones;
  private firstTransactionDate: string | null = null;

  constructor() {
    this.milestones = {
      firstTransaction: false,
      tenTransactions: false,
      thirtyDays: false,
      firstGoal: false,
      budgetSet: false,
      firstForecast: false,
      weekStreak: false,
    };
    this.loadState();
  }

  /**
   * Check if a milestone has been reached and return congratulatory message
   */
  checkMilestone(type: string, count?: number, data?: any): string | null {
    if (type === 'transaction' && count === 1 && !this.milestones.firstTransaction) {
      this.milestones.firstTransaction = true;
      this.firstTransactionDate = new Date().toISOString();
      this.saveState();
      return "🎉 First transaction recorded! You're on your way to better financial health.";
    }

    if (type === 'transaction' && count === 10 && !this.milestones.tenTransactions) {
      this.milestones.tenTransactions = true;
      this.saveState();
      return "🎊 10 transactions tracked! You're building a great habit.";
    }

    if (type === 'transaction' && this.firstTransactionDate && !this.milestones.thirtyDays) {
      const daysSinceFirst = Math.floor(
        (Date.now() - new Date(this.firstTransactionDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceFirst >= 30) {
        this.milestones.thirtyDays = true;
        this.saveState();
        return '🏆 30 days of tracking! Consistency is the key to financial success.';
      }
    }

    if (type === 'goal' && count === 1 && !this.milestones.firstGoal) {
      this.milestones.firstGoal = true;
      this.saveState();
      return '🎯 First goal set! Having clear targets makes saving easier.';
    }

    if (type === 'budget' && count === 1 && !this.milestones.budgetSet) {
      this.milestones.budgetSet = true;
      this.saveState();
      return "💰 Budget created! You're taking control of your spending.";
    }

    if (type === 'forecast' && !this.milestones.firstForecast) {
      this.milestones.firstForecast = true;
      this.saveState();
      return '🔮 First forecast generated! Planning ahead reduces financial stress.';
    }

    return null;
  }

  /**
   * Get progress summary for display
   */
  getProgress(): { completed: number; total: number; milestones: Milestones } {
    const completed = Object.values(this.milestones).filter(Boolean).length;
    const total = Object.keys(this.milestones).length;
    return { completed, total, milestones: this.milestones };
  }

  private loadState(): void {
    try {
      const saved = localStorage.getItem('bofo-milestones');
      if (saved) {
        const data = JSON.parse(saved);
        this.milestones = data.milestones || this.milestones;
        this.firstTransactionDate = data.firstTransactionDate || null;
      }
    } catch (err) {
      console.warn('Failed to load milestone state:', err);
    }
  }

  private saveState(): void {
    try {
      localStorage.setItem(
        'bofo-milestones',
        JSON.stringify({
          milestones: this.milestones,
          firstTransactionDate: this.firstTransactionDate,
        })
      );
    } catch (err) {
      console.warn('Failed to save milestone state:', err);
    }
  }

  /**
   * Reset all milestones (for testing or user request)
   */
  reset(): void {
    this.milestones = {
      firstTransaction: false,
      tenTransactions: false,
      thirtyDays: false,
      firstGoal: false,
      budgetSet: false,
      firstForecast: false,
      weekStreak: false,
    };
    this.firstTransactionDate = null;
    this.saveState();
  }
}
