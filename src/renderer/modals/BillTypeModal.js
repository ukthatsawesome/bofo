export const BillTypeModal = () => {
    return `
        <div id="bill-type-modal" class="modal hidden">
            <div class="modal-content glass">
                <div class="modal-header">
                    <h2>Add New Bill Type</h2>
                    <button class="close"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group full-width">
                            <label>Bill Name</label>
                            <input type="text" id="bill-name" class="form-control" placeholder="e.g. Electricity, Water">
                        </div>
                        <div class="form-group">
                            <label>Metric Unit</label>
                            <input type="text" id="bill-unit" class="form-control" placeholder="e.g. kWh, m³">
                        </div>
                        <div class="form-group">
                            <label>Cost per Unit</label>
                            <input type="number" id="bill-cost" class="form-control" step="0.0001" placeholder="0.00">
                        </div>
                        <div class="form-group">
                            <label>Icon</label>
                            <select id="bill-icon" class="form-control">
                                <option value="zap">Zap (Electricity)</option>
                                <option value="droplet">Droplet (Water)</option>
                                <option value="flame">Flame (Gas)</option>
                                <option value="wifi">Wifi (Internet)</option>
                                <option value="phone">Phone</option>
                                <option value="trash-2">Waste</option>
                                <option value="file-text">Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Theme Color</label>
                            <input type="color" id="bill-color" class="form-control" value="#7c3aed" style="height: 45px; padding: 5px;">
                        </div>
                        <div class="form-group full-width">
                            <label>Linked Category</label>
                            <select id="bill-category" class="form-control">
                                <option value="">No linked category</option>
                            </select>
                        </div>
                        <div class="form-group full-width">
                            <label>Default Payment Account</label>
                            <select id="bill-account" class="form-control">
                                <option value="">No linked account</option>
                            </select>
                        </div>
                        <div class="form-group full-width">
                            <div class="toggle-row">
                                <div>
                                    <p class="font-bold">Auto-register Transaction</p>
                                    <p class="text-xs text-text-muted">Automatically record an expense when a new reading is added.</p>
                                </div>
                                <label class="switch">
                                    <input type="checkbox" id="bill-auto-tx">
                                    <span class="slider round"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn secondary" id="cancel-bill-type">Cancel</button>
                    <button class="btn primary" id="save-bill-type">Save Bill Type</button>
                </div>
            </div>
        </div>
    `;
};
