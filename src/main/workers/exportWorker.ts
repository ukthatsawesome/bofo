/**
 * Export Worker
 * 
 * Handles CPU-intensive export operations off the main thread:
 * - JSON serialization and file writing
 * - Excel workbook generation
 */

import { parentPort, workerData } from 'worker_threads';
import * as fs from 'fs';

interface WorkerTask {
    type: 'json-export' | 'excel-export' | 'json-streaming-export';
    data?: unknown;
    filePath: string;
    tableData?: Array<{ tableName: string; data: unknown[] }>;
    options?: {
        sheets?: Array<{
            name: string;
            data: any[];
            headers: string[];
        }>;
    };
}

interface WorkerResult {
    success: boolean;
    data?: unknown;
    error?: string;
}

async function handleTask(task: WorkerTask): Promise<WorkerResult> {
    try {
        switch (task.type) {
            case 'json-export':
                return await handleJsonExport(task);
            case 'json-streaming-export':
                return await handleStreamingJsonExport(task);
            case 'excel-export':
                return await handleExcelExport(task);
            default:
                return { success: false, error: `Unknown task type: ${(task as any).type}` };
        }
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Serialize data to JSON and write to file.
 * This is the main CPU-intensive operation for large datasets.
 */
async function handleJsonExport(task: WorkerTask): Promise<WorkerResult> {
    const jsonString = JSON.stringify(task.data, null, 2);
    await fs.promises.writeFile(task.filePath, jsonString, 'utf8');
    return { success: true };
}

/**
 * Streaming JSON export for large databases.
 * Writes data incrementally without holding entire dataset in memory.
 */
async function handleStreamingJsonExport(task: WorkerTask): Promise<WorkerResult> {
    if (!task.tableData) {
        return { success: false, error: 'No tableData provided for streaming export' };
    }

    const tableData = task.tableData;  // Capture after null check to satisfy TS
    const stream = fs.createWriteStream(task.filePath, { encoding: 'utf8' });

    return new Promise((resolve) => {
        stream.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });

        // Write header
        stream.write('{\n');
        stream.write(`  "version": 2,\n`);
        stream.write(`  "exportedAt": "${new Date().toISOString()}",\n`);
        stream.write('  "data": {\n');

        // Write each table
        const tableCount = tableData.length;
        tableData.forEach((table, index) => {
            const isLast = index === tableCount - 1;
            const jsonData = JSON.stringify(table.data, null, 4)
                .split('\n')
                .map((line, i) => i === 0 ? line : '    ' + line)
                .join('\n');

            stream.write(`    "${table.tableName}": ${jsonData}${isLast ? '' : ','}\n`);
        });

        stream.write('  }\n');
        stream.write('}\n');

        stream.end(() => {
            resolve({ success: true });
        });
    });
}

/**
 * Generate Excel workbook with multiple sheets.
 */
async function handleExcelExport(task: WorkerTask): Promise<WorkerResult> {
    if (!task.options?.sheets) {
        return { success: false, error: 'No sheets provided for Excel export' };
    }

    // @ts-ignore - Dynamic import
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bofo Finance Manager';
    workbook.created = new Date();

    for (const sheetConfig of task.options.sheets) {
        const sheet = workbook.addWorksheet(sheetConfig.name);

        // Add headers
        sheet.getRow(1).values = sheetConfig.headers;
        sheet.getRow(1).font = { bold: true };

        // Add data rows
        if (sheetConfig.data && sheetConfig.data.length > 0) {
            for (const row of sheetConfig.data) {
                const rowData = sheetConfig.headers.map(h => row[h] ?? '');
                sheet.addRow(rowData);
            }
        }

        // Auto-width columns
        if (sheet.columns) {
            for (const column of sheet.columns) {
                if (!column) continue;
                let maxLength = 0;
                if (column.eachCell) {
                    column.eachCell({ includeEmpty: true }, (cell: any) => {
                        const columnLength = cell.value ? cell.value.toString().length : 10;
                        if (columnLength > maxLength) {
                            maxLength = columnLength;
                        }
                    });
                }
                column.width = maxLength < 10 ? 10 : Math.min(maxLength + 2, 50);
            }
        }
    }

    await workbook.xlsx.writeFile(task.filePath);
    return { success: true };
}

// Main worker execution
(async () => {
    const task = workerData as WorkerTask;
    const result = await handleTask(task);
    parentPort?.postMessage(result);
})();
