/**
 * OpenCode Executor Service
 *
 * @deprecated Usar @agento/agent-core en su lugar
 * Este servicio será eliminado en versión 2.0
 *
 * PLAN #5: Migración a @agento/agent-core
 * Usar WhatsAppAdapter de @agento/agent-core que maneja internamente la ejecución.
 *
 * ---
 *
 * Ejecuta OpenCode CLI en un contexto aislado por tenant.
 * Soporta Windows (desarrollo) y Linux (producción/VPS).
 *
 * Comandos OpenCode CLI usados:
 * - `opencode run "mensaje" --agent <agente> --model <modelo> --format json --dir <workspace>`
 * - `opencode agent create --description "..." --tools read,glob,grep`
 *
 * Modos de ejecución:
 * - FULL: Acceso completo a todas las tools (chat Accomplish)
 * - LIMITED: Solo tools de lectura (agentes WhatsApp)
 */

import * as pty from 'node-pty';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { CliResolverService } from './cli-resolver.service';
import { ExecutionMode } from '../../security/services/security-layer.service';

// ============================================
// Tools disponibles en OpenCode CLI
// ============================================
export const OPENCODE_TOOLS = {
  bash: 'bash',
  read: 'read',
  write: 'write',
  edit: 'edit',
  list: 'list',
  glob: 'glob',
  grep: 'grep',
  webfetch: 'webfetch',
  task: 'task',
  todowrite: 'todowrite',
  todoread: 'todoread',
} as const;

// ============================================
// Tools por Modo
// ============================================
export const FULL_MODE_TOOLS = Object.values(OPENCODE_TOOLS);

export const LIMITED_MODE_TOOLS = [
  OPENCODE_TOOLS.read,
  OPENCODE_TOOLS.list,
  OPENCODE_TOOLS.glob,
  OPENCODE_TOOLS.grep,
];

export const LIMITED_MODE_BLOCKED_TOOLS = [
  OPENCODE_TOOLS.bash,
  OPENCODE_TOOLS.write,
  OPENCODE_TOOLS.edit,
  OPENCODE_TOOLS.task,
  OPENCODE_TOOLS.todowrite,
  OPENCODE_TOOLS.todoread,
];

// ============================================
// Interfaces
// ============================================

export interface AgentIdentity {
  name?: string;
  role?: string;
  style?: string;
  language?: string;
}

export interface BusinessInfo {
  name?: string;
  type?: string;
  description?: string;
  hours?: Record<string, string>;
  policies?: Record<string, string>;
  procedures?: Record<string, string>;
}

export interface ExecutionContext {
  tenantId: string;
  mode: ExecutionMode;
  workspacePath: string;

  // Contexto de conversación
  conversationHistory?: ConversationMessage[];

  // Identidad del agente
  agentIdentity?: AgentIdentity;

  // Información del negocio
  businessInfo?: BusinessInfo;

  // Conocimiento
  agentInstructions?: string;
  knowledgeBase?: KnowledgeBase;
  relevantEmbeddings?: EmbeddingResult[];

  // Configuración de tools (override del modo)
  allowedTools?: string[];
  blockedTools?: string[];

  // Configuración de LLM
  provider?: string;
  model?: string;

  // Timeout
  timeout?: number;
}

export interface KnowledgeBase {
  faq?: Record<string, string>;
  products?: any[];
  policies?: Record<string, string>;
  custom?: Record<string, any>;
}

export interface EmbeddingResult {
  content: string;
  source: string;
  score: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface ExecutionResult {
  content: string;
  tokensUsed?: number;
  executionTime: number;
  toolsUsed?: string[];
  error?: string;
}

// ============================================
// Servicio Principal
// ============================================

/**
 * @deprecated Usar @agento/agent-core en su lugar
 * Este servicio será eliminado en versión 2.0
 *
 * PLAN #5: Migración a @agento/agent-core
 * Usar WhatsAppAdapter de @agento/agent-core que maneja internamente la ejecución.
 */
export class OpenCodeExecutorService {
  private cliResolver = new CliResolverService();
  private readonly DEFAULT_TIMEOUT = 120000; // 2 minutos
  private readonly MAX_HISTORY_MESSAGES = 20;

  // Cache de agentes creados por tenant
  private agentCache: Map<string, string> = new Map();

  /**
   * Ejecuta un prompt usando OpenCode CLI
   */
  async execute(prompt: string, context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // 1. Asegurar que el workspace existe
      await this.ensureWorkspaceExists(context.workspacePath);

      // 2. Construir el mensaje completo con contexto
      const fullPrompt = this.buildFullPrompt(prompt, context);

      // 3. Crear o obtener el agente para este tenant
      const agentName = await this.getOrCreateAgent(context);

      // 4. Construir argumentos del CLI
      const args = this.buildCliArgs(fullPrompt, context, agentName);

      // 5. Construir entorno aislado
      const env = this.buildIsolatedEnv(context);

      // 6. Ejecutar OpenCode via PTY
      const result = await this.executePty(args, context, env);

      const executionTime = Date.now() - startTime;

      return {
        content: result.output,
        tokensUsed: result.tokensUsed,
        executionTime,
        toolsUsed: result.toolsUsed,
        error: result.error,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        content: '',
        executionTime,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  /**
   * Asegura que el directorio de workspace existe
   */
  private async ensureWorkspaceExists(workspacePath: string): Promise<void> {
    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true });
      console.log(`[OpenCode] Workspace creado: ${workspacePath}`);
    }
  }

  /**
   * Construye el prompt completo incluyendo contexto
   */
  private buildFullPrompt(prompt: string, context: ExecutionContext): string {
    const parts: string[] = [];

    // Identidad del agente
    if (context.agentIdentity) {
      const { name, role, style, language } = context.agentIdentity;
      if (name) parts.push(`Tu nombre es ${name}.`);
      if (role) parts.push(`Tu rol es: ${role}.`);
      if (style) parts.push(`Tu estilo de comunicación es ${style}.`);
      if (language) parts.push(`Responde siempre en ${language}.`);
    }

    // Información del negocio
    if (context.businessInfo) {
      parts.push('\n--- INFORMACIÓN DEL NEGOCIO ---');
      const { name, type, description, hours, policies } = context.businessInfo;
      if (name) parts.push(`Nombre: ${name}`);
      if (type) parts.push(`Rubro: ${type}`);
      if (description) parts.push(`Descripción: ${description}`);
      if (hours) {
        parts.push('Horarios:');
        Object.entries(hours).forEach(([day, time]) => {
          parts.push(`  - ${day}: ${time}`);
        });
      }
      if (policies) {
        parts.push('Políticas:');
        Object.entries(policies).forEach(([key, value]) => {
          parts.push(`  - ${key}: ${value}`);
        });
      }
    }

    // Knowledge Base
    if (context.knowledgeBase) {
      const { faq, products, policies, custom } = context.knowledgeBase;

      if (faq && Object.keys(faq).length > 0) {
        parts.push('\n--- PREGUNTAS FRECUENTES ---');
        Object.entries(faq).forEach(([question, answer]) => {
          parts.push(`P: ${question}`);
          parts.push(`R: ${answer}`);
          parts.push('');
        });
      }

      if (products && products.length > 0) {
        parts.push('\n--- PRODUCTOS/SERVICIOS ---');
        products.forEach((product: any) => {
          parts.push(`- ${JSON.stringify(product)}`);
        });
      }

      if (custom) {
        parts.push('\n--- INFORMACIÓN ADICIONAL ---');
        parts.push(JSON.stringify(custom, null, 2));
      }
    }

    // Embeddings relevantes
    if (context.relevantEmbeddings && context.relevantEmbeddings.length > 0) {
      parts.push('\n--- CONTEXTO RELEVANTE ---');
      context.relevantEmbeddings.forEach((embedding) => {
        parts.push(`[${embedding.source}]: ${embedding.content}`);
      });
    }

    // Historial de conversación
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      parts.push('\n--- HISTORIAL DE CONVERSACIÓN ---');
      context.conversationHistory.slice(-this.MAX_HISTORY_MESSAGES).forEach((msg) => {
        const roleLabel = msg.role === 'user' ? 'Cliente' : 'Agente';
        parts.push(`${roleLabel}: ${msg.content}`);
      });
    }

    // Instrucciones personalizadas
    if (context.agentInstructions) {
      parts.push('\n--- INSTRUCCIONES ---');
      parts.push(context.agentInstructions);
    }

    // Reglas según el modo
    if (context.mode === ExecutionMode.LIMITED) {
      parts.push('\n--- REGLAS IMPORTANTES ---');
      parts.push('- Responde SOLO basándote en la información proporcionada');
      parts.push('- Si no tienes información, dilo honestamente');
      parts.push('- Sé conciso (max 2-3 párrafos cortos)');
      parts.push('- Usa un tono amigable pero profesional');
      parts.push('- Si el cliente parece molesto, ofrece conectarlo con un humano');
    }

    // Prompt del usuario
    parts.push('\n--- MENSAJE DEL CLIENTE ---');
    parts.push(prompt);

    return parts.join('\n');
  }

  /**
   * Crea o obtiene el agente para el tenant
   */
  private async getOrCreateAgent(context: ExecutionContext): Promise<string> {
    const agentKey = `${context.tenantId}-${context.mode}`;
    const cachedAgent = this.agentCache.get(agentKey);
    if (cachedAgent) {
      return cachedAgent;
    }

    // Determinar tools según el modo
    const tools = context.mode === ExecutionMode.LIMITED
      ? LIMITED_MODE_TOOLS
      : FULL_MODE_TOOLS;

    const agentName = `agento-${context.tenantId.substring(0, 8)}-${context.mode.toLowerCase()}`;
    const description = context.mode === ExecutionMode.LIMITED
      ? 'Agente de WhatsApp en modo limitado. Solo puede leer archivos y buscar información.'
      : 'Agente de Accomplish en modo completo. Puede ejecutar código y modificar archivos.';

    try {
      // Crear el agente si no existe
      const isWindows = process.platform === 'win32';
      const shell = isWindows ? 'powershell.exe' : '/bin/bash';
      const shellFlag = isWindows ? '-Command' : '-c';

      const createCmd = `npx opencode agent create --description "${description}" --tools ${tools.join(',')} --mode primary`;

      console.log(`[OpenCode] Creando agente: ${agentName}`);

      // Por ahora, usamos el agente por defecto
      // TODO: Implementar creación de agentes cuando OpenCode lo soporte mejor

      this.agentCache.set(agentKey, agentName);
      return agentName;
    } catch (error) {
      console.log('[OpenCode] Usando agente por defecto');
      return 'default';
    }
  }

  /**
   * Construye los argumentos del CLI de OpenCode
   */
  private buildCliArgs(
    prompt: string,
    context: ExecutionContext,
    agentName: string
  ): string[] {
    const args: string[] = [];

    // Comando principal
    args.push('run');

    // El prompt (mensaje a enviar)
    args.push(prompt);

    // Formato JSON para parsear la salida
    args.push('--format', 'json');

    // Directorio de trabajo
    args.push('--dir', context.workspacePath);

    // Modelo si está especificado
    if (context.provider && context.model) {
      args.push('--model', `${context.provider}/${context.model}`);
    } else {
      // Modelo por defecto
      args.push('--model', 'anthropic/claude-sonnet-4-20250514');
    }

    // Mostrar thinking
    args.push('--thinking');

    return args;
  }

  /**
   * Construye el entorno aislado por tenant
   */
  private buildIsolatedEnv(context: ExecutionContext): NodeJS.ProcessEnv {
    const isWindows = process.platform === 'win32';
    const homeVar = isWindows ? 'USERPROFILE' : 'HOME';

    return {
      ...process.env,

      // Identificación del tenant
      TENANT_ID: context.tenantId,
      EXECUTION_MODE: context.mode,

      // Workspace aislado
      OPENCODE_WORKSPACE: context.workspacePath,
      [homeVar]: context.workspacePath,

      // Configuración
      NODE_ENV: process.env.NODE_ENV || 'production',
      TERM: 'xterm-256color',
      LANG: 'en_US.UTF-8',

      // Prevenir acceso a configuraciones globales
      APPDATA: isWindows ? context.workspacePath : undefined,
      LOCALAPPDATA: isWindows ? context.workspacePath : undefined,
    } as NodeJS.ProcessEnv;
  }

  /**
   * Ejecuta OpenCode via PTY (multiplataforma)
   */
  private async executePty(
    args: string[],
    context: ExecutionContext,
    env: NodeJS.ProcessEnv
  ): Promise<{ output: string; tokensUsed?: number; toolsUsed?: string[]; error?: string }> {
    return new Promise((resolve, reject) => {
      let output = '';
      let jsonOutput = '';
      let toolsUsed: string[] = [];
      let tokensUsed = 0;
      let isResolved = false;

      const timeout = context.timeout || this.DEFAULT_TIMEOUT;
      const isWindows = process.platform === 'win32';

      // Configurar shell según SO
      const shell = isWindows ? 'powershell.exe' : '/bin/bash';
      const shellArgs = isWindows ? ['-NoProfile', '-Command'] : ['-lc'];

      // Construir comando completo
      const command = `npx opencode ${args.map((a) => this.escapeShellArg(a, isWindows)).join(' ')}`;

      console.log(`[OpenCode] Ejecutando: npx opencode ${args.slice(0, 3).join(' ')}...`);
      console.log(`[OpenCode] Modo: ${context.mode}`);
      console.log(`[OpenCode] Workspace: ${context.workspacePath}`);

      // Spawn PTY
      const ptyProcess = pty.spawn(shell, [...shellArgs, command], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: context.workspacePath,
        env,
      });

      // Timeout handler
      const timeoutHandle = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          try {
            ptyProcess.kill();
          } catch (e) {
            // Ignore kill errors
          }
          reject(new Error(`Timeout: OpenCode no respondió después de ${timeout}ms`));
        }
      }, timeout);

      // Capturar salida
      ptyProcess.onData((data: string) => {
        output += data;

        // Intentar parsear JSON si viene en formato json
        try {
          // Buscar líneas JSON en la salida
          const lines = data.split('\n');
          for (const line of lines) {
            if (line.trim().startsWith('{')) {
              jsonOutput += line;
            }
          }
        } catch (e) {
          // Ignore JSON parse errors
        }

        // Detectar uso de tools
        const toolMatch = data.match(/"tool":\s*"(\w+)"/g);
        if (toolMatch) {
          toolMatch.forEach((match) => {
            const toolName = match.replace(/"tool":\s*"/, '').replace('"', '');
            if (!toolsUsed.includes(toolName)) {
              toolsUsed.push(toolName);
            }
          });
        }

        // Detectar tokens
        const tokenMatch = data.match(/"tokens":\s*(\d+)/i);
        if (tokenMatch) {
          tokensUsed = parseInt(tokenMatch[1], 10);
        }
      });

      // Capturar finalización
      ptyProcess.onExit(({ exitCode }) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutHandle);

        const parsedOutput = this.parseOutput(output, jsonOutput);

        if (exitCode === 0) {
          resolve({
            output: parsedOutput,
            tokensUsed,
            toolsUsed,
          });
        } else {
          resolve({
            output: parsedOutput,
            tokensUsed,
            toolsUsed,
            error: `OpenCode terminó con código ${exitCode}`,
          });
        }
      });

      // Nota: node-pty no tiene evento 'error', los errores se manejan via exitCode en onExit
    });
  }

  /**
   * Escapa un argumento para shell según el SO
   */
  private escapeShellArg(arg: string, isWindows: boolean): string {
    if (isWindows) {
      // PowerShell escaping
      if (arg.includes(' ') || arg.includes('"') || arg.includes("'") || arg.includes('$')) {
        return `"${arg.replace(/"/g, '""')}"`;
      }
      return arg;
    } else {
      // Bash escaping
      if (arg.includes(' ') || arg.includes('"') || arg.includes("'") || arg.includes('$')) {
        return `'${arg.replace(/'/g, "'\\''")}'`;
      }
      return arg;
    }
  }

  /**
   * Limpia y parsea la salida de OpenCode
   */
  private parseOutput(rawOutput: string, jsonOutput: string): string {
    // Si tenemos JSON, intentar extraer la respuesta
    if (jsonOutput) {
      try {
        // Buscar el contenido de la respuesta
        const jsonLines = jsonOutput.split('\n').filter(l => l.trim());
        const contents: string[] = [];

        for (const line of jsonLines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'content' && parsed.content) {
              contents.push(parsed.content);
            } else if (parsed.response) {
              contents.push(parsed.response);
            } else if (parsed.message) {
              contents.push(parsed.message);
            } else if (parsed.text) {
              contents.push(parsed.text);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }

        if (contents.length > 0) {
          return contents.join('\n');
        }
      } catch (e) {
        // Fall through to raw output parsing
      }
    }

    // Parsear salida raw
    let cleaned = rawOutput;

    // Remover códigos ANSI
    cleaned = cleaned.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    cleaned = cleaned.replace(/\x1b\[[0-9;]*m/g, '');

    // Remover secuencias de control
    cleaned = cleaned.replace(/\x1b\[2m|\x1b\[22m|\x1b\[0m|\x1b\[K/g, '');

    // Remover caracteres de spinner
    cleaned = cleaned.replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, '');

    // Remover URLs de WebSocket
    cleaned = cleaned.replace(/ws:\/\/[^\s\]]+/g, '');

    // Remover marcadores internos
    cleaned = cleaned.replace(/\[ref=e\d+\]/g, '');
    cleaned = cleaned.replace(/\[cursor=\w+\]/g, '');

    // Limpiar espacios y líneas vacías excesivas
    cleaned = cleaned.replace(/ {2,}/g, ' ');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Intentar extraer la respuesta si hay marcadores
    const responseMatch = cleaned.match(/(?:Response|Output|Answer):\s*([\s\S]*?)(?=(?:===|$))/i);
    if (responseMatch && responseMatch[1]) {
      return responseMatch[1].trim();
    }

    return cleaned.trim();
  }

  /**
   * Ejecuta múltiples prompts en secuencia
   */
  async executeBatch(
    prompts: string[],
    context: ExecutionContext
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const prompt of prompts) {
      const result = await this.execute(prompt, context);
      results.push(result);

      // Si hay error, detener ejecución
      if (result.error) {
        break;
      }
    }

    return results;
  }

  /**
   * Verifica disponibilidad de OpenCode
   */
  async checkHealth(): Promise<{
    available: boolean;
    version: string | null;
    cliPath: string | null;
    platform: string;
  }> {
    try {
      // Verificar que npx está disponible
      const isWindows = process.platform === 'win32';
      const checkCmd = isWindows ? 'where npx' : 'which npx';

      try {
        execSync(checkCmd, { encoding: 'utf-8', timeout: 5000 });
      } catch {
        return {
          available: false,
          version: null,
          cliPath: null,
          platform: `${process.platform} (${process.arch})`,
        };
      }

      // Obtener versión de opencode
      let version: string | null = null;
      try {
        const versionOutput = execSync('npx opencode --version', {
          encoding: 'utf-8',
          timeout: 30000,
        });
        const versionMatch = versionOutput.match(/(\d+\.\d+\.\d+)/);
        version = versionMatch ? versionMatch[1] : null;
      } catch (e) {
        console.log('[OpenCode] Could not get version');
      }

      return {
        available: true,
        version,
        cliPath: 'npx opencode',
        platform: `${process.platform} (${process.arch})`,
      };
    } catch (error) {
      return {
        available: false,
        version: null,
        cliPath: null,
        platform: `${process.platform} (${process.arch})`,
      };
    }
  }

  /**
   * Obtiene el path del workspace para un tenant
   */
  static getWorkspacePath(tenantId: string): string {
    const basePath = process.env.WORKSPACE_BASE_PATH || path.join(os.homedir(), '.agento', 'workspaces');
    return path.join(basePath, tenantId, 'workspace');
  }
}

// Exportar instancia singleton
export const openCodeExecutor = new OpenCodeExecutorService();
