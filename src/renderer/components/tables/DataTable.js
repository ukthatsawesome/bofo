/**
 * DataTable Component - Tailwind version
 * Reusable data table with sortable columns
 */
export const DataTable = ({
    columns,
    data,
    emptyMsg = 'No data available',
    id = ''
}) => {
    return `
        <table class="data-table-tw w-full" ${id ? `id="${id}"` : ''}>
            <thead>
                <tr>
                    ${columns.map(col => `
                        <th 
                            class="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-text-muted
                                   ${col.sortable ? 'cursor-pointer select-none hover:bg-brand-primary/10 transition-colors' : ''}"
                            ${col.id ? `id="${col.id}"` : ''}
                            ${col.onclick ? `onclick="${col.onclick}"` : ''}
                        >
                            <div class="flex items-center gap-2">
                                <span>${col.label}</span>
                                ${col.sortable ? `
                                    <i data-lucide="arrow-up-down" class="w-3.5 h-3.5 opacity-40 transition-opacity group-hover:opacity-100"></i>
                                ` : ''}
                            </div>
                        </th>
                    `).join('')}
                </tr>
            </thead>
            <tbody>
                ${data.length > 0 ? data.map(row => `
                    <tr class="transition-colors hover:bg-white/[0.02]">
                        ${columns.map(col => `
                            <td class="px-5 py-4 bg-surface-panel/30 first:rounded-l-xl last:rounded-r-xl">
                                ${row[col.key] || ''}
                            </td>
                        `).join('')}
                    </tr>
                `).join('') : `
                    <tr>
                        <td colspan="${columns.length}" class="px-5 py-12 text-center text-text-muted bg-surface-panel/30 rounded-xl">
                            ${emptyMsg}
                        </td>
                    </tr>
                `}
            </tbody>
        </table>
    `;
};
