import { BaseController } from './BaseController';
import { Route } from '../router';

export class BillController extends BaseController {
  registerRoutes(): Record<string, Route> {
    return {
      'get-bill-types': () => this.getFinanceModel().getBillTypes(),
      'add-bill-type': (_, data) => this.getFinanceModel().create('billType', data),
      'update-bill-type': (_, { id, data }) => this.getFinanceModel().update('billType', id, data),
      'delete-bill-type': (_, id) => this.getFinanceModel().delete('billType', id, true),

      'get-bill-readings': (_, filters) => this.getFinanceModel().getBillReadings(filters),
      'get-bill-readings-paginated': (_, options) =>
        this.getFinanceModel().getBillReadingsPaginated(options),

      'add-bill-reading': (_, data) => this.getFinanceModel().create('billReading', data),
      'update-bill-reading': (_, { id, data }) =>
        this.getFinanceModel().update('billReading', id, data),
      'delete-bill-reading': (_, id) => this.getFinanceModel().delete('billReading', id, true),

      'get-bill-projections': () => this.getFinanceModel().getBillProjections(),

      // Recurring Charges for Bills often handled here too but logic might be separate?
      // handlers.ts had separate recurring charges section. I should probably add RecurringChargeController or merge into Bill/Transaction?
      // Recurring charges are conceptually Bills sometimes but also subscriptions.
      // Let's create a RecurringController to keep it clean.

      // Adding Recurring Charge routes here for now or separate?
      // handlers.ts has 'get-recurring-charges' separate.
    };
  }
}
