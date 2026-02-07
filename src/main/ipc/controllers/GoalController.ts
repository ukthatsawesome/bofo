
import { BaseController } from './BaseController';
import { Route } from '../router';
import { sanitizeAuditContext } from '../utils/audit'; // Actually goals use explicit methods in handlers.ts but better to reuse

export class GoalController extends BaseController {
    registerRoutes(): Record<string, Route> {
        return {
            'get-goals': () => this.getFinanceModel().getAllGoals(),

            'get-active-goals': () => this.getFinanceModel().getAll('goal', { where: { status: 'active' } }),

            'get-goal': (_, id) => this.getFinanceModel().getById('goal', id),

            'create-goal': (_, data) => this.getFinanceModel().create('goal', data),

            'update-goal': async (_, { id, data }) => {
                // Auto-complete if target reached
                if (data.current_amount !== undefined && data.target_amount !== undefined) {
                    if (data.current_amount >= data.target_amount && data.status !== 'completed') {
                        data.status = 'completed';
                        (data as any).completed_at = new Date().toISOString();
                    }
                }
                return await this.getFinanceModel().update('goal', id, data);
            },

            'delete-goal': (_, id) => this.getFinanceModel().deleteGoal(id),

            'contribute-to-goal': (_, { goalId, amount, source, notes }) =>
                this.getFinanceModel().contributeToGoal(goalId, amount, source, notes),

            'get-goal-contributions': (_, goalId) => this.getFinanceModel().getGoalContributions(goalId),

            'get-goals-summary': () => this.getFinanceModel().getGoalsSummary(),

            'get-available-for-goals': () => this.getFinanceModel().getAvailableForGoals(),
        };
    }
}
