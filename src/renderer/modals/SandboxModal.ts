import { Modal } from '../components/common/Modal';
import { FormGroup } from '../components/common/FormGroup';

export const SandboxModal = (): string => {
    return Modal({
        id: 'sandbox-modal',
        title: 'Simulation Parameters',
        content: `
            <p class="text-muted mb-4">Adjust these values to see how they impact your financial future.</p>
            <div class="modal-grid">
                ${FormGroup({
            label: 'Monthly Investment',
            content: '<input type="number" id="sim-investment" class="form-control" step="100" value="500">'
        })}
                ${FormGroup({
            label: 'Expected Return (%)',
            content: '<input type="number" id="sim-return" class="form-control" step="0.1" value="7.0">'
        })}
                ${FormGroup({
            label: 'Inflation Rate (%)',
            content: '<input type="number" id="sim-inflation" class="form-control" step="0.1" value="2.5">'
        })}
                ${FormGroup({
            label: 'Retirement Goal',
            content: '<input type="number" id="sim-goal" class="form-control" step="10000" value="1000000">'
        })}
            </div>
        `,
        actions: `
            <button class="btn secondary" id="cancel-sim">Cancel</button>
            <button class="btn primary" id="run-sim">Run Simulation</button>
        `
    });
};
