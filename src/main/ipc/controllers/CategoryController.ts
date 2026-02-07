import { BaseController } from './BaseController';
import { Route } from '../router';

export class CategoryController extends BaseController {
    registerRoutes(): Record<string, Route> {
        return {
            'get-categories': () => this.getFinanceModel().getAll('category', { orderBy: 'name ASC' }),

            'add-category': (_, data) => this.getFinanceModel().create('category', data),

            'update-category': (_, { id, data }) => this.getFinanceModel().update('category', id, data),

            'delete-category': (_, id) => this.getFinanceModel().delete('category', id),

            'archive-category': async (_, id) => {
                const category = await this.getFinanceModel().getById('category', id);
                if (!category) throw new Error('Category not found');
                return this.getFinanceModel().update('category', id, { ...category, is_active: 0 });
            },

            'unarchive-category': async (_, id) => {
                const category = await this.getFinanceModel().getById('category', id);
                if (!category) throw new Error('Category not found');
                return this.getFinanceModel().update('category', id, { ...category, is_active: 1 });
            },

            'is-category-in-use': (_, name) => this.getFinanceModel().isCategoryInUse(name),
        };
    }
}
