import { Modal } from '../components/common/Modal.js';
import { FormGroup } from '../components/common/FormGroup.js';

export const TransactionModal = ({ accounts, categories }) => {
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
                    content: '<input type="number" id="modal-tx-amount" step="0.01" placeholder="0.00">'
                })}
                ${FormGroup({
                    label: 'Date',
                    content: '<input type="date" id="modal-tx-date">'
                })}
                ${FormGroup({
                    label: 'From Account',
                    content: `
                        <select id="modal-tx-account">
                            ${accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
                        </select>
                    `
                })}
                <div id="modal-tx-to-account-group" class="hidden">
                    ${FormGroup({
                        label: 'To Account',
                        content: `
                            <select id="modal-tx-to-account">
                                ${accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
                            </select>
                        `
                    })}
                </div>
                ${FormGroup({
                    label: 'Category',
                    content: `
                        <select id="modal-tx-category">
                            ${categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                        </select>
                    `
                })}
                ${FormGroup({
                    label: 'Description',
                    content: '<input type="text" id="modal-tx-desc" placeholder="What was this for?">'
                })}
            </div>
        `,
        actions: `
            <button class="btn" id="modal-tx-cancel">Cancel</button>
            <button class="btn primary" id="modal-tx-save">Save Transaction</button>
        `
    });
};
