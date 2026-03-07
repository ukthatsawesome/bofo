import { IController, Route } from '../router';

/**
 * Base Controller
 * provides common utilities for all controllers
 */
export abstract class BaseController implements IController {
  abstract registerRoutes(): Record<string, Route>;

  protected getFinanceModel() {
    return require('../../models/finance').FinanceModel;
  }
}
