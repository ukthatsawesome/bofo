
/**
 * Sanitize audit context from IPC to prevent privilege escalation.
 * Renderer should never be able to set source to 'SYSTEM' or 'SEED'.
 */
export function sanitizeAuditContext(untrusted: any): { source: string; metadata?: any } {
    // Always force USER source - renderer cannot claim SYSTEM/SEED privileges
    const sanitized: { source: string; metadata?: any } = { source: 'USER' };

    // Only preserve safe metadata if provided (e.g., client timestamp, UI action)
    if (untrusted?.metadata && typeof untrusted.metadata === 'object') {
        // Whitelist only safe metadata fields
        const allowedMetaKeys = ['clientTimestamp', 'uiAction', 'notes'];
        const safeMeta: Record<string, unknown> = {};
        for (const key of allowedMetaKeys) {
            if (key in untrusted.metadata) {
                safeMeta[key] = untrusted.metadata[key];
            }
        }
        if (Object.keys(safeMeta).length > 0) {
            sanitized.metadata = safeMeta;
        }
    }

    return sanitized;
}
