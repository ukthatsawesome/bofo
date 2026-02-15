import { h, ComponentChildren, FunctionalComponent } from 'preact';
import { useEffect, useState, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { X } from 'lucide-preact';
import { clsx } from 'clsx';
import { useId } from 'preact/hooks';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ComponentChildren;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    description?: string;
}

export const Modal = ({ isOpen, onClose, title, children, size = 'md', description }: ModalProps) => {
    const [isVisible, setIsVisible] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const generatedId = useId();
    const titleId = `modal-title-${generatedId}`;
    const descriptionId = description ? `modal-description-${generatedId}` : undefined;

    // Get all focusable elements within modal
    const getFocusableElements = () => {
        if (!modalRef.current) return [];
        return modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
    };

    // Handle keyboard navigation (Tab/Shift+Tab focus trap)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'Escape') {
                onClose();
                return;
            }

            if (e.key === 'Tab') {
                const focusables = getFocusableElements();
                if (focusables.length === 0) return;

                const firstElement = focusables[0];
                const lastElement = focusables[focusables.length - 1];

                if (e.shiftKey && document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                } else if (!e.shiftKey && document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            previousFocusRef.current = document.activeElement as HTMLElement;
        }

        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Focus trap: focus first focusable element when modal opens
    useEffect(() => {
        if (isOpen && modalRef.current) {
            // Focus the close button or first input
            const focusable = modalRef.current.querySelector<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            (focusable || modalRef.current)?.focus();
        }

        // Return focus to previous element on close
        if (!isOpen && previousFocusRef.current) {
            previousFocusRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            document.body.style.overflow = 'hidden';
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            document.body.style.overflow = 'unset';
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isVisible && !isOpen) return null;

    const sizes = {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-2xl",
        xl: "max-w-4xl"
    };

    const modalContent = (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className={clsx(
                    "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0"
                )}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Content */}
            <div
                ref={modalRef}
                className={clsx(
                    "relative w-full bg-surface-card rounded-2xl shadow-xl transform transition-all duration-300 flex flex-col max-h-[90vh]",
                    sizes[size],
                    isOpen ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
                )}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <div>
                        <h2 id={titleId} className="text-xl font-bold text-text-primary">{title}</h2>
                        {description && <p id={descriptionId} className="text-sm text-text-muted mt-1">{description}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-text-muted hover:text-text-primary p-1 hover:bg-surface-hover rounded-lg transition-colors"
                        aria-label="Close modal"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );

    // Mount to document.body (Portal)
    // Note: In a real app we might mount to a specific #modal-root
    return createPortal(modalContent, document.body);
};
