// Schema index - exports all tables and types

// Enums
export * from "./enums"

// Core/Tenant
export * from "./tenant"
export * from "./user"
export * from "./plan"

// Agent
export * from "./agent"

// Agent Sessions & Messages (OpenCode Integration)
export * from "./agent-session"
export * from "./agent-message"

// Skills & Tools (Agent Codificador)
export * from "./skill"
export * from "./tool"

// User Tools (SP-5)
export * from "./user-tool"

// Agent Templates (SP-11)
export * from "./agent-template"

// WhatsApp
export * from "./whatsapp"
export * from "./conversation"
export * from "./message"

// Memory/Context
export * from "./memory"
export * from "./tenant-file"

// Billing
export * from "./subscription"
export * from "./payment"
export * from "./invoice"
export * from "./coupon"
export * from "./dunning"

// Knowledge
export * from "./knowledge"

// Integration
export * from "./integration"
export * from "./api-connector"

// Automation
export * from "./scheduled-task"
export * from "./approval"

// Audit & Logging (SP-9)
export * from "./tool-execution"
export * from "./audit-log"

// Workspace
export * from "./workspace"

// DB Credentials (SP-1)
export * from "./db-credential"

// Simulation
export * from "./simulation"

// Marketplace
export * from "./marketplace"

// AI
export * from "./ai-provider"
export * from "./ai-config"

// Usage
export * from "./tenant-usage"

// Usage Metrics (SP-10)
export * from "./usage-metric"

// Relations (centralized to avoid circular dependencies)
export * from "./relations"
