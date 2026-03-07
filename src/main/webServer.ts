/**
 * Secure Web Server for Remote Access
 *
 * Security Features:
 * - Strict CORS with origin whitelist
 * - Rate limiting per IP
 * - Request body size limits
 * - Input validation and sanitization
 * - Security headers
 * - Constant-time API key comparison
 */

import * as http from 'http';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { RemoteConfigService } from './config/RemoteConfig';

function getFinanceModel() {
  return require('./models/finance').FinanceModel;
}

let server: http.Server | null = null;

function buildWebRoutes(): Record<string, Function> {
  const { TransactionController } = require('./ipc/controllers/TransactionController');
  const { AccountController } = require('./ipc/controllers/AccountController');
  const { FinanceController } = require('./ipc/controllers/FinanceController');
  const { SettingsController } = require('./ipc/controllers/SettingsController');
  const { GoalController } = require('./ipc/controllers/GoalController');
  const { BudgetController } = require('./ipc/controllers/BudgetController');
  const { RecurringController } = require('./ipc/controllers/RecurringController');
  const { BillController } = require('./ipc/controllers/BillController');
  const { AnomalyController } = require('./ipc/controllers/AnomalyController');
  const { BofoAIController } = require('./ipc/controllers/BofoAIController');
  const { CategoryController } = require('./ipc/controllers/CategoryController');
  const { AuditController } = require('./ipc/controllers/AuditController');
  const { ExportController } = require('./ipc/controllers/ExportController');

  const controllers = [
    new TransactionController(),
    new AccountController(),
    new FinanceController(),
    new SettingsController(),
    new GoalController(),
    new BudgetController(),
    new RecurringController(),
    new BillController(),
    new AnomalyController(),
    new BofoAIController(),
    new CategoryController(),
    new AuditController(),
    new ExportController(),
  ];

  const routes: Record<string, Function> = {};
  for (const controller of controllers) {
    const controllerRoutes = controller.registerRoutes();
    for (const [channel, route] of Object.entries(controllerRoutes)) {
      if (!route) continue;
      const handler = typeof route === 'object' && 'handler' in route ? route.handler : route;
      routes[channel] = handler as Function;
    }
  }
  return routes;
}

const SECURITY_CONFIG = {
  maxBodySize: 50 * 1024 * 1024, // 50MB max request body (for backup imports)
  rateLimitWindow: 60 * 1000, // 1 minute window
  rateLimitMax: 100, // Max requests per window per IP
  allowedChannelPattern: /^[a-z][a-z0-9-]*$/i,
};

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const allowedOrigins = new Set<string>();

/**
 * Constant-time string comparison to prevent timing attacks
 */
function secureCompare(a: string | unknown, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Get client IP address from request
 */
function getClientIP(req: http.IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Check rate limit for an IP
 */
function checkRateLimit(ip: string): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + SECURITY_CONFIG.rateLimitWindow });
    return { allowed: true, remaining: SECURITY_CONFIG.rateLimitMax - 1 };
  }

  if (record.count >= SECURITY_CONFIG.rateLimitMax) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((record.resetTime - now) / 1000) };
  }

  record.count++;
  return { allowed: true, remaining: SECURITY_CONFIG.rateLimitMax - record.count };
}

/**
 * Validate channel name to prevent injection
 */
function isValidChannel(channel: unknown): boolean {
  if (typeof channel !== 'string') return false;
  if (channel.length < 1 || channel.length > 100) return false;
  return SECURITY_CONFIG.allowedChannelPattern.test(channel);
}

/**
 * Sanitize error messages for client (don't leak internal details)
 */
function sanitizeError(err: any): string {
  const isDev = !app.isPackaged;
  if (isDev) return err.message || String(err);
  return 'An error occurred processing your request';
}

/**
 * Set security headers on response
 */
function setSecurityHeaders(res: http.ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Cache-Control', 'no-store');
}

/**
 * Handle CORS with origin validation
 */
function handleCORS(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  isDev: boolean,
  origins: Set<string>
): void {
  const origin = req.headers.origin;

  if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return;
  }

  const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
  const isAllowed = origins.has(origin) || (isDev && isLocalhost);

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (isDev) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
}

/**
 * Read request body with size limit
 */
function readBody(req: http.IncomingMessage, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;

    req.on('data', (chunk: any) => {
      size += chunk.length;
      if (size > maxSize) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      body += chunk.toString();
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

import { Logger } from './utils/logger';

export async function startWebServer(): Promise<void> {
  Logger.info('[Web Server] Checking configuration...');
  if (server) return;

  try {
    const WEB_ROUTES = buildWebRoutes();
    const isDev = !app.isPackaged;
    const config = await RemoteConfigService.getEffectiveConfig();
    const { enabled, port, apiKey, allowedOrigins, external } = config;

    Logger.info(`[Web Server] Config: Port=${port}, Enabled=${enabled} (External=${external})`);
    const originsList = [...allowedOrigins].join(', ') || '(dev mode: localhost)';
    Logger.info(`[Web Server] Allowed origins: ${originsList}`);

    if (!enabled) return;

    server = http.createServer(async (req, res) => {
      const clientIP = getClientIP(req);

      setSecurityHeaders(res);

      handleCORS(req, res, isDev, allowedOrigins);

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'GET') {
        const url = req.url || '/';

        const rendererPath = path.join(
          app.getAppPath(),
          app.isPackaged ? 'dist/renderer' : 'src/renderer'
        );

        const filePath = path.join(rendererPath, url === '/' ? 'index.html' : url);

        if (!filePath.startsWith(rendererPath)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        fs.readFile(filePath, (err, data) => {
          if (err) {
            if (err.code === 'ENOENT') {
              fs.readFile(path.join(rendererPath, 'index.html'), (e, d) => {
                if (e) {
                  res.writeHead(404);
                  res.end('App UI not found. Run "npm run build" if in dev mode.');
                  return;
                }
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(d);
              });
            } else {
              res.writeHead(500);
              res.end(`Server Error: ${err.code}`);
            }
            return;
          }

          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
          };

          res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
          res.end(data);
        });
        return;
      }

      const rateLimit = checkRateLimit(clientIP);
      res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);

      if (!rateLimit.allowed) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'Too many requests',
            retryAfter: rateLimit.retryAfter,
          })
        );
        return;
      }

      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed. Use POST or visit UI via GET.' }));
        return;
      }

      const providedKey = (req.headers['x-api-key'] as string) || '';
      if (!secureCompare(providedKey, apiKey)) {
        await new Promise((r) => setTimeout(r, 100 + Math.random() * 100));
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      try {
        const body = await readBody(req, SECURITY_CONFIG.maxBodySize);

        let parsed: any;
        try {
          parsed = JSON.parse(body);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }

        const { channel, data } = parsed;

        if (!isValidChannel(channel)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid channel name' }));
          return;
        }

        const handler = WEB_ROUTES[channel];
        if (!handler) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({ error: `Channel '${channel}' not found or not available via web` })
          );
          return;
        }

        const result = await handler(null, data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        Logger.error(`[Web Server] Error from ${clientIP}:`, (err as Error).message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: sanitizeError(err) }));
      }
    });

    const bindAddress = external ? '0.0.0.0' : '127.0.0.1';

    server.listen(port, bindAddress, () => {
      Logger.info(`[Web Server] Remote access enabled on ${bindAddress}:${port}`);
    });

    server.on('error', (err) => {
      Logger.error('[Web Server] Error:', err.message);
      server = null;
    });
  } catch (err) {
    Logger.error('[Web Server] Startup error:', err);
  }
}

/**
 * Stops the web server
 */
export function stopWebServer(): void {
  if (server) {
    server.close();
    server = null;
    rateLimitStore.clear();
    Logger.info('[Web Server] Remote access disabled');
  }
}

/**
 * Restart server with new settings
 */
export async function restartWebServer(): Promise<void> {
  stopWebServer();
  await startWebServer();
}
