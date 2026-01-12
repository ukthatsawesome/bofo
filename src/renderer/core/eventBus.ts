/**
 * Simple Event Bus for decoupled communication between modules
 */

type Callback = (data?: any) => void;

class EventBus {
    private events: Record<string, Callback[]>;

    constructor() {
        this.events = {};
    }

    /**
     * Subscribe to an event
     */
    on(event: string, callback: Callback): void {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    /**
     * Emit an event
     */
    emit(event: string, data?: any): void {
        if (this.events[event]) {
            this.events[event].forEach(callback => callback(data));
        }
    }

    /**
     * Unsubscribe from an event
     */
    off(event: string, callback: Callback): void {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
}

export const eventBus = new EventBus();
