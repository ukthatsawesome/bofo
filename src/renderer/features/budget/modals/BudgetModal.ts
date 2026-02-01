import { Modal } from '../../../components/ui/Modal';
import { FormGroup } from '../../../components/ui/FormGroup';

interface Category {
  name: string;
}

interface BudgetModalProps {
  categories: Category[];
}

export const BudgetModal = ({ categories }: BudgetModalProps): string => {
  return Modal({
    id: 'budget-modal',
    title: 'Create Budget',
    content: `
            ${FormGroup({
      label: 'Category',
      content: `
                    <select id="budget-category" class="form-control">
                        ${categories.map((c) => `<option value="${c.name}">${c.name}</option>`).join('')}
                    </select>
                `,
    })}
            ${FormGroup({
      label: 'Budget Limit',
      content:
        '<input type="number" id="budget-limit" class="form-control" step="0.01" placeholder="0.00">',
    })}
            ${FormGroup({
      label: 'Period',
      content: `
                    <select id="budget-period" class="form-control">
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                        <option value="yearly">Yearly</option>
                    </select>
                `,
    })}
            <div class="grid grid-cols-2 gap-4">
                ${FormGroup({
      label: 'Start Date',
      className: 'mb-0',
      content: '<input type="date" id="budget-start" class="form-control">',
    })}
                ${FormGroup({
      label: 'End Date',
      className: 'mb-0',
      content: '<input type="date" id="budget-end" class="form-control">',
    })}
            </div>
        `,
    actions: `
            <button class="btn secondary" id="cancel-budget">Cancel</button>
            <button class="btn primary" id="save-budget">Save Budget</button>
        `,
  });
};
