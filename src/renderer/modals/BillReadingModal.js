export const BillReadingModal = ({ billTypes }) => {
    return `
        <div id="bill-reading-modal" class="modal hidden">
            <div class="modal-content glass">
                <div class="modal-header">
                    <h2>Record New Reading</h2>
                    <button class="close"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group full-width">
                            <label>Bill Type</label>
                            <select id="reading-bill-type" class="form-control">
                                ${billTypes.map(bt => `<option value="${bt.id}" data-unit="${bt.unit_name}" data-cost="${bt.cost_per_unit}">${bt.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Date</label>
                            <input type="date" id="reading-date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="form-group">
                            <label>Units Used</label>
                            <div class="flex-row gap-2 align-center">
                                <input type="number" id="reading-units" class="form-control" placeholder="0.00">
                                <span id="reading-unit-label" class="text-sm text-text-muted">Units</span>
                            </div>
                        </div>
                        <div class="form-group full-width">
                            <label>Total Cost</label>
                            <div class="flex-row gap-2 align-center">
                                <input type="number" id="reading-cost" class="form-control" placeholder="0.00">
                                <button class="btn sm" id="calculate-reading-cost" title="Calculate based on current unit cost">
                                    <i data-lucide="calculator"></i>
                                </button>
                            </div>
                            <p class="text-xs text-text-muted mt-1" id="reading-cost-hint"></p>
                        </div>
                        <div class="form-group full-width">
                            <label>Notes</label>
                            <textarea id="reading-notes" class="form-control" rows="2" placeholder="Optional notes..."></textarea>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn secondary" id="cancel-bill-reading">Cancel</button>
                    <button class="btn primary" id="save-reading">Save Reading</button>
                </div>
            </div>
        </div>
    `;
};
