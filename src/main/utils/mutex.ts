
/**
 * Simple Mutex for serializing async operations
 */
export class Mutex {
    private _locked = false;
    private _queue: (() => void)[] = [];

    /**
     * Run a task exclusively. Waits for previous tasks to complete.
     */
    async runExclusive<T>(task: () => Promise<T>): Promise<T> {
        const release = await this.acquire();
        try {
            return await task();
        } finally {
            release();
        }
    }

    private acquire(): Promise<() => void> {
        const release = () => {
            this._locked = false;
            const next = this._queue.shift();
            if (next) {
                this._locked = true;
                // Ensure next runs in next tick to avoid stack growth
                setImmediate(next);
            }
        };

        if (!this._locked) {
            this._locked = true;
            return Promise.resolve(release);
        }

        return new Promise((resolve) => {
            this._queue.push(() => {
                this._locked = true; // Claim it
                resolve(release);
            });
        });
    }
}
