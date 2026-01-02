import { Modal } from '../components/common/Modal.js';
import { FormGroup } from '../components/common/FormGroup.js';

export const BudgetModal = ({ categories }) => {
    return Modal({
        id: 'budget-modal',
        title: 'Create Budget',
        content: `
            ${FormGroup({
                label: 'Category',
                content: `
                    <select id="budget-category">
                        ${categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                    </select>
                `
            })}
            ${FormGroup({
                label: 'Monthly Limit',
                content: '<input type="number" id="budget-limit" step="0.01" placeholder="0.00">'
            })}
            ${FormGroup({
                label: 'Period',
                content: `
                    <select id="budget-period">
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                        <option value="yearly">Yearly</option>
                    </select>
                `
            })}
            <div class="flex-row gap-4">
                ${FormGroup({
                    label: 'Start Date',
                    content: '<input type="date" id="budget-start">'
                })}
                ${FormGroup({
                    label: 'End Date',
                    content: '<input type="date" id="budget-end">'
                })}
            </div>
        `,
        actions: `
            <button class="btn" id="cancel-budget">Cancel</button>
            <button class="btn primary" id="save-budget">Save Budget</button>
        `
    });
};
