import { h } from 'preact';
import { useState } from 'preact/hooks';
import { ViewLayout } from '@/components/layout/ViewLayout';
import { UiCard } from '@/components/ui/UiCard';
import {
    Wallet,
    Tags,
    TrendingUp,
    Settings2,
    Coins,
    Receipt,
    Database,
    Wifi,
    ClipboardList,
    ChevronRight
} from 'lucide-preact';
import { clsx } from 'clsx';
import { SettingsAccounts } from './components/SettingsAccounts';
import { SettingsPreferences } from './components/SettingsPreferences';
import { SettingsCategories } from './components/SettingsCategories';
import { SettingsBillTypes } from './components/SettingsBillTypes';
import { SettingsForecast } from './components/SettingsForecast';
import { SettingsExchangeRates } from './components/SettingsExchangeRates';
import { SettingsBackup } from './components/SettingsBackup';
import { SettingsRemote } from './components/SettingsRemote';
import { SettingsAudit } from './components/SettingsAudit';
import { SettingsAI } from './components/SettingsAI';
import { Bot } from 'lucide-preact';

export const SettingsPage = () => {
    const [activeTab, setActiveTab] = useState('accounts');

    const tabs = [
        { id: 'accounts', label: 'Accounts', icon: Wallet, component: SettingsAccounts, description: 'Manage connected bank accounts and wallets' },
        { id: 'categories', label: 'Categories', icon: Tags, component: SettingsCategories, description: 'Customize your spending categories' },
        { id: 'forecast', label: 'Forecast', icon: TrendingUp, component: SettingsForecast, description: 'Configure forecasting parameters' },
        { id: 'preferences', label: 'Preferences', icon: Settings2, component: SettingsPreferences, description: 'App appearance and behavior' },
        { id: 'currencies', label: 'Exchange Rates', icon: Coins, component: SettingsExchangeRates, description: 'Multi-currency settings' },
        { id: 'bills', label: 'Bill Types', icon: Receipt, component: SettingsBillTypes, description: 'Manage recurring bill types' },
        { id: 'ai', label: 'AI Assistant', icon: Bot, component: SettingsAI, description: 'Configure local AI engine' },
        { id: 'backup', label: 'Backup & Data', icon: Database, component: SettingsBackup, description: 'Export, import, and backup data' },
        { id: 'remote', label: 'Remote Access', icon: Wifi, component: SettingsRemote, description: 'Configure remote server access' },
        { id: 'audit', label: 'Activity Log', icon: ClipboardList, component: SettingsAudit, description: 'View system activity logs' },
    ];

    const activeTabObj = tabs.find(t => t.id === activeTab);
    const ActiveComponent = activeTabObj?.component || (() => <div>Not Found</div>);

    return (
        <ViewLayout title="Settings" actions={null}>
            <div className="flex h-full gap-6 items-start">
                {/* Sidebar Navigation */}
                <div className="w-64 flex-shrink-0 animate-fade-in-left sticky top-6">
                    <div className="bg-surface-card/60 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[calc(100vh-12rem)] min-h-[32rem]">
                        <div className="p-4 border-b border-border/50 bg-surface-base/30">
                            <h2 className="font-semibold text-text-primary">Configuration</h2>
                            <p className="text-xs text-text-muted">System preferences</p>
                        </div>
                        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={clsx(
                                        "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                                        activeTab === tab.id
                                            ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20"
                                            : "text-text-muted hover:text-text-primary hover:bg-surface-hover"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <tab.icon size={18} className={activeTab === tab.id ? "text-white" : "text-text-muted group-hover:text-text-primary"} />
                                        <span>{tab.label}</span>
                                    </div>
                                    {activeTab === tab.id && <ChevronRight size={14} className="text-white/80" />}
                                </button>
                            ))}
                        </nav>
                        <div className="p-4 bg-surface-base/30 text-center text-xs text-text-muted border-t border-border/50">
                            <p className="font-medium">Bofo Finance v2.0</p>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 animate-fade-in overflow-y-auto pr-2 pb-4">
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* Header for the section */}
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-brand-primary/10 rounded-xl text-brand-primary">
                                {activeTabObj?.icon && <activeTabObj.icon size={28} />}
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-text-primary">{activeTabObj?.label}</h1>
                                <p className="text-text-muted">{activeTabObj?.description}</p>
                            </div>
                        </div>

                        <ActiveComponent />
                    </div>
                </div>
            </div>
        </ViewLayout>
    );
};
