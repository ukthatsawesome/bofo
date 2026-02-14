import { h } from 'preact';
import { Link, useLocation } from 'wouter';
import { clsx } from 'clsx';
import {
    LayoutDashboard,
    ArrowLeftRight,
    TrendingUp,
    PieChart,
    Repeat,
    Receipt,
    Target,
    Sparkles,
    Settings,
    Bot,
    LogOut,
    User
} from 'lucide-preact';
import { SidebarInsight } from './SidebarInsight';

interface AppSidebarProps {
    aiStatus: 'online' | 'offline' | 'checking' | 'disabled';
}

const NavItem = ({ to, icon: Icon, label, statusDot }: { to: string; icon: any; label: string; statusDot?: 'online' | 'offline' | 'checking' | 'disabled' }) => {
    const [location] = useLocation();
    const isActive = location === to;

    return (
        <Link href={to}>
            <li
                className={clsx(
                    "group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 mb-1 mx-2",
                    isActive
                        ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/25"
                        : "text-text-muted hover:bg-surface-elevated/50 hover:text-text-primary"
                )}
            >
                <div className="relative flex items-center justify-center">
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={clsx("transition-transform duration-200 group-hover:scale-110")} />
                    {statusDot && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                            <span className={clsx(
                                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                                statusDot === 'online' ? "bg-emerald-400" : "hidden"
                            )}></span>
                            <span className={clsx(
                                "relative inline-flex rounded-full h-2.5 w-2.5 border border-surface-panel",
                                statusDot === 'online' ? "bg-emerald-500" :
                                    statusDot === 'offline' ? "bg-rose-500" :
                                        statusDot === 'checking' ? "bg-amber-500" : "bg-text-muted"
                            )}></span>
                        </span>
                    )}
                </div>
                <span className="font-medium text-sm">{label}</span>
            </li>
        </Link>
    );
};

export const AppSidebar = ({ aiStatus }: AppSidebarProps) => {
    return (
        <nav className="w-64 bg-surface-panel/90 backdrop-blur-xl border-r border-border/50 flex flex-col h-full z-20 transition-all duration-300">
            {/* Brand Header */}
            <div className="p-6 flex items-center gap-3">
                <div className="relative w-10 h-10 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/20 text-white font-bold text-xl group cursor-help">
                    B
                    {/* AI Status Indicator on Logo */}
                    {aiStatus !== 'disabled' && (
                        <div className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className={clsx(
                                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                                aiStatus === 'online' ? "bg-emerald-400" :
                                    aiStatus === 'checking' ? "bg-amber-400" : "hidden"
                            )}></span>
                            <span className={clsx(
                                "relative inline-flex rounded-full h-3 w-3 border-2 border-surface-panel",
                                aiStatus === 'online' ? "bg-emerald-500" :
                                    aiStatus === 'offline' ? "bg-rose-500" :
                                        aiStatus === 'checking' ? "bg-amber-500" : "bg-text-muted"
                            )}></span>
                        </div>
                    )}
                </div>
                <div>
                    <h1 className="font-display font-bold text-xl text-text-primary tracking-tight leading-none">Bofo</h1>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mt-0.5">Premium Finance</p>
                </div>
            </div>

            {/* Navigation Groups */}
            <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
                <div className="px-4 mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Overview</div>
                <ul className="mb-6">
                    <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
                    <NavItem to="/transactions" icon={ArrowLeftRight} label="Transactions" />
                    <NavItem to="/forecast" icon={TrendingUp} label="Forecast" />
                    <NavItem to="/budget" icon={PieChart} label="Budget" />
                    <NavItem to="/goals" icon={Target} label="Goals" />
                </ul>

                <div className="px-4 mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Management</div>
                <ul className="mb-6">
                    <NavItem to="/recurring" icon={Repeat} label="Recurring" />
                    <NavItem to="/bills" icon={Receipt} label="Bills" />
                    <NavItem to="/sandbox" icon={Sparkles} label="Sandbox" />
                    {/* AI Assistant moved to Settings per user request */}
                </ul>
            </div>

            {/* AI Insight Widget */}
            <SidebarInsight />

            {/* User Footer */}
            <div className="p-4 border-t border-border/50 bg-surface-base/50">
                <Link href="/settings">
                    <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-card transition-all cursor-pointer group border border-transparent hover:border-border hover:shadow-sm">
                        <div className="w-9 h-9 bg-surface-elevated rounded-full flex items-center justify-center text-text-muted">
                            <User size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-text-primary truncate">User Account</p>
                            <p className="text-xs text-text-muted truncate">Settings & Profile</p>
                        </div>
                        <Settings size={16} className="text-text-muted group-hover:text-brand-primary transition-colors" />
                    </div>
                </Link>
            </div>
        </nav>
    );
};
