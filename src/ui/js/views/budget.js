class BudgetView extends BaseView {
    constructor(app) {
        super(app, 'budget');
        this.isInitialized = false;
        this.editingBudgetId = null;
    }

    async onShow() {
        if (!this.isInitialized) {
            this.setupEventListeners();
            this.isInitialized = true;
        }

        const { state } = this.app;
        const monthFilter = $('#budget-month-filter');
        if (monthFilter) {
            monthFilter.value = state.budgetViewMonth;
            UIUtils.setHidden('#budget-month-filter-container', state.budgetViewFilter === 'active');
        }

        $$('.view-toggle .toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === state.budgetViewFilter);
        });

        await this.render();
    }

    async render() {
        const { state, formatter } = this.app;
        await state.loadBudgets();
        await state.loadTransactions();

        const container = $('#budget-list');
        if (!container) return;

        const now = new Date();
        const today = now.toISOString().split('T')[0];

        let filteredBudgets = [];
        let viewMonthStart, viewMonthEnd;

        if (state.budgetViewFilter === 'active') {
            filteredBudgets = state.budgets.filter(b => b.start_date <= today && b.end_date >= today);
            viewMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            viewMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else {
            const [year, month] = state.budgetViewMonth.split('-').map(Number);
            viewMonthStart = new Date(year, month - 1, 1);
            viewMonthEnd = new Date(year, month, 0);
            const monthStr = state.budgetViewMonth;

            filteredBudgets = state.budgets.filter(b => {
                const bStart = b.start_date.slice(0, 7);
                const bEnd = b.end_date.slice(0, 7);
                return monthStr >= bStart && monthStr <= bEnd;
            });
        }

        let totalBudgeted = 0;
        let totalSpent = 0;

        if (filteredBudgets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="piggy-bank"></i>
                    <p>No ${state.budgetViewFilter} budgets found for this period.</p>
                    <button class="btn primary" onclick="app.views.budget.showBudgetModal()">✨ Add Budget</button>
                </div>
            `;
            this.updateSummary(0, 0);
            this.refreshIcons();
            return;
        }

        container.innerHTML = filteredBudgets.map(budget => {
            const bStart = new Date(budget.start_date);
            const bEnd = new Date(budget.end_date);
            const calcStart = bStart > viewMonthStart ? bStart : viewMonthStart;
            const calcEnd = bEnd < viewMonthEnd ? bEnd : viewMonthEnd;

            const spent = state.transactions
                .filter(t => t.category === budget.category && t.type === 'expense')
                .filter(t => {
                    const tDate = new Date(t.start_date);
                    return tDate >= calcStart && tDate <= calcEnd;
                })
                .reduce((sum, t) => sum + t.amount, 0);

            totalBudgeted += budget.amount;
            totalSpent += spent;

            const percent = Math.min((spent / budget.amount) * 100, 100);
            const isOver = spent > budget.amount;
            const remaining = budget.amount - spent;

            return `
                <div class="budget-card ${isOver ? 'over-budget' : ''}">
                    <div class="budget-card-header">
                        <div>
                            <h3>${budget.category}</h3>
                            <span class="budget-period-badge">${budget.period} | ${budget.start_date} to ${budget.end_date}</span>
                        </div>
                        <div class="budget-actions">
                            <button class="action-btn" onclick="app.views.budget.handleEdit(${budget.id})">
                                <i data-lucide="edit-3"></i>
                            </button>
                            <button class="action-btn danger" onclick="app.views.budget.handleDeleteBudget(${budget.id})">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </div>
                    <div class="budget-amounts">
                        <span class="spent">${formatter.formatCurrency(spent)} spent</span>
                        <span class="limit">of ${formatter.formatCurrency(budget.amount)}</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar ${this.getProgressColor(percent)}" style="width: ${percent}%"></div>
                    </div>
                    <div class="budget-footer">
                        <span class="${remaining < 0 ? 'text-danger' : 'text-success'}">
                            ${remaining < 0 ? 'Over by ' : 'Remaining: '} ${formatter.formatCurrency(Math.abs(remaining))}
                        </span>
                    </div>
                </div>
            `;
        }).join('');

        this.updateSummary(totalBudgeted, totalSpent);
        this.refreshIcons();
    }

    updateSummary(budgeted, spent) {
        const remaining = budgeted - spent;
        const fmt = this.app.formatter;

        const budgetedEl = $('#total-budgeted-amt');
        const spentEl = $('#total-spent-amt');
        const remainingEl = $('#net-remaining-amt');

        if (budgetedEl) budgetedEl.innerText = fmt.formatCurrency(budgeted);
        if (spentEl) spentEl.innerText = fmt.formatCurrency(spent);
        if (remainingEl) {
            remainingEl.innerText = fmt.formatCurrency(Math.abs(remaining));
            remainingEl.className = remaining < 0 ? 'text-danger' : 'text-success';
        }
    }

    getProgressColor(percent) {
        if (percent >= 100) return 'progress-danger';
        if (percent >= 80) return 'progress-warning';
        return 'progress-success';
    }

    setupEventListeners() {
        const { state } = this.app;

        $('#budget-month-filter')?.addEventListener('change', (e) => {
            state.budgetViewMonth = e.target.value;
            this.render();
        });

        $$('.view-toggle .toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.budgetViewFilter = btn.dataset.filter;
                $$('.view-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                UIUtils.setHidden('#budget-month-filter-container', state.budgetViewFilter === 'active');
                this.render();
            });
        });

        const form = $('#budget-form');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const category = $('#budget-category').value;
                const amount = parseFloat($('#budget-limit').value);
                const period = $('#budget-period').value;
                const startDate = $('#budget-start-date').value;
                const endDate = $('#budget-end-date').value;

                try {
                    if (this.editingBudgetId) {
                        await window.api.updateBudget(this.editingBudgetId, category, amount, period, startDate, endDate);
                        notifications.toast('Budget Updated', `${category} limit updated`, 'success');
                    } else {
                        await window.api.setBudget(category, amount, period, startDate, endDate);
                        notifications.toast('Budget Created', `${category} limit set`, 'success');
                    }

                    this.hideBudgetModal();
                    await this.render();
                } catch (err) {
                    notifications.alert('Error', err.message, 'error');
                }
            };
        }

        const startInput = $('#budget-start-date');
        const periodInput = $('#budget-period');
        const endInput = $('#budget-end-date');

        const updateEndDate = () => {
            if (!startInput?.value) return;
            const start = new Date(startInput.value);
            let end;

            switch (periodInput?.value) {
                case 'weekly':
                    end = new Date(start);
                    end.setDate(start.getDate() + 6);
                    break;
                case 'monthly':
                    end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
                    break;
                case 'yearly':
                    end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate() - 1);
                    break;
                default: return;
            }
            if (endInput) endInput.value = end.toISOString().split('T')[0];
        };

        startInput?.addEventListener('change', updateEndDate);
        periodInput?.addEventListener('change', updateEndDate);

        $('#close-budget-modal')?.addEventListener('click', () => this.hideBudgetModal());
        $('#cancel-budget')?.addEventListener('click', () => this.hideBudgetModal());
        $('#btn-add-budget')?.addEventListener('click', () => this.showBudgetModal());
    }

    handleEdit(id) {
        const b = this.app.state.budgets.find(item => item.id == id);
        if (!b) return;

        this.editingBudgetId = id;
        this.showBudgetModal(b.category, b.amount, b.period, b.start_date, b.end_date);
        $('#budget-modal h2').innerText = 'Edit Budget';
    }

    showBudgetModal(category = '', amount = '', period = 'monthly', start = '', end = '') {
        const catInput = $('#budget-category');
        const amtInput = $('#budget-limit');
        const perInput = $('#budget-period');
        const startInput = $('#budget-start-date');
        const endInput = $('#budget-end-date');

        // Populate category dropdown if needed
        if (catInput && catInput.options.length <= 1) {
            catInput.innerHTML = '<option value="" disabled selected>Select Category</option>' +
                this.app.state.categories
                    .filter(c => c.type === 'expense')
                    .map(c => `<option value="${c.name}">${c.name}</option>`)
                    .join('');
        }

        if (catInput) catInput.value = category;
        if (amtInput) amtInput.value = amount;
        if (perInput) perInput.value = period;

        if (!this.editingBudgetId) {
            $('#budget-modal h2').innerText = 'Set New Budget';
            const now = new Date();
            if (startInput) startInput.value = start || now.toISOString().split('T')[0];
            if (endInput) {
                if (end) endInput.value = end;
                else {
                    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    endInput.value = lastDay.toISOString().split('T')[0];
                }
            }
        } else {
            if (startInput) startInput.value = start;
            if (endInput) endInput.value = end;
        }

        UIUtils.setHidden('#budget-modal', false);
    }

    hideBudgetModal() {
        this.editingBudgetId = null;
        UIUtils.setHidden('#budget-modal', true);
    }

    async handleDeleteBudget(id) {
        if (await notifications.confirm('Delete Budget', 'Remove this budget limit?')) {
            await window.api.deleteBudget(id);
            await this.render();
            notifications.toast('Budget Removed', 'Budget limit has been cleared', 'success');
        }
    }
}

window.BudgetView = BudgetView;
