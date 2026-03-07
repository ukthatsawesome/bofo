import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Logger } from '../utils/logger';
import { z } from 'zod';

export type RouteHandler<T = any> = (event: IpcMainInvokeEvent, args: T) => Promise<any> | any;

export interface RouteDefinition<T = any> {
  handler: RouteHandler<T>;

  schema?: z.ZodSchema<T>;
}

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
        Logger.info(
          `[IpcRouter] Attempting to register ${channel} for ${controller.constructor.name}`
        );
        if (this.registeredChannels.has(channel)) {
          Logger.warn(`[IpcRouter] Duplicate channel detected: ${channel}. Skipping.`);
          continue;
        }

        const isModern = typeof route === 'object' && 'handler' in route;
        const handler = isModern ? (route as RouteDefinition).handler : (route as RouteHandler);
        const schema = isModern ? (route as RouteDefinition).schema : undefined;

        ipcMain.removeHandler(channel);

        ipcMain.handle(channel, async (event, ...args) => {
          try {
            const input = args[0];

            if (schema) {
              try {
                const validated = schema.parse(input);
                return await handler(event, validated);
              } catch (validationError: any) {
                const isTupleUndefined =
                  validationError.issues?.[0]?.code === 'invalid_type' &&
                  validationError.issues?.[0]?.expected === 'tuple' &&
                  input === undefined;

                if (!isTupleUndefined) {
                  Logger.warn(`[IpcRouter] Validation failed for ${channel}:`, validationError);
                }

                return {
                  error: true,
                  code: 'VALIDATION_ERROR',
                  message: 'Invalid request data',
                  details: validationError.errors,
                };
              }
            }

            // @ts-ignore
            return await handler(event, ...args);
          } catch (error: any) {
            Logger.error(`[IpcRouter] Error in ${channel}:`, error);

            let code = 'INTERNAL_ERROR';

            if (error.code === 'SQLITE_BUSY') code = 'DATABASE_LOCKED';
            if (
              error.message &&
              (error.message.includes('404') || error.message.includes('not found'))
            ) {
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
