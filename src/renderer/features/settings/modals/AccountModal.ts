import { Modal } from '../../../components/ui/Modal';
import { FormGroup } from '../../../components/ui/FormGroup';

export const AccountModal = (): string => {
  return Modal({
    id: 'account-modal',
    title: 'Setup New Account',
    content: `
            ${FormGroup({
      label: 'Account Name',
      content:
        '<input type="text" id="acc-name" class="form-control" placeholder="e.g. Main Bank, My Wallet...">',
    })}
            ${FormGroup({
      label: 'Account Type',
      content: `
                    <select id="acc-type" class="form-control">
                        <option value="bank">Bank Account</option>
                        <option value="wallet">Wallet</option>
                        <option value="credit_card">Credit Card</option>
                        <option value="loan">Loan</option>
                        <option value="investment">Investment</option>
                    </select>
                `,
    })}
            ${FormGroup({
      label: 'Initial Balance',
      content:
        '<input type="number" id="acc-balance" class="form-control" step="0.01" value="0.00">',
    })}
            ${FormGroup({
      label: 'Currency',
      content: '<select id="acc-currency" class="form-control currency-select"></select>',
    })}
        `,
    actions: `
            <button class="btn secondary" id="cancel-account">Cancel</button>
            <button class="btn primary" id="save-account">Create Account</button>
        `,
  });
};
