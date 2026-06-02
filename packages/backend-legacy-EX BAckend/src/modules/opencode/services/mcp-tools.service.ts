/**
 * MCP Tools Service - Herramientas del agente
 * Adaptado desde Accomplish Agent-Core para multi-tenant
 *
 * Estas herramientas se integran directamente en el backend
 * en lugar de ser servidores MCP standalone.
 */

import { v4 as uuidv4 } from 'uuid';
import { getThoughtStreamHandler } from '../internal/classes/ThoughtStreamHandler';
import { getPermissionHandler } from '../internal/classes/PermissionHandler';
import type {
  ThoughtCategory,
  CheckpointStatus,
} from '../common/types/thought-stream';
import type { PermissionOperation } from '../common/types/permissions';

// ============================================
// INTERFACES
// ============================================

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  handler: (args: any, context: MCPToolContext) => Promise<MCPToolResult>;
}

export interface MCPToolContext {
  tenantId: string;
  taskId: string;
  agentName: string;
  conversationId?: string;
}

export interface MCPToolResult {
  content: string;
  isError?: boolean;
}

// ============================================
// TOOL: Ask User Question
// ============================================

interface AskUserQuestionInput {
  question: string;
  header?: string;
  options?: Array<{ label: string; description?: string }>;
  multiSelect?: boolean;
}

export const askUserQuestionTool: MCPTool = {
  name: 'AskUserQuestion',
  description:
    "Pregunta al usuario y espera su respuesta. Úsalo para clarificaciones, confirmaciones antes de acciones sensibles, o cuando necesitas input del usuario para proceder.",
  inputSchema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'La pregunta a hacer al usuario',
      },
      header: {
        type: 'string',
        description: 'Encabezado corto para la pregunta (máx 12 caracteres)',
      },
      options: {
        type: 'array',
        description: 'Opciones disponibles (2-4 opciones)',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Texto de la opción' },
            description: { type: 'string', description: 'Explicación de la opción' },
          },
          required: ['label'],
        },
      },
      multiSelect: {
        type: 'boolean',
        description: 'Permitir selección múltiple',
        default: false,
      },
    },
    required: ['question'],
  },
  handler: async (args: AskUserQuestionInput, context: MCPToolContext): Promise<MCPToolResult> => {
    // En modo sandbox/entrenamiento, simular respuesta
    // En producción, esto se conectaría con WebSocket para esperar respuesta real

    const { question, options } = args;

    // Por ahora, registrar la pregunta y devolver respuesta simulada
    console.log(`[MCP:AskUserQuestion] Task ${context.taskId}: ${question}`);

    if (options && options.length > 0) {
      return {
        content: `Pregunta registrada. Opciones disponibles: ${options.map(o => o.label).join(', ')}. En modo sandbox, se simulará respuesta.`,
      };
    }

    return {
      content: 'Pregunta registrada. En modo sandbox, se simulará respuesta del usuario.',
    };
  },
};

// ============================================
// TOOL: Report Thought
// ============================================

interface ReportThoughtInput {
  content: string;
  category: ThoughtCategory;
}

export const reportThoughtTool: MCPTool = {
  name: 'report_thought',
  description:
    'Reporta un pensamiento para visibilidad en tiempo real del razonamiento del agente. Úsalo frecuentemente para narrar lo que ves y haces.',
  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'El contenido del pensamiento',
      },
      category: {
        type: 'string',
        enum: ['observation', 'reasoning', 'decision', 'action'],
        description:
          'Categoría: observation (lo que ves), reasoning (por qué), decision (qué elegiste), action (qué estás haciendo)',
      },
    },
    required: ['content', 'category'],
  },
  handler: async (args: ReportThoughtInput, context: MCPToolContext): Promise<MCPToolResult> => {
    const { content, category } = args;
    const handler = getThoughtStreamHandler();

    const event = handler.recordThought({
      taskId: context.taskId,
      tenantId: context.tenantId,
      content,
      category,
      agentName: context.agentName,
      timestamp: Date.now(),
    });

    if (!event) {
      return {
        content: 'Error: No se pudo registrar el pensamiento.',
        isError: true,
      };
    }

    return {
      content: 'Pensamiento registrado.',
    };
  },
};

// ============================================
// TOOL: Report Checkpoint
// ============================================

interface ReportCheckpointInput {
  status: CheckpointStatus;
  summary: string;
  nextPlanned?: string;
  blocker?: string;
}

export const reportCheckpointTool: MCPTool = {
  name: 'report_checkpoint',
  description:
    'Reporta un punto de control del progreso de la tarea. Úsalo para indicar progreso, completitud o bloqueos.',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['progress', 'complete', 'stuck'],
        description: 'Estado: progress (en progreso), complete (terminado), stuck (bloqueado)',
      },
      summary: {
        type: 'string',
        description: 'Resumen del estado actual',
      },
      nextPlanned: {
        type: 'string',
        description: 'Próximo paso planeado (si aplica)',
      },
      blocker: {
        type: 'string',
        description: 'Descripción del bloqueo (si aplica)',
      },
    },
    required: ['status', 'summary'],
  },
  handler: async (args: ReportCheckpointInput, context: MCPToolContext): Promise<MCPToolResult> => {
    const { status, summary, nextPlanned, blocker } = args;
    const handler = getThoughtStreamHandler();

    const event = handler.recordCheckpoint({
      taskId: context.taskId,
      tenantId: context.tenantId,
      status,
      summary,
      nextPlanned,
      blocker,
      agentName: context.agentName,
      timestamp: Date.now(),
    });

    if (!event) {
      return {
        content: 'Error: No se pudo registrar el checkpoint.',
        isError: true,
      };
    }

    return {
      content: `Checkpoint registrado: ${status}`,
    };
  },
};

// ============================================
// TOOL: File Permission
// ============================================

interface FilePermissionInput {
  operation: 'create' | 'delete' | 'rename' | 'move' | 'modify' | 'overwrite';
  filePath?: string;
  filePaths?: string[];
  targetPath?: string;
  contentPreview?: string;
}

export const filePermissionTool: MCPTool = {
  name: 'request_file_permission',
  description:
    'Solicita permiso del usuario antes de realizar operaciones de archivo. Siempre llama a esta herramienta ANTES de ejecutar cualquier modificación de archivos.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'delete', 'rename', 'move', 'modify', 'overwrite'],
        description: 'Tipo de operación de archivo',
      },
      filePath: {
        type: 'string',
        description: 'Ruta absoluta al archivo',
      },
      filePaths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array de rutas para operaciones batch',
      },
      targetPath: {
        type: 'string',
        description: 'Ruta destino para operaciones rename/move',
      },
      contentPreview: {
        type: 'string',
        description: 'Vista previa del contenido (primeros ~500 caracteres)',
      },
    },
    required: ['operation'],
  },
  handler: async (args: FilePermissionInput, context: MCPToolContext): Promise<MCPToolResult> => {
    const { operation, filePath, filePaths, targetPath, contentPreview } = args;
    const handler = getPermissionHandler();

    const resource = filePath || (filePaths && filePaths.join(',')) || 'unknown';

    const response = await handler.requestPermission(
      context.tenantId,
      `file_${operation}` as PermissionOperation,
      resource,
      `Operación: ${operation}`,
      contentPreview,
      targetPath,
      filePaths
    );

    return {
      content: response.granted ? 'allowed' : 'denied',
      isError: !response.granted,
    };
  },
};

// ============================================
// TOOL: Complete Task
// ============================================

interface CompleteTaskInput {
  summary: string;
  artifacts?: Array<{ type: string; path: string; description?: string }>;
}

export const completeTaskTool: MCPTool = {
  name: 'complete_task',
  description:
    'Marca la tarea actual como completada con un resumen final. Úsalo cuando hayas terminado todas las acciones solicitadas.',
  inputSchema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'Resumen de lo completado',
      },
      artifacts: {
        type: 'array',
        description: 'Artefactos creados/modificados',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Tipo de artefacto' },
            path: { type: 'string', description: 'Ruta del artefacto' },
            description: { type: 'string', description: 'Descripción' },
          },
          required: ['type', 'path'],
        },
      },
    },
    required: ['summary'],
  },
  handler: async (args: CompleteTaskInput, context: MCPToolContext): Promise<MCPToolResult> => {
    const { summary, artifacts } = args;
    const handler = getThoughtStreamHandler();

    // Registrar checkpoint final
    handler.recordCheckpoint({
      taskId: context.taskId,
      tenantId: context.tenantId,
      status: 'complete',
      summary,
      agentName: context.agentName,
      timestamp: Date.now(),
    });

    // Desregistrar tarea
    handler.unregisterTask(context.taskId);

    let message = `Tarea completada: ${summary}`;
    if (artifacts && artifacts.length > 0) {
      message += `\n\nArtefactos: ${artifacts.map(a => a.path).join(', ')}`;
    }

    return {
      content: message,
    };
  },
};

// ============================================
// TOOL REGISTRY
// ============================================

export const mcpToolsRegistry: MCPTool[] = [
  askUserQuestionTool,
  reportThoughtTool,
  reportCheckpointTool,
  filePermissionTool,
  completeTaskTool,
];

/**
 * Obtiene definiciones de herramientas para enviar al LLM
 */
export function getToolDefinitions(): Array<{
  name: string;
  description: string;
  input_schema: any;
}> {
  return mcpToolsRegistry.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

/**
 * Ejecuta una herramienta por nombre
 */
export async function executeTool(
  toolName: string,
  args: any,
  context: MCPToolContext
): Promise<MCPToolResult> {
  const tool = mcpToolsRegistry.find((t) => t.name === toolName);

  if (!tool) {
    return {
      content: `Error: Herramienta desconocida: ${toolName}`,
      isError: true,
    };
  }

  try {
    return await tool.handler(args, context);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: `Error ejecutando ${toolName}: ${errorMessage}`,
      isError: true,
    };
  }
}

/**
 * MCP Tools Service
 */
export class MCPToolsService {
  /**
   * Obtiene definiciones de herramientas
   */
  getToolDefinitions() {
    return getToolDefinitions();
  }

  /**
   * Ejecuta una herramienta
   */
  async executeTool(toolName: string, args: any, context: MCPToolContext) {
    return executeTool(toolName, args, context);
  }

  /**
   * Verifica si existe una herramienta
   */
  hasTool(toolName: string): boolean {
    return mcpToolsRegistry.some((t) => t.name === toolName);
  }

  /**
   * Lista nombres de herramientas disponibles
   */
  listTools(): string[] {
    return mcpToolsRegistry.map((t) => t.name);
  }
}

export const mcpToolsService = new MCPToolsService();
