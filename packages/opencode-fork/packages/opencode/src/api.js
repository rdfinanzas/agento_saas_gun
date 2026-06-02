"use strict";
/**
 * OpenCode API for AgenTo SaaS Integration
 *
 * This module provides a clean API for integrating OpenCode functionality
 * into a multi-tenant SaaS platform. It handles session management and prompt
 * execution with proper multi-tenancy support.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.opencode = exports.OpenCodeAPI = void 0;
exports.initOpenCode = initOpenCode;
const instance_1 = require("@/project/instance");
const session_1 = require("@/session");
const prompt_1 = require("@/session/prompt");
const db_1 = require("@/storage/db");
const log_1 = require("@/util/log");
const project_1 = require("@/project/project");
const global_1 = require("@/global");
const path_1 = __importDefault(require("path"));
const apiLog = log_1.Log.create({ service: "opencode.api" });
/**
 * OpenCode API class for multi-tenant SaaS integration
 */
class OpenCodeAPI {
    constructor() {
        this.initialized = false;
        this.config = {};
    }
    /**
     * Initialize the OpenCode API
     */
    async initialize(config = {}) {
        if (this.initialized) {
            apiLog.warn("Already initialized");
            return;
        }
        this.config = config;
        apiLog.info("Initializing OpenCode API", config);
        // Initialize database if needed
        if (config.initDatabase !== false) {
            // Database is lazy-loaded on first use, but we can pre-initialize
            await db_1.Database.Client();
        }
        this.initialized = true;
        apiLog.info("OpenCode API initialized successfully");
    }
    /**
     * Get or create a tenant-specific workspace directory
     */
    getTenantDirectory(tenantId) {
        const baseDir = this.config.baseDataDir || global_1.Global.Path.data;
        return path_1.default.join(baseDir, "tenants", tenantId);
    }
    /**
     * Create a new session for a tenant
     */
    async createSession(config) {
        this.ensureInitialized();
        const directory = config.directory || this.getTenantDirectory(config.tenantId);
        apiLog.info("Creating tenant session", {
            tenantId: config.tenantId,
            directory,
            title: config.title,
        });
        // Use Instance.provide to run in the correct context
        return instance_1.Instance.provide({
            directory,
            fn: () => {
                return session_1.Session.create({
                    title: config.title,
                    workspaceID: config.workspaceId,
                    permission: config.permission,
                });
            },
        });
    }
    /**
     * Execute a prompt in a session
     */
    async executePrompt(sessionId, options) {
        this.ensureInitialized();
        apiLog.info("Executing prompt", { sessionId, model: options.model, agent: options.agent });
        // First, get the session to determine its directory
        const session = await session_1.Session.get(sessionId);
        // Execute the prompt in the session's directory context
        const result = await instance_1.Instance.provide({
            directory: session.directory,
            fn: async () => {
                // Parse model if provided
                let modelInput;
                if (options.model) {
                    const [providerID, modelID] = options.model.split("/");
                    modelInput = { providerID, modelID };
                }
                // Create the parts for the message
                const parts = [
                    {
                        type: "text",
                        text: options.prompt,
                    },
                ];
                // Execute the prompt
                const message = await prompt_1.SessionPrompt.prompt({
                    sessionID: sessionId,
                    messageID: options.messageId,
                    model: modelInput,
                    agent: options.agent,
                    system: options.system,
                    variant: options.variant,
                    format: options.format,
                    tools: options.tools,
                    noReply: options.noReply,
                    parts,
                });
                return {
                    message,
                    sessionId,
                };
            },
        });
        return result;
    }
    /**
     * Get a session by ID
     */
    async getSession(sessionId) {
        this.ensureInitialized();
        const session = await session_1.Session.get(sessionId);
        const project = await project_1.Project.get(session.projectID);
        return {
            ...session,
            project: {
                id: project.id,
                name: project.name ?? undefined,
                worktree: project.worktree,
            },
        };
    }
    /**
     * List sessions for a tenant
     */
    async listSessions(tenantId, options) {
        this.ensureInitialized();
        const directory = this.getTenantDirectory(tenantId);
        return instance_1.Instance.provide({
            directory,
            fn: () => {
                const sessions = [];
                for (const session of session_1.Session.listGlobal({
                    directory,
                    limit: options?.limit,
                    search: options?.search,
                    roots: true,
                })) {
                    sessions.push(session);
                }
                return sessions;
            },
        });
    }
    /**
     * Fork an existing session
     */
    async forkSession(sessionId, messageId) {
        this.ensureInitialized();
        const session = await session_1.Session.get(sessionId);
        return instance_1.Instance.provide({
            directory: session.directory,
            fn: () => {
                return session_1.Session.fork({ sessionID: sessionId, messageID: messageId });
            },
        });
    }
    /**
     * Set session title
     */
    async setSessionTitle(sessionId, title) {
        this.ensureInitialized();
        return session_1.Session.setTitle({ sessionID: sessionId, title });
    }
    /**
     * Archive a session
     */
    async archiveSession(sessionId) {
        this.ensureInitialized();
        return session_1.Session.setArchived({ sessionID: sessionId, time: Date.now() });
    }
    /**
     * Delete a session
     */
    async deleteSession(sessionId) {
        this.ensureInitialized();
        await session_1.Session.remove(sessionId);
    }
    /**
     * Get messages for a session
     */
    async getSessionMessages(sessionId, limit) {
        this.ensureInitialized();
        return session_1.Session.messages({ sessionID: sessionId, limit });
    }
    /**
     * Execute a prompt in a single step (creates session if needed)
     */
    async executeOneShot(tenantId, prompt, options = {}) {
        this.ensureInitialized();
        // Create a new session
        const session = await this.createSession({
            tenantId,
            ...options.sessionConfig,
        });
        // Execute the prompt
        return this.executePrompt(session.id, {
            ...options,
            prompt,
        });
    }
    /**
     * Ensure the API is initialized
     */
    ensureInitialized() {
        if (!this.initialized) {
            throw new Error("OpenCode API not initialized. Call initialize() first.");
        }
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        apiLog.info("Cleaning up OpenCode API");
        // Database will be cleaned up automatically when the process exits
        this.initialized = false;
    }
}
exports.OpenCodeAPI = OpenCodeAPI;
/**
 * Global singleton instance of the OpenCode API
 */
exports.opencode = new OpenCodeAPI();
/**
 * Utility function to initialize the API with default settings
 */
async function initOpenCode(config) {
    await exports.opencode.initialize(config);
    return exports.opencode;
}
//# sourceMappingURL=api.js.map