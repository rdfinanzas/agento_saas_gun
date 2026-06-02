/**
 * AI Worker - Exportaciones
 */

export { OpenCodeExecutor, openCodeExecutor } from './executor/opencode-executor.service';
export type { ExecutionContext, ExecutionInput, ExecutionOutput } from './executor/opencode-executor.service';

export { contextManager } from './context/context-manager';
export type { ConversationContext, ContextMessage, TenantContext, KnowledgeEntry, IntegrationConfig, AgentConfig } from './context/context-manager';
