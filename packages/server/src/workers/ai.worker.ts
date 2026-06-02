/**
 * AI Worker - Processes AI-related jobs using BullMQ
 *
 * This worker consumes jobs from the 'ai-processing' queue and handles:
 * - chat_completion: Process chat messages with AI models
 * - embedding: Generate text embeddings for semantic search/RAG
 * - tool_execution: Execute AI tools/function calls
 */

import { Worker, Job } from "bullmq"
import { redisConnection } from "../config/redis"
import { createLogger } from "../utils/logger"
import {
  AIJobType,
  AIJobData,
  AIJobResult,
  AIWorkerStats,
  ChatCompletionJobData,
  ChatCompletionJobResult,
  EmbeddingJobData,
  EmbeddingJobResult,
  ToolExecutionJobData,
  ToolExecutionJobResult,
  ToolCallResult,
} from "./ai.types"

const logger = createLogger("ai-worker")

/**
 * Queue name for AI processing jobs
 */
const QUEUE_NAME = "ai-processing"

/**
 * AI Worker Class
 * Handles processing of AI-related background jobs
 */
class AIWorker {
  private worker: Worker<AIJobData, AIJobResult> | null = null
  private stats: AIWorkerStats = {
    isRunning: false,
    queueName: QUEUE_NAME,
    jobsProcessed: 0,
    jobsCompleted: 0,
    jobsFailed: 0,
    lastJobAt: null,
    lastError: null,
    byType: {
      chat_completion: { processed: 0, failed: 0 },
      embedding: { processed: 0, failed: 0 },
      tool_execution: { processed: 0, failed: 0 },
    },
  }

  /**
   * Starts the AI worker
   */
  async start(): Promise<void> {
    if (this.worker) {
      logger.warn("AI Worker is already running")
      return
    }

    logger.info(`Starting AI Worker for queue: ${QUEUE_NAME}`)

    this.worker = new Worker<AIJobData, AIJobResult>(
      QUEUE_NAME,
      async (job: Job<AIJobData>) => {
        return this.processJob(job)
      },
      {
        connection: redisConnection,
        concurrency: 3, // Process up to 3 jobs concurrently (AI tasks can be resource-intensive)
        limiter: {
          max: 50, // Maximum 50 jobs
          duration: 60000, // Per minute
        },
      }
    )

    // Setup event handlers
    this.setupEventHandlers()

    this.stats.isRunning = true
    logger.info("AI Worker started successfully")
  }

  /**
   * Stops the worker gracefully
   */
  async stop(): Promise<void> {
    if (!this.worker) {
      logger.warn("AI Worker is not running")
      return
    }

    logger.info("Stopping AI Worker...")

    try {
      // Wait for current jobs to finish (graceful shutdown)
      await this.worker.close()
      this.worker = null
      this.stats.isRunning = false
      logger.info("AI Worker stopped successfully")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Error stopping AI Worker", { error: errorMessage })
      // Force close if there's an error
      if (this.worker) {
        await this.worker.close(true)
        this.worker = null
      }
      this.stats.isRunning = false
    }
  }

  /**
   * Gets worker statistics
   */
  getStats(): AIWorkerStats {
    return { ...this.stats }
  }

  /**
   * Resets worker statistics
   */
  resetStats(): void {
    this.stats.jobsProcessed = 0
    this.stats.jobsCompleted = 0
    this.stats.jobsFailed = 0
    this.stats.lastJobAt = null
    this.stats.lastError = null
    this.stats.byType = {
      chat_completion: { processed: 0, failed: 0 },
      embedding: { processed: 0, failed: 0 },
      tool_execution: { processed: 0, failed: 0 },
    }
    logger.info("AI Worker stats reset")
  }

  /**
   * Processes an individual job
   */
  private async processJob(job: Job<AIJobData>): Promise<AIJobResult> {
    const { type } = job.data

    logger.info(`Processing job ${job.id} of type: ${type}`, {
      jobId: job.id,
      type,
      tenantId: "tenantId" in job.data ? job.data.tenantId : undefined,
    })

    this.stats.jobsProcessed++
    this.stats.lastJobAt = new Date()

    // Track by type
    if (type in this.stats.byType) {
      this.stats.byType[type].processed++
    }

    try {
      let result: AIJobResult

      switch (type) {
        case "chat_completion":
          result = await this.processChatCompletion(job.data as ChatCompletionJobData, job)
          break
        case "embedding":
          result = await this.processEmbedding(job.data as EmbeddingJobData, job)
          break
        case "tool_execution":
          result = await this.processToolExecution(job.data as ToolExecutionJobData, job)
          break
        default:
          throw new Error(`Unknown job type: ${type}`)
      }

      this.stats.jobsCompleted++
      logger.info(`Job ${job.id} completed successfully`, { type, jobId: job.id })
      return result
    } catch (error) {
      this.stats.jobsFailed++
      if (type in this.stats.byType) {
        this.stats.byType[type].failed++
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      this.stats.lastError = errorMessage
      logger.error(`Job ${job.id} failed`, { type, jobId: job.id, error: errorMessage })
      throw error // Re-throw for BullMQ to handle retry
    }
  }

  /**
   * Processes chat completion job
   */
  private async processChatCompletion(
    data: ChatCompletionJobData,
    job: Job<AIJobData>
  ): Promise<ChatCompletionJobResult> {
    const { conversationId, tenantId, agentId, messages, model, temperature, maxTokens, tools } = data

    logger.debug(`Processing chat completion for conversation: ${conversationId}`, {
      conversationId,
      tenantId,
      agentId,
      messageCount: messages.length,
      model,
    })

    try {
      // Report progress
      await job.updateProgress(10)

      // TODO: Integrate with actual AI service (OpenAI, Anthropic, etc.)
      // For now, this is a placeholder implementation
      const response = await this.callAIModel({
        messages,
        model: model || "gpt-4",
        temperature: temperature ?? 0.7,
        maxTokens: maxTokens ?? 2000,
        tools,
      })

      await job.updateProgress(80)

      const result: ChatCompletionJobResult = {
        success: true,
        conversationId,
        messageId: `msg-${Date.now()}`,
        content: response.content,
        toolCalls: response.toolCalls,
        usage: response.usage,
        finishReason: response.finishReason,
        processedAt: new Date(),
      }

      await job.updateProgress(100)

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Chat completion failed", {
        conversationId,
        tenantId,
        error: errorMessage,
      })

      return {
        success: false,
        conversationId,
        error: errorMessage,
        processedAt: new Date(),
      }
    }
  }

  /**
   * Processes embedding generation job
   */
  private async processEmbedding(
    data: EmbeddingJobData,
    job: Job<AIJobData>
  ): Promise<EmbeddingJobResult> {
    const { tenantId, texts, model, dimensions, batchId } = data

    logger.debug(`Processing embedding generation`, {
      tenantId,
      textCount: texts.length,
      model,
      batchId,
    })

    try {
      // Report progress
      await job.updateProgress(10)

      // TODO: Integrate with actual embedding service
      // For now, this is a placeholder implementation
      const embeddings = await this.generateEmbeddings({
        texts,
        model: model || "text-embedding-3-small",
        dimensions: dimensions ?? 1536,
      })

      await job.updateProgress(100)

      return {
        success: true,
        batchId,
        embeddings,
        model: model || "text-embedding-3-small",
        dimensions: dimensions ?? 1536,
        usage: {
          totalTokens: texts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0),
        },
        processedAt: new Date(),
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Embedding generation failed", {
        tenantId,
        batchId,
        error: errorMessage,
      })

      return {
        success: false,
        batchId,
        error: errorMessage,
        processedAt: new Date(),
      }
    }
  }

  /**
   * Processes tool execution job
   */
  private async processToolExecution(
    data: ToolExecutionJobData,
    job: Job<AIJobData>
  ): Promise<ToolExecutionJobResult> {
    const { conversationId, tenantId, agentId, toolCalls, timeout } = data

    logger.debug(`Processing tool execution`, {
      conversationId,
      tenantId,
      agentId,
      toolCallCount: toolCalls.length,
    })

    try {
      // Report progress
      await job.updateProgress(10)

      const results: ToolCallResult[] = []
      const defaultTimeout = timeout ?? 30000 // 30 seconds default

      // Execute each tool call
      for (let i = 0; i < toolCalls.length; i++) {
        const toolCall = toolCalls[i]
        const progress = 10 + Math.floor((i / toolCalls.length) * 80)
        await job.updateProgress(progress)

        try {
          const result = await this.executeToolCall(toolCall, {
            conversationId,
            tenantId,
            agentId,
            timeout: defaultTimeout,
          })

          results.push(result)
        } catch (toolError) {
          const errorMessage = toolError instanceof Error ? toolError.message : "Tool execution failed"
          results.push({
            toolCallId: toolCall.id,
            name: toolCall.function.name,
            result: null,
            status: "error",
            error: errorMessage,
          })
        }
      }

      await job.updateProgress(100)

      const hasErrors = results.some((r) => r.status === "error")

      return {
        success: !hasErrors,
        conversationId,
        results,
        executedAt: new Date(),
        error: hasErrors ? "Some tool executions failed" : undefined,
        processedAt: new Date(),
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Tool execution failed", {
        conversationId,
        tenantId,
        error: errorMessage,
      })

      return {
        success: false,
        conversationId,
        results: [],
        executedAt: new Date(),
        error: errorMessage,
        processedAt: new Date(),
      }
    }
  }

  /**
   * Sets up event handlers for the worker
   */
  private setupEventHandlers(): void {
    if (!this.worker) return

    // Job completed
    this.worker.on("completed", (job: Job<AIJobData>, result: AIJobResult) => {
      logger.info(`Job completed`, {
        jobId: job.id,
        type: job.data.type,
        success: "success" in result ? result.success : undefined,
      })
    })

    // Job failed
    this.worker.on("failed", (job: Job<AIJobData> | undefined, error: Error) => {
      if (job) {
        logger.error(`Job failed`, {
          jobId: job.id,
          type: job.data.type,
          error: error.message,
          attemptsMade: job.attemptsMade,
        })
      } else {
        logger.error("Job failed without job info", { error: error.message })
      }
    })

    // Worker error
    this.worker.on("error", (error: Error) => {
      logger.error("Worker error", { error: error.message })
    })

    // Job stalled
    this.worker.on("stalled", (jobId: string) => {
      logger.warn(`Job stalled`, { jobId })
    })

    // Worker ready
    this.worker.on("ready", () => {
      logger.info("AI Worker ready and connected to Redis")
    })

    // Worker closed
    this.worker.on("closed", () => {
      logger.info("AI Worker closed")
      this.stats.isRunning = false
    })

    // Progress update
    this.worker.on("progress", (job: Job<AIJobData>, progress: number | object) => {
      const progressValue = typeof progress === "number" ? progress : 0
      logger.debug(`Job progress`, {
        jobId: job.id,
        progress: progressValue,
      })
    })
  }

  // ============================================
  // AI Service Methods - Delegate to ai.service
  // ============================================

  /**
   * Calls an AI model for chat completion via ai.service
   */
  private async callAIModel(params: {
    messages: Array<{ role: string; content: string }>
    model: string
    temperature: number
    maxTokens: number
    tools?: Array<unknown>
  }): Promise<{
    content: string
    toolCalls?: ToolCallResult[]
    usage: { promptTokens: number; completionTokens: number; totalTokens: number }
    finishReason: "stop" | "length" | "tool_calls" | "content_filter"
  }> {
    const { aiService } = await import("../modules/ai/ai.service")

    const result = await aiService.processMessage({
      tenantId: "",
      agentId: "",
      messages: params.messages as any,
      systemPrompt: "",
      tools: params.tools as any,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    })

    return {
      content: result.content,
      usage: result.tokensUsed,
      finishReason: result.finishReason as any,
    }
  }

  /**
   * Generates embeddings for texts - placeholder until embedding provider is configured
   */
  private async generateEmbeddings(params: {
    texts: string[]
    model: string
    dimensions: number
  }): Promise<Array<{ text: string; embedding: number[]; index: number }>> {
    // TODO: Integrate with embedding provider (OpenAI text-embedding-3-small)
    // For now return dummy embeddings
    logger.warn("Embedding generation using placeholder - configure embedding provider")
    return params.texts.map((text, index) => ({
      text,
      embedding: new Array(params.dimensions).fill(0).map(() => Math.random() * 2 - 1),
      index,
    }))
  }

  /**
   * Executes a tool call - delegates to integration adapters
   */
  private async executeToolCall(
    toolCall: { id: string; function: { name: string; arguments: string } },
    context: { conversationId: string; tenantId: string; agentId: string; timeout: number }
  ): Promise<ToolCallResult> {
    const args = JSON.parse(toolCall.function.arguments || "{}")

    logger.debug(`Executing tool: ${toolCall.function.name}`, {
      toolCallId: toolCall.id,
      name: toolCall.function.name,
      args,
      context,
    })

    // Placeholder - tool execution is handled by the AI service tool calling loop
    // This method is only used if jobs are enqueued directly
    return {
      toolCallId: toolCall.id,
      name: toolCall.function.name,
      result: `Tool ${toolCall.function.name} executed (via direct job)`,
      status: "success",
    }

    return {
      toolCallId: toolCall.id,
      name: toolCall.function.name,
      result: { message: "Tool executed successfully (placeholder)", args },
      status: "success",
    }
  }
}

// Export singleton instance
export const aiWorker = new AIWorker()

// Export class for testing
export { AIWorker }
