
import { BaseController } from './BaseController';
import { Route } from '../router';

export class RecurringController extends BaseController {
    registerRoutes(): Record<string, Route> {
        return {
            'get-recurring-charges': () => this.getFinanceModel().getAllRecurringCharges(),
            'get-active-recurring-charges': () => this.getFinanceModel().getAll('recurringCharge', { where: { is_active: 1 } }),

            'create-recurring-charge': (_, data) => this.getFinanceModel().create('recurringCharge', data),
            'update-recurring-charge': (_, { id, data }) => this.getFinanceModel().update('recurringCharge', id, data),
            'delete-recurring-charge': (_, id) => this.getFinanceModel().delete('recurringCharge', id, true),

            'get-monthly-recurring-total': () => this.getFinanceModel().getMonthlyRecurringTotal(),
        };
    }
}
