import { BaseController } from './BaseController';
import { Route } from '../router';
import { sanitizeAuditContext } from '../utils/audit';

export class TransactionController extends BaseController {
  registerRoutes(): Record<string, Route> {
    return {
      'get-transactions': (_, filter) => this.getFinanceModel().getAll('transaction', filter),
      'get-transactions-paginated': (_, { limit, offset, filters = {} }) =>
        this.getFinanceModel().getTransactionsPaginated({ limit, offset, ...filters }),
      'get-transaction': (_, id) => this.getFinanceModel().getTransactionById(id),

      'add-transaction': async (_, data) => {
        const { _auditContext, ...rest } = data;
        const result = await this.getFinanceModel().create(
          'transaction',
          rest,
          sanitizeAuditContext(_auditContext)
        );

        return this.getFinanceModel().getTransactionById(result.id);
      },

      'update-transaction': (_, { id, data }) => {
        const { _auditContext, ...rest } = data;
        return this.getFinanceModel().update(
          'transaction',
          id,
          rest,
          sanitizeAuditContext(_auditContext)
        );
      },

      'delete-transaction': async (_, id) => {
        return await this.getFinanceModel().delete('transaction', id, true, { source: 'USER' });
      },

      'get-transaction-count': (_, options) => this.getFinanceModel().getTransactionCount(options),

      'get-transaction-stats': (_, options) => this.getFinanceModel().getTransactionStats(options),
    };
  }
}
