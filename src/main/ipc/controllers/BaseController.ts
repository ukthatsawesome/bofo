
import { IController, Route } from '../router';

/**
 * Base Controller
 * provides common utilities for all controllers
 */
export abstract class BaseController implements IController {
    abstract registerRoutes(): Record<string, Route>;

    protected getFinanceModel() {
        // Lazy load to avoid circular dependencies if necessary, 
        // or just import directly if models are safe.
        // Given the original handlers used lazy loading, we'll keep it safe.
        return require('../../models/finance').FinanceModel;
    }
}
