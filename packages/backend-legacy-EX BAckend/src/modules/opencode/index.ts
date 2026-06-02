// ============================================
// Services
// ============================================
export { CliResolverService } from './services/cli-resolver.service';
export {
  OpenCodeExecutorService,
  openCodeExecutor,
  LIMITED_MODE_TOOLS,
  LIMITED_MODE_BLOCKED_TOOLS,
  FULL_MODE_TOOLS,
} from './services/opencode-executor.service';
export type {
  ExecutionContext,
  ExecutionResult,
  AgentIdentity,
  BusinessInfo,
  KnowledgeBase,
  EmbeddingResult,
} from './services/opencode-executor.service';
export { LLMService, llmService } from './services/llm.service';
export { MCPToolsService, mcpToolsService } from './services/mcp-tools.service';
export { AgentIdentityService, agentIdentityService } from './services/agent-identity.service';
export { SimulatorService, simulatorService } from './services/simulator.service';
export { SchedulerService, schedulerService } from './services/scheduler.service';
export type { ScheduleConfig, ScheduledTask, TaskType, TaskExecution, TaskTypeConfig } from './services/scheduler.service';
export { ApiDocsService, apiDocsService } from './services/api-docs.service';
export type { ApiDocumentation, GeneratedConnector, GeneratedTool, ConnectorConfig, TestResult } from './services/api-docs.service';

// ============================================
// Adapters
// ============================================
export { WhatsAppAdapter } from './adapters/whatsapp.adapter';

// ============================================
// Controllers
// ============================================
export { ProvidersController, providersController } from './controllers/providers.controller';
export { AgentIdentityController, agentIdentityController } from './controllers/agent-identity.controller';
export { PermissionsController, permissionsController } from './controllers/agent-tools.controller';
export { SkillsController, skillsController } from './controllers/skills.controller';
export { SandboxController, sandboxController } from './controllers/sandbox.controller';
export { AutomationController, automationController } from './controllers/automation.controller';
export { ApiConnectorsController, apiConnectorsController } from './controllers/api-connectors.controller';
export { ApprovalController, approvalController } from './controllers/approval.controller';

// ============================================
// Routes
// ============================================
export { providersRoutes, agentIdentityRoutes, permissionsRoutes, skillsRoutes, skillsMarketplaceRoutes, sandboxRoutes, automationRoutes, apiConnectorsRoutes, approvalRoutes } from './routes';

// ============================================
// DTOs
// ============================================
export * from './dto';

// ============================================
// Providers
// ============================================
export * from './providers/models';
export * from './providers/validation';
export type { ZaiRegion, ProviderCredential, ModelFetchResult, ModelInfo } from './providers/types';

// ============================================
// Common Types
// ============================================
export type {
  ProviderType,
  ModelConfig,
  ProviderConfig,
  TenantProviderConfig,
  ProviderSettings,
  ConversationMessage,
  ContentBlock,
} from './common/types/provider';

export type {
  SkillSource,
  Skill,
  SkillFrontmatter,
  SkillsManagerOptions,
} from './common/types/skills';

export type {
  ThoughtEvent,
  CheckpointEvent,
  ThoughtCategory,
  CheckpointStatus,
  ThoughtStreamHandlerOptions,
  StoredThoughtEvent,
  StoredCheckpointEvent,
  ReportThoughtDto,
  ReportCheckpointDto,
  ThoughtStreamResponseDto,
} from './common/types/thought-stream';

export type {
  PermissionOperation,
  PermissionRequest,
  PermissionResponse,
  PermissionRule,
  PermissionHandlerOptions,
  RequestPermissionDto,
  RespondPermissionDto,
  PermissionRuleDto,
  PendingPermissionsDto,
} from './common/types/permissions';

export type {
  SimulationConfig,
  CustomerProfile,
  SandboxSession,
  SimulationMessage,
  SimulationMessageMetadata,
  SimulationMetrics,
  SimulationLog,
  CreateSimulationDto,
  SendMessageDto,
  SimulateCustomerDto,
  SimulationMetricsResponse,
  PromoteToProductionResponse,
  ValidationResult,
  ValidationIssue,
} from './common/types/simulation';

// ============================================
// Internal Classes
// ============================================
export { TaskManager, getTaskManager, createTaskManager } from './internal/classes/TaskManager';
export { SecureStorage } from './internal/classes/SecureStorage';
export { ThoughtStreamHandler, getThoughtStreamHandler, createThoughtStreamHandler } from './internal/classes/ThoughtStreamHandler';
export { PermissionHandler, getPermissionHandler, createPermissionHandler } from './internal/classes/PermissionHandler';
export { SkillsManager, getSkillsManager, createSkillsManager } from './internal/classes/SkillsManager';

// ============================================
// Workers
// ============================================
export { AutomationWorker, automationWorker } from './workers/automation.worker';
export type { AutomationJobData, AutomationResult } from './workers/automation.worker';

export { ApprovalService, approvalService } from './services/approval.service';
export type { PendingResponse, ApprovalStatus, ApprovalConfig, ApprovalStats } from './services/approval.service';

export { SkillsMarketplaceService, skillsMarketplaceService } from './services/skills-marketplace.service';
export type { MarketplaceSkill, SkillCategory, MarketplaceFilter, SkillReview } from './services/skills-marketplace.service';

export { SkillsMarketplaceController, skillsMarketplaceController } from './controllers/skills-marketplace.controller';
