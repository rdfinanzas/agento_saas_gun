/**
 * OpenCode API for AgenTo SaaS Integration
 *
 * This module provides a clean API for integrating OpenCode functionality
 * into a multi-tenant SaaS platform. It handles session management and prompt
 * execution with proper multi-tenancy support.
 */
import { Session } from "@/session";
/**
 * Configuration for initializing OpenCode API
 */
export interface OpenCodeConfig {
    /**
     * Base directory for OpenCode data (will be used for multi-tenant isolation)
     */
    baseDataDir?: string;
    /**
     * Whether to initialize the database automatically
     */
    initDatabase?: boolean;
}
/**
 * Multi-tenant session configuration
 */
export interface TenantSessionConfig {
    /**
     * Unique tenant identifier
     */
    tenantId: string;
    /**
     * Workspace ID for this session (optional)
     */
    workspaceId?: string;
    /**
     * Session title
     */
    title?: string;
    /**
     * Custom directory for this tenant's workspace
     */
    directory?: string;
    /**
     * Permission ruleset for the session
     */
    permission?: Session.Info.shape.permission;
}
/**
 * Prompt execution options
 */
export interface PromptOptions {
    /**
     * The prompt text to execute
     */
    prompt: string;
    /**
     * AI model to use (format: "provider/model", e.g., "anthropic/claude-sonnet-4-20250514")
     */
    model?: string;
    /**
     * Agent to use (e.g., "build", "document", etc.)
     */
    agent?: string;
    /**
     * Message ID to attach to (for continuing conversations)
     */
    messageId?: string;
    /**
     * Custom system prompt
     */
    system?: string;
    /**
     * Agent variant
     */
    variant?: string;
    /**
     * Output format
     */
    format?: "text" | "json";
    /**
     * Tool permissions (deprecated - use permission in session config)
     */
    tools?: Record<string, boolean>;
    /**
     * Whether to skip AI reply
     */
    noReply?: boolean;
    /**
     * Callback for progress events
     */
    onProgress?: (event: any) => void;
    /**
     * Callback for tool calls
     */
    onToolCall?: (tool: string, input: any) => void;
}
/**
 * Result of a prompt execution
 */
export interface PromptResult {
    /**
     * The message that was created
     */
    message: any;
    /**
     * Session ID
     */
    sessionId: string;
    /**
     * Tokens used (if available)
     */
    tokens?: any;
}
/**
 * OpenCode API class for multi-tenant SaaS integration
 */
export declare class OpenCodeAPI {
    private initialized;
    private config;
    /**
     * Initialize the OpenCode API
     */
    initialize(config?: OpenCodeConfig): Promise<void>;
    /**
     * Get or create a tenant-specific workspace directory
     */
    private getTenantDirectory;
    /**
     * Create a new session for a tenant
     */
    createSession(config: TenantSessionConfig): Promise<Session.Info>;
    /**
     * Execute a prompt in a session
     */
    executePrompt(sessionId: string, options: PromptOptions): Promise<PromptResult>;
    /**
     * Get a session by ID
     */
    getSession(sessionId: string): Promise<Session.GlobalInfo>;
    /**
     * List sessions for a tenant
     */
    listSessions(tenantId: string, options?: {
        limit?: number;
        search?: string;
    }): Promise<Session.GlobalInfo[]>;
    /**
     * Fork an existing session
     */
    forkSession(sessionId: string, messageId?: string): Promise<Session.Info>;
    /**
     * Set session title
     */
    setSessionTitle(sessionId: string, title: string): Promise<Session.Info>;
    /**
     * Archive a session
     */
    archiveSession(sessionId: string): Promise<Session.Info>;
    /**
     * Delete a session
     */
    deleteSession(sessionId: string): Promise<void>;
    /**
     * Get messages for a session
     */
    getSessionMessages(sessionId: string, limit?: number): Promise<any[]>;
    /**
     * Execute a prompt in a single step (creates session if needed)
     */
    executeOneShot(tenantId: string, prompt: string, options?: Omit<PromptOptions, "prompt"> & {
        sessionConfig?: Omit<TenantSessionConfig, "tenantId">;
    }): Promise<PromptResult>;
    /**
     * Ensure the API is initialized
     */
    private ensureInitialized;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
/**
 * Global singleton instance of the OpenCode API
 */
export declare const opencode: OpenCodeAPI;
/**
 * Utility function to initialize the API with default settings
 */
export declare function initOpenCode(config?: OpenCodeConfig): Promise<OpenCodeAPI>;
//# sourceMappingURL=api.d.ts.map