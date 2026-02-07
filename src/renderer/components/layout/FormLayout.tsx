
import { JSX } from 'preact';
import { PageTitle, SectionTitle } from '../ui/Typography';
import { UiButton } from '../ui/UiButton';

interface FormLayoutProps {
    title: string;
    subtitle?: string;
    onSubmit: (e: Event) => void;
    onCancel: () => void;
    isSubmitting?: boolean;
    submitLabel?: string;
    children: preact.ComponentChildren;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const FormLayout = ({
    title,
    subtitle,
    onSubmit,
    onCancel,
    isSubmitting = false,
    submitLabel = 'Save Changes',
    children,
    maxWidth = 'md'
}: FormLayoutProps) => {

    const maxW = {
        sm: 'max-w-md',
        md: 'max-w-2xl',
        lg: 'max-w-4xl',
        xl: 'max-w-6xl'
    };

    return (
        <div className={`mx-auto w-full ${maxW[maxWidth]} animate-in fade-in slide-in-from-bottom-4 duration-300`}>
            <form onSubmit={onSubmit} className="bg-surface-card rounded-3xl border border-border shadow-xl overflow-hidden">

                {/* Header */}
                <div className="px-8 py-6 border-b border-border bg-surface-base/50">
                    <SectionTitle>{title}</SectionTitle>
                    {subtitle && <p className="text-text-muted mt-1 text-sm">{subtitle}</p>}
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">
                    {children}
                </div>

                {/* Footer Actions */}
                <div className="bg-surface-base/50 px-8 py-5 border-t border-border flex justify-end gap-3">
                    <UiButton
                        type="button"
                        variant="ghost"
                        onClick={onCancel}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </UiButton>
                    <UiButton
                        type="submit"
                        variant="primary"
                        isLoading={isSubmitting}
                    >
                        {submitLabel}
                    </UiButton>
                </div>
            </form>
        </div>
    );
};
