import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { UiCard } from '@/components/ui/UiCard';
import {
  ClipboardList,
  Sparkles,
  User,
  Trash2,
  PlusCircle,
  Edit2,
  AlertCircle,
} from 'lucide-preact';
import { clsx } from 'clsx';
import { SectionTitle, Caption } from '@/components/ui/Typography';

interface AuditLog {
  id: number;
  action: string;
  entity_type: string;
  entity_name?: string;
  source: 'USER' | 'AI';
  changes: any;
  metadata: any;
  created_at: string;
}

export const SettingsAudit = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'USER' | 'AI'>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await (window as any).api.getAuditLogs();

        const logsData = Array.isArray(response) ? response : response.data || [];

        const parsed = logsData.map((l: any) => ({
          ...l,
          changes: typeof l.changes === 'string' ? tryParse(l.changes) : l.changes,
          metadata: typeof l.metadata === 'string' ? tryParse(l.metadata) : l.metadata,
        }));
        setLogs(parsed);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const tryParse = (str: string) => {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  };

  const filteredLogs = logs.filter((l) => filter === 'ALL' || l.source === filter);

  const getIcon = (log: AuditLog) => {
    if (log.source === 'AI') return Sparkles;
    if (log.action === 'DELETE') return Trash2;
    if (log.action === 'CREATE') return PlusCircle;
    return Edit2;
  };

  const getDescription = (log: AuditLog) => {
    const isAI = log.source === 'AI';
    const actor = isAI ? 'Bofo AI' : 'You';

    let actionText = '';
    if (log.entity_type === 'transaction') {
      if (log.action === 'CREATE')
        actionText = `created transaction for ${log.changes?.category || 'unknown'}`;
      else if (log.action === 'DELETE') actionText = 'deleted transaction';
      else actionText = 'updated transaction';
    } else {
      actionText = `${log.action.toLowerCase()}d ${log.entity_type}`;
    }

    return (
      <span>
        <span className={clsx('font-bold', isAI ? 'text-brand-secondary' : 'text-brand-primary')}>
          {actor}
        </span>
        <span className="text-text-muted mx-1">{actionText}</span>
      </span>
    );
  };

  const getChangeDetails = (log: AuditLog) => {
    if (!log.changes || log.action === 'DELETE' || log.action === 'CREATE') return null;

    const { old, new: newVal } = log.changes;
    if (!old || !newVal) return null;

    const changes = Object.keys(newVal).filter(
      (k) =>
        JSON.stringify(newVal[k]) !== JSON.stringify(old[k]) &&
        !['updated_at', 'created_at'].includes(k)
    );

    if (changes.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {changes.map((key) => (
          <span
            key={key}
            className="text-xs px-2 py-0.5 bg-surface-base border border-border rounded text-text-muted"
          >
            {key}: {String(old[key]).substring(0, 20)} → {String(newVal[key]).substring(0, 20)}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <SectionTitle>Activity Log</SectionTitle>
          <Caption className="mt-1">Audit trail of changes and AI actions</Caption>
        </div>
        <div className="flex bg-surface-card border border-border rounded-lg p-1">
          {['ALL', 'USER', 'AI'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={clsx(
                'px-3 py-1 text-xs font-semibold rounded-md transition-colors',
                filter === f
                  ? 'bg-brand-primary text-white'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              {f === 'ALL' ? 'All' : f === 'USER' ? 'My Actions' : 'AI Actions'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-text-muted">Loading activity...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 text-text-muted border border-dashed border-border rounded-xl">
          <ClipboardList className="mx-auto mb-2 opacity-20" size={32} />
          <p>No activity found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLogs.map((log) => {
            const Icon = getIcon(log);
            const isAI = log.source === 'AI';
            const uniqueKey = `${log.entity_type}-${log.id}`;

            return (
              <div
                key={uniqueKey}
                className="flex gap-4 p-4 rounded-xl border border-border/50 bg-surface-card hover:border-border transition-colors"
              >
                <div
                  className={clsx(
                    'shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
                    isAI
                      ? 'bg-brand-secondary/10 text-brand-secondary'
                      : 'bg-brand-primary/10 text-brand-primary'
                  )}
                >
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div className="text-sm">{getDescription(log)}</div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider ml-2 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>

                  {getChangeDetails(log)}

                  {log.metadata && log.metadata.confidence && (
                    <div className="mt-2 text-xs text-text-muted italic border-l-2 border-border pl-2">
                      Confidence: {(log.metadata.confidence * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
