import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  json,
  decimal,
  boolean,
} from "drizzle-orm/pg-core"

// ============================================
// APPROVAL REQUESTS - Para herramientas del agente
// ============================================

export const approvalStatuses = ["pending", "approved", "rejected", "expired"] as const
export type ApprovalStatus = typeof approvalStatuses[number]

export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    sessionId: uuid("session_id").notNull(),

    // Tool que requiere approval
    toolName: text("tool_name").notNull(),
    toolParams: json("tool_params").$type<any>(),

    // Quien lo solicita
    requestedBy: uuid("requested_by"),

    // Estado
    status: text("status").$type<ApprovalStatus>().default("pending").notNull(),

    // Quien lo aprueba/rechaza
    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at"),
    notes: text("notes"),

    // Expiración (default 1 hora)
    expiresAt: timestamp("expires_at"),

    // Resultado si se ejecuta
    executionResult: json("execution_result").$type<any>(),
    executionError: text("execution_error"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("approval_requests_tenant_id_idx").on(table.tenantId),
    sessionIdIdx: index("approval_requests_session_id_idx").on(table.sessionId),
    statusIdx: index("approval_requests_status_idx").on(table.status),
    expiresAtIdx: index("approval_requests_expires_at_idx").on(table.expiresAt),
  })
)

export type ApprovalRequest = typeof approvalRequests.$inferSelect
export type NewApprovalRequest = typeof approvalRequests.$inferInsert

// ============================================
// PENDING RESPONSES - Para respuestas de WhatsApp
// ============================================

export const pendingResponses = pgTable(
  "pending_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    conversationId: uuid("conversation_id").notNull(),
    agentId: uuid("agent_id").notNull(),
    proposedResponse: text("proposed_response").notNull(),
    reason: text("reason"),
    confidence: decimal("confidence", { precision: 3, scale: 2 }),
    status: text("status").default("PENDING").notNull(),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at"),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => ({
    tenantStatusIdx: index("pending_responses_tenant_id_status_idx").on(table.tenantId, table.status),
    statusIdx: index("pending_responses_status_idx").on(table.status),
  })
)

export const approvalFeedbacks = pgTable(
  "approval_feedbacks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    responseId: text("response_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    proposedResponse: text("proposed_response").notNull(),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("approval_feedbacks_tenant_id_idx").on(table.tenantId),
  })
)

// Type exports
export type PendingResponse = typeof pendingResponses.$inferSelect
export type NewPendingResponse = typeof pendingResponses.$inferInsert
export type ApprovalFeedback = typeof approvalFeedbacks.$inferSelect
export type NewApprovalFeedback = typeof approvalFeedbacks.$inferInsert
