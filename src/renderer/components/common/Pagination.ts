/**
 * Pagination Component - Tailwind version
 */

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    id?: string;
    onPrev?: string;
    onNext?: string;
}

export const Pagination = ({
    currentPage,
    totalPages,
    id = 'pagination',
    onPrev = '',
    onNext = ''
}: PaginationProps): string => `
    <div id="${id}" class="flex items-center justify-center gap-3 mt-5">
        <button 
            class="btn-secondary btn-sm flex items-center gap-2"
            id="prev-page" 
            ${currentPage === 1 ? 'disabled' : ''}
            ${onPrev ? `onclick="${onPrev}"` : ''}
        >
            <i data-lucide="chevron-left" class="w-4 h-4"></i>
            Previous
        </button>
        <span class="text-sm text-text-muted px-3">
            Page <span class="font-semibold text-text-main">${currentPage}</span> of ${totalPages}
        </span>
        <button 
            class="btn-secondary btn-sm flex items-center gap-2"
            id="next-page" 
            ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}
            ${onNext ? `onclick="${onNext}"` : ''}
        >
            Next
            <i data-lucide="chevron-right" class="w-4 h-4"></i>
        </button>
    </div>
`;
