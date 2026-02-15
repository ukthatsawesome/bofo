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
import { TransactionController } from './ipc/controllers/TransactionController';
import { AccountController } from './ipc/controllers/AccountController';
import { FinanceController } from './ipc/controllers/FinanceController';
import { SettingsController } from './ipc/controllers/SettingsController';
import { GoalController } from './ipc/controllers/GoalController';
import { BudgetController } from './ipc/controllers/BudgetController';
import { RecurringController } from './ipc/controllers/RecurringController';
import { BillController } from './ipc/controllers/BillController';
import { AnomalyController } from './ipc/controllers/AnomalyController';
import { BofoAIController } from './ipc/controllers/BofoAIController';
import { CategoryController } from './ipc/controllers/CategoryController';
import { AuditController } from './ipc/controllers/AuditController';
import { SETTING_KEYS } from '../shared/settings/keys';
import { RemoteConfigService } from './config/RemoteConfig';

// Build a map of allowed web routes from Controllers
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
  new AuditController()
];

const WEB_ROUTES: Record<string, Function> = {};

// Flatten controller routes into a single map
// Note: We skip 'export' related routes safely as they might depend on Electron dialogs which don't work in headless web request context
// unless we handle them carefully. For now, we include most CRUD.
for (const controller of controllers) {
  const routes = controller.registerRoutes();
  for (const [channel, route] of Object.entries(routes)) {
    if (!route) continue;
    // Modern route object vs legacy function
    const handler = (typeof route === 'object' && 'handler' in route) ? route.handler : route;
    WEB_ROUTES[channel] = handler as Function;
  }
}

function getFinanceModel() {
  // Legacy helper removal or keep if needed elsewhere
  return require('./models/finance').FinanceModel;
}

let server: http.Server | null = null;

// =============================================================================
// SECURITY CONFIGURATION
// =============================================================================

const SECURITY_CONFIG = {
  maxBodySize: 1024 * 1024, // 1MB max request body
  rateLimitWindow: 60 * 1000, // 1 minute window
  rateLimitMax: 100, // Max requests per window per IP
  allowedChannelPattern: /^[a-z][a-z0-9-]*$/i,
};

// Rate limiting store (IP -> { count, resetTime })
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Allowed origins for CORS (configurable)
let allowedOrigins = new Set<string>();

// =============================================================================
// SECURITY UTILITIES
// =============================================================================

/**
 * Constant-time string comparison to prevent timing attacks
 */
function secureCompare(a: string | unknown, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still do comparison to maintain constant time
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
  // In development, show full errors; in production, generic message
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

  // Check if origin is in whitelist or is localhost in dev mode
  const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
  const isAllowed = origins.has(origin) || (isDev && isLocalhost);

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (isDev) {
    // In dev mode, also allow local network origins (e.g. 192.168.x.x)
    // for easier mobile testing, even if not explicitly in whitelist
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

// =============================================================================
// WEB SERVER
// =============================================================================

import { Logger } from './utils/logger';

// ... imports

export async function startWebServer(): Promise<void> {
  Logger.info('[Web Server] Checking configuration...');
  if (server) return;

  try {
    const isDev = !app.isPackaged;
    const config = await RemoteConfigService.getEffectiveConfig();
    const { enabled, port, apiKey, allowedOrigins, external } = config;

    Logger.info(`[Web Server] Config: Port=${port}, Enabled=${enabled} (External=${external})`);
    const originsList = [...allowedOrigins].join(', ') || '(dev mode: localhost)';
    Logger.info(`[Web Server] Allowed origins: ${originsList}`);

    if (!enabled) return;

    server = http.createServer(async (req, res) => {
      const clientIP = getClientIP(req);

      // Set security headers on all responses
      setSecurityHeaders(res);

      // Handle CORS
      handleCORS(req, res, isDev, allowedOrigins);

      // Handle preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // GET Request - Serve static files (Production only)
      if (req.method === 'GET') {
        const url = req.url || '/';
        // Determine base path for static files
        // In production (packaged), dist/renderer is located relative to the app
        const rendererPath = path.join(
          app.getAppPath(),
          app.isPackaged ? 'dist/renderer' : 'src/renderer'
        );

        let filePath = path.join(rendererPath, url === '/' ? 'index.html' : url);

        // Security: Prevent path traversal
        if (!filePath.startsWith(rendererPath)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        fs.readFile(filePath, (err, data) => {
          if (err) {
            // Fallback to index.html for SPA routing if file not found
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

          // Simple mime type detection
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

      // Rate limiting for API calls (POST)
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

      // Only allow POST for API
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed. Use POST or visit UI via GET.' }));
        return;
      }

      // Authenticate with constant-time comparison
      const providedKey = (req.headers['x-api-key'] as string) || '';
      if (!secureCompare(providedKey, apiKey)) {
        // Add small delay to further prevent timing attacks
        await new Promise((r) => setTimeout(r, 100 + Math.random() * 100));
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      try {
        // Read body with size limit
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

        // Validate channel name
        if (!isValidChannel(channel)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid channel name' }));
          return;
        }

        // Check if channel exists and is allowed via web
        const handler = WEB_ROUTES[channel];
        if (!handler) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({ error: `Channel '${channel}' not found or not available via web` })
          );
          return;
        }

        // Execute handler
        const result = await handler(null, data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        Logger.error(`[Web Server] Error from ${clientIP}:`, (err as Error).message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: sanitizeError(err) }));
      }
    });

    // Check if external access is explicitly enabled
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
