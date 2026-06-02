// Agent AI Services
export { toolRegistry, type ToolDefinition, type ToolExecutionContext, type ToolResult } from "./tool-registry.service"
export { skillRegistry, type SkillDefinition } from "./skill-registry.service"
export { agentCoderService, type CreateAgentInput, type CreateToolInput } from "./agent-coder.service"

// SP-1: Infraestructura Core
export { workspaceManager, WorkspaceManager, type WorkspaceSubdir } from "./workspace.service"
export { credentialManager, CredentialManager, type CreateCredentialInput, type UpdateCredentialInput } from "./credential.service"
export { encryptionService, EncryptionService, encrypt, decrypt, encryptCredentials, decryptCredentials, generateEncryptionKey, isEncrypted, type DbCredentialInput, type DbCredentialEncrypted } from "./encryption.service"

// SP-5: User Tools
export { toolExecutor, ToolExecutor, type ExecutionContext, type ExecutionResult } from "./tool-executor.service"

// SP-11: Agent Templates
export { agentTemplateService, AgentTemplateService, DEFAULT_TEMPLATES } from "./agent-template.service"

// SP-6: Approval Workflow
export { approvalService, ApprovalService, initApprovalCleaner, type CreateApprovalParams, type ApprovalDecision } from "./approval.service"

// SP-9: Logs y Auditoría
export { auditService, AuditService, auditMiddleware, initAuditCleaner as initAuditCleaner, type AuditLogParams, type ToolExecutionParams } from "./audit.service"

// SP-10: Monitoreo de Uso
export { usageService, UsageService, trackTokens, trackRequest, trackToolExecution, type TrackUsageParams, type UsageQuotaParams } from "./usage.service"
