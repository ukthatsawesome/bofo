
import { JSX } from 'preact';

interface ActionGroupProps {
    children: preact.ComponentChildren;
    align?: 'start' | 'end' | 'between' | 'center';
    className?: string;
}

export const ActionGroup = ({
    children,
    align = 'end',
    className = ''
}: ActionGroupProps) => {

    const alignments = {
        start: 'justify-start',
        end: 'justify-end',
        between: 'justify-between',
        center: 'justify-center'
    };

    return (
        <div className={`flex items-center gap-3 ${alignments[align]} ${className}`}>
            {children}
        </div>
    );
};
