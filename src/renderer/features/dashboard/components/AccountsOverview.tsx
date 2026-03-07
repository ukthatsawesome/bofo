import { h } from 'preact';
import { UiCard } from '@/components/ui/UiCard';
import { Wallet } from 'lucide-preact';
import { financeStore } from '@/core/financeStore';
import { formatCurrency } from '@/utils/format';
import { StatusBadge } from '@/components/ui/StatusBadge';

export const AccountsOverview = () => {
  const accounts = financeStore.activeAccounts.value;

  const mapTypeToStatus = (type: string) => {
    const mapping: Record<string, string> = {
      bank: 'info',
      wallet: 'success',
      credit_card: 'warning',
      loan: 'danger',
      investment: 'success',
      other: 'neutral',
    };
    return mapping[type] || 'neutral';
  };

  return (
    <UiCard title="Accounts Overview" icon={Wallet} variant="flat" noPadding>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-muted bg-surface-base/50">
              <th className="py-3 px-5 text-left font-medium text-xs uppercase tracking-wider">
                Account
              </th>
              <th className="py-3 px-5 text-left font-medium text-xs uppercase tracking-wider">
                Type
              </th>
              <th className="py-3 px-5 text-left font-medium text-xs uppercase tracking-wider">
                Currency
              </th>
              <th className="py-3 px-5 text-right font-medium text-xs uppercase tracking-wider">
                Balance
              </th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-text-muted">
                  No accounts configured yet.
                </td>
              </tr>
            ) : (
              accounts.map((acc: any) => {
                const balanceClass =
                  acc.balance >= 0 ? 'text-text-primary' : 'text-danger font-medium';

                return (
                  <tr
                    key={acc.id}
                    className="border-b border-border/50 last:border-0 hover:bg-surface-hover transition-colors"
                  >
                    <td className="py-4 px-5">
                      <span className="font-semibold text-text-primary">{acc.name}</span>
                    </td>
                    <td className="py-4 px-5">
                      <StatusBadge status={mapTypeToStatus(acc.type) as any} variant="soft">
                        {acc.type.replace('_', ' ')}
                      </StatusBadge>
                    </td>
                    <td className="py-4 px-5">
                      <span className="text-xs font-bold uppercase tracking-wide text-text-muted">
                        {acc.currency}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <span className={`${balanceClass} font-mono`}>
                        {formatCurrency(acc.balance, acc.currency)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </UiCard>
  );
};
