/**
 * OpenCode Library Entry Point for AgenTo SaaS
 *
 * This is the main entry point for using OpenCode as a library in the AgenTo SaaS platform.
 * It exports the high-level API without any CLI dependencies.
 *
 * @example
 * ```typescript
 * import { opencode } from '@opencode-ai/lib'
 *
 * // Initialize
 * await opencode.initialize({ baseDataDir: '/var/data/agento' })
 *
 * // Create a tenant session
 * const session = await opencode.createSession({
 *   tenantId: 'tenant-123',
 *   title: 'My Coding Session'
 * })
 *
 * // Execute a prompt
 * const result = await opencode.executePrompt(session.id, {
 *   prompt: 'Create a REST API endpoint',
 *   model: 'anthropic/claude-sonnet-4-20250514',
 *   agent: 'build'
 * })
 * ```
 */

// Main API exports
export {
  OpenCodeAPI,
  opencode,
  initOpenCode,
  type OpenCodeConfig,
  type TenantSessionConfig,
  type PromptOptions,
  type PromptResult,
} from "./api.js"

// Session exports for advanced usage
export { Session } from "./session/index.js"
export type { Session as SessionNamespace } from "./session/index.js"

// Agent exports
export { Agent } from "./agent/agent.js"

// Provider exports
export { Provider } from "./provider/provider.js"
export type { ModelID, ProviderID } from "./provider/schema.js"

// Type exports
export type { MessageV2 } from "./session/message-v2.js"

// Utility exports
export { Log } from "./util/log.js"
export { Bus } from "./bus.js"
