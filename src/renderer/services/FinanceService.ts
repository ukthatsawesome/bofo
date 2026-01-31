import type {
    Account,
    Category,
    TransactionListDTO,
    Budget,
    RecurringCharge,
    BillType,
    BillReading,
    ExchangeRate,
    PaginatedResponse
} from '../../shared/types';

/**
 * Service for fetching financial data from the backend.
 * Abstraction layer over window.api.
 */
export class FinanceService {
    async getSettings(): Promise<Record<string, string>> {
        return window.api.getSettings();
    }

    async getAISettings(): Promise<any> {
        return window.api.getAISettings();
    }

    async updateSetting(data: { key: string; value: string }): Promise<any> {
        return window.api.updateSetting(data);
    }

    async getExchangeRates(): Promise<ExchangeRate[]> {
        return window.api.getExchangeRates();
    }

    async getAccounts(): Promise<Account[]> {
        return window.api.getAccounts();
    }

    async getCategories(): Promise<Category[]> {
        return window.api.getCategories();
    }

    async getSummaryStats(baseCurrency?: string): Promise<{
        netWorth: number;
        totalBalance: number;
        monthIncome: number;
        monthExpense: number;
        savingsRate: number;
    }> {
        return window.api.getSummaryStats(baseCurrency);
    }

    async getTransactions(options: any): Promise<PaginatedResponse<TransactionListDTO> | any> {
        return window.api.getTransactions(options);
    }

    async deleteTransaction(id: number): Promise<any> {
        return window.api.deleteTransaction(id);
    }

    async getBudgets(): Promise<Budget[]> {
        return window.api.getBudgets();
    }

    async getBillTypes(): Promise<(BillType & { account_name?: string })[]> {
        return window.api.getBillTypes();
    }

    async getBillReadings(filters: any): Promise<(BillReading & { bill_name: string })[]> {
        return window.api.getBillReadings(filters);
    }

    async getRecurringCharges(): Promise<RecurringCharge[]> {
        return window.api.getRecurringCharges();
    }
}
