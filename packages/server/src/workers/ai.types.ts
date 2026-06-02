/**
 * AI Worker Types - TypeScript types for AI processing jobs
 *
 * This module defines the types for AI-related jobs processed by the AI worker:
 * - chat_completion: Process chat messages with AI models
 * - embedding: Generate text embeddings for semantic search/RAG
 * - tool_execution: Execute AI tools/function calls
 */

// ============================================
// AI Job Types
// ============================================

/**
 * Supported AI job types
 */
export type AIJobType = "chat_completion" | "embedding" | "tool_execution"

// ============================================
// Chat Completion Job
// ============================================

/**
 * Message role types for chat completion
 */
export type ChatMessageRole = "system" | "user" | "assistant" | "tool"

/**
 * Individual chat message
 */
export interface ChatMessage {
  role: ChatMessageRole
  content: string
  name?: string
  toolCallId?: string
}

/**
 * Data for chat completion jobs
 */
export interface ChatCompletionJobData {
  type: "chat_completion"
  conversationId: string
  tenantId: string
  agentId: string
  messages: ChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
  tools?: AIToolDefinition[]
  metadata?: Record<string, unknown>
  timestamp: number
}

/**
 * Result of chat completion processing
 */
export interface ChatCompletionJobResult {
  success: boolean
  conversationId: string
  messageId?: string
  content?: string
  toolCalls?: ToolCallResult[]
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  finishReason?: "stop" | "length" | "tool_calls" | "content_filter"
  error?: string
  processedAt: Date
}

// ============================================
// Embedding Job
// ============================================

/**
 * Data for embedding generation jobs
 */
export interface EmbeddingJobData {
  type: "embedding"
  tenantId: string
  texts: string[]
  model?: string
  dimensions?: number
  batchId?: string
  metadata?: Record<string, unknown>
  timestamp: number
}

/**
 * Single embedding result
 */
export interface EmbeddingResult {
  text: string
  embedding: number[]
  index: number
}

/**
 * Result of embedding generation
 */
export interface EmbeddingJobResult {
  success: boolean
  batchId?: string
  embeddings?: EmbeddingResult[]
  model?: string
  dimensions?: number
  usage?: {
    totalTokens: number
  }
  error?: string
  processedAt: Date
}

// ============================================
// Tool Execution Job
// ============================================

/**
 * AI Tool definition
 */
export interface AIToolDefinition {
  type: "function"
  function: {
    name: string
    description: string
    parameters?: Record<string, unknown>
  }
}

/**
 * Tool call request
 */
export interface ToolCallRequest {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string
  }
}

/**
 * Tool call result
 */
export interface ToolCallResult {
  toolCallId: string
  name: string
  result: unknown
  status: "success" | "error"
  error?: string
}

/**
 * Data for tool execution jobs
 */
export interface ToolExecutionJobData {
  type: "tool_execution"
  conversationId: string
  tenantId: string
  agentId: string
  toolCalls: ToolCallRequest[]
  timeout?: number
  metadata?: Record<string, unknown>
  timestamp: number
}

/**
 * Result of tool execution
 */
export interface ToolExecutionJobResult {
  success: boolean
  conversationId: string
  results: ToolCallResult[]
  executedAt: Date
  error?: string
  processedAt: Date
}

// ============================================
// Union Types
// ============================================

/**
 * Union type for all AI job data types
 */
export type AIJobData = ChatCompletionJobData | EmbeddingJobData | ToolExecutionJobData

/**
 * Union type for all AI job result types
 */
export type AIJobResult = ChatCompletionJobResult | EmbeddingJobResult | ToolExecutionJobResult

// ============================================
// Worker Stats
// ============================================

/**
 * Statistics for the AI worker
 */
export interface AIWorkerStats {
  isRunning: boolean
  queueName: string
  jobsProcessed: number
  jobsCompleted: number
  jobsFailed: number
  lastJobAt: Date | null
  lastError: string | null
  byType: {
    chat_completion: {
      processed: number
      failed: number
    }
    embedding: {
      processed: number
      failed: number
    }
    tool_execution: {
      processed: number
      failed: number
    }
  }
}
