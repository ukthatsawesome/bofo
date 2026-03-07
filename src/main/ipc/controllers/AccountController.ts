import { BaseController } from './BaseController';
import { Route } from '../router';
import { sanitizeAuditContext } from '../utils/audit';

export class AccountController extends BaseController {
  registerRoutes(): Record<string, Route> {
    return {
      'get-accounts': () => this.getFinanceModel().getAllAccounts(),

      'add-account': (_, data) => {
        const { _auditContext, ...rest } = data;
        return this.getFinanceModel().create(
          'account',
          { ...rest, initial_balance: rest.balance || 0 },
          sanitizeAuditContext(_auditContext)
        );
      },

      'update-account': (_, data) => {
        const { _auditContext, ...rest } = data;
        return this.getFinanceModel().update(
          'account',
          rest.id,
          rest,
          sanitizeAuditContext(_auditContext)
        );
      },

      'delete-account': (_, id) =>
        this.getFinanceModel().delete('account', id, false, { source: 'USER' }),

      'archive-account': (_, id) => this.getFinanceModel().archive('account', id),

      'unarchive-account': (_, id) => this.getFinanceModel().unarchive('account', id),

      'is-account-in-use': async (_, id) => {
        const model = this.getFinanceModel();
        const row = await model.getById('account', id);
        if (!row) return false;
        const count = await model.getTransactionCount({ accountId: id });
        return count > 0;
      },
    };
  }
}
