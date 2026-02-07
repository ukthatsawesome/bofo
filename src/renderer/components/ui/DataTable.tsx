import { h, ComponentChildren, FunctionalComponent } from 'preact';
import { ChevronUp, ChevronDown, CheckSquare } from 'lucide-preact';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Generic Table Column Definition
export interface Column<T> {
    header: string;
    accessor: keyof T | ((item: T) => ComponentChildren);
    className?: string; // Class for the cell
    headerClassName?: string;
    sortable?: boolean;
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    keyField: keyof T;
    isLoading?: boolean;
    onRowClick?: (item: T) => void;
    selectedIds?: Set<number | string>;
    onSelectionChange?: (ids: Set<number | string>) => void;
    selectable?: boolean;
    emptyMessage?: string;
}

export const DataTable = <T,>({
    data,
    columns,
    keyField,
    isLoading,
    onRowClick,
    selectedIds,
    onSelectionChange,
    selectable = false,
    emptyMessage = "No data available"
}: DataTableProps<T>) => {

    if (isLoading) {
        return (
            <div className="w-full h-48 flex items-center justify-center text-text-muted animate-pulse">
                Loading data...
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="w-full h-48 flex flex-col items-center justify-center text-text-muted bg-surface-card/50 rounded-xl border border-dashed border-border">
                <p>{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="w-full overflow-hidden rounded-xl border border-border bg-surface-card shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-surface-hover border-b border-border">
                            {columns.map((col, idx) => (
                                <th
                                    key={idx}
                                    className={clsx(
                                        "px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap",
                                        col.className
                                    )}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {data.map((item) => (
                            <tr
                                key={String(item[keyField])}
                                onClick={() => onRowClick && onRowClick(item)}
                                className={clsx(
                                    "group transition-colors",
                                    onRowClick ? "cursor-pointer hover:bg-surface-hover" : ""
                                )}
                            >
                                {columns.map((col, idx) => (
                                    <td
                                        key={idx}
                                        className={clsx(
                                            "px-6 py-4 text-sm text-text-primary whitespace-nowrap",
                                            col.className
                                        )}
                                    >
                                        {typeof col.accessor === 'function'
                                            ? col.accessor(item)
                                            : (item[col.accessor] as ComponentChildren)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
