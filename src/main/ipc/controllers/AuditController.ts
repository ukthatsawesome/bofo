import { BaseController } from './BaseController';
import { Route } from '../router';

export class AuditController extends BaseController {
    registerRoutes(): Record<string, Route> {
        return {
            'get-audit-logs': (_, options) => this.getFinanceModel().getAuditLogs(options || {}),
        };
    }
}
