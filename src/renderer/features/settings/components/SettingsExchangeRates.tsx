import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { UiCard } from '@/components/ui/UiCard';
import { UiSelect } from '@/components/ui/UiSelect';
import { UiButton } from '@/components/ui/UiButton';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { RefreshCw, Activity, Plus, Trash2, Edit2, Coins } from 'lucide-preact';
import { IconButton } from '@/components/ui/IconButton';
import { ExchangeRate } from '../../../../shared/types';
import { clsx } from 'clsx';
import { SectionTitle, Caption } from '@/components/ui/Typography';
import { CURRENCY_API_PROVIDERS } from '../../../../shared/currencies';
import { useSortedData } from '@/hooks/useSortedData';
import { SETTING_KEYS } from '../../../../shared/settings/keys';
import { DEFAULT_CURRENCY, DEFAULT_CURRENCY_PROVIDER } from '../../../../shared/settings/defaults';

export const SettingsExchangeRates = () => {
    const [rates, setRates] = useState<ExchangeRate[]>([]);
    const [baseCurrency, setBaseCurrency] = useState<string>(DEFAULT_CURRENCY);
    const [provider, setProvider] = useState<string>(DEFAULT_CURRENCY_PROVIDER);
    const [customUrl, setCustomUrl] = useState('');
    const [autoSync, setAutoSync] = useState(false);
    const [lastSync, setLastSync] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const { sortedData, sortColumn, sortDirection, handleSort } = useSortedData({
        data: rates,
        initialSortColumn: 'from_currency'
    });

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRate, setEditingRate] = useState<Partial<ExchangeRate> | undefined>(undefined);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const settings = await (window as any).api.getSettings();
        const r = await (window as any).api.getExchangeRates();
        const syncStatus = await (window as any).api.getRateSyncStatus();

        setRates(r || []);
        setBaseCurrency(settings[SETTING_KEYS.CURRENCY.BASE] || DEFAULT_CURRENCY);
        setProvider(settings[SETTING_KEYS.CURRENCY.API_PROVIDER] || DEFAULT_CURRENCY_PROVIDER);
        setCustomUrl(settings[SETTING_KEYS.CURRENCY.CUSTOM_URL] || '');
        setAutoSync(settings[SETTING_KEYS.CURRENCY.AUTO_SYNC] === 'true');
        setLastSync(syncStatus);
    };

    const handleSync = async () => {
        setLoading(true);
        try {
            await (window as any).api.updateSetting({ key: SETTING_KEYS.CURRENCY.API_PROVIDER, value: provider });
            if (provider === 'custom') {
                await (window as any).api.updateSetting({ key: SETTING_KEYS.CURRENCY.CUSTOM_URL, value: customUrl });
            }

            const result = await (window as any).api.syncExchangeRates({ provider, baseCurrency, customUrl });
            if (result.success) {
                alert(`Synced ${result.ratesUpdated} rates`);
                await loadData();
            } else {
                throw new Error(result.message);
            }
        } catch (e: any) {
            alert('Sync failed: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleTest = async () => {
        setLoading(true);
        try {
            const result = await (window as any).api.testCurrencyAPI({ provider, baseCurrency, customUrl });
            if (result.success) alert('Connection successful!');
            else alert('Connection failed: ' + result.message);
        } catch (e: any) {
            alert('Error: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRate = async (e: Event) => {
        e.preventDefault();
        try {
            // @ts-ignore
            const payload = {
                ...editingRate,
                source: 'manual'
            };
            await (window as any).api.setExchangeRate(payload);
            await loadData();
            setIsModalOpen(false);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this rate?')) return;
        await (window as any).api.deleteExchangeRate(id);
        await loadData();
    };

    const columns: Column<ExchangeRate>[] = [
        { header: 'From', accessor: 'from_currency', className: 'font-bold', sortable: true },
        { header: 'To', accessor: 'to_currency', className: 'font-bold', sortable: true },
        { header: 'Rate', accessor: (r) => r.rate.toFixed(6), sortable: true, sortKey: 'rate' },
        {
            header: 'Source', accessor: (r) => (
                <span className={clsx(
                    "px-2 py-0.5 rounded text-xs",
                    r.source === 'api' ? "bg-info/10 text-info" : "bg-surface-active text-text-muted"
                )}>
                    {r.source === 'api' ? 'API' : 'Manual'}
                </span>
            ),
            sortable: true,
            sortKey: 'source'
        },
        {
            header: 'Updated',
            accessor: (r) => new Date(r.last_updated).toLocaleDateString(),
            className: 'text-xs text-text-muted',
            sortable: true,
            sortKey: 'last_updated'
        },
        {
            header: 'Actions',
            accessor: (r) => (
                <div className="flex justify-end gap-1">
                    <IconButton icon={Edit2} variant="primary" tooltip="Edit" onClick={() => { setEditingRate(r); setIsModalOpen(true); }} />
                    <IconButton icon={Trash2} variant="danger" tooltip="Delete" onClick={() => handleDelete(r.id!)} />
                </div>
            ),
            className: 'text-right'
        }
    ];


    const providerOptions = CURRENCY_API_PROVIDERS.map(p => ({
        label: p.name,
        value: p.id
    }));

    return (
        <div className="space-y-6">
            <div>
                <SectionTitle>Exchange Rates</SectionTitle>
                <Caption className="mt-1">Manage currency conversion rates</Caption>
            </div>

            <UiCard>
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <strong>Base Currency: </strong> <span className="text-brand-primary font-bold">{baseCurrency}</span>
                    </div>
                    {lastSync && (
                        <div className={clsx("flex items-center gap-2 px-3 py-1.5 rounded text-sm", lastSync.isStale ? "bg-warning/10 text-warning" : "bg-success/10 text-success")}>
                            {lastSync.isStale ? <Activity size={16} /> : <RefreshCw size={16} />}
                            <span>{lastSync.isStale ? 'Rates are stale' : 'Up to date'}</span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <UiSelect
                        label="Rate Provider"
                        options={providerOptions}
                        value={provider}
                        onChange={(e) => setProvider((e.target as HTMLSelectElement).value)}
                    />

                    {provider === 'custom' && (
                        <Input
                            label="Custom URL"
                            value={customUrl}
                            onInput={(e) => setCustomUrl((e.target as HTMLInputElement).value)}
                            placeholder="https://api..."
                        />
                    )}

                    <div className="flex gap-2">
                        <UiButton variant="secondary" onClick={handleTest} isLoading={loading} icon={<Activity size={16} />}>Test API</UiButton>
                        <UiButton onClick={handleSync} isLoading={loading} icon={<RefreshCw size={16} />}>Sync Now</UiButton>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="er-auto"
                            className="w-4 h-4 rounded border-border"
                            checked={autoSync}
                            onChange={async (e) => {
                                const val = (e.target as HTMLInputElement).checked;
                                setAutoSync(val);
                                await (window as any).api.updateSetting({ key: SETTING_KEYS.CURRENCY.AUTO_SYNC, value: val ? 'true' : 'false' });
                            }}
                        />
                        <label htmlFor="er-auto" className="text-sm font-medium cursor-pointer">
                            Sync rates on app startup (if stale)
                        </label>
                    </div>
                </div>
            </UiCard>

            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold">Active Rates</h3>
                    <UiButton size="sm" variant="secondary" icon={<Plus size={16} />} onClick={() => { setEditingRate({}); setIsModalOpen(true); }}>
                        Add Manual Rate
                    </UiButton>
                </div>

                <DataTable
                    data={sortedData}
                    columns={columns}
                    keyField="id"
                    isLoading={loading}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                />
            </div>

            {/* @ts-ignore */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRate?.id ? "Edit Rate" : "Add Manual Rate"}>
                <form onSubmit={handleSaveRate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="From"
                            value={editingRate?.from_currency || ''}
                            onInput={(e) => setEditingRate({ ...editingRate, from_currency: (e.target as HTMLInputElement).value })}
                            required
                        />
                        <Input
                            label="To"
                            value={editingRate?.to_currency || ''}
                            onInput={(e) => setEditingRate({ ...editingRate, to_currency: (e.target as HTMLInputElement).value })}
                            required
                        />
                    </div>
                    <Input
                        label="Rate"
                        type="number"
                        step="0.000001"
                        value={editingRate?.rate || ''}
                        onInput={(e) => setEditingRate({ ...editingRate, rate: Number((e.target as HTMLInputElement).value) })}
                        required
                    />
                    <div className="flex justify-end pt-4">
                        <UiButton type="submit">Save Rate</UiButton>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
