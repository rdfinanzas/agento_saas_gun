/**
 * @agento/agent-core
 *
 * Core de agentes de IA para AgenTo SaaS
 * Basado en el código de Accomplish/OpenCode
 */

// ============================================
// Security - ÚNICA FUENTE DE VERDAD
// ============================================
export {
  SecurityLayerService,
  securityLayer,
  ExecutionMode,
  FULL_MODE_ALLOWED_TOOLS,
  LIMITED_MODE_ALLOWED_TOOLS,
  LIMITED_MODE_BLOCKED_TOOLS,
} from './security';

// ============================================
// Tenant Management
// ============================================
export { TenantManager, tenantManager } from './tenant/TenantManager';
export type { TenantConfig, WorkspaceInfo } from './tenant/TenantManager';

export { WorkspaceManager, workspaceManager } from './tenant/WorkspaceManager';

// ============================================
// Adapters
// ============================================
export { WhatsAppAdapter, whatsAppAdapter } from './adapter/WhatsAppAdapter';
export type {
  WhatsAppContext,
  ConversationMessage,
  AgentResponse,
  WhatsAppAdapterEvents
} from './adapter/WhatsAppAdapter';

export { FullModeAdapter, fullModeAdapter } from './adapter/FullModeAdapter';
export type {
  ExecutionContext,
  ExecutionResult,
  ToolExecution,
  FullModeAdapterEvents,
  PermissionRequestData
} from './adapter/FullModeAdapter';

// ============================================
// OpenCode Runtime Adapter (NEW) - API-based without CLI
// ============================================
export { OpenCodeRuntimeAdapter } from './adapter/OpenCodeRuntimeAdapter';
export type {
  ExecutionContext as OpenCodeRuntimeExecutionContext,
  ExecutionResult as OpenCodeRuntimeExecutionResult,
  ToolExecution as OpenCodeRuntimeToolExecution,
  OpenCodeRuntimeAdapterEvents,
  PermissionRequestData as OpenCodeRuntimePermissionRequestData
} from './adapter/OpenCodeRuntimeAdapter';

// ============================================
// OpenCode Native Adapter - Uses OpenCode HTTP Server (via Bun spawn)
// ============================================
export { OpenCodeNativeAdapter } from './adapter/OpenCodeNativeAdapter';
export type {
  ExecutionContext as OpenCodeNativeExecutionContext,
  ExecutionResult as OpenCodeNativeExecutionResult,
  ToolExecution as OpenCodeNativeToolExecution,
  OpenCodeNativeAdapterEvents,
  PermissionRequestData as OpenCodeNativePermissionRequestData
} from './adapter/OpenCodeNativeAdapter';

// ============================================
// OpenCode HTTP Adapter - Communicates via HTTP (no spawn)
// ============================================
export { OpenCodeHttpAdapter } from './adapter/OpenCodeHttpAdapter';
export type {
  ExecutionContext as OpenCodeHttpExecutionContext,
  ExecutionResult as OpenCodeHttpExecutionResult,
  ToolExecution as OpenCodeHttpToolExecution,
  OpenCodeHttpAdapterEvents,
  PermissionRequestData as OpenCodeHttpPermissionRequestData
} from './adapter/OpenCodeHttpAdapter';

// StreamParser
export { StreamParser } from './adapter/StreamParser';
export type { StreamParserEvents } from './adapter/StreamParser';

// ============================================
// Types
// ============================================
export type { OpenCodeMessage } from './types/opencode';
export type { PermissionRequest } from './types/permission';
export type { Task, TaskConfig, TaskMessage, TaskResult } from './types/task';

// ============================================
// Utils
// ============================================
export { resolveOpenCodeCli, isCliAvailable, getOpenCodeCommand } from './utils/cli-resolver';
export type { CliInfo } from './utils/cli-resolver';

export {
  generateOpenCodeConfig,
  saveOpenCodeConfig,
  loadOpenCodeConfig,
  generateAndSaveConfig
} from './utils/config-generator';
export type { OpenCodeConfig, AgentConfig, McpServerConfig, TenantConfigInput } from './utils/config-generator';

// ============================================
// Version
// ============================================
export const VERSION = '1.0.0';
