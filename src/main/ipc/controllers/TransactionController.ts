import { IpcMainInvokeEvent } from 'electron';
import { IController } from '../router';
import { FinanceModel } from '../../models/finance';
import type { 
  Transaction, 
} from '../../database/types';
import type { TransactionListDTO } from '../../../shared/types';

interface PaginationResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export class TransactionController implements IController {
  
  registerRoutes() {
    return {
      'get-transactions': this.getTransactions.bind(this),
      // 'get-transactions-paginated': this.getTransactionsPaginated.bind(this), // Could map to same handler or keep separate
    };
  }

  /**
   * Enhanced get-transactions handler.
   * Auto-enforces pagination if no options provided to prevent OOM.
   */
  async getTransactions(event: IpcMainInvokeEvent, options: any = {}): Promise<PaginationResult<TransactionListDTO>> {
    // Default to pagination if not specified
    // Legacy calls might expect all, but we return a paginated struct with limit 100
    // This IS A BREAKING CHANGE in response structure, as mandated by the plan.
    
    // Check if options contains pagination params, if not use safe defaults
    const safeOptions = {
        limit: options.limit || 100,
        offset: options.offset || 0,
        ...options // Preserve other filters like accountId, category, etc.
    };

    const result = await FinanceModel.getTransactionsPaginated(safeOptions);
    
    return {
        data: result.data,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.hasMore
    };
  }
}
