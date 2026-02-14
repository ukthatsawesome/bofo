import { useState, useMemo } from 'preact/hooks';

type SortDirection = 'asc' | 'desc';

interface UseSortedDataProps<T> {
    data: T[];
    initialSortColumn?: keyof T | string;
    initialSortDirection?: SortDirection;
}

export const useSortedData = <T>({
    data,
    initialSortColumn,
    initialSortDirection = 'asc'
}: UseSortedDataProps<T>) => {
    const [sortColumn, setSortColumn] = useState<keyof T | string | undefined>(initialSortColumn);
    const [sortDirection, setSortDirection] = useState<SortDirection>(initialSortDirection);

    const handleSort = (column: keyof T | string) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const sortedData = useMemo(() => {
        if (!sortColumn) return data;

        return [...data].sort((a, b) => {
            const aValue = (a as any)[sortColumn];
            const bValue = (b as any)[sortColumn];

            if (aValue === bValue) return 0;

            // Handle null/undefined
            if (aValue === null || aValue === undefined) return 1;
            if (bValue === null || bValue === undefined) return -1;

            // String comparison (case insensitive)
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortDirection === 'asc'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            }

            // Numeric comparison
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortDirection === 'asc'
                    ? aValue - bValue
                    : bValue - aValue;
            }

            // Date comparison (if strictly Date objects or timestamps)
            if (aValue instanceof Date && bValue instanceof Date) {
                return sortDirection === 'asc'
                    ? aValue.getTime() - bValue.getTime()
                    : bValue.getTime() - aValue.getTime();
            }

            // Fallback
            return sortDirection === 'asc'
                ? (aValue > bValue ? 1 : -1)
                : (bValue > aValue ? 1 : -1);
        });
    }, [data, sortColumn, sortDirection]);

    return {
        sortedData,
        sortColumn,
        sortDirection,
        handleSort
    };
};
