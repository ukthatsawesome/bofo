import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { AppSidebar } from './AppSidebar';

export const Shell = ({ children }: { children: any }) => {
    const [aiStatus, setAiStatus] = useState<'online' | 'offline' | 'checking' | 'disabled'>('checking');

    useEffect(() => {
        const checkAI = async () => {
            try {
                const settings = await (window as any).api.getAISettings();
                if (!settings.enabled) {
                    setAiStatus('disabled');
                    return;
                }
                const ok = await (window as any).api.checkAIConnection();
                setAiStatus(ok ? 'online' : 'offline');
            } catch {
                setAiStatus('offline');
            }
        };

        checkAI();
        const interval = setInterval(checkAI, 15000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex h-screen bg-surface-base text-text-primary overflow-hidden font-sans">
            <AppSidebar aiStatus={aiStatus} />

            {/* Main Content Area */}
            <main className="flex-1 relative overflow-auto scroll-smooth">
                {children}
            </main>
        </div>
    );
};
