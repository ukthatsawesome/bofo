/**
 * AI Status Indicator Component
 * Shows global AI connection status as a minimal dot
 */

interface AIStatusIndicatorProps {
  status?: boolean | null;
}

export function AIStatusIndicator({ status = null }: AIStatusIndicatorProps): string {
  const getStatusInfo = (status: boolean | null) => {
    if (status === null) {
      return {
        class: 'checking',
        tooltip: 'Checking AI connection...',
      };
    }
    if (status === true) {
      return {
        class: 'online',
        tooltip: 'AI Online - Click to configure',
      };
    }
    return {
      class: 'offline',
      tooltip: 'AI Offline - Click to configure',
    };
  };

  const info = getStatusInfo(status);

  return `
        <div class="ai-status-dot ai-dot-${info.class}" title="${info.tooltip}">
            <span class="ai-dot-inner ${status === null ? 'pulsing' : ''}"></span>
        </div>
    `;
}

/**
 * AI Status Badge for use in cards and sections
 */

interface AIStatusBadgeProps {
  isAI?: boolean;
  label?: string | null;
}

export function AIStatusBadge({ isAI = false, label = null }: AIStatusBadgeProps): string {
  if (isAI) {
    return `
            <span class="ai-badge ai-badge-active" title="Powered by AI">
                <i data-lucide="sparkles" class="w-3 h-3"></i>
                ${label || 'AI'}
            </span>
        `;
  }
  return `
        <span class="ai-badge ai-badge-fallback" title="Rule-based insight">
            <i data-lucide="lightbulb" class="w-3 h-3"></i>
            ${label || 'Auto'}
        </span>
    `;
}
