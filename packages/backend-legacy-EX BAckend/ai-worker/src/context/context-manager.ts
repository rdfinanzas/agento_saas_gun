/**
 * Context Module - Gestión de contexto para AI Worker
 */

import { v4 as uuidv4 } from 'uuid';

export interface ConversationContext {
  id: string;
  tenantId: string;
  conversationId: string;
  messages: ContextMessage[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContextMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface TenantContext {
  tenantId: string;
  workspacePath: string;
  knowledgeBase: KnowledgeEntry[];
  integrations: IntegrationConfig[];
  agentConfig: AgentConfig;
}

export interface KnowledgeEntry {
  id: string;
  content: string;
  embedding?: number[];
  source: string;
  createdAt: Date;
}

export interface IntegrationConfig {
  id: string;
  type: 'google-sheets' | 'excel' | 'api' | 'webhook';
  config: Record<string, any>;
  enabled: boolean;
}

export interface AgentConfig {
  mode: 'FULL' | 'LIMITED';
  allowedTools: string[];
  blockedTools: string[];
  maxIterations: number;
  timeout: number;
}

export class ContextManager {
  private contexts: Map<string, ConversationContext> = new Map();
  private tenantContexts: Map<string, TenantContext> = new Map();

  async createContext(tenantId: string, conversationId: string): Promise<ConversationContext> {
    const context: ConversationContext = {
      id: uuidv4(),
      tenantId,
      conversationId,
      messages: [],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.contexts.set(context.id, context);
    return context;
  }

  async getContext(contextId: string): Promise<ConversationContext | null> {
    return this.contexts.get(contextId) || null;
  }

  async addMessage(contextId: string, message: Omit<ContextMessage, 'id' | 'timestamp'>): Promise<ContextMessage> {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }

    const newMessage: ContextMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date(),
    };

    context.messages.push(newMessage);
    context.updatedAt = new Date();

    return newMessage;
  }

  async getMessages(contextId: string): Promise<ContextMessage[]> {
    const context = this.contexts.get(contextId);
    return context?.messages || [];
  }

  async clearContext(contextId: string): Promise<void> {
    const context = this.contexts.get(contextId);
    if (context) {
      context.messages = [];
      context.updatedAt = new Date();
    }
  }

  setTenantContext(tenantId: string, context: TenantContext): void {
    this.tenantContexts.set(tenantId, context);
  }

  getTenantContext(tenantId: string): TenantContext | null {
    return this.tenantContexts.get(tenantId) || null;
  }

  async loadTenantKnowledge(tenantId: string): Promise<KnowledgeEntry[]> {
    const context = this.tenantContexts.get(tenantId);
    return context?.knowledgeBase || [];
  }

  async searchKnowledge(tenantId: string, query: string): Promise<KnowledgeEntry[]> {
    const knowledge = await this.loadTenantKnowledge(tenantId);
    const queryLower = query.toLowerCase();
    
    return knowledge.filter(entry => 
      entry.content.toLowerCase().includes(queryLower)
    );
  }
}

export const contextManager = new ContextManager();
