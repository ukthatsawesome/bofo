import { NotificationManager } from '../../components/ui/notifications/NotificationManager';

let notificationManagerInstance: NotificationManager | null = null;

function getManager(): NotificationManager {
  if (!notificationManagerInstance) {
    notificationManagerInstance = new NotificationManager();
  }
  return notificationManagerInstance;
}

export const notify = {
  toast: (
    title: string,
    message?: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info'
  ) => {
    getManager().toast(title, message, type);
  },
  success: (title: string, message?: string) => {
    getManager().toast(title, message, 'success');
  },
  error: (title: string, message?: string) => {
    getManager().toast(title, message, 'error');
  },
  warning: (title: string, message?: string) => {
    getManager().toast(title, message, 'warning');
  },
  info: (title: string, message?: string) => {
    getManager().toast(title, message, 'info');
  },

  confirm: (
    title: string,
    message: string,
    type: 'warning' | 'info' | 'error' | 'success' = 'warning'
  ) => {
    return getManager().confirm(title, message, type);
  },
};
