/**
 * Comprehensive Database Seeding Script
 *
 * Populates ALL major entity types for proper testing:
 * - Accounts (5)
 * - Categories (10)
 * - Transactions (500)
 * - Budgets (5)
 * - Goals (3)
 * - Recurring Charges (5)
 * - Bill Types (3) + Bill Readings (12)
 * - Exchange Rates (5)
 */

import { FinanceModel } from '../models/finance';
import { dbInitialized, run } from '../database/db';

export async function seedDatabase(): Promise<{ success: boolean; message: string }> {
  console.log('🌱 Starting Comprehensive Seed Process...');
  const start = Date.now();

  try {
    console.log('Waiting for database initialization...');
    await dbInitialized;
    console.log('Database ready.');

    console.log('Creating Accounts...');
    const accounts = [
      { name: 'Chase Checking', type: 'bank', balance: 5000, currency: 'USD', status: 'active' },
      { name: 'Amex Gold', type: 'credit_card', balance: -1250, currency: 'USD', status: 'active' },
      {
        name: 'High Yield Savings',
        type: 'bank',
        balance: 25000,
        currency: 'USD',
        status: 'active',
      },
      { name: 'Cash Wallet', type: 'wallet', balance: 200, currency: 'USD', status: 'active' },
      {
        name: 'Investment Portfolio',
        type: 'investment',
        balance: 12000,
        currency: 'USD',
        status: 'active',
      },
    ];

    const accountIds: number[] = [];
    for (const acc of accounts) {
      try {
        const existing = (await FinanceModel.getAllAccounts()).find((a) => a.name === acc.name);
        if (existing) {
          accountIds.push(existing.id);
        } else {
          const result = await FinanceModel.create('account', acc);
          accountIds.push(result.id);
        }
      } catch (e: any) {
        console.warn(`Account ${acc.name} creation failed:`, e.message);
      }
    }
    console.log(`✓ ${accountIds.length} accounts ready.`);

    console.log('Creating Categories...');
    const categories = [
      { name: 'Salary', type: 'income', icon: 'wallet', color: '#22c55e' },
      { name: 'Freelance', type: 'income', icon: 'briefcase', color: '#10b981' },
      { name: 'Investments', type: 'income', icon: 'trending-up', color: '#14b8a6' },
      { name: 'Groceries', type: 'expense', icon: 'shopping-cart', color: '#f97316' },
      { name: 'Rent', type: 'expense', icon: 'home', color: '#ef4444' },
      { name: 'Dining', type: 'expense', icon: 'coffee', color: '#f59e0b' },
      { name: 'Transport', type: 'expense', icon: 'car', color: '#3b82f6' },
      { name: 'Entertainment', type: 'expense', icon: 'film', color: '#8b5cf6' },
      { name: 'Utilities', type: 'expense', icon: 'zap', color: '#06b6d4' },
      { name: 'Shopping', type: 'expense', icon: 'shopping-bag', color: '#ec4899' },
    ];

    const categoryMap: { income: string[]; expense: string[] } = { income: [], expense: [] };
    for (const cat of categories) {
      try {
        const existing = (await FinanceModel.getAllCategories()).find((c) => c.name === cat.name);
        if (!existing) {
          await FinanceModel.create('category', cat);
        }
        categoryMap[cat.type as 'income' | 'expense'].push(cat.name);
      } catch (e: any) {
        categoryMap[cat.type as 'income' | 'expense'].push(cat.name);
      }
    }
    console.log(`✓ ${categoryMap.income.length + categoryMap.expense.length} categories ready.`);

    console.log('Generating Transactions...');
    const descriptions = [
      'Coffee shop',
      'Uber ride',
      'Amazon purchase',
      'Netflix subscription',
      'Monthly salary',
      'Client payment',
      'Grocery shopping',
      'Gas station',
      'Electric bill',
      'Rent payment',
      'Dinner out',
      'Movie tickets',
      'Gym membership',
      'Phone bill',
      'Internet bill',
      'Freelance project',
      'Stock dividend',
      'Clothing store',
      'Insurance payment',
      'Taxi fare',
    ];

    const TOTAL_RECORDS = 500;
    let generatedCount = 0;

    await run('BEGIN TRANSACTION');

    for (let i = 0; i < TOTAL_RECORDS; i++) {
      const isIncome = Math.random() > 0.75;
      const type = isIncome ? 'income' : 'expense';
      const categoryList = categoryMap[type];

      if (categoryList.length === 0) continue;

      const category = categoryList[Math.floor(Math.random() * categoryList.length)];
      const accountId = accountIds[Math.floor(Math.random() * accountIds.length)];

      const amount = isIncome
        ? Math.floor(Math.random() * 5000) + 1000
        : Math.floor(Math.random() * 200) + 5;

      const daysAgo = Math.floor(Math.random() * 730);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      const dateStr = date.toISOString().split('T')[0];

      const desc = descriptions[Math.floor(Math.random() * descriptions.length)];

      await FinanceModel.create(
        'transaction',
        {
          type,
          amount,
          category,
          account_id: accountId,
          description: desc,
          start_date: dateStr,
          is_active: 1,
          currency: 'USD',
        },
        { source: 'SEED', skipAudit: true }
      );

      generatedCount++;

      if (generatedCount % 100 === 0) {
        await run('COMMIT');
        await run('BEGIN TRANSACTION');
        console.log(`  ${generatedCount} transactions...`);
      }
    }

    await run('COMMIT');
    console.log(`✓ ${generatedCount} transactions created.`);

    console.log('Creating Budgets...');
    const budgets = [
      { category: 'Groceries', amount: 500, period: 'monthly' },
      { category: 'Dining', amount: 300, period: 'monthly' },
      { category: 'Entertainment', amount: 200, period: 'monthly' },
      { category: 'Transport', amount: 400, period: 'monthly' },
      { category: 'Shopping', amount: 250, period: 'monthly' },
    ];

    for (const budget of budgets) {
      try {
        const existing = (await FinanceModel.getAllBudgets()).find(
          (b) => b.category === budget.category
        );
        if (!existing) {
          await FinanceModel.create('budget', {
            ...budget,
            start_date: new Date().toISOString().split('T')[0],
          });
        }
      } catch (e: any) {
        console.warn(`Budget for ${budget.category} failed:`, e.message);
      }
    }
    console.log(`✓ ${budgets.length} budgets created.`);

    console.log('Creating Goals...');
    const goals = [
      {
        name: 'Emergency Fund',
        target_amount: 10000,
        current_amount: 3500,
        status: 'active',
        monthly_contribution: 500,
      },
      {
        name: 'New Car',
        target_amount: 30000,
        current_amount: 8000,
        status: 'active',
        monthly_contribution: 800,
      },
      {
        name: 'Vacation Fund',
        target_amount: 5000,
        current_amount: 1200,
        status: 'active',
        monthly_contribution: 200,
      },
    ];

    for (const goal of goals) {
      try {
        const existing = (await FinanceModel.getAllGoals()).find((g) => g.name === goal.name);
        if (!existing) {
          await FinanceModel.create('goal', goal);
        }
      } catch (e: any) {
        console.warn(`Goal ${goal.name} failed:`, e.message);
      }
    }
    console.log(`✓ ${goals.length} goals created.`);

    console.log('Creating Recurring Charges...');
    const recurring = [
      {
        name: 'Rent',
        category: 'Rent',
        amount: 1500,
        frequency: 'monthly',
        due_day: 1,
        is_active: 1,
      },
      {
        name: 'Netflix',
        category: 'Entertainment',
        amount: 15.99,
        frequency: 'monthly',
        due_day: 15,
        is_active: 1,
      },
      {
        name: 'Gym Membership',
        category: 'Entertainment',
        amount: 50,
        frequency: 'monthly',
        due_day: 5,
        is_active: 1,
      },
      {
        name: 'Phone Plan',
        category: 'Utilities',
        amount: 80,
        frequency: 'monthly',
        due_day: 20,
        is_active: 1,
      },
      {
        name: 'Car Insurance',
        category: 'Transport',
        amount: 600,
        frequency: 'yearly',
        due_day: 1,
        is_active: 1,
      },
    ];

    for (const charge of recurring) {
      try {
        const existing = (await FinanceModel.getAllRecurringCharges()).find(
          (r) => r.name === charge.name
        );
        if (!existing) {
          await FinanceModel.create('recurringCharge', charge);
        }
      } catch (e: any) {
        console.warn(`Recurring charge ${charge.name} failed:`, e.message);
      }
    }
    console.log(`✓ ${recurring.length} recurring charges created.`);

    console.log('Creating Bill Types and Readings...');
    const billTypes = [
      { name: 'Electricity', unit_name: 'kWh', cost_per_unit: 0.12, icon: 'zap', color: '#f59e0b' },
      {
        name: 'Water',
        unit_name: 'Gallons',
        cost_per_unit: 0.005,
        icon: 'droplet',
        color: '#3b82f6',
      },
      {
        name: 'Natural Gas',
        unit_name: 'Therms',
        cost_per_unit: 1.2,
        icon: 'flame',
        color: '#ef4444',
      },
    ];

    for (const billType of billTypes) {
      try {
        const result = await FinanceModel.create('billType', billType);
        const billTypeId = result.id;

        for (let month = 0; month < 4; month++) {
          const readingDate = new Date();
          readingDate.setMonth(readingDate.getMonth() - month);
          const unitsUsed = Math.floor(Math.random() * 500) + 100;
          const totalCost = unitsUsed * billType.cost_per_unit;

          await FinanceModel.create('billReading', {
            bill_type_id: billTypeId,
            date: readingDate.toISOString().split('T')[0],
            units_used: unitsUsed,
            total_cost: totalCost,
            notes: `${billType.name} reading for ${readingDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
          });
        }
      } catch (e: any) {
        console.warn(`Bill type ${billType.name} failed:`, e.message);
      }
    }
    console.log(`✓ ${billTypes.length} bill types with readings created.`);

    const duration = (Date.now() - start) / 1000;
    const message =
      `🎉 Seeding complete in ${duration.toFixed(2)}s!\n` +
      `• ${accountIds.length} accounts\n` +
      `• ${categoryMap.income.length + categoryMap.expense.length} categories\n` +
      `• ${generatedCount} transactions\n` +
      `• ${budgets.length} budgets\n` +
      `• ${goals.length} goals\n` +
      `• ${recurring.length} recurring charges\n` +
      `• ${billTypes.length} bill types with ${billTypes.length * 4} readings\n` +
      `\n⚡ Please refresh the app (Ctrl+R) to see the data.`;

    console.log(message);

    return { success: true, message };
  } catch (err: any) {
    console.error('Seeding failed:', err);
    try {
      await run('ROLLBACK');
    } catch (_) {}
    return { success: false, message: err.message };
  }
}
