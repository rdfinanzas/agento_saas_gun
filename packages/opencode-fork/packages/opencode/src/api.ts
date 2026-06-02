/**
 * OpenCode API for AgenTo SaaS Integration
 *
 * This module provides a clean API for integrating OpenCode functionality
 * into a multi-tenant SaaS platform. It handles session management and prompt
 * execution with proper multi-tenancy support.
 */

import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionPrompt } from "@/session/prompt"
import { Database } from "@/storage/db"
import { Log } from "@/util/log"
import { Bus } from "@/bus"
import { Project } from "@/project/project"
import { Global } from "@/global"
import { Installation } from "@/installation"
import { Config } from "@/config/config"
import { WorkspaceID } from "@/control-plane/schema"
import { WorkspaceContext } from "@/control-plane/workspace-context"
import path from "path"

const apiLog = Log.create({ service: "opencode.api" })

/**
 * Configuration for initializing OpenCode API
 */
export interface OpenCodeConfig {
  /**
   * Base directory for OpenCode data (will be used for multi-tenant isolation)
   */
  baseDataDir?: string

  /**
   * Whether to initialize the database automatically
   */
  initDatabase?: boolean
}

/**
 * Multi-tenant session configuration
 */
export interface TenantSessionConfig {
  /**
   * Unique tenant identifier
   */
  tenantId: string

  /**
   * Workspace ID for this session (optional)
   */
  workspaceId?: string

  /**
   * Session title
   */
  title?: string

  /**
   * Custom directory for this tenant's workspace
   */
  directory?: string

  /**
   * Permission ruleset for the session
   */
  permission?: Session.Info.shape.permission
}

/**
 * Prompt execution options
 */
export interface PromptOptions {
  /**
   * The prompt text to execute
   */
  prompt: string

  /**
   * AI model to use (format: "provider/model", e.g., "anthropic/claude-sonnet-4-20250514")
   */
  model?: string

  /**
   * Agent to use (e.g., "build", "document", etc.)
   */
  agent?: string

  /**
   * Message ID to attach to (for continuing conversations)
   */
  messageId?: string

  /**
   * Custom system prompt
   */
  system?: string

  /**
   * Agent variant
   */
  variant?: string

  /**
   * Output format
   */
  format?: "text" | "json"

  /**
   * Tool permissions (deprecated - use permission in session config)
   */
  tools?: Record<string, boolean>

  /**
   * Whether to skip AI reply
   */
  noReply?: boolean

  /**
   * Callback for progress events
   */
  onProgress?: (event: any) => void

  /**
   * Callback for tool calls
   */
  onToolCall?: (tool: string, input: any) => void
}

/**
 * Result of a prompt execution
 */
export interface PromptResult {
  /**
   * The message that was created
   */
  message: any

  /**
   * Session ID
   */
  sessionId: string

  /**
   * Tokens used (if available)
   */
  tokens?: any
}

/**
 * OpenCode API class for multi-tenant SaaS integration
 */
export class OpenCodeAPI {
  private initialized: boolean = false
  private config: OpenCodeConfig = {}

  /**
   * Initialize the OpenCode API
   */
  async initialize(config: OpenCodeConfig = {}): Promise<void> {
    if (this.initialized) {
      apiLog.warn("Already initialized")
      return
    }

    this.config = config

    apiLog.info("Initializing OpenCode API", config)

    // Initialize database if needed
    if (config.initDatabase !== false) {
      // Database is lazy-loaded on first use, but we can pre-initialize
      await Database.Client()
    }

    this.initialized = true
    apiLog.info("OpenCode API initialized successfully")
  }

  /**
   * Get or create a tenant-specific workspace directory
   */
  private getTenantDirectory(tenantId: string): string {
    const baseDir = this.config.baseDataDir || Global.Path.data
    return path.join(baseDir, "tenants", tenantId)
  }

  /**
   * Create a new session for a tenant
   */
  async createSession(config: TenantSessionConfig): Promise<Session.Info> {
    this.ensureInitialized()

    const directory = config.directory || this.getTenantDirectory(config.tenantId)

    apiLog.info("Creating tenant session", {
      tenantId: config.tenantId,
      directory,
      title: config.title,
    })

    // Use Instance.provide to run in the correct context
    return Instance.provide({
      directory,
      fn: () => {
        return Session.create({
          title: config.title,
          workspaceID: config.workspaceId as WorkspaceID,
          permission: config.permission,
        })
      },
    })
  }

  /**
   * Execute a prompt in a session
   */
  async executePrompt(sessionId: string, options: PromptOptions): Promise<PromptResult> {
    this.ensureInitialized()

    apiLog.info("Executing prompt", { sessionId, model: options.model, agent: options.agent })

    // First, get the session to determine its directory
    const session = await Session.get(sessionId)

    // Execute the prompt in the session's directory context
    const result = await Instance.provide({
      directory: session.directory,
      fn: async () => {
        // Parse model if provided
        let modelInput: { providerID: string; modelID: string } | undefined
        if (options.model) {
          const [providerID, modelID] = options.model.split("/")
          modelInput = { providerID, modelID }
        }

        // Create the parts for the message
        const parts: SessionPrompt.PromptInput["parts"] = [
          {
            type: "text",
            text: options.prompt,
          },
        ]

        // Execute the prompt
        const message = await SessionPrompt.prompt({
          sessionID: sessionId,
          messageID: options.messageId,
          model: modelInput,
          agent: options.agent,
          system: options.system,
          variant: options.variant,
          format: options.format as any,
          tools: options.tools,
          noReply: options.noReply,
          parts,
        })

        return {
          message,
          sessionId,
        }
      },
    })

    return result
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<Session.GlobalInfo> {
    this.ensureInitialized()

    const session = await Session.get(sessionId)
    const project = await Project.get(session.projectID)

    return {
      ...session,
      project: {
        id: project.id,
        name: project.name ?? undefined,
        worktree: project.worktree,
      },
    }
  }

  /**
   * List sessions for a tenant
   */
  async listSessions(tenantId: string, options?: { limit?: number; search?: string }): Promise<Session.GlobalInfo[]> {
    this.ensureInitialized()

    const directory = this.getTenantDirectory(tenantId)

    return Instance.provide({
      directory,
      fn: () => {
        const sessions: Session.GlobalInfo[] = []
        for (const session of Session.listGlobal({
          directory,
          limit: options?.limit,
          search: options?.search,
          roots: true,
        })) {
          sessions.push(session)
        }
        return sessions
      },
    })
  }

  /**
   * Fork an existing session
   */
  async forkSession(sessionId: string, messageId?: string): Promise<Session.Info> {
    this.ensureInitialized()

    const session = await Session.get(sessionId)

    return Instance.provide({
      directory: session.directory,
      fn: () => {
        return Session.fork({ sessionID: sessionId, messageID: messageId })
      },
    })
  }

  /**
   * Set session title
   */
  async setSessionTitle(sessionId: string, title: string): Promise<Session.Info> {
    this.ensureInitialized()

    return Session.setTitle({ sessionID: sessionId, title })
  }

  /**
   * Archive a session
   */
  async archiveSession(sessionId: string): Promise<Session.Info> {
    this.ensureInitialized()

    return Session.setArchived({ sessionID: sessionId, time: Date.now() })
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.ensureInitialized()

    await Session.remove(sessionId)
  }

  /**
   * Get messages for a session
   */
  async getSessionMessages(sessionId: string, limit?: number): Promise<any[]> {
    this.ensureInitialized()

    return Session.messages({ sessionID: sessionId, limit })
  }

  /**
   * Execute a prompt in a single step (creates session if needed)
   */
  async executeOneShot(tenantId: string, prompt: string, options: Omit<PromptOptions, "prompt"> & { sessionConfig?: Omit<TenantSessionConfig, "tenantId"> } = {}): Promise<PromptResult> {
    this.ensureInitialized()

    // Create a new session
    const session = await this.createSession({
      tenantId,
      ...options.sessionConfig,
    })

    // Execute the prompt
    return this.executePrompt(session.id, {
      ...options,
      prompt,
    })
  }

  /**
   * Ensure the API is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("OpenCode API not initialized. Call initialize() first.")
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    apiLog.info("Cleaning up OpenCode API")
    // Database will be cleaned up automatically when the process exits
    this.initialized = false
  }
}

/**
 * Global singleton instance of the OpenCode API
 */
export const opencode = new OpenCodeAPI()

/**
 * Utility function to initialize the API with default settings
 */
export async function initOpenCode(config?: OpenCodeConfig): Promise<OpenCodeAPI> {
  await opencode.initialize(config)
  return opencode
}
