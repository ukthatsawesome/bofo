/**
 * Worker Pool Utility
 * 
 * Provides a simple Promise-based API for running tasks in worker threads.
 * Used to offload CPU-intensive operations (JSON serialization, Excel generation)
 * from the main Electron process to prevent UI freezing.
 */

import { Worker } from 'worker_threads';
import * as path from 'path';
import { app } from 'electron';
import { Logger } from './logger';

export interface WorkerTask {
    type: string;
    data?: unknown;
    filePath?: string;
    options?: unknown;
    tableData?: Array<{ tableName: string; data: unknown[] }>;
}

export interface WorkerResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Run a task in a worker thread.
 * 
 * @param workerName - Name of the worker file (without extension)
 * @param task - Task object to send to the worker
 * @param timeout - Maximum time to wait (default: 5 minutes)
 * @returns Promise resolving to worker result
 */
export function runInWorker<TOutput>(
    workerName: string,
    task: WorkerTask,
    timeout: number = 300000
): Promise<WorkerResult<TOutput>> {
    return new Promise((resolve, reject) => {
        // In production, workers are in resources/app.asar.unpacked or resources/app
        // In development, they're in dist/main/workers
        const isDev = !app.isPackaged;
        const workerDir = isDev
            ? path.join(__dirname, '..', 'workers')
            : path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'main', 'workers');

        const workerPath = path.join(workerDir, `${workerName}.js`);

        let worker: Worker;
        let timeoutId: NodeJS.Timeout;

        try {
            worker = new Worker(workerPath, {
                workerData: task,
            });
        } catch (err: any) {
            Logger.error(`[WorkerPool] Failed to spawn worker ${workerName}:`, err.message);
            resolve({
                success: false,
                error: `Failed to spawn worker: ${err.message}`,
            });
            return;
        }

        // Set timeout
        timeoutId = setTimeout(() => {
            worker.terminate();
            resolve({
                success: false,
                error: `Worker timeout after ${timeout}ms`,
            });
        }, timeout);

        worker.on('message', (result: WorkerResult<TOutput>) => {
            clearTimeout(timeoutId);
            worker.terminate();
            resolve(result);
        });

        worker.on('error', (err: Error) => {
            clearTimeout(timeoutId);
            worker.terminate();
            Logger.error(`[WorkerPool] Worker error:`, err);
            resolve({
                success: false,
                error: err.message,
            });
        });

        worker.on('exit', (code) => {
            clearTimeout(timeoutId);
            if (code !== 0) {
                resolve({
                    success: false,
                    error: `Worker exited with code ${code}`,
                });
            }
        });
    });
}

/**
 * Check if worker threads are available.
 * Always true in Node.js 12+, but useful for testing.
 */
export function isWorkerSupported(): boolean {
    try {
        require('worker_threads');
        return true;
    } catch {
        return false;
    }
}
