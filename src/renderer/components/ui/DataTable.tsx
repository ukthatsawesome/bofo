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
    sortKey?: keyof T | string; // Key to sort by if accessor is a function
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
    sortColumn?: keyof T | string;
    sortDirection?: 'asc' | 'desc';
    onSort?: (column: keyof T | string) => void;
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
    emptyMessage = "No data available",
    sortColumn,
    sortDirection,
    onSort
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

    const handleHeaderClick = (col: Column<T>) => {
        if (col.sortable && onSort) {
            // Prioritize sortKey if provided, otherwise use accessor if it's a string/key
            const key = col.sortKey || (typeof col.accessor === 'string' ? col.accessor : null);

            if (key) {
                onSort(key as string);
            } else {
                console.warn('DataTable: Sortable column missing sortKey or string accessor', col);
            }
        }
    };

    return (
        <div className="w-full overflow-hidden rounded-xl border border-border bg-surface-card shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-surface-hover border-b border-border">
                            {columns.map((col, idx) => {
                                const sortIdentifier = col.sortKey || (typeof col.accessor === 'string' ? col.accessor : undefined);
                                const isSorted = sortColumn === sortIdentifier;
                                return (
                                    <th
                                        key={idx}
                                        onClick={() => handleHeaderClick(col)}
                                        className={clsx(
                                            "px-6 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap transition-colors",
                                            col.sortable && "cursor-pointer hover:bg-surface-active hover:text-text-primary select-none",
                                            col.className
                                        )}
                                    >
                                        <div className="flex items-center gap-1">
                                            {col.header}
                                            {col.sortable && (
                                                <div className="flex flex-col">
                                                    {isSorted && sortDirection === 'asc' && <ChevronUp size={14} className="text-brand-primary" />}
                                                    {isSorted && sortDirection === 'desc' && <ChevronDown size={14} className="text-brand-primary" />}
                                                    {!isSorted && <div className="w-3.5 h-3.5" />} {/* Placeholder */}
                                                </div>
                                            )}
                                        </div>
                                    </th>
                                );
                            })}
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
