
import { ipcMain, IpcMainInvokeEvent } from 'electron';

export interface IController {
  registerRoutes(): Record<string, (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any>;
}

export class IpcRouter {
  private controllers: IController[] = [];
  private registeredChannels: Set<string> = new Set();

  constructor(controllers: IController[]) {
    this.controllers = controllers;
  }

  public registerAll(): void {
    for (const controller of this.controllers) {
      const routes = controller.registerRoutes();
      for (const [channel, handler] of Object.entries(routes)) {
        if (this.registeredChannels.has(channel)) {
          console.warn(`[IpcRouter] Duplicate channel detected: ${channel}. Skipping.`);
          continue;
        }

        ipcMain.handle(channel, async (event, ...args) => {
          try {
             // Bind context if not already bound, but we expect registerRoutes to return bound methods or arrow funcs
             return await handler(event, ...args);
          } catch (error: any) {
             console.error(`[IpcRouter] Error in ${channel}:`, error);
             
             let code = 'INTERNAL_ERROR';
             // Map known errors
             if (error.code === 'SQLITE_BUSY') code = 'DATABASE_LOCKED';
             if (error.message && (error.message.includes('404') || error.message.includes('not found'))) {
                 code = 'AI_MODEL_NOT_FOUND';
             }

             return { error: true, code, message: error.message || 'Unknown error occurred' };
          }
        });
        
        this.registeredChannels.add(channel);
        console.log(`[IpcRouter] Registered ${channel}`);
      }
    }
  }

  public getRegisteredChannels(): string[] {
    return Array.from(this.registeredChannels);
  }
}
