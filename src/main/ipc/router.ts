
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Logger } from '../utils/logger';
import { z } from 'zod';

export type RouteHandler<T = any> = (event: IpcMainInvokeEvent, args: T) => Promise<any> | any;

export interface RouteDefinition<T = any> {
  handler: RouteHandler<T>;
  // Optional schema. If provided, args will be parsed/validated before handler is called.
  schema?: z.ZodSchema<T>;
}

// Support both legacy (function) and modern (object) route definitions
export type Route = RouteHandler | RouteDefinition;

export interface IController {
  registerRoutes(): Record<string, Route>;
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
      for (const [channel, route] of Object.entries(routes)) {
        Logger.info(`[IpcRouter] Attempting to register ${channel} for ${controller.constructor.name}`);
        if (this.registeredChannels.has(channel)) {
          Logger.warn(`[IpcRouter] Duplicate channel detected: ${channel}. Skipping.`);
          continue;
        }

        const isModern = typeof route === 'object' && 'handler' in route;
        const handler = isModern ? (route as RouteDefinition).handler : (route as RouteHandler);
        const schema = isModern ? (route as RouteDefinition).schema : undefined;

        // Ensure idempotency by removing any existing handler for this channel
        ipcMain.removeHandler(channel);

        ipcMain.handle(channel, async (event, ...args) => {
          try {
            // In Electron IPC, the first arg is event. The rest are arguments.
            // We assume our modern handlers take a SINGLE argument object (common practice).
            // If multiple args are passed but we have a schema, we validate the first one.
            const input = args[0];

            if (schema) {
              try {
                const validated = schema.parse(input);
                return await handler(event, validated);
              } catch (validationError: any) {
                const isTupleUndefined = validationError.issues?.[0]?.code === 'invalid_type' &&
                  validationError.issues?.[0]?.expected === 'tuple' &&
                  input === undefined;

                if (!isTupleUndefined) {
                  Logger.warn(`[IpcRouter] Validation failed for ${channel}:`, validationError);
                }

                return {
                  error: true,
                  code: 'VALIDATION_ERROR',
                  message: 'Invalid request data',
                  details: validationError.errors
                };
              }
            }

            // Legacy or No-Schema path
            // @ts-ignore
            return await handler(event, ...args);

          } catch (error: any) {
            // Logger.error is already called in the handlers usually, but double logging here for safety
            // Actually, duplicate logging can be noisy. Let's log only if not handled? 
            // Logic in original router was:
            Logger.error(`[IpcRouter] Error in ${channel}:`, error);

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
        Logger.info(`[IpcRouter] Registered ${channel} ${schema ? '(Validated)' : ''}`);
      }
    }
  }

  public getRegisteredChannels(): string[] {
    return Array.from(this.registeredChannels);
  }
}
