import { JSX } from 'preact';
import { PageTitle } from '../ui/Typography';
import { UiButton } from '../ui/UiButton';
import { ActionGroup } from '../ui/ActionGroup';

interface DetailLayoutProps {
  title: string;
  onBack: () => void;
  actions?: preact.ComponentChildren;
  children: preact.ComponentChildren;
  isLoading?: boolean;
}

export const DetailLayout = ({
  title,
  onBack,
  actions,
  children,
  isLoading = false,
}: DetailLayoutProps) => {
  const ArrowLeft = (props: any) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );

  return (
    <div className="flex flex-col min-h-full max-w-5xl mx-auto w-full px-8 pt-8 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <UiButton
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="rounded-full hover:bg-surface-hover -ml-2"
          >
            <ArrowLeft className="w-6 h-6 text-text-muted" />
          </UiButton>
          <PageTitle>{title}</PageTitle>
        </div>

        {actions && <ActionGroup>{actions}</ActionGroup>}
      </div>

      {/* Content */}
      <div className="flex-1">
        {isLoading ? (
          <div className="space-y-6">
            <div className="h-64 bg-surface-active rounded-3xl animate-pulse"></div>
            <div className="h-32 bg-surface-active rounded-2xl animate-pulse"></div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};
