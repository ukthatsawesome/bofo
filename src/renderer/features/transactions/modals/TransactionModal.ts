import { Modal } from '../../../components/ui/Modal';
import { FormGroup } from '../../../components/ui/FormGroup';
import { UIUtils } from '../../../lib/dom';
import type { Account, Category } from '../../../../shared/types';

interface TransactionModalProps {
  accounts: Account[];
  categories: Category[];
}

export const TransactionModal = ({ accounts, categories }: TransactionModalProps): string => {
  return Modal({
    id: 'transaction-modal',
    title: 'New Transaction',
    content: `
      <div class="tx-type-toggle-modal mb-4" role="group" aria-label="Transaction Type">
          <button class="segment active" data-type="income" aria-pressed="true">Income</button>
          <button class="segment" data-type="expense" aria-pressed="false">Expense</button>
          <button class="segment" data-type="transfer" aria-pressed="false">Transfer</button>
      </div>
      
      <div class="modal-grid">
          ${FormGroup({
      label: 'Amount',
      forId: 'modal-tx-amount',
      content:
        '<input type="number" id="modal-tx-amount" class="form-control" step="0.01" min="0.01" placeholder="0.00" required aria-label="Amount">',
    })}
          ${FormGroup({
      label: 'Date',
      forId: 'modal-tx-date',
      content: '<input type="date" id="modal-tx-date" class="form-control" required aria-label="Transaction Date">',
    })}
          ${FormGroup({
      label: 'From Account',
      forId: 'modal-tx-account',
      content: `
                <select id="modal-tx-account" class="form-control" aria-label="Source Account">
                    ${accounts
          .filter(a => a.status === 'active')
          .map((a) => `<option value="${a.id}" data-currency="${a.currency}">${UIUtils.escapeHTML(a.name)}</option>`)
          .join('')}
                </select>
            `,
    })}
          <div id="modal-tx-to-account-group" class="hidden" style="grid-column: span 2; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              ${FormGroup({
      label: 'To Account',
      forId: 'modal-tx-to-account',
      content: `
                    <select id="modal-tx-to-account" class="form-control" style="width: 100%;" aria-label="Destination Account">
                        ${accounts
          .filter(a => a.status === 'active')
          .map((a) => `<option value="${a.id}" data-currency="${a.currency}">${UIUtils.escapeHTML(a.name)}</option>`)
          .join('')}
                    </select>
                `,
    })}
              ${FormGroup({
      label: 'Destination Amount',
      forId: 'modal-tx-to-amount',
      content:
        '<input type="number" id="modal-tx-to-amount" class="form-control" step="0.01" placeholder="Auto-calc" disabled aria-label="Destination Amount">',
    })}
          </div>
          <div id="modal-tx-rate-group" class="hidden">
               ${FormGroup({
      label: 'Exchange Rate',
      forId: 'modal-tx-exchange-rate',
      content: `
          <div class="flex-row gap-2 align-center">
              <input type="number" id="modal-tx-exchange-rate" class="form-control flex-1" step="0.0001" placeholder="1.0000" disabled aria-label="Exchange Rate">
              <span id="modal-tx-rate-source" class="text-xs text-muted"></span>
          </div>
          <small class="text-muted">1 [From] = [Rate] × [To]</small>
      `,
    })}
          </div>
          ${FormGroup({
      label: 'Category',
      content: `
                <select id="modal-tx-category" class="form-control" aria-label="Category">
                    ${categories
          .filter(c => c.status === 'active')
          .map((c) => `<option value="${c.name}">${UIUtils.escapeHTML(c.name)}</option>`)
          .join('')}
                </select>
            `,
    })}
          ${FormGroup({
      label: 'Description',
      content:
        '<input type="text" id="modal-tx-desc" class="form-control" placeholder="What was this for?" aria-label="Description">',
    })}
      </div>
    `,
    actions: `
      <button class="btn secondary" id="modal-tx-cancel" aria-label="Cancel">Cancel</button>
      <button class="btn primary" id="modal-tx-save" aria-label="Save Transaction">Save Transaction</button>
    `,
  });
};
