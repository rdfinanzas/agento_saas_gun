/**
 * AI Worker Service - Integración del AI Worker con el Backend
 */

import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

const WORKSPACE_BASE = process.env.WORKSPACE_PATH || path.join(os.homedir(), '.agento', 'workspaces');

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ExecuteChatOptions {
  tenantId: string;
  message: string;
  mode?: 'FULL' | 'LIMITED';
  provider?: string;
  model?: string;
  context?: ChatMessage[];
  onProgress?: (event: ChatProgressEvent) => void;
}

export interface ChatProgressEvent {
  type: 'thinking' | 'tool' | 'tool_result' | 'message' | 'complete' | 'error';
  content: string;
  metadata?: Record<string, any>;
}

export interface ExecuteChatResult {
  response: string;
  messageId: string;
  sessionId: string;
  metadata?: {
    tokens?: number;
    toolsUsed?: string[];
    executionTime?: number;
  };
}

export class AIWorkerService {
  private sessions: Map<string, {
    tenantId: string;
    messages: ChatMessage[];
    createdAt: Date;
  }> = new Map();

  async executeChat(options: ExecuteChatOptions): Promise<ExecuteChatResult> {
    const {
      tenantId,
      message,
      mode = 'FULL',
      provider = 'anthropic',
      model = 'claude-sonnet-4-20250514',
      context = [],
      onProgress,
    } = options;

    const messageId = uuidv4();
    const sessionId = uuidv4();

    const workspacePath = path.join(WORKSPACE_BASE, tenantId);

    let systemPrompt = this.buildSystemPrompt(mode, context);

    const userMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    const session = {
      tenantId,
      messages: [...context, userMessage],
      createdAt: new Date(),
    };
    this.sessions.set(sessionId, session);

    try {
      onProgress?.({
        type: 'thinking',
        content: 'Procesando tu solicitud...',
      });

      const response = await this.executeWithOpenCode({
        tenantId,
        workspacePath,
        prompt: message,
        systemPrompt,
        provider,
        model,
        mode,
        onProgress,
      });

      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      session.messages.push(assistantMessage);

      return {
        response,
        messageId: assistantMessage.id,
        sessionId,
        metadata: {
          executionTime: 0,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      onProgress?.({
        type: 'error',
        content: errorMessage,
      });

      return {
        response: `Lo siento, occurredió un error: ${errorMessage}`,
        messageId,
        sessionId,
      };
    }
  }

  private buildSystemPrompt(mode: 'FULL' | 'LIMITED', context: ChatMessage[]): string {
    let prompt = 'Eres un asistente AI útil y poderoso.';

    if (mode === 'LIMITED') {
      prompt += 'Estás en modo limitado. Puedes leer archivos, buscar en la base de conocimiento, y usar integraciones configuradas. NO puedes ejecutar código ni modificar archivos.';
    } else {
      prompt += 'Estás en modo completo. Tienes acceso completo a todas las herramientas del sistema, incluyendo ejecución de código, manipulación de archivos, y más.';
    }

    if (context.length > 0) {
      const recentContext = context.slice(-5);
      prompt += '\n\nContexto de la conversación:\n';
      for (const msg of recentContext) {
        prompt += `${msg.role}: ${msg.content}\n`;
      }
    }

    return prompt;
  }

  private async executeWithOpenCode(params: {
    tenantId: string;
    workspacePath: string;
    prompt: string;
    systemPrompt: string;
    provider: string;
    model: string;
    mode: 'FULL' | 'LIMITED';
    onProgress?: (event: ChatProgressEvent) => void;
  }): Promise<string> {
    const { prompt, systemPrompt, provider, model, mode } = params;

    const chatResult = await this.callChatAPI({
      provider,
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      onProgress: params.onProgress,
    });

    return chatResult;
  }

  private async callChatAPI(params: {
    provider: string;
    model: string;
    messages: Array<{ role: string; content: string }>;
    onProgress?: (event: ChatProgressEvent) => void;
  }): Promise<string> {
    const { provider, model, messages } = params;

    try {
      const response = await fetch('http://localhost:3001/api/v1/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messages[messages.length - 1].content,
          mode: 'FULL',
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.status}`);
      }

      const data = await response.json() as { response?: string };
      return data.response || '';
    } catch (error) {
      return 'Lo siento, no pude procesar tu solicitud en este momento. Por favor intenta más tarde.';
    }
  }

  async getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
    const session = this.sessions.get(sessionId);
    return session?.messages || [];
  }

  async clearSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  getActiveSessions(tenantId: string): string[] {
    const active: string[] = [];
    for (const [sessionId, session] of this.sessions) {
      if (session.tenantId === tenantId) {
        active.push(sessionId);
      }
    }
    return active;
  }
}

export const aiWorkerService = new AIWorkerService();
