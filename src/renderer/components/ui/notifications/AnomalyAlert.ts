/**
 * Anomaly Alert Component
 *
 * Displays transaction anomaly warnings with severity-based styling
 */

export interface AnomalyAlertProps {
  type: 'unusual_amount' | 'new_category' | 'duplicate' | 'price_increase';
  severity: 'low' | 'medium' | 'high';
  message: string;
  onDismiss?: string;
}

const ICONS: Record<string, string> = {
  unusual_amount: 'alert-triangle',
  new_category: 'plus-circle',
  duplicate: 'copy',
  price_increase: 'trending-up',
};

const SEVERITY_CLASSES: Record<string, string> = {
  low: 'anomaly-alert--low',
  medium: 'anomaly-alert--medium',
  high: 'anomaly-alert--high',
};

export const AnomalyAlert = ({ type, severity, message, onDismiss }: AnomalyAlertProps): string => {
  const icon = ICONS[type] || 'alert-circle';
  const severityClass = SEVERITY_CLASSES[severity] || '';

  return `
    <div class="anomaly-alert ${severityClass}" role="alert">
      <div class="anomaly-alert__icon">
        <i data-lucide="${icon}"></i>
      </div>
      <div class="anomaly-alert__content">
        <span class="anomaly-alert__badge">${severity.toUpperCase()}</span>
        <p class="anomaly-alert__message">${message}</p>
      </div>
      ${
        onDismiss
          ? `
        <button class="anomaly-alert__dismiss" onclick="${onDismiss}">
          <i data-lucide="x"></i>
        </button>
      `
          : ''
      }
    </div>
  `;
};

/**
 * Render multiple anomaly alerts
 */
export const AnomalyAlertList = (anomalies: AnomalyAlertProps[]): string => {
  if (anomalies.length === 0) return '';

  return `
    <div class="anomaly-alerts">
      ${anomalies.map((a) => AnomalyAlert(a)).join('')}
    </div>
  `;
};
