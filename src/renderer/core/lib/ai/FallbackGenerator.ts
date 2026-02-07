
import { Formatter } from '../formatters';

interface DashboardSummary {
    balance: number;
    monthIncome: number;
    monthExpense: number;
    savingsRate: number | string;
    topCategory?: string;
    topCategoryAmount?: number;
}

interface TransactionSummary {
    savingsRate: string;
    netFlow: string;
    topCategories: Array<{ category: string; percent: string }>;
    yoyChange: string | null;
    transactionCount: number;
    incomeRaw: number;
    expense: string;
}

interface BudgetSummary {
    overBudgetCategories: string[];
    nearBudgetCategories: string[];
    underBudgetCategories: string[];
    totalSpent: number;
    totalBudget: number;
}

interface GoalsSummary {
    totalProgress: number;
    nearCompletion: Array<{ name: string; progress: number }>;
    stalled: Array<{ name: string }>;
    availableForGoals: number;
}

interface PlannerData {
    willGoNegative: boolean;
    impactPercent: string;
    range: number;
    plannedExpenses: string;
    plannedExpensesRaw: number;
    plannedIncomeRaw: number;
    impact: string;
    items: Array<{ frequency: string }>;
}

/**
 * Helper to escape HTML characters in user content
 */
function escapeHTML(str: any): string {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* ==================== FALLBACK GENERATOR (Functional) ==================== */

export const FallbackGenerator = {
    /**
     * Generate dashboard insight from financial summary
     */
    generateDashboardInsight(summary: DashboardSummary, currency = 'USD'): string {
        const { balance, monthIncome, monthExpense, savingsRate, topCategory } = summary;
        const insights: Array<{
            text: string;
            priority: number;
            type: 'success' | 'warning' | 'danger' | 'info';
        }> = [];
        const rate = typeof savingsRate === 'string' ? parseFloat(savingsRate) : savingsRate;
        const safeCategory = escapeHTML(topCategory);

        // Savings rate analysis
        if (rate >= 50) {
            insights.push({
                text: `Outstanding ${rate}% savings rate this month! You're saving more than half your income.`,
                priority: 1,
                type: 'success',
            });
        } else if (rate >= 30) {
            insights.push({
                text: `Excellent ${rate}% savings rate – you're building wealth effectively.`,
                priority: 2,
                type: 'success',
            });
        } else if (rate >= 20) {
            insights.push({
                text: `Solid ${rate}% savings rate. You're on track for financial stability.`,
                priority: 3,
                type: 'info',
            });
        } else if (rate >= 10) {
            insights.push({
                text: `${rate}% savings rate. Consider cutting discretionary spending to reach 20%.`,
                priority: 4,
                type: 'warning',
            });
        } else if (rate > 0) {
            insights.push({
                text: `Low ${rate}% savings rate. Review your ${safeCategory || 'top spending'} category for quick wins.`,
                priority: 5,
                type: 'warning',
            });
        } else if (monthIncome > 0 && rate <= 0) {
            insights.push({
                text: `Spending exceeds income this month. Time to review your ${safeCategory || 'largest expenses'} first.`,
                priority: 6,
                type: 'danger',
            });
        }

        // Emergency fund analysis
        if (balance && monthExpense > 0) {
            const monthsRunway = balance / monthExpense;
            if (monthsRunway < 1) {
                insights.push({
                    text: `Emergency fund critically low – only ${monthsRunway.toFixed(1)} months of expenses covered.`,
                    priority: 1,
                    type: 'danger',
                });
            } else if (monthsRunway < 3) {
                insights.push({
                    text: `Build your emergency fund to 3-6 months. Currently at ${monthsRunway.toFixed(1)} months.`,
                    priority: 4,
                    type: 'warning',
                });
            } else if (monthsRunway >= 6) {
                insights.push({
                    text: `Strong emergency fund covering ${monthsRunway.toFixed(0)} months. Consider investing excess.`,
                    priority: 7,
                    type: 'success',
                });
            }
        }

        // Top category dominance
        if (topCategory && topCategory !== 'None' && monthExpense > 0) {
            const topAmount = summary.topCategoryAmount || 0;
            const pct = (topAmount / monthExpense) * 100;
            if (pct > 50) {
                insights.push({
                    text: `${safeCategory} dominates at ${pct.toFixed(0)}% of spending. Is this intentional?`,
                    priority: 3,
                    type: 'info',
                });
            } else if (pct > 35) {
                insights.push({
                    text: `${safeCategory} is ${pct.toFixed(0)}% of spending. Review if this aligns with your priorities.`,
                    priority: 5,
                    type: 'info',
                });
            }
        }

        insights.sort((a, b) => a.priority - b.priority);

        if (insights.length > 0) {
            if (insights.length >= 2 && insights[0].priority <= 3 && insights[1].priority <= 4) {
                return insights[0].text + ' ' + insights[1].text;
            }
            return insights[0].text;
        }

        return `Net worth: ${Formatter.currency(balance, currency)}. Keep tracking to build your financial picture.`;
    },

    /**
     * Generate transaction period insight
     */
    generateTransactionInsight(
        summary: TransactionSummary,
        monthName: string,
        isPastMonth: boolean
    ): string {
        const insights: string[] = [];
        const rate = parseFloat(summary.savingsRate);

        if (rate >= 30) {
            insights.push(
                `<strong class="text-success">Excellent!</strong> ${summary.savingsRate}% savings rate with ${summary.netFlow} net flow.`
            );
        } else if (rate >= 15) {
            insights.push(`Solid ${summary.savingsRate}% savings rate with ${summary.netFlow} net flow.`);
        } else if (rate > 0) {
            const topCat = summary.topCategories[0]?.category;
            const safeTopCat = topCat ? escapeHTML(topCat) : 'discretionary';
            insights.push(`${summary.savingsRate}% savings rate. Consider reducing ${safeTopCat} spending.`);
        } else if (summary.incomeRaw > 0) {
            insights.push(
                `<strong class="text-danger">Watch out:</strong> Spending exceeded income by ${summary.netFlow}.`
            );
        }

        if (summary.topCategories.length > 0) {
            const top = summary.topCategories[0];
            if (parseInt(top.percent) > 40) {
                insights.push(`${escapeHTML(top.category)} dominated at ${top.percent}% of spending.`);
            }
        }

        if (summary.yoyChange !== null) {
            const change = parseInt(summary.yoyChange);
            if (change > 20) {
                insights.push(`Expenses up ${summary.yoyChange}% vs last year – review for lifestyle creep.`);
            } else if (change < -10) {
                insights.push(`Great progress! Expenses down ${Math.abs(change)}% compared to last year.`);
            }
        }

        if (!isPastMonth && insights.length > 0) {
            const now = new Date();
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const daysRemaining = lastDay - now.getDate();
            if (daysRemaining > 0 && daysRemaining < 10) {
                insights.push(`${daysRemaining} days left this month – stay on track!`);
            }
        }

        return insights.length > 0
            ? insights.join(' ')
            : `${summary.transactionCount} transactions totaling ${summary.expense} in expenses.`;
    },

    /**
     * Generate planner/sandbox insight
     */
    generatePlannerInsight(data: PlannerData): string {
        const items: string[] = [];

        if (data.willGoNegative) {
            items.push(
                `<p class="text-danger font-semibold">⚠️ Warning: This plan will cause your balance to go negative. Consider reducing planned expenses or spreading them over a longer period.</p>`
            );
        }

        const impactPercent = parseFloat(data.impactPercent);
        if (impactPercent < -50) {
            items.push(
                `<p>High-impact plan: reduces balance by ${Math.abs(impactPercent).toFixed(0)}% over ${data.range} months. Ensure you have contingency funds.</p>`
            );
        } else if (impactPercent < -30) {
            items.push(
                `<p>Significant impact on finances. The ${data.plannedExpenses} in planned expenses requires careful budgeting.</p>`
            );
        } else if (impactPercent < -15) {
            items.push(`<p>Moderate financial impact. Monitor your actual spending against this projection.</p>`);
        } else if (impactPercent > 10) {
            items.push(
                `<p class="text-success">Positive outlook! Your planned income exceeds expenses, adding ${data.impact} to your balance.</p>`
            );
        }

        const hasOnlyExpenses = data.plannedExpensesRaw > 0 && data.plannedIncomeRaw === 0;
        if (hasOnlyExpenses && !data.willGoNegative) {
            items.push(
                `<p>Consider offsetting expenses with additional income sources or savings reallocation.</p>`
            );
        }

        const hasRecurring = (data.items || []).some((i) => i.frequency !== 'once');
        if (hasRecurring) {
            items.push(
                `<p>Recurring items in your plan will compound over time. Review the ${data.range}-month projection carefully.</p>`
            );
        }

        if (items.length === 0) {
            items.push(
                `<p>Your plan appears balanced. Continue monitoring actual spending against this projection.</p>`
            );
        }

        return items.join('');
    },

    /**
     * Generate budget insight
     */
    generateBudgetInsight(budgetData: BudgetSummary, currency = 'USD'): string {
        const { overBudgetCategories, nearBudgetCategories, totalSpent, totalBudget } = budgetData;
        const insights: string[] = [];

        const overallPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

        if (overallPercent > 100) {
            insights.push(
                `<strong class="text-danger">Over budget</strong> by ${Formatter.currency(totalSpent - totalBudget, currency)}. Review your spending immediately.`
            );
        } else if (overallPercent > 90) {
            insights.push(
                `At ${overallPercent.toFixed(0)}% of budget with time remaining. Consider slowing down spending.`
            );
        } else if (overallPercent < 50) {
            insights.push(`Good control at ${overallPercent.toFixed(0)}% of budget used.`);
        }

        if (overBudgetCategories && overBudgetCategories.length > 0) {
            insights.push(`${escapeHTML(overBudgetCategories[0])} is over budget – address this first.`);
        } else if (nearBudgetCategories && nearBudgetCategories.length > 0) {
            insights.push(`Watch ${escapeHTML(nearBudgetCategories[0])} – approaching limit.`);
        }

        return insights.length > 0 ? insights.join(' ') : 'Your budgets are on track.';
    },

    /**
     * Generate goals insight
     */
    generateGoalsInsight(goalsData: GoalsSummary, currency = 'USD'): string {
        const { nearCompletion, stalled, availableForGoals } = goalsData;
        const insights: string[] = [];

        if (nearCompletion && nearCompletion.length > 0) {
            insights.push(
                `Almost there! "${escapeHTML(nearCompletion[0].name)}" is ${nearCompletion[0].progress}% complete.`
            );
        }

        if (stalled && stalled.length > 0) {
            insights.push(`"${escapeHTML(stalled[0].name)}" needs attention – no contributions recently.`);
        }

        if (availableForGoals > 0) {
            insights.push(
                `You have ${Formatter.currency(availableForGoals, currency)} available for goal contributions.`
            );
        }

        return insights.length > 0 ? insights.join(' ') : 'Keep contributing to reach your financial goals.';
    }
};
