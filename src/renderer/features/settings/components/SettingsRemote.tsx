import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { UiCard } from '@/components/ui/UiCard';
import { UiButton } from '@/components/ui/UiButton';
import { Input } from '@/components/ui/Input';
import { Wifi, Save, Key, RefreshCcw } from 'lucide-preact';
import { clsx } from 'clsx';
import { SectionTitle, Caption } from '@/components/ui/Typography';
import { SETTING_KEYS } from '../../../../shared/settings/keys';
import { DEFAULT_REMOTE_PORT } from '../../../../shared/settings/defaults';
import { notify } from '@/core/lib/notify';

export const SettingsRemote = () => {
  const [enabled, setEnabled] = useState(false);
  const [port, setPort] = useState<string>(DEFAULT_REMOTE_PORT);
  const [key, setKey] = useState('');
  const [hostInfo, setHostInfo] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const config = await (window as any).api.getEffectiveConfig();
        if (config?.remote) {
          setEnabled(config.remote.enabled);
          setPort(String(config.remote.port));
          setKey(config.remote.apiKey || '');

          if (config.remote.enabled) {
            const info = await (window as any).api.getHostInfo();
            setHostInfo(info.ips || []);
          }
          return;
        }
      } catch (e) {
        console.warn('Failed to load effective config, falling back to settings');
      }

      const settings = await (window as any).api.getSettings();
      setEnabled(settings[SETTING_KEYS.REMOTE.ENABLED] === 'true');
      setPort(settings[SETTING_KEYS.REMOTE.PORT] || DEFAULT_REMOTE_PORT);
      setKey(settings[SETTING_KEYS.REMOTE.KEY] || '');

      if (settings[SETTING_KEYS.REMOTE.ENABLED] === 'true') {
        try {
          const info = await (window as any).api.getHostInfo();
          setHostInfo(info.ips || []);
        } catch (e) {
          console.error(e);
        }
      }
    };
    load();
  }, []);

  const generateKey = async () => {
    const secureKey = await (window as any).api.generateSecureKey();
    setKey(secureKey);
  };

  const handleSave = async () => {
    if (enabled && !key) {
      notify.error(
        'Access Key Required',
        'Please generate or enter an access key when enabling remote access'
      );
      return;
    }

    setLoading(true);
    try {
      await (window as any).api.saveSettings({
        [SETTING_KEYS.REMOTE.ENABLED]: enabled.toString(),
        [SETTING_KEYS.REMOTE.PORT]: port,
        [SETTING_KEYS.REMOTE.KEY]: key,
      });

      await (window as any).api.restartWebServer?.();

      if (enabled) {
        const info = await (window as any).api.getHostInfo();
        setHostInfo(info.ips || []);
      } else {
        setHostInfo([]);
      }
      notify.success('Settings Saved', 'Remote server restarted successfully');
    } catch (error: any) {
      notify.error('Save Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Remote Access</SectionTitle>
        <Caption className="mt-1">
          Access your dashboard from other devices on your local network
        </Caption>
      </div>

      <UiCard title="Server Configuration" icon={<Wifi size={20} />}>
        <div className="max-w-xl space-y-6">
          {/* Info Alert */}
          <div className="p-4 bg-info/10 border border-info/20 rounded-lg flex gap-3">
            <div className="text-info shrink-0">
              <Wifi size={20} />
            </div>
            <div>
              <h4 className="font-bold text-info text-sm">Beta Feature</h4>
              <p className="text-xs text-text-muted mt-1">
                This starts a local web server on your computer. Ensure your firewall allows
                incoming connections on the specified port.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-surface-hover/50 rounded-lg border border-border/50">
            <input
              type="checkbox"
              id="ra-enabled"
              className="w-5 h-5 rounded border-border cursor-pointer accent-brand-primary"
              checked={enabled}
              onChange={(e) => setEnabled((e.target as HTMLInputElement).checked)}
            />
            <label htmlFor="ra-enabled" className="text-sm font-medium cursor-pointer flex-1">
              Enable Remote Access Server
            </label>
          </div>

          <div
            className={clsx(
              'grid grid-cols-2 gap-4 transition-opacity',
              !enabled && 'opacity-50 pointer-events-none'
            )}
          >
            <Input
              label="Port"
              value={port}
              onInput={(e) => setPort((e.target as HTMLInputElement).value)}
            />
            <div className="relative">
              <Input
                label="Access Key"
                value={key}
                onInput={(e) => setKey((e.target as HTMLInputElement).value)}
                placeholder="Required password"
              />
              <button
                onClick={generateKey}
                className="absolute right-2 top-[2.2rem] p-1.5 text-text-muted hover:text-brand-primary hover:bg-surface-hover rounded"
                title="Generate Random Key"
              >
                <RefreshCcw size={14} />
              </button>
            </div>
          </div>

          {enabled && hostInfo.length > 0 && (
            <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
              <h4 className="text-success text-sm font-bold flex items-center gap-2 mb-2">
                <Wifi size={16} /> Server Running
              </h4>
              <p className="text-xs text-text-muted mb-2">Access from other devices at:</p>
              <code className="block p-2 bg-surface-base rounded text-sm font-mono select-all">
                http://{hostInfo[0]}:{port}
              </code>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <UiButton onClick={handleSave} isLoading={loading} icon={<Save size={18} />}>
              Save & Restart Server
            </UiButton>
          </div>
        </div>
      </UiCard>
    </div>
  );
};
