// Constants for agent-core
export const PERMISSION_REQUEST_TIMEOUT_MS = 300000; // 5 minutes
export const LOG_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const LOG_RETENTION_DAYS = 7;
export const LOG_BUFFER_FLUSH_INTERVAL_MS = 5000;
export const LOG_BUFFER_MAX_ENTRIES = 100;
export const FILE_OPERATIONS = ['read', 'write', 'edit', 'delete', 'list'] as const;
export type FileOperation = typeof FILE_OPERATIONS[number];
