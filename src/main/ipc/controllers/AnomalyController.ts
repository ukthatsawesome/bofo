import { BaseController } from './BaseController';
import { Route } from '../router';
import { Logger } from '../../utils/logger';

export class AnomalyController extends BaseController {
  private getAnomalyService() {
    return require('../../services/anomalyService').AnomalyService;
  }

  registerRoutes(): Record<string, Route> {
    return {
      'get-category-stats': async () => {
        try {
          return await this.getFinanceModel().getCategoryStats();
        } catch (e: any) {
          Logger.warn('[IPC] get-category-stats failed:', e.message);
          return [];
        }
      },

      'detect-anomalies': async (_, { transaction }) => {
        try {
          const AnomalyService = this.getAnomalyService();
          const model = this.getFinanceModel();

          const history = await model.getAllTransactions();
          const statsArray = await model.getCategoryStats();
          const statsMap = new Map((statsArray || []).map((s: any) => [s.category, s]));

          const anomalies = AnomalyService.detectAnomalies(transaction, history, statsMap);

          return { success: true, anomalies };
        } catch (e: any) {
          Logger.warn('[IPC] detect-anomalies failed:', e.message);
          return { success: false, anomalies: [], error: e.message };
        }
      },
    };
  }
}
