import { BaseView } from '../../app/BaseView';
import { $, $$, UIUtils } from '../../lib/dom';
import { StatCard } from '../../components/ui/StatCard';
import { GoalCard } from '../../components/ui/GoalCard';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { EmptyState } from '../../components/ui/EmptyState';
import { ViewHeader } from '../../components/ui/ViewHeader';
import type { App } from '../../app/App';

export class GoalsView extends BaseView {
  private filter: 'active' | 'completed' | 'all' = 'active';
  private goals: any[] = [];
  private summary: any = null;
  private available: any = null;

  constructor(app: App) {
    super(app, 'goals');
  }

  async onShow(): Promise<void> {
    if (!this.isInitialized) {
      this.renderBaseTemplate();
      this.setupListeners();
      this.isInitialized = true;
    }
    await this.loadData();
    this.render();
  }

  async loadData(): Promise<void> {
    this.goals = await window.api.getGoals();
    this.summary = await window.api.getGoalsSummary();
    this.available = await window.api.getAvailableForGoals();
  }

  renderBaseTemplate(): void {
    if (!this.element) return;
    this.element.innerHTML = `
            ${ViewHeader({
      title: 'Savings Goals',
      subtitle: 'Track your progress towards financial milestones',
      actions: `
                    <div id="goals-filter-container"></div>
                    <button class="btn primary" id="btn-add-goal">
                        <i data-lucide="plus"></i>
                        New Goal
                    </button>
                `,
    })}

            <div id="goals-stats-container" class="stats-grid mb-6"></div>

            <!-- Available for Goals Card -->
            <div id="goals-available-card" class="mb-6"></div>

            <div id="goals-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"></div>

            <!-- Goal Modal -->
            <div id="goal-modal" class="modal hidden">
                <div class="modal-content max-w-lg">
                    <button class="close" id="close-goal-modal">&times;</button>
                    <h2 id="goal-modal-title">New Goal</h2>
                    <form id="goal-form" class="mt-6">
                        <input type="hidden" id="goal-id">
                        
                        <div class="form-group">
                            <label>Goal Name</label>
                            <input type="text" id="goal-name" class="form-control" placeholder="e.g., New Laptop" required>
                        </div>

                        <div class="form-group">
                            <label>Description (optional)</label>
                            <input type="text" id="goal-description" class="form-control" placeholder="MacBook Pro 14-inch">
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="form-group">
                                <label>Target Amount</label>
                                <input type="number" id="goal-target" class="form-control" step="0.01" min="1" required>
                            </div>
                            <div class="form-group">
                                <label>Monthly Contribution</label>
                                <input type="number" id="goal-monthly" class="form-control" step="0.01" min="0">
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="form-group">
                                <label>Target Date (optional)</label>
                                <input type="date" id="goal-target-date" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>Priority</label>
                                <select id="goal-priority" class="form-control">
                                    <option value="1">High</option>
                                    <option value="2">Medium</option>
                                    <option value="3">Low</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Icon</label>
                            <div id="goal-icon-picker" class="flex flex-wrap gap-2">
                                ${[
        'target',
        'laptop',
        'car',
        'home',
        'plane',
        'gift',
        'heart',
        'piggy-bank',
        'graduation-cap',
        'briefcase',
        'gem',
        'trophy',
      ]
        .map(
          (icon) => `
                                        <button type="button" class="icon-btn w-10 h-10 rounded-lg border border-border flex items-center justify-center
                                                      hover:border-brand-primary hover:text-brand-primary transition-all" 
                                                data-icon="${icon}">
                                            <i data-lucide="${icon}" class="w-5 h-5"></i>
                                        </button>
                                    `
        )
        .join('')}
                            </div>
                            <input type="hidden" id="goal-icon" value="target">
                        </div>

                        <div class="flex justify-end gap-3 mt-6">
                            <button type="button" class="btn secondary" id="cancel-goal">Cancel</button>
                            <button type="submit" class="btn primary">Save Goal</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Contribute Modal -->
            <div id="contribute-modal" class="modal hidden">
                <div class="modal-content max-w-md">
                    <button class="close" id="close-contribute-modal">&times;</button>
                    <h2>Contribute to Goal</h2>
                    <p id="contribute-goal-name" class="text-muted mb-6"></p>
                    
                    <form id="contribute-form">
                        <input type="hidden" id="contribute-goal-id">
                        
                        <div class="form-group">
                            <label>Amount</label>
                            <input type="number" id="contribute-amount" class="form-control" step="0.01" min="0.01" required>
                        </div>

                        <div class="form-group">
                            <label>Source (optional)</label>
                            <input type="text" id="contribute-source" class="form-control" placeholder="e.g., Salary, Bonus">
                        </div>

                        <div class="form-group">
                            <label>Notes (optional)</label>
                            <input type="text" id="contribute-notes" class="form-control" placeholder="Any notes...">
                        </div>

                        <div class="flex justify-end gap-3 mt-6">
                            <button type="button" class="btn secondary" id="cancel-contribute">Cancel</button>
                            <button type="submit" class="btn primary">Add Contribution</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    this.refreshIcons();
  }

  setupListeners(): void {
    // Add Goal
    $('#btn-add-goal')?.addEventListener('click', () => this.openGoalModal());
    $('#close-goal-modal')?.addEventListener('click', () => this.closeGoalModal());
    $('#cancel-goal')?.addEventListener('click', () => this.closeGoalModal());

    // Goal Form
    $('#goal-form')?.addEventListener('submit', (e: Event) => {
      e.preventDefault();
      this.saveGoal();
    });

    // Icon Picker
    $('#goal-icon-picker')?.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('[data-icon]') as HTMLElement;
      if (btn) {
        $$('#goal-icon-picker .icon-btn').forEach((b) =>
          b.classList.remove('border-brand-primary', 'text-brand-primary', 'bg-brand-primary/10')
        );
        btn.classList.add('border-brand-primary', 'text-brand-primary', 'bg-brand-primary/10');
        const iconInput = $('#goal-icon') as HTMLInputElement;
        if (iconInput) iconInput.value = btn.dataset.icon || 'target';
      }
    });

    // Contribute Modal
    $('#close-contribute-modal')?.addEventListener('click', () => this.closeContributeModal());
    $('#cancel-contribute')?.addEventListener('click', () => this.closeContributeModal());
    $('#contribute-form')?.addEventListener('submit', (e: Event) => {
      e.preventDefault();
      this.submitContribution();
    });
  }

  async render(): Promise<void> {
    const { formatter } = this.app;

    // Filter Goals
    const filterContainer = $('#goals-filter-container');
    if (filterContainer && !filterContainer.innerHTML.trim()) {
      filterContainer.innerHTML = SegmentedControl({
        id: 'goals-filter',
        onchange: 'app.views.goals.handleFilterChange',
        options: [
          { label: 'Active', value: 'active', active: this.filter === 'active' },
          { label: 'Completed', value: 'completed', active: this.filter === 'completed' },
          { label: 'All', value: 'all', active: this.filter === 'all' },
        ],
      });
    } else if (filterContainer) {
      filterContainer.querySelectorAll('.segment').forEach((btn) => {
        const el = btn as HTMLElement;
        el.classList.toggle('active', el.dataset.value === this.filter);
      });
    }

    // Stats
    const statsContainer = $('#goals-stats-container');
    if (statsContainer && this.summary) {
      statsContainer.innerHTML = `
                ${StatCard({
        label: 'Active Goals',
        value: this.summary.activeGoals,
        icon: 'target',
      })}
                ${StatCard({
        label: 'Total Saved',
        value: formatter.formatCurrency(this.summary.totalSaved),
        icon: 'piggy-bank',
        trend: { type: 'up', value: `${this.summary.totalProgress.toFixed(1)}%` },
      })}
                ${StatCard({
        label: 'Total Target',
        value: formatter.formatCurrency(this.summary.totalTarget),
        icon: 'flag',
      })}
                ${StatCard({
        label: 'Monthly Allocation',
        value: formatter.formatCurrency(this.summary.totalMonthlyContribution),
        icon: 'calendar-check',
      })}
            `;
    }

    // Available for Goals Card
    const availableCard = $('#goals-available-card');
    if (availableCard && this.available) {
      const availableAmount = this.available.available || 0;
      availableCard.innerHTML = `
                <div class="card-glass p-5">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center text-success">
                                <i data-lucide="wallet" class="w-6 h-6"></i>
                            </div>
                            <div>
                                <p class="text-sm text-text-muted">Available for New Goals</p>
                                <p class="text-2xl font-bold ${availableAmount >= 0 ? 'text-success' : 'text-danger'}">
                                    ${formatter.formatCurrency(availableAmount)}/month
                                </p>
                            </div>
                        </div>
                        <div class="text-right text-sm text-text-muted">
                            <p>Income: ${formatter.formatCurrency(this.available.avgMonthlyIncome)}</p>
                            <p>- Fixed: ${formatter.formatCurrency(this.available.recurringCharges)}</p>
                            <p>- Goals: ${formatter.formatCurrency(this.available.goalContributions)}</p>
                        </div>
                    </div>
                </div>
            `;
    }

    // Goals Grid
    const grid = $('#goals-grid');
    if (grid) {
      let filteredGoals = this.goals || [];
      if (this.filter === 'active') {
        filteredGoals = filteredGoals.filter((g) => g.status === 'active');
      } else if (this.filter === 'completed') {
        filteredGoals = filteredGoals.filter((g) => g.status === 'completed');
      }

      if (filteredGoals.length === 0) {
        grid.innerHTML = `
                    <div class="col-span-full">
                        ${EmptyState({
          icon: 'target',
          title:
            this.filter === 'completed' ? 'No completed goals yet' : 'No goals yet',
          message:
            this.filter === 'completed'
              ? 'Complete your first goal to see it here!'
              : 'Start by creating your first savings goal',
          action: {
            label: 'Create Goal',
            onclick: 'app.views.goals.openGoalModal()',
          },
        })}
                    </div>
                `;
      } else {
        grid.innerHTML = filteredGoals
          .map((goal) =>
            GoalCard({
              ...goal,
              formatter,
              onContribute: 'app.views.goals.openContributeModal',
              onEdit: 'app.views.goals.editGoal',
              onDelete: 'app.views.goals.deleteGoal',
            })
          )
          .join('');
      }
    }

    this.refreshIcons('#goals-stats-container');
    this.refreshIcons('#goals-available-card');
    this.refreshIcons('#goals-grid');
  }

  handleFilterChange(val: 'active' | 'completed' | 'all'): void {
    this.filter = val;
    this.render();
  }

  // Goal Modal Functions
  openGoalModal(goalId: number | null = null): void {
    const modal = $('#goal-modal');
    const form = $('#goal-form') as HTMLFormElement;

    if (goalId) {
      const goal = this.goals.find((g) => g.id === goalId);
      if (goal) {
        const title = $('#goal-modal-title');
        if (title) title.textContent = 'Edit Goal';
        ($('#goal-id') as HTMLInputElement).value = goal.id;
        ($('#goal-name') as HTMLInputElement).value = goal.name;
        ($('#goal-description') as HTMLInputElement).value = goal.description || '';
        ($('#goal-target') as HTMLInputElement).value = goal.target_amount;
        ($('#goal-monthly') as HTMLInputElement).value = goal.monthly_contribution || '';
        ($('#goal-target-date') as HTMLInputElement).value = goal.target_date || '';
        ($('#goal-priority') as HTMLSelectElement).value = goal.priority || 1;
        ($('#goal-icon') as HTMLInputElement).value = goal.icon || 'target';

        // Highlight selected icon
        $$('#goal-icon-picker .icon-btn').forEach((b) => {
          const btn = b as HTMLElement;
          btn.classList.toggle('border-brand-primary', btn.dataset.icon === goal.icon);
          btn.classList.toggle('text-brand-primary', btn.dataset.icon === goal.icon);
          btn.classList.toggle('bg-brand-primary/10', btn.dataset.icon === goal.icon);
        });
      }
    } else {
      const title = $('#goal-modal-title');
      if (title) title.textContent = 'New Goal';
      form?.reset();
      const idInput = $('#goal-id') as HTMLInputElement;
      if (idInput) idInput.value = '';
      const iconInput = $('#goal-icon') as HTMLInputElement;
      if (iconInput) iconInput.value = 'target';
      $$('#goal-icon-picker .icon-btn').forEach((b) =>
        b.classList.remove('border-brand-primary', 'text-brand-primary', 'bg-brand-primary/10')
      );
      const targetBtn = $('#goal-icon-picker .icon-btn[data-icon="target"]');
      if (targetBtn)
        targetBtn.classList.add(
          'border-brand-primary',
          'text-brand-primary',
          'bg-brand-primary/10'
        );
    }

    modal?.classList.remove('hidden');
    this.refreshIcons();
  }

  closeGoalModal(): void {
    $('#goal-modal')?.classList.add('hidden');
  }

  async saveGoal(): Promise<void> {
    const id = ($('#goal-id') as HTMLInputElement).value;
    const name = ($('#goal-name') as HTMLInputElement).value?.trim();
    const targetAmount = parseFloat(($('#goal-target') as HTMLInputElement).value);

    // Validation
    if (!name) {
      this.app.notifications.toast('Error', 'Goal name is required', 'error');
      return;
    }
    if (!targetAmount || targetAmount <= 0) {
      this.app.notifications.toast('Error', 'Please enter a valid target amount', 'error');
      return;
    }

    const data: any = {
      name,
      description: ($('#goal-description') as HTMLInputElement).value || null,
      target_amount: targetAmount,
      monthly_contribution: parseFloat(($('#goal-monthly') as HTMLInputElement).value) || 0,
      target_date: ($('#goal-target-date') as HTMLInputElement).value || null,
      priority: parseInt(($('#goal-priority') as HTMLSelectElement).value),
      icon: ($('#goal-icon') as HTMLInputElement).value,
    };

    try {
      if (id) {
        await window.api.updateGoal(parseInt(id), data);
        this.app.notifications.toast('Goal Updated', `"${data.name}" has been updated`);
      } else {
        await window.api.createGoal(data);
        this.app.notifications.toast(
          'Goal Created',
          `"${data.name}" is now being tracked!`,
          'success'
        );
      }

      this.closeGoalModal();
      await this.loadData();
      this.render();
    } catch (error) {
      console.error('Failed to save goal:', error);
      this.app.notifications.toast('Error', 'Failed to save goal', 'error');
    }
  }

  editGoal(id: number): void {
    this.openGoalModal(id);
  }

  async deleteGoal(id: number): Promise<void> {
    const goal = this.goals.find((g) => g.id === id);
    if (!goal) return;

    const confirmed = await this.app.notifications.confirm(
      'Delete Goal?',
      `Are you sure you want to delete "${goal.name || 'Goal'}"? This cannot be undone.`
    );

    if (confirmed) {
      await window.api.deleteGoal(id);
      this.app.notifications.toast('Goal Deleted', `"${goal.name || 'Goal'}" has been removed`);
      await this.loadData();
      this.render();
    }
  }

  // Contribute Modal Functions
  openContributeModal(goalId: number): void {
    const goal = this.goals.find((g) => g.id === goalId);
    if (!goal) return;

    const id = $('#contribute-goal-id') as HTMLInputElement;
    if (id) id.value = goalId.toString();
    const name = $('#contribute-goal-name');
    if (name) name.textContent = `Contributing to: ${goal.name}`;
    ($('#contribute-form') as HTMLFormElement)?.reset();
    $('#contribute-modal')?.classList.remove('hidden');
  }

  closeContributeModal(): void {
    $('#contribute-modal')?.classList.add('hidden');
  }

  async submitContribution(): Promise<void> {
    const goalId = parseInt(($('#contribute-goal-id') as HTMLInputElement).value);
    const amount = parseFloat(($('#contribute-amount') as HTMLInputElement).value);
    const source = ($('#contribute-source') as HTMLInputElement).value || null;
    const notes = ($('#contribute-notes') as HTMLInputElement).value || null;

    // Validation
    if (!amount || amount <= 0) {
      this.app.notifications.toast('Error', 'Please enter a valid contribution amount', 'error');
      return;
    }

    try {
      await window.api.contributeToGoal(goalId, amount, source, notes);

      const goal = this.goals.find((g) => g.id === goalId);
      this.app.notifications.toast(
        'Contribution Added',
        `${this.app.formatter.formatCurrency(amount)} added to "${goal?.name || 'Goal'}"`,
        'success'
      );

      this.closeContributeModal();
      await this.loadData();
      this.render();
    } catch (error) {
      console.error('Failed to add contribution:', error);
      this.app.notifications.toast('Error', 'Failed to add contribution', 'error');
    }
  }
}
