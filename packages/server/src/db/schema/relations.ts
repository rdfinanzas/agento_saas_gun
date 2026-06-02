// Centralized relations file to avoid circular dependencies
import { relations } from "drizzle-orm"
import { tenants } from "./tenant"
import { users, tenantUsers } from "./user"
import { plans } from "./plan"
import { agents } from "./agent"
import { skills } from "./skill"
import { tools } from "./tool"
import { whatsappConfigs } from "./whatsapp"
import { conversations } from "./conversation"
import { messages } from "./message"
import { conversationContexts, memoryEntries } from "./memory"
import { tenantFiles } from "./tenant-file"
import { subscriptions } from "./subscription"
import { payments } from "./payment"
import { invoices } from "./invoice"
import { coupons } from "./coupon"
import { dunningAttempts } from "./dunning"
import { knowledgeEntries, knowledgeEmbeddings } from "./knowledge"
import { integrations, agentIntegrations } from "./integration"
import { apiConnectors } from "./api-connector"
import { scheduledTasks, taskExecutions } from "./scheduled-task"
import { pendingResponses, approvalFeedbacks, approvalRequests } from "./approval"
import { toolExecutions as toolExecutionsLog } from "./tool-execution"
import { auditLogs } from "./audit-log"
import { workspaces, accomplishTasks, workspaceFiles } from "./workspace"
import { dbCredentials } from "./db-credential"
import { agentSessions } from "./agent-session"
import { agentMessages } from "./agent-message"
import { userTools, userToolExecutions } from "./user-tool"
import { agentTemplates, agentTemplateInstallations } from "./agent-template"
import { simulationSessions, simulationLogs } from "./simulation"
import { marketplaceSkills, skillReviews, installedSkills } from "./marketplace"
import { aiProviders, aiModels } from "./ai-provider"
import { tenantUsages } from "./tenant-usage"
import { usageMetrics, usageEvents, usageQuotas } from "./usage-metric"

// ============================================
// Tenant Relations
// ============================================
export const tenantsRelations = relations(tenants, ({ many, one }) => ({
  users: many(tenantUsers),
  agents: many(agents),
  whatsappConfigs: many(whatsappConfigs),
  conversations: many(conversations),
  subscription: one(subscriptions, {
    fields: [tenants.id],
    references: [subscriptions.tenantId],
  }),
  invoices: many(invoices),
  payments: many(payments),
  files: many(tenantFiles),
  usages: many(tenantUsages),
  apiIntegrations: many(integrations),
  contexts: many(conversationContexts),
  plan: one(plans, {
    fields: [tenants.planId],
    references: [plans.id],
  }),
  // SP-1: Infraestructura Core
  workspaces: one(workspaces, {
    fields: [tenants.id],
    references: [workspaces.tenantId],
  }),
  dbCredentials: many(dbCredentials),
  agentSessions: many(agentSessions),
  // SP-5: User Tools
  userTools: many(userTools),
  // SP-11: Agent Templates
  agentTemplates: many(agentTemplates),
}))

// ============================================
// User Relations
// ============================================
export const usersRelations = relations(users, ({ many }) => ({
  tenants: many(tenantUsers),
}))

export const tenantUsersRelations = relations(tenantUsers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantUsers.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [tenantUsers.userId],
    references: [users.id],
  }),
}))

// ============================================
// Plan Relations
// ============================================
export const plansRelations = relations(plans, ({ many }) => ({
  tenants: many(tenants),
}))

// ============================================
// Agent Relations
// ============================================
export const agentsRelations = relations(agents, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [agents.tenantId],
    references: [tenants.id],
  }),
  parent: one(agents, {
    fields: [agents.parentId],
    references: [agents.id],
    relationName: "AgentHierarchy",
  }),
  children: many(agents, {
    relationName: "AgentHierarchy",
  }),
  whatsappConfigs: many(whatsappConfigs),
  integrations: many(agentIntegrations),
  conversations: many(conversations),
  // Skills y Tools del agente
  skills: many(skills),
  tools: many(tools),
  sessions: many(agentSessions),
}))

// ============================================
// Skill Relations
// ============================================
export const skillsRelations = relations(skills, ({ one }) => ({
  tenant: one(tenants, {
    fields: [skills.tenantId],
    references: [tenants.id],
  }),
  agent: one(agents, {
    fields: [skills.agentId],
    references: [agents.id],
  }),
}))

// ============================================
// Tool Relations
// ============================================
export const toolsRelations = relations(tools, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tools.tenantId],
    references: [tenants.id],
  }),
  agent: one(agents, {
    fields: [tools.agentId],
    references: [agents.id],
  }),
}))

// ============================================
// WhatsApp Relations
// ============================================
export const whatsappConfigsRelations = relations(whatsappConfigs, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [whatsappConfigs.tenantId],
    references: [tenants.id],
  }),
  agent: one(agents, {
    fields: [whatsappConfigs.agentId],
    references: [agents.id],
  }),
  conversations: many(conversations),
}))

// ============================================
// Conversation Relations
// ============================================
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [conversations.tenantId],
    references: [tenants.id],
  }),
  config: one(whatsappConfigs, {
    fields: [conversations.configId],
    references: [whatsappConfigs.id],
  }),
  agent: one(agents, {
    fields: [conversations.agentId],
    references: [agents.id],
  }),
  messages: many(messages),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}))

// ============================================
// Memory Relations
// ============================================
export const conversationContextsRelations = relations(conversationContexts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [conversationContexts.tenantId],
    references: [tenants.id],
  }),
  memoryEntries: many(memoryEntries),
}))

export const memoryEntriesRelations = relations(memoryEntries, ({ one }) => ({
  context: one(conversationContexts, {
    fields: [memoryEntries.contextId],
    references: [conversationContexts.id],
  }),
}))

// ============================================
// Tenant File Relations
// ============================================
export const tenantFilesRelations = relations(tenantFiles, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantFiles.tenantId],
    references: [tenants.id],
  }),
}))

// ============================================
// Subscription Relations
// ============================================
export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [subscriptions.tenantId],
    references: [tenants.id],
  }),
  invoices: many(invoices),
  dunningAttempts: many(dunningAttempts),
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
}))

export const invoicesRelations = relations(invoices, ({ one }) => ({
  tenant: one(tenants, {
    fields: [invoices.tenantId],
    references: [tenants.id],
  }),
  subscription: one(subscriptions, {
    fields: [invoices.subscriptionId],
    references: [subscriptions.id],
  }),
  coupon: one(coupons, {
    fields: [invoices.couponId],
    references: [coupons.id],
  }),
}))

export const couponsRelations = relations(coupons, ({ many }) => ({
  invoices: many(invoices),
}))

export const dunningAttemptsRelations = relations(dunningAttempts, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [dunningAttempts.subscriptionId],
    references: [subscriptions.id],
  }),
}))

// ============================================
// Integration Relations
// ============================================
export const integrationsRelations = relations(integrations, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [integrations.tenantId],
    references: [tenants.id],
  }),
  agentIntegrations: many(agentIntegrations),
}))

export const agentIntegrationsRelations = relations(agentIntegrations, ({ one }) => ({
  agent: one(agents, {
    fields: [agentIntegrations.agentId],
    references: [agents.id],
  }),
  integration: one(integrations, {
    fields: [agentIntegrations.integrationId],
    references: [integrations.id],
  }),
}))

// ============================================
// Scheduled Task Relations
// ============================================
export const scheduledTasksRelations = relations(scheduledTasks, ({ many }) => ({
  executions: many(taskExecutions),
}))

export const taskExecutionsRelations = relations(taskExecutions, ({ one }) => ({
  task: one(scheduledTasks, {
    fields: [taskExecutions.taskId],
    references: [scheduledTasks.id],
  }),
}))

// ============================================
// Workspace Relations
// ============================================
export const workspacesRelations = relations(workspaces, ({ one }) => ({
  tenant: one(tenants, {
    fields: [workspaces.tenantId],
    references: [tenants.id],
  }),
}))

export const accomplishTasksRelations = relations(accomplishTasks, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [accomplishTasks.tenantId],
    references: [tenants.id],
  }),
  files: many(workspaceFiles),
}))

export const workspaceFilesRelations = relations(workspaceFiles, ({ one }) => ({
  tenant: one(tenants, {
    fields: [workspaceFiles.tenantId],
    references: [tenants.id],
  }),
  task: one(accomplishTasks, {
    fields: [workspaceFiles.taskId],
    references: [accomplishTasks.id],
  }),
}))

// ============================================
// DB Credentials Relations (SP-1)
// ============================================
export const dbCredentialsRelations = relations(dbCredentials, ({ one }) => ({
  tenant: one(tenants, {
    fields: [dbCredentials.tenantId],
    references: [tenants.id],
  }),
}))

// ============================================
// Agent Sessions Relations (SP-1)
// ============================================
export const agentSessionsRelations = relations(agentSessions, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [agentSessions.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [agentSessions.userId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [agentSessions.agentId],
    references: [agents.id],
  }),
  messages: many(agentMessages),
}))

export const agentMessagesRelations = relations(agentMessages, ({ one }) => ({
  session: one(agentSessions, {
    fields: [agentMessages.sessionId],
    references: [agentSessions.id],
  }),
  tenant: one(tenants, {
    fields: [agentMessages.tenantId],
    references: [tenants.id],
  }),
}))

// ============================================
// User Tools Relations (SP-5)
// ============================================
export const userToolsRelations = relations(userTools, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [userTools.tenantId],
    references: [tenants.id],
  }),
  executions: many(userToolExecutions),
}))

export const userToolExecutionsRelations = relations(userToolExecutions, ({ one }) => ({
  tool: one(userTools, {
    fields: [userToolExecutions.toolId],
    references: [userTools.id],
  }),
  tenant: one(tenants, {
    fields: [userToolExecutions.tenantId],
    references: [tenants.id],
  }),
}))

// ============================================
// Agent Template Relations (SP-11)
// ============================================
export const agentTemplatesRelations = relations(agentTemplates, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [agentTemplates.tenantId],
    references: [tenants.id],
  }),
  installations: many(agentTemplateInstallations),
}))

export const agentTemplateInstallationsRelations = relations(agentTemplateInstallations, ({ one }) => ({
  template: one(agentTemplates, {
    fields: [agentTemplateInstallations.templateId],
    references: [agentTemplates.id],
  }),
  tenant: one(tenants, {
    fields: [agentTemplateInstallations.tenantId],
    references: [tenants.id],
  }),
}))

// ============================================
// Simulation Relations
// ============================================
export const simulationSessionsRelations = relations(simulationSessions, ({ many }) => ({
  logs: many(simulationLogs),
}))

export const simulationLogsRelations = relations(simulationLogs, ({ one }) => ({
  session: one(simulationSessions, {
    fields: [simulationLogs.sessionId],
    references: [simulationSessions.id],
  }),
}))

// ============================================
// Marketplace Relations
// ============================================
export const marketplaceSkillsRelations = relations(marketplaceSkills, ({ many }) => ({
  installations: many(installedSkills),
  reviews: many(skillReviews),
}))

export const skillReviewsRelations = relations(skillReviews, ({ one }) => ({
  skill: one(marketplaceSkills, {
    fields: [skillReviews.skillId],
    references: [marketplaceSkills.id],
  }),
}))

export const installedSkillsRelations = relations(installedSkills, ({ one }) => ({
  marketplaceSkill: one(marketplaceSkills, {
    fields: [installedSkills.marketplaceSkillId],
    references: [marketplaceSkills.id],
  }),
}))

// ============================================
// AI Provider Relations
// ============================================
export const aiProvidersRelations = relations(aiProviders, ({ many }) => ({
  models: many(aiModels),
}))

export const aiModelsRelations = relations(aiModels, ({ one }) => ({
  provider: one(aiProviders, {
    fields: [aiModels.providerId],
    references: [aiProviders.id],
  }),
}))

// ============================================
// Tenant Usage Relations
// ============================================
export const tenantUsagesRelations = relations(tenantUsages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantUsages.tenantId],
    references: [tenants.id],
  }),
}))

// ============================================
// Approval Relations (SP-6)
// ============================================
export const approvalRequestsRelations = relations(approvalRequests, ({ one }) => ({
  tenant: one(tenants, {
    fields: [approvalRequests.tenantId],
    references: [tenants.id],
  }),
  session: one(agentSessions, {
    fields: [approvalRequests.sessionId],
    references: [agentSessions.id],
  }),
}))

export const pendingResponsesRelations = relations(pendingResponses, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pendingResponses.tenantId],
    references: [tenants.id],
  }),
}))

export const approvalFeedbacksRelations = relations(approvalFeedbacks, ({ one }) => ({
  tenant: one(tenants, {
    fields: [approvalFeedbacks.tenantId],
    references: [tenants.id],
  }),
}))

// ============================================
// Tool Execution Logs (SP-9)
// ============================================
export const toolExecutionsRelations = relations(toolExecutionsLog, ({ one }) => ({
  tenant: one(tenants, {
    fields: [toolExecutionsLog.tenantId],
    references: [tenants.id],
  }),
  session: one(agentSessions, {
    fields: [toolExecutionsLog.sessionId],
    references: [agentSessions.id],
  }),
}))

// ============================================
// Audit Logs (SP-9)
// ============================================
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [auditLogs.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}))

// ============================================
// Usage Metrics (SP-10)
// ============================================
export const usageMetricsRelations = relations(usageMetrics, ({ one }) => ({
  tenant: one(tenants, {
    fields: [usageMetrics.tenantId],
    references: [tenants.id],
  }),
  session: one(agentSessions, {
    fields: [usageMetrics.sessionId],
    references: [agentSessions.id],
  }),
  agent: one(agents, {
    fields: [usageMetrics.agentId],
    references: [agents.id],
  }),
}))

export const usageEventsRelations = relations(usageEvents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [usageEvents.tenantId],
    references: [tenants.id],
  }),
  session: one(agentSessions, {
    fields: [usageEvents.sessionId],
    references: [agentSessions.id],
  }),
  agent: one(agents, {
    fields: [usageEvents.agentId],
    references: [agents.id],
  }),
}))

export const usageQuotasRelations = relations(usageQuotas, ({ one }) => ({
  tenant: one(tenants, {
    fields: [usageQuotas.tenantId],
    references: [tenants.id],
  }),
}))


