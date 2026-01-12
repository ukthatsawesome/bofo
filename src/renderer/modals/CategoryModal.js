import { Modal } from '../components/common/Modal.js';
import { FormGroup } from '../components/common/FormGroup.js';

export const CategoryModal = () => {
    return Modal({
        id: 'category-modal',
        title: 'Create New Category',
        content: `
            ${FormGroup({
            label: 'Category Name',
            content: '<input type="text" id="new-cat-name" class="form-control" placeholder="e.g. Groceries, Freelance...">'
        })}
            ${FormGroup({
            label: 'Category Type',
            content: `
                    <select id="new-cat-type" class="form-control">
                        <option value="income">Income</option>
                        <option value="expense">Expense</option>
                    </select>
                `
        })}
        `,
        actions: `
            <button class="btn secondary" id="cancel-category">Cancel</button>
            <button class="btn primary" id="save-category">Create Category</button>
        `
    });
};
