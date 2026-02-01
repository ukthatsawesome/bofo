/**
 * ModalManager - Handles all modal lifecycle and form actions
 * Extracted from App to maintain single responsibility
 */
import { $, UIUtils } from '../lib/dom';
import { eventBus } from '../lib/eventBus';

// Modal components
import { TransactionModal } from '../features/transactions/modals/TransactionModal';
import { AccountModal } from '../features/settings/modals/AccountModal';
import { CategoryModal } from '../features/settings/modals/CategoryModal';
import { BudgetModal } from '../features/budget/modals/BudgetModal';
import { SandboxModal } from '../features/sandbox/modals/SandboxModal';
import { BillTypeModal } from '../features/bills/modals/BillTypeModal';
import { BillReadingModal } from '../features/bills/modals/BillReadingModal';
import { NotificationModal } from '../components/ui/notifications/NotificationModal';

import type { App } from './App';

export class ModalManager {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Render all dynamic modals into the DOM
     */
    renderDynamicModals(): void {
        const container = document.getElementById('dynamic-modals-container');
        if (!container) return;

        const accounts = (this.app.state.accounts || []).filter((a) => a.status !== 'archived');
        const categories = (this.app.state.categories || []).filter((c) => c.status !== 'archived');

        container.innerHTML = `
      ${TransactionModal({ accounts, categories })}
      ${AccountModal()}
      ${CategoryModal()}
      ${BudgetModal({ categories })}
      ${SandboxModal()}
      ${BillTypeModal()}
      ${BillReadingModal({ billTypes: (this.app.state.billTypes as any) || [] })}
    `;

        const notificationContainer = document.getElementById('notification-modal-container');
        if (notificationContainer) {
            notificationContainer.innerHTML = NotificationModal();
            this.app.notifications.setupEventListeners();
        }

        this.setupListeners();
        this.setupActions();
    }

    /**
     * Setup global modal listeners (close, backdrop click)
     */
    setupListeners(): void {
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;

            // Close button or Cancel button
            const closeBtn = target.closest('.modal .close, .modal .btn.secondary, [data-modal-close]');
            if (closeBtn) {
                const modal = closeBtn.closest('.modal');
                if (modal) {
                    UIUtils.setHidden(`#${modal.id}`, true);
                }
                return;
            }

            // Backdrop click (target is the modal itself)
            if (target.classList.contains('modal')) {
                UIUtils.setHidden(`#${target.id}`, true);
            }
        });
    }

    /**
     * Setup all modal form actions
     */
    setupActions(): void {
        this.setupCurrencyCalculations();
        this.setupTransactionModal();
        this.setupAccountModal();
        this.setupCategoryModal();
        this.setupTransactionTypeToggles();
    }

    /**
     * Cross-currency transfer calculations
     */
    private setupCurrencyCalculations(): void {
        const checkCurrencies = async () => {
            const fromSelect = $('#modal-tx-account') as HTMLSelectElement;
            const toSelect = $('#modal-tx-to-account') as HTMLSelectElement;
            const activeSegment = document.querySelector('#transaction-modal .segment.active') as HTMLElement;
            const type = activeSegment?.dataset?.type;

            if (type !== 'transfer') {
                UIUtils.setHidden('#modal-tx-rate-group', true);
                return;
            }

            const fromCurrency = fromSelect.options[fromSelect.selectedIndex]?.dataset?.currency;
            const toCurrency = toSelect.options[toSelect.selectedIndex]?.dataset?.currency;
            const isMultiCurrency = fromCurrency && toCurrency && fromCurrency !== toCurrency;

            const rateInput = $('#modal-tx-exchange-rate') as HTMLInputElement;
            const toAmountInput = $('#modal-tx-to-amount') as HTMLInputElement;
            const rateGroup = $('#modal-tx-rate-group');
            const rateSourceHint = $('#modal-tx-rate-source');

            if (isMultiCurrency) {
                if (rateGroup) rateGroup.classList.remove('hidden');
                if (rateInput) rateInput.disabled = false;
                if (toAmountInput) toAmountInput.disabled = false;

                try {
                    const storedRate = await window.api.getExchangeRate(fromCurrency, toCurrency);
                    if (storedRate !== null && rateInput) {
                        rateInput.value = storedRate.toFixed(6);
                        if (rateSourceHint) {
                            rateSourceHint.textContent = '(from saved rates)';
                            rateSourceHint.classList.remove('text-warning');
                            rateSourceHint.classList.add('text-success');
                        }
                    } else if (rateInput && !rateInput.value) {
                        rateInput.value = '1';
                        if (rateSourceHint) {
                            rateSourceHint.textContent = '(no rate found - enter manually)';
                            rateSourceHint.classList.remove('text-success');
                            rateSourceHint.classList.add('text-warning');
                        }
                    }
                } catch {
                    if (rateInput && !rateInput.value) rateInput.value = '1';
                }

                this.updateCalculations('amount');
            } else {
                if (rateGroup) rateGroup.classList.add('hidden');
                if (rateInput) rateInput.disabled = true;
                if (toAmountInput) toAmountInput.disabled = true;
                if (toAmountInput) toAmountInput.value = '';
            }
        };

        // Attach listeners
        const els = {
            from: $('#modal-tx-account'),
            to: $('#modal-tx-to-account'),
            amt: $('#modal-tx-amount'),
            rate: $('#modal-tx-exchange-rate'),
            toAmt: $('#modal-tx-to-amount'),
        };

        if (els.from) els.from.addEventListener('change', checkCurrencies);
        if (els.to) els.to.addEventListener('change', checkCurrencies);
        if (els.amt) els.amt.addEventListener('input', () => this.updateCalculations('amount'));
        if (els.rate) els.rate.addEventListener('input', () => this.updateCalculations('rate'));
        if (els.toAmt) els.toAmt.addEventListener('input', () => this.updateCalculations('toAmount'));

        // Store for toggle access
        (this as any)._checkCurrencies = checkCurrencies;
    }

    private updateCalculations(source: string): void {
        const amount = parseFloat(($('#modal-tx-amount') as HTMLInputElement).value) || 0;
        const rate = parseFloat(($('#modal-tx-exchange-rate') as HTMLInputElement)?.value) || 1;
        const toAmountInput = $('#modal-tx-to-amount') as HTMLInputElement;

        if (!toAmountInput || toAmountInput.disabled) return;

        if (source === 'amount' || source === 'rate') {
            toAmountInput.value = (amount * rate).toFixed(2);
        } else if (source === 'toAmount') {
            const toAmount = parseFloat(toAmountInput.value) || 0;
            if (amount > 0) {
                const rateInput = $('#modal-tx-exchange-rate') as HTMLInputElement;
                if (rateInput) rateInput.value = (toAmount / amount).toFixed(4);
            }
        }
    }

    /**
     * Transaction modal save handler
     */
    private setupTransactionModal(): void {
        const btnTxSave = document.getElementById('modal-tx-save');
        if (!btnTxSave) return;

        const newBtn = btnTxSave.cloneNode(true);
        btnTxSave.parentNode?.replaceChild(newBtn, btnTxSave);

        newBtn.addEventListener('click', async () => {
            const amount = parseFloat(($('#modal-tx-amount') as HTMLInputElement).value);
            const date = ($('#modal-tx-date') as HTMLInputElement).value;
            const accountId = parseInt(($('#modal-tx-account') as HTMLSelectElement).value);
            const category = ($('#modal-tx-category') as HTMLSelectElement).value;
            const description = ($('#modal-tx-desc') as HTMLInputElement).value;
            const activeSegment = document.querySelector('#transaction-modal .segment.active') as HTMLElement;
            const type = activeSegment?.dataset?.type || 'expense';

            if (!amount || amount <= 0 || !date) {
                return this.app.notifications.toast('Error', 'Please fill all required fields', 'error');
            }

            const tx: any = {
                amount,
                start_date: date,
                account_id: accountId,
                category,
                description,
                type,
                frequency: 'once',
            };

            // Handle transfer fields
            if (type === 'transfer') {
                tx.to_account_id = parseInt(($('#modal-tx-to-account') as HTMLSelectElement).value);
                tx.category = 'Transfer';
                if (tx.account_id === tx.to_account_id) {
                    return this.app.notifications.toast('Error', 'Source and destination must be different', 'error');
                }

                const rateInput = $('#modal-tx-exchange-rate') as HTMLInputElement;
                const toAmountInput = $('#modal-tx-to-amount') as HTMLInputElement;

                if (rateInput && !rateInput.disabled && rateInput.value) {
                    tx.exchange_rate = parseFloat(rateInput.value) || 1;
                    tx.to_amount = parseFloat(toAmountInput?.value) || amount * tx.exchange_rate;
                } else {
                    tx.exchange_rate = 1;
                    tx.to_amount = amount;
                }
            }

            try {
                if (this.app.state.editingTxId) {
                    await window.api.updateTransaction(this.app.state.editingTxId, tx);
                    this.app.notifications.toast('Success', 'Transaction updated');
                } else {
                    await window.api.addTransaction(tx);
                    this.app.notifications.toast('Success', 'Transaction saved');
                }

                UIUtils.setHidden('#transaction-modal', true);
                eventBus.emit('transaction:saved', undefined);
                this.app.state.editingTxId = null;
            } catch (e: any) {
                this.app.notifications.alert('Error', e.message);
            }
        });
    }

    /**
     * Account modal save handler
     */
    private setupAccountModal(): void {
        const btnAccSave = document.getElementById('save-account');
        if (!btnAccSave) return;

        const newBtn = btnAccSave.cloneNode(true);
        btnAccSave.parentNode?.replaceChild(newBtn, btnAccSave);

        newBtn.addEventListener('click', async () => {
            const name = ($('#acc-name') as HTMLInputElement).value;
            const type = ($('#acc-type') as HTMLSelectElement).value;
            const balance = parseFloat(($('#acc-balance') as HTMLInputElement).value) || 0;
            const currency = ($('#acc-currency') as HTMLSelectElement).value;

            if (!name) return this.app.notifications.toast('Error', 'Name is required', 'error');

            try {
                await window.api.addAccount({ name, type: type as any, balance, currency });
                this.app.notifications.toast('Success', 'Account created');
                UIUtils.setHidden('#account-modal', true);
                await this.app.state.loadAccounts();
                this.app.forms.updateAccountDropdowns();
                this.app.views[this.app.router.currentViewName!]?.render();
            } catch (e: any) {
                this.app.notifications.alert('Error', e.message);
            }
        });
    }

    /**
     * Category modal save handler
     */
    private setupCategoryModal(): void {
        const btnCatSave = document.getElementById('save-category');
        if (!btnCatSave) return;

        const newBtn = btnCatSave.cloneNode(true);
        btnCatSave.parentNode?.replaceChild(newBtn, btnCatSave);

        newBtn.addEventListener('click', async () => {
            const name = ($('#new-cat-name') as HTMLInputElement).value;
            const type = ($('#new-cat-type') as HTMLSelectElement).value;

            if (!name) return this.app.notifications.toast('Error', 'Name is required', 'error');

            try {
                await window.api.addCategory({ type: type as any, name });
                this.app.notifications.toast('Success', 'Category saved');
                UIUtils.setHidden('#category-modal', true);
                await this.app.state.loadCategories();
                this.app.forms.updateCategoryDropdowns();
                this.app.views[this.app.router.currentViewName!]?.render();
            } catch (e: any) {
                this.app.notifications.alert('Error', e.message);
            }
        });
    }

    /**
     * Transaction type toggle handlers (income/expense/transfer)
     */
    private setupTransactionTypeToggles(): void {
        const checkCurrencies = (this as any)._checkCurrencies;

        document.querySelectorAll('#transaction-modal .segment').forEach((seg) => {
            seg.addEventListener('click', () => {
                document.querySelectorAll('#transaction-modal .segment').forEach((s) => s.classList.remove('active'));
                seg.classList.add('active');

                const type = (seg as HTMLElement).dataset.type;
                if (type === 'transfer') {
                    UIUtils.setHidden('#modal-tx-to-account-group', false);
                    UIUtils.setHidden('#modal-tx-category', true);
                    if (checkCurrencies) checkCurrencies();
                } else {
                    UIUtils.setHidden('#modal-tx-to-account-group', true);
                    UIUtils.setHidden('#modal-tx-category', false);
                    if (checkCurrencies) checkCurrencies();
                }
            });
        });
    }
}
