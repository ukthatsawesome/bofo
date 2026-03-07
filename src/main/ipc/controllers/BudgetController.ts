import { BaseController } from './BaseController';
import { Route } from '../router';
import { sanitizeAuditContext } from '../utils/audit';

export class BudgetController extends BaseController {
  registerRoutes(): Record<string, Route> {
    return {
      'get-budgets': () => this.getFinanceModel().getAllBudgets(),

      'set-budget': (_, { category, amount, period, startDate, endDate, _auditContext }) =>
        this.getFinanceModel().create(
          'budget',
          {
            category,
            amount,
            period,
            start_date: startDate,
            end_date: endDate,
          },
          sanitizeAuditContext(_auditContext)
        ),

      'update-budget': (_, { id, category, amount, period, startDate, endDate, _auditContext }) =>
        this.getFinanceModel().update(
          'budget',
          id,
          {
            category,
            amount,
            period,
            start_date: startDate,
            end_date: endDate,
          },
          sanitizeAuditContext(_auditContext)
        ),

      'delete-budget': (_, id) => this.getFinanceModel().delete('budget', id, true),

      'get-budget-summary': () => this.getFinanceModel().getBudgetSummary(),
    };
  }
}
