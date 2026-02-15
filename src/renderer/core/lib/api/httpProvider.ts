/**
 * HTTP API Provider
 *
 * Implements the Bofo API interface using fetch for the Web version.
 * Acts as an adapter to translate UI intent into HTTP requests.
 */

export class HttpApiProvider {
  host: string;
  key: string;
  private _promptLock: Promise<boolean> | null = null;
  private _authRetryCount = 0;
  private static MAX_AUTH_RETRIES = 2;

  constructor() {
    // Defaults for Dev environment
    // Detect default host based on current location
    let defaultHost = 'http://localhost:5174';
    if (typeof location !== 'undefined' && location.hostname) {
      if (location.port === '5173') {
        // In dev mode (Vite), API is usually on the next port
        defaultHost = `http://${location.hostname}:5174`;
      } else if (location.port === '5174') {
        // If visiting via the backend server itself
        defaultHost = location.origin;
      } else if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        // If visiting via an IP, try same IP with 5174
        defaultHost = `http://${location.hostname}:5174`;
      }
    }

    this.host = localStorage.getItem('bofo_remote_host') || defaultHost;
    this.key = localStorage.getItem('bofo_remote_key') || '';

    // Proxy to handle all methods dynamically
    return new Proxy(this, {
      get: (target: any, prop: string | symbol) => {
        if (prop in target) return target[prop as keyof HttpApiProvider]; // Return explicit methods if defined

        // Default handling for all other API methods
        return async (data: any) => {
          // Convert camelCase method names to kebab-case channel names
          // e.g., getSettings -> get-settings, parseTransactionAI -> parse-transaction-ai
          const channel = target._toKebabCase(String(prop));
          return await target._request(channel, data);
        };
      },
    });
  }

  /**
   * Convert camelCase to kebab-case
   * Handles acronyms properly:
   * - getSettings -> get-settings
   * - getAISettings -> get-ai-settings
   * - parseTransactionAI -> parse-transaction-ai
   */
  _toKebabCase(str: string): string {
    return (
      str
        // Handle sequences of uppercase letters followed by lowercase (e.g., AISettings -> AI-Settings)
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
        // Handle lowercase followed by uppercase (e.g., getA -> get-A)
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase()
    );
  }

  /**
   * Internal request handler
   */
  async _request(channel: string, data?: any): Promise<any> {
    // Ensure we have a valid config before proceeding
    if (!this.validConfig()) {
      const success = await this.ensureConfig();
      if (!success) return null;
    }

    try {
      const response = await fetch(`${this.host}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.key,
        },
        body: JSON.stringify({ channel, data }),
      });

      if (response.status === 401) {
        // Key is invalid. Force a re-config.
        console.warn('[HttpApi] 401 Unauthorized. Prompting for new key...');

        // Prevent infinite retry loops
        if (this._authRetryCount >= HttpApiProvider.MAX_AUTH_RETRIES) {
          console.error('[HttpApi] Max auth retries reached. Giving up.');
          this._authRetryCount = 0;
          return null;
        }
        this._authRetryCount++;

        const success = await this.ensureConfig(true);
        if (success) {
          // Retry once with new credentials
          return await this._request(channel, data);
        }
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      // Reset retry counter on successful response
      this._authRetryCount = 0;
      return await response.json();
    } catch (err: any) {
      console.error(`[HttpApi] Error calling ${channel}:`, err);
      if (!channel.includes('check-ai') && !channel.includes('get-ai-insight')) {
        console.error(`[HttpApi] ${channel} failed: ${err.message}`);
      }
      throw err;
    }
  }

  validConfig(): boolean {
    return !!(this.host && this.key);
  }

  /**
   * Ensures config exists, prompting if necessary.
   * Uses a lock to prevent multiple overlapping prompts.
   */
  async ensureConfig(force = false): Promise<boolean> {
    if (!force && this.validConfig()) return true;

    // Use existing prompt if one is already in progress
    if (this._promptLock) return await this._promptLock;

    this._promptLock = (async () => {
      try {
        const result = this.promptConfig();
        return result;
      } finally {
        this._promptLock = null;
      }
    })();

    return await this._promptLock;
  }

  promptConfig(): boolean {
    const host = prompt(
      'Bofo Remote Access Setup\n\nPlease enter the Host URL (e.g. http://192.168.1.10:5174):',
      this.host || ''
    );
    if (!host) return false;

    const apiKey = prompt('Please enter your Access Key:', this.key || '');
    if (!apiKey) return false;

    this.host = host;
    this.key = apiKey;

    localStorage.setItem('bofo_remote_host', host);
    localStorage.setItem('bofo_remote_key', apiKey);
    return true;
  }

  // =========================================================================
  // SPECIALIZED ADAPTERS (Overrides for Web)
  // =========================================================================

  /**
   * Adapter for exportData
   * Electron: Invokes 'export-data' (Backend opens dialog)
   * Web: Invokes 'get-backup-data' (Returns JSON) -> triggers Download
   */
  async exportData(): Promise<boolean> {
    try {
      // Use the web-compatible endpoint we created
      const data = await this._request('get-backup-data');
      if (data) {
        this._triggerDownload(data, `bofo-backup-${new Date().toISOString().split('T')[0]}.json`);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Export failed:', e);
      return false;
    }
  }

  /**
   * Adapter for importData
   * Electron: Opens generic dialog -> Invokes 'import-data'
   * Web: Opens browser file picker -> Reads file -> Invokes 'import-backup-data'
   */
  async importData(): Promise<any> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';

      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (!file) {
          resolve({ success: false, message: 'No file selected' });
          return;
        }

        const reader = new FileReader();
        reader.onload = async (event: any) => {
          try {
            const json = JSON.parse(event.target.result);
            // Call the web-compatible import route
            const result = await this._request('import-backup-data', json);
            resolve({ success: true, message: 'Data imported successfully' });
            // Optional: Reload to see changes
            setTimeout(() => window.location.reload(), 1000);
          } catch (err: any) {
            resolve({ success: false, message: 'Invalid JSON file' });
          }
        };
        reader.readAsText(file);
      };

      input.click();
    });
  }

  // Helper to download JSON in browser
  _triggerDownload(data: any, filename: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Stubs for listeners (not supported over simple HTTP yet)
  onChatSandboxChunk(): () => void {
    console.warn('[HttpApi] Streaming is not supported in Web mode yet.');
    return () => { };
  }
}
