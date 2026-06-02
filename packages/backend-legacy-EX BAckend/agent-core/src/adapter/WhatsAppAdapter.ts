/**
 * WhatsAppAdapter - Adaptador para agentes de WhatsApp
 *
 * Ejecuta OpenCode CLI en modo LIMITED con la configuración del tenant.
 * Emite eventos para tracking de progreso y respuestas.
 */

import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TenantManager, TenantConfig, SkillTool } from '../tenant/TenantManager';
import { WorkspaceManager } from '../tenant/WorkspaceManager';
import { SecurityLayerService, ExecutionMode, securityLayer } from '../security';

export interface WhatsAppContext {
  phoneNumber: string;
  contactName?: string;
  conversationHistory?: ConversationMessage[];
  metadata?: Record<string, any>;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface AgentResponse {
  content: string;
  status: 'success' | 'error' | 'timeout';
  sessionId?: string;
  tokensUsed?: number;
  executionTime: number;
  toolsUsed?: string[];
  error?: string;
}

export interface WhatsAppAdapterEvents {
  'tool-use': [string, unknown];
  'progress': [{ stage: string; message?: string }];
  'complete': [AgentResponse];
  'error': [Error];
}

export class WhatsAppAdapter extends EventEmitter<WhatsAppAdapterEvents> {
  private tenantManager: TenantManager;
  private workspaceManager: WorkspaceManager;
  private securityLayer: SecurityLayerService;
  private ptyProcesses: Map<string, pty.IPty> = new Map();
  private readonly DEFAULT_TIMEOUT = 120000; // 2 minutos

  constructor(
    tenantManager?: TenantManager,
    workspaceManager?: WorkspaceManager,
    securityLayerService?: SecurityLayerService
  ) {
    super();
    this.tenantManager = tenantManager || new TenantManager();
    this.workspaceManager = workspaceManager || new WorkspaceManager();
    this.securityLayer = securityLayerService || securityLayer;
  }

  /**
   * Ejecuta el agente para un mensaje de WhatsApp
   */
  async execute(
    tenantId: string,
    message: string,
    context: WhatsAppContext
  ): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      // 1. Obtener configuración del tenant
      const config = await this.tenantManager.getConfig(tenantId);
      if (!config) {
        throw new Error(`Tenant ${tenantId} not configured`);
      }

      // 2. Asegurar workspace
      const workspacePath = this.workspaceManager.ensureWorkspace(tenantId);

      // 3. Generar configuración de OpenCode
      const openCodeConfigPath = await this.tenantManager.generateOpenCodeConfig(tenantId);

      // 4. Construir prompt completo
      const fullPrompt = this.buildPrompt(message, context, config);

      // 5. Ejecutar OpenCode
      const result = await this.executeOpenCode(
        tenantId,
        fullPrompt,
        workspacePath,
        openCodeConfigPath,
        config
      );

      const executionTime = Date.now() - startTime;

      return {
        content: result.content,
        status: 'success',
        sessionId: result.sessionId,
        tokensUsed: result.tokensUsed,
        executionTime,
        toolsUsed: result.toolsUsed
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        content: '',
        status: 'error',
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Ejecuta OpenCode CLI via PTY
   */
  private async executeOpenCode(
    tenantId: string,
    prompt: string,
    workspacePath: string,
    configPath: string,
    config: TenantConfig
  ): Promise<{ content: string; sessionId?: string; tokensUsed?: number; toolsUsed?: string[] }> {
    return new Promise((resolve, reject) => {
      let output = '';
      let sessionId: string | undefined;
      let tokensUsed = 0;
      let toolsUsed: string[] = [];
      let isResolved = false;

      const timeout = config.mode === 'LIMITED' ? this.DEFAULT_TIMEOUT : 300000;
      const isWindows = process.platform === 'win32';

      // Construir argumentos
      const args = [
        'run',
        '--format', 'json',
        '--model', `${config.provider}/${config.model}`,
        '--agent', 'agento-agent',
        prompt
      ];

      // Variables de entorno
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        OPENCODE_CONFIG: configPath,
        TENANT_ID: tenantId,
        EXECUTION_MODE: config.mode
      };

      console.log(`[WhatsAppAdapter] Executing OpenCode for tenant ${tenantId}`);
      console.log(`[WhatsAppAdapter] Mode: ${config.mode}`);
      console.log(`[WhatsAppAdapter] Workspace: ${workspacePath}`);

      // Configurar shell según SO
      const shell = isWindows ? 'powershell.exe' : '/bin/bash';
      const shellArgs = isWindows ? ['-NoProfile', '-Command'] : ['-c'];
      const command = `npx opencode ${args.map(a => this.escapeArg(a, isWindows)).join(' ')}`;

      // Spawn PTY
      const ptyProcess = pty.spawn(shell, [...shellArgs, command], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: workspacePath,
        env: env as { [key: string]: string }
      });

      this.ptyProcesses.set(tenantId, ptyProcess);

      // Timeout handler
      const timeoutHandle = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          this.cleanup(tenantId);
          reject(new Error(`Timeout after ${timeout}ms`));
        }
      }, timeout);

      // Capturar salida
      ptyProcess.onData((data: string) => {
        output += data;
        this.parseOutput(data, {
          onSessionId: (id) => { sessionId = id; },
          onTokens: (tokens) => { tokensUsed = tokens; },
          onTool: (tool) => {
            // Validar tool con SecurityLayer
            const mode = config.mode === 'LIMITED' ? ExecutionMode.LIMITED : ExecutionMode.FULL;

            // Obtener nombres de skills dinámicos si existen
            const skillToolNames = config.skills?.map((s: SkillTool) => s.name) || [];

            const validation = this.securityLayer.validateTool(tool, mode, skillToolNames);

            if (!validation.allowed) {
              console.log(`[WhatsAppAdapter] Tool '${tool}' bloqueada: ${validation.reason}`);
              return; // Ignorar tools no permitidas
            }

            if (!toolsUsed.includes(tool)) toolsUsed.push(tool);
            this.emit('tool-use', tool, {});
          },
          onProgress: (stage, message) => {
            this.emit('progress', { stage, message });
          }
        });
      });

      // Capturar finalización
      ptyProcess.onExit(({ exitCode }) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutHandle);
        this.ptyProcesses.delete(tenantId);

        const content = this.extractResponse(output);

        if (exitCode === 0) {
          resolve({ content, sessionId, tokensUsed, toolsUsed });
        } else {
          resolve({
            content: content || this.extractFallbackResponse(output),
            sessionId,
            tokensUsed,
            toolsUsed
          });
        }
      });

      // Nota: node-pty no tiene evento 'error', los errores se manejan via exitCode
    });
  }

  /**
   * Construye el prompt completo con contexto
   */
  private buildPrompt(
    message: string,
    context: WhatsAppContext,
    config: TenantConfig
  ): string {
    const parts: string[] = [];

    // Historial de conversación
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      parts.push('--- HISTORIAL DE CONVERSACIÓN ---');
      context.conversationHistory.slice(-20).forEach(msg => {
        const role = msg.role === 'user' ? 'Cliente' : 'Agente';
        parts.push(`${role}: ${msg.content}`);
      });
      parts.push('');
    }

    // Información del contacto
    if (context.contactName) {
      parts.push(`El cliente se llama: ${context.contactName}`);
    }

    // Mensaje actual
    parts.push('--- MENSAJE DEL CLIENTE ---');
    parts.push(message);

    return parts.join('\n');
  }

  /**
   * Parsea la salida de OpenCode
   */
  private parseOutput(
    data: string,
    handlers: {
      onSessionId: (id: string) => void;
      onTokens: (tokens: number) => void;
      onTool: (tool: string) => void;
      onProgress: (stage: string, message?: string) => void;
    }
  ): void {
    const lines = data.split('\n');

    for (const line of lines) {
      if (!line.trim() || !line.startsWith('{')) continue;

      try {
        const parsed = JSON.parse(line);

        if (parsed.sessionID) {
          handlers.onSessionId(parsed.sessionID);
        }

        if (parsed.type === 'step_start') {
          handlers.onProgress('connecting', 'Conectando con el agente...');
        }

        if (parsed.type === 'tool_use' && parsed.part?.tool) {
          handlers.onTool(parsed.part.tool);
          handlers.onProgress('tool-use', `Usando ${parsed.part.tool}`);
        }

        if (parsed.type === 'step_finish') {
          if (parsed.part?.tokens) {
            handlers.onTokens(
              (parsed.part.tokens.input || 0) +
              (parsed.part.tokens.output || 0)
            );
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }

  /**
   * Extrae la respuesta de la salida
   */
  private extractResponse(output: string): string {
    // Remover códigos ANSI
    let cleaned = output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    cleaned = cleaned.replace(/\x1b\[[0-9;]*m/g, '');

    // Buscar líneas JSON con texto
    const lines = cleaned.split('\n');
    const textParts: string[] = [];

    for (const line of lines) {
      if (line.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'text' && parsed.part?.text) {
            textParts.push(parsed.part.text);
          }
        } catch (e) {
          // Ignore
        }
      }
    }

    if (textParts.length > 0) {
      return textParts.join('\n');
    }

    // Fallback: buscar texto después de marcadores
    const textMatch = cleaned.match(/(?:Response|Answer|Output):\s*([\s\S]*?)(?=(?:===|$))/i);
    if (textMatch && textMatch[1]) {
      return textMatch[1].trim();
    }

    return cleaned.trim();
  }

  /**
   * Extrae respuesta de fallback cuando falla
   */
  private extractFallbackResponse(output: string): string {
    // Remover códigos ANSI y limpiar
    let cleaned = output
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, '')
      .trim();

    // Limitar longitud
    if (cleaned.length > 500) {
      cleaned = cleaned.substring(0, 500) + '...';
    }

    return cleaned;
  }

  /**
   * Escapa argumentos para shell
   */
  private escapeArg(arg: string, isWindows: boolean): string {
    if (isWindows) {
      if (arg.includes(' ') || arg.includes('"') || arg.includes("'")) {
        return `"${arg.replace(/"/g, '""')}"`;
      }
      return arg;
    } else {
      if (arg.includes(' ') || arg.includes('"') || arg.includes("'") || arg.includes('$')) {
        return `'${arg.replace(/'/g, "'\\''")}'`;
      }
      return arg;
    }
  }

  /**
   * Limpia procesos PTY
   */
  private cleanup(tenantId: string): void {
    const process = this.ptyProcesses.get(tenantId);
    if (process) {
      try {
        process.kill();
      } catch (e) {
        // Ignore
      }
      this.ptyProcesses.delete(tenantId);
    }
  }

  /**
   * Cancela la ejecución actual
   */
  cancel(tenantId: string): void {
    this.cleanup(tenantId);
  }

  /**
   * Verifica disponibilidad de OpenCode
   */
  async checkAvailability(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      const { execSync } = require('child_process');
      const output = execSync('npx opencode --version', {
        encoding: 'utf-8',
        timeout: 30000
      });
      const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
      return {
        available: true,
        version: versionMatch ? versionMatch[1] : 'unknown'
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const whatsAppAdapter = new WhatsAppAdapter();
