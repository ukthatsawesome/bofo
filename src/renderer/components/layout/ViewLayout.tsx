import { JSX } from 'preact';
import { PageTitle, Text } from '../ui/Typography';
import { ActionGroup } from '../ui/ActionGroup';

interface ViewLayoutProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: preact.ComponentChildren;
  actions?: preact.ComponentChildren;
  children: preact.ComponentChildren;
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
  fullWidth?: boolean;
}

export const ViewLayout = ({
  title,
  subtitle,
  actions,
  children,
  isLoading,
  error,
  className = '',
  fullWidth = false,
}: ViewLayoutProps) => {
  const fadeIn = 'animate-in fade-in duration-500 slide-in-from-bottom-2';

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h2 className="text-xl font-bold text-text-primary mb-2">Something went wrong</h2>
        <p className="text-text-muted mb-4">{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90"
        >
          Reload Page
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col min-h-full ${className}`}>
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 bg-surface-base/80 backdrop-blur-md border-b border-border/50 px-8 py-4 mb-6 transition-all duration-200">
        <div
          className={`mx-auto flex items-center justify-between ${fullWidth ? 'max-w-full' : 'max-w-7xl'}`}
        >
          <div className="flex flex-col">
            <PageTitle>{title}</PageTitle>
            {subtitle && <p className="text-text-muted text-sm mt-0.5">{subtitle}</p>}
          </div>

          {actions && <ActionGroup>{actions}</ActionGroup>}
        </div>
      </header>

      {/* Main Content */}
      <main
        className={`flex-1 px-8 pb-12 mx-auto w-full ${fullWidth ? 'max-w-full' : 'max-w-7xl'} ${fadeIn}`}
      >
        {isLoading ? (
          <div className="space-y-4">
            {/* Skeleton Loader Effect */}
            <div className="h-48 bg-surface-active rounded-2xl animate-pulse"></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="h-32 bg-surface-active rounded-2xl animate-pulse"></div>
              <div className="h-32 bg-surface-active rounded-2xl animate-pulse"></div>
              <div className="h-32 bg-surface-active rounded-2xl animate-pulse"></div>
            </div>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
};
