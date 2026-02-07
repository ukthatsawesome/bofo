import { h } from 'preact';
import { Route, Switch } from 'wouter';
import { Shell } from '../components/layout/Shell';
import { BillsPage } from '../features/bills/BillsPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { TransactionsPage } from '../features/transactions/TransactionsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { BudgetPage } from '../features/budget/BudgetPage';
import { GoalsPage } from '../features/goals/GoalsPage';
import { ForecastPage } from '../features/dashboard/ForecastPage';
import { SandboxPage } from '../features/sandbox/SandboxPage';
import { RecurringPage } from '../features/recurring/RecurringPage';
import { AISettingsPage } from '../features/settings/AISettingsPage';

export const Routes = () => {
    return (
        <Shell>
            <Switch>
                {/* Dashboard */}
                <Route path="/">
                    <DashboardPage />
                </Route>

                {/* Transactions */}
                <Route path="/transactions">
                    <TransactionsPage />
                </Route>

                {/* Bills */}
                <Route path="/bills">
                    <BillsPage />
                </Route>

                <Route path="/budget">
                    <BudgetPage />
                </Route>

                <Route path="/goals">
                    <GoalsPage />
                </Route>

                <Route path="/forecast">
                    <ForecastPage />
                </Route>

                <Route path="/sandbox">
                    <SandboxPage />
                </Route>

                <Route path="/recurring">
                    <RecurringPage />
                </Route>

                <Route path="/settings">
                    <SettingsPage />
                </Route>

                <Route path="/ai-settings">
                    <AISettingsPage />
                </Route>

                <Route path="/:view">
                    {(params: { view?: string }) => {
                        const viewName = params.view?.toLowerCase();
                        return <div className="p-10 text-center text-text-muted">View "{viewName}" transition in progress...</div>;
                    }}
                </Route>

                {/* 404 Fallback - Go to Dashboard */}
                <Route>
                    <DashboardPage />
                </Route>
            </Switch>
        </Shell>
    );
};
