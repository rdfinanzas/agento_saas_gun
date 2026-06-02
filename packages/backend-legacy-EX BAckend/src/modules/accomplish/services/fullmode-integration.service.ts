/**
 * FullModeIntegrationService - Servicio de integración con OpenCode Nativo
 *
 * Este servicio integra AccomplishService con OpenCodeRuntimeAdapter
 * que usa el código NATIVO de OpenCode (sin CLI) para ejecutar tareas agenticas
 */

import { PrismaClient, TaskStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

import { OpenCodeHttpAdapter, ExecutionContext, ConversationMessage } from '@agento/agent-core';
import { streamingService } from './streaming.service';
import { SecureStorage } from '../../opencode/internal/classes/SecureStorage';

const prisma = new PrismaClient();

// SecureStorage para API keys encriptadas
const secureStorage = new SecureStorage({
  storagePath: process.env.SECURE_STORAGE_PATH || path.join(process.cwd(), 'secure-storage'),
  appId: 'agento-saas-global', // Usar el mismo appId que el admin para poder leer las keys
});

export class FullModeIntegrationService {
  private readonly WORKSPACE_BASE = process.env.WORKSPACE_PATH || path.join(process.cwd(), 'storage', 'tenants');
  private adapters: Map<string, OpenCodeHttpAdapter> = new Map();

  /**
   * Ejecuta una tarea usando el FullModeAdapter
   */
  async executeTask(
    taskId: string,
    tenantId: string,
    prompt: string,
    workspacePath: string,
    conversationHistory?: ConversationMessage[]
  ): Promise<void> {
    console.log(`[fullModeIntegrationService] Iniciando ejecución tarea ${taskId}`);
    console.log(`[fullModeIntegrationService] Tenant: ${tenantId}, Workspace: ${workspacePath}`);
    console.log(`[fullModeIntegrationService] Prompt: ${prompt.substring(0, 100)}...`);

    // Emitir evento de inicio
    streamingService.emitProgress(taskId, 'starting', 0, 'Inicializando agente...');

    try {
      // Obtener API key del SecureStorage
      const apiKeys = await this.getApiKeys(tenantId);
      console.log(`[fullModeIntegrationService] API keys obtenidas:`, Object.keys(apiKeys));

      // Crear o obtener adapter para este tenant
      const adapter = this.getOrCreateAdapter(tenantId);
      console.log(`[fullModeIntegrationService] Adapter obtenido para tenant ${tenantId}`);

      // Preparar contexto de ejecución
      const context: ExecutionContext = {
        tenantId,
        taskId,
        workspacePath,
        sessionId: uuidv4(),
        conversationHistory: conversationHistory || [],
        metadata: {
          mode: 'FULL',
          allowedTools: [
            'bash', 'write', 'edit', 'read', 'glob', 'grep', 'list',
            'webfetch', 'websearch',
            'execute_code',
            'excel_read', 'excel_write',
            'sheets_read', 'sheets_write',
            'knowledge_query'
          ],
          // Incluir API keys en el metadata
          apiKeys,
        },
      };

      console.log(`[fullModeIntegrationService] Contexto creado, llamando a adapter.execute`);

      // Emitir mensaje de inicio
      streamingService.emitMessage(taskId, 'assistant', `Iniciando ejecución en modo FULL para: "${prompt.substring(0, 100)}..."`);

      // Escuchar eventos del adapter
      this.setupAdapterListeners(adapter, taskId);

      console.log(`[fullModeIntegrationService] Listeners configurados, iniciando execute`);

      // Ejecutar con el adapter
      const result = await adapter.execute(prompt, context);

      console.log(`[fullModeIntegrationService] Ejecución completada, resultado:`, JSON.stringify(result).substring(0, 200));

      console.log(`[fullModeIntegrationService] Guardando resultado en BD`);

      // Guardar resultado en BD
      await this.saveExecutionResult(taskId, result);

      // Emitir evento de completado
      streamingService.emitComplete(taskId, result);

    } catch (error: any) {
      console.error(`Error ejecutando tarea ${taskId} con FullModeAdapter:`, error);

      // Guardar error en BD
      await prisma.accomplishTask.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.FAILED,
          completedAt: new Date(),
          error: error.message || 'Error en ejecución FULL',
        },
      });

      // Emitir error
      streamingService.emitError(taskId, error.message || 'Error desconocido');
    }
  }

  /**
   * Obtiene o crea un adapter para un tenant
   */
  private getOrCreateAdapter(tenantId: string): OpenCodeHttpAdapter {
    if (!this.adapters.has(tenantId)) {
      const adapter = new OpenCodeHttpAdapter();
      this.adapters.set(tenantId, adapter);
    }
    return this.adapters.get(tenantId)!;
  }

  /**
   * Configura los listeners del adapter para streaming
   */
  private setupAdapterListeners(adapter: OpenCodeHttpAdapter, taskId: string): void {
    console.log(`[setupAdapterListeners] Configurando listeners para tarea ${taskId}`);

    // Listener para mensajes
    adapter.on('message', (msg: ConversationMessage) => {
      console.log(`[setupAdapterListeners] MESSAGE event recibido:`, msg);
      streamingService.emitMessage(taskId, msg.role, msg.content);
    });

    // Listener para herramientas
    adapter.on('tool-start', (toolName: string, input: any) => {
      streamingService.emitToolEvent(taskId, toolName, input, 'started');
    });

    adapter.on('tool-complete', (toolName: string, input: any, output: any) => {
      streamingService.emitToolEvent(taskId, toolName, input, 'completed', output);
    });

    adapter.on('tool-error', (toolName: string, input: any, error: Error) => {
      streamingService.emitToolEvent(taskId, toolName, input, 'failed', error.message);
    });

    // Listener para progreso
    adapter.on('progress', ({ step, progress, details }) => {
      streamingService.emitProgress(taskId, step, progress || 0, details);
    });

    // Listener para permisos
    adapter.on('permission-request', (request: any) => {
      streamingService.emitPermissionRequest(taskId, request);
    });

    // Listener para completado
    adapter.on('complete', (result: any) => {
      // Este evento se maneja en executeTask
    });

    // Listener para errores
    adapter.on('error', (error: Error) => {
      streamingService.emitError(taskId, error.message);
    });
  }

  /**
   * Guarda el resultado de la ejecución en BD
   */
  private async saveExecutionResult(taskId: string, result: any): Promise<void> {
    const messages = result.messages || [];
    const finalMessages = messages.map((msg: any) => ({
      id: uuidv4(),
      role: msg.role || 'assistant',
      content: msg.content || '',
      timestamp: msg.timestamp || new Date(),
      metadata: msg.metadata,
    }));

    await prisma.accomplishTask.update({
      where: { id: taskId },
      data: {
        status: result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
        completedAt: new Date(),
        messages: finalMessages,
        result: result.success ? result : null,
        error: result.success ? undefined : result.error,
      },
    });
  }

  /**
   * Ejecuta un follow-up usando el adapter
   */
  async executeFollowUp(
    taskId: string,
    tenantId: string,
    message: string,
    conversationHistory: ConversationMessage[]
  ): Promise<void> {
    const task = await prisma.accomplishTask.findUnique({
      where: { id: taskId },
    } as any);

    if (!task || !task.workspacePath) {
      throw new Error('Tarea no encontrada o sin workspace');
    }

    // Actualizar estado
    await prisma.accomplishTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    // Ejecutar con el adapter
    await this.executeTask(taskId, tenantId, message, task.workspacePath, [
      ...conversationHistory,
      // Agregar historial previo de la tarea
      ...(task.messages as any[]).map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      })),
    ]);
  }

  /**
   * Cancela una tarea en ejecución
   */
  async cancelExecution(taskId: string, tenantId: string): Promise<void> {
    const adapter = this.adapters.get(tenantId);
    if (adapter) {
      await adapter.cancelExecution(taskId);
    }

    // Actualizar estado
    await prisma.accomplishTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.CANCELLED,
        completedAt: new Date(),
      },
    });

    streamingService.emitComplete(taskId, { cancelled: true });
  }

  /**
   * Limpia adapters no usados
   */
  cleanup(tenantId: string): void {
    const adapter = this.adapters.get(tenantId);
    if (adapter) {
      // Remover todos los listeners
      adapter.removeAllListeners();
      this.adapters.delete(tenantId);
    }
  }

  /**
   * Obtiene las API keys para un tenant (lee de SecureStorage)
   */
  private async getApiKeys(tenantId: string): Promise<Record<string, string>> {
    const apiKeys: Record<string, string> = {};

    // Providers soportados
    const providers = ['deepseek', 'kimi-coding', 'opencode'];

    // Leer API keys de SecureStorage (con error handling)
    for (const provider of providers) {
      try {
        // Primero intentar globales
        const globalCredential = await secureStorage.getApiKey('global', provider);
        if (globalCredential?.apiKey) {
          apiKeys[provider] = globalCredential.apiKey;
          continue;
        }

        // Luego específicas del tenant
        const tenantCredential = await secureStorage.getApiKey(tenantId, provider);
        if (tenantCredential?.apiKey) {
          apiKeys[provider] = tenantCredential.apiKey;
        }
      } catch (error: any) {
        console.log(`[getApiKeys] Error reading ${provider}:`, error.message);
        // Continuar con siguiente provider
      }
    }

    console.log(`[getApiKeys] API keys obtenidas:`, Object.keys(apiKeys));
    return apiKeys;
  }
}

// Singleton instance
export const fullModeIntegrationService = new FullModeIntegrationService();
