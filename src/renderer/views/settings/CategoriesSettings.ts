import { SortableHeader } from '../../components/tables/SortableHeader';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { TypePill } from '../../components/common/TypePill';
import type { SettingsView } from '../SettingsView';

export const CategoriesSettingsMixin = {
    // State
    categorySortField: 'name',
    categorySortDir: 'asc' as 'asc' | 'desc',
    categoryFilter: 'all',

    // Table rendering
    renderCategoryTable(this: SettingsView) {
        const { state } = this.app;
        const tbody = document.getElementById('category-table-body');
        const thead = document.getElementById('category-table-head');
        const filterContainer = document.getElementById('category-filter-container');
        if (!tbody || !thead) return;

        // Render filter
        if (filterContainer) {
            filterContainer.innerHTML = SegmentedControl({
                id: 'category-type-filter',
                onchange: 'app.views.settings.filterCategoryTable',
                options: [
                    { label: 'All', value: 'all', active: this.categoryFilter === 'all' },
                    { label: 'Income', value: 'income', active: this.categoryFilter === 'income' },
                    { label: 'Expense', value: 'expense', active: this.categoryFilter === 'expense' }
                ]
            });
        }

        // Render sortable headers
        thead.innerHTML = `<tr>
            ${SortableHeader({ label: 'Name', field: 'name', currentSort: this.categorySortField, direction: this.categorySortDir, onclick: `app.views.settings.sortCategories('name')` })}
            ${SortableHeader({ label: 'Type', field: 'type', currentSort: this.categorySortField, direction: this.categorySortDir, onclick: `app.views.settings.sortCategories('type')` })}
            ${SortableHeader({ label: 'Status', field: 'status', currentSort: this.categorySortField, direction: this.categorySortDir, onclick: `app.views.settings.sortCategories('status')` })}
            <th>Default</th>
            <th class="text-right">Actions</th>
        </tr>`;

        // Filter and sort categories
        let filtered = [...state.categories];
        if (this.categoryFilter !== 'all') {
            filtered = filtered.filter(c => c.type === this.categoryFilter);
        }

        const sorted = filtered.sort((a: any, b: any) => {
            const dir = this.categorySortDir === 'asc' ? 1 : -1;
            if (typeof a[this.categorySortField] === 'string') {
                return a[this.categorySortField].localeCompare(b[this.categorySortField]) * dir;
            }
            return (a[this.categorySortField] - b[this.categorySortField]) * dir;
        });

        tbody.innerHTML = sorted.map(cat => `
            <tr class="${cat.status === 'archived' ? 'opacity-50' : ''}">
                <td>
                    <div class="flex-row align-center gap-2">
                        <span class="text-lg">${cat.icon || '📂'}</span>
                        <strong>${cat.name}</strong>
                    </div>
                </td>
                <td>${TypePill({ type: cat.type })}</td>
                <td>
                    <span class="status-badge ${cat.status === 'archived' ? 'muted' : 'success'}">
                        ${cat.status === 'archived' ? 'Archived' : 'Active'}
                    </span>
                </td>
                <td>${cat.is_default ? '<span class="text-success">✓</span>' : ''}</td>
                <td class="text-right">
                    <div class="row-actions justify-end">
                        <button class="action-btn" onclick="app.views.settings.handleEditCategory(${cat.id})" title="Edit">
                            <i data-lucide="edit-3"></i>
                        </button>
                        ${cat.status === 'archived'
                ? `<button class="action-btn success" onclick="app.views.settings.handleUnarchiveCategory(${cat.id})" title="Restore">
                                <i data-lucide="archive-restore"></i>
                               </button>`
                : `<button class="action-btn warning" onclick="app.views.settings.handleArchiveCategory(${cat.id})" title="Archive">
                                <i data-lucide="archive"></i>
                               </button>`
            }
                        ${!cat.is_default ? `
                            <button class="action-btn danger" onclick="app.views.settings.handleDeleteCategory(${cat.id})" title="Delete">
                                <i data-lucide="trash-2"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');

        this.refreshIcons();
    },

    sortCategories(this: SettingsView, field: string) {
        if (this.categorySortField === field) {
            this.categorySortDir = this.categorySortDir === 'asc' ? 'desc' : 'asc';
        } else {
            this.categorySortField = field;
            this.categorySortDir = 'asc';
        }
        this.renderCategoryTable();
    },

    filterCategoryTable(this: SettingsView, type: string) {
        this.categoryFilter = type;
        this.renderCategoryTable();
    },

    // CRUD handlers
    handleNewCategory(this: SettingsView) {
        this.showCategoryModal();
    },

    async handleEditCategory(this: SettingsView, id: number) {
        const category = this.app.state.categories.find(c => c.id === id);
        if (category) this.showCategoryModal(category);
    },

    showCategoryModal(this: SettingsView, category: any = null) {
        const isEdit = !!category;
        const { notifications } = this.app;

        notifications.modal({
            title: isEdit ? 'Edit Category' : 'New Category',
            content: `
                <div class="form-group">
                    <label>Category Name</label>
                    <input type="text" id="cat-name" class="form-control" value="${category?.name || ''}" placeholder="e.g. Groceries">
                </div>
                <div class="form-group">
                    <label>Type</label>
                    <select id="cat-type" class="form-control" ${isEdit ? 'disabled' : ''}>
                        <option value="income" ${category?.type === 'income' ? 'selected' : ''}>Income</option>
                        <option value="expense" ${category?.type === 'expense' ? 'selected' : ''}>Expense</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Icon (emoji)</label>
                    <input type="text" id="cat-icon" class="form-control" value="${category?.icon || '📂'}" maxlength="4">
                </div>
            `,
            confirmText: isEdit ? 'Save Changes' : 'Create Category',
            onConfirm: async () => {
                const name = (document.getElementById('cat-name') as HTMLInputElement).value.trim();
                const type = (document.getElementById('cat-type') as HTMLSelectElement).value;
                const icon = (document.getElementById('cat-icon') as HTMLInputElement).value || '📂';

                if (!name) {
                    notifications.toast('Error', 'Category name is required', 'error');
                    return false;
                }

                try {
                    if (isEdit) {
                        await window.api.updateCategory({ id: category.id, data: { name, icon } });
                    } else {
                        await window.api.addCategory({ type, name });
                        // Update icon after creation
                        const created = (await window.api.getCategories()).find(c => c.name === name);
                        if (created) {
                            await window.api.updateCategory({ id: created.id, data: { icon } });
                        }
                    }
                    await this.app.loadData();
                    this.renderCategoryTable();
                    notifications.toast('Success', isEdit ? 'Category updated' : 'Category created', 'success');
                } catch (error: any) {
                    notifications.toast('Error', error.message, 'error');
                    return false;
                }
            }
        });
    },

    async handleDeleteCategory(this: SettingsView, id: number) {
        const { notifications } = this.app;
        const category = this.app.state.categories.find(c => c.id === id);
        if (!category) return;

        const inUse = await window.api.isCategoryInUse(category.name);
        if (inUse) {
            notifications.toast('Cannot Delete', 'This category has transactions. Archive it instead.', 'warning');
            return;
        }

        if (await notifications.confirm('Delete Category', `Delete "${category.name}"? This cannot be undone.`)) {
            try {
                await window.api.deleteCategory(id);
                await this.app.loadData();
                this.renderCategoryTable();
                notifications.toast('Deleted', 'Category removed', 'success');
            } catch (error: any) {
                notifications.toast('Error', error.message, 'error');
            }
        }
    },

    async handleArchiveCategory(this: SettingsView, id: number) {
        try {
            await window.api.archiveCategory(id);
            await this.app.loadData();
            this.renderCategoryTable();
            this.app.notifications.toast('Archived', 'Category archived', 'success');
        } catch (error: any) {
            this.app.notifications.toast('Error', error.message, 'error');
        }
    },

    async handleUnarchiveCategory(this: SettingsView, id: number) {
        try {
            await window.api.unarchiveCategory(id);
            await this.app.loadData();
            this.renderCategoryTable();
            this.app.notifications.toast('Restored', 'Category restored', 'success');
        } catch (error: any) {
            this.app.notifications.toast('Error', error.message, 'error');
        }
    }
};
