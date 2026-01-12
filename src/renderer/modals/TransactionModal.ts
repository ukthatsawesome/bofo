import { Modal } from '../components/common/Modal';
import { FormGroup } from '../components/common/FormGroup';

interface Account {
    id: number | string;
    name: string;
    currency: string;
}

interface Category {
    name: string;
}

interface TransactionModalProps {
    accounts: Account[];
    categories: Category[];
}

export const TransactionModal = ({ accounts, categories }: TransactionModalProps): string => {
    return Modal({
        id: 'transaction-modal',
        title: 'New Transaction',
        content: `
            <div class="tx-type-toggle-modal mb-4">
                <button class="segment active" data-type="income">Income</button>
                <button class="segment" data-type="expense">Expense</button>
                <button class="segment" data-type="transfer">Transfer</button>
            </div>
            
            <div class="modal-grid">
                ${FormGroup({
            label: 'Amount',
            content: '<input type="number" id="modal-tx-amount" class="form-control" step="0.01" min="0.01" placeholder="0.00" required>'
        })}
                ${FormGroup({
            label: 'Date',
            content: '<input type="date" id="modal-tx-date" class="form-control" required>'
        })}
                ${FormGroup({
            label: 'From Account',
            content: `
                        <select id="modal-tx-account" class="form-control">
                            ${accounts.map(a => `<option value="${a.id}" data-currency="${a.currency}">${a.name}</option>`).join('')}
                        </select>
                    `
        })}
                <div id="modal-tx-to-account-group" class="hidden" style="grid-column: span 2; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    ${FormGroup({
            label: 'To Account',
            content: `
                            <select id="modal-tx-to-account" class="form-control" style="width: 100%;">
                                ${accounts.map(a => `<option value="${a.id}" data-currency="${a.currency}">${a.name}</option>`).join('')}
                            </select>
                        `
        })}
                    ${FormGroup({
            label: 'Destination Amount',
            content: '<input type="number" id="modal-tx-to-amount" class="form-control" step="0.01" placeholder="Auto-calc" disabled>'
        })}
                </div>
                <div id="modal-tx-rate-group" class="hidden">
                     ${FormGroup({
            label: 'Exchange Rate',
            content: '<input type="number" id="modal-tx-exchange-rate" class="form-control" step="0.0001" placeholder="1.0000" disabled>'
        })}
                </div>
                ${FormGroup({
            label: 'Category',
            content: `
                        <select id="modal-tx-category" class="form-control">
                            ${categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                        </select>
                    `
        })}
                ${FormGroup({
            label: 'Description',
            content: '<input type="text" id="modal-tx-desc" class="form-control" placeholder="What was this for?">'
        })}
            </div>
        `,
        actions: `
            <button class="btn secondary" id="modal-tx-cancel">Cancel</button>
            <button class="btn primary" id="modal-tx-save">Save Transaction</button>
        `
    });
};
