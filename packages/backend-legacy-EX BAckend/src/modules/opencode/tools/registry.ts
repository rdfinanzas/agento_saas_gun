/**
 * ToolRegistry - Registro de Herramientas
 * Adaptado desde OpenCode para multi-tenant
 */

import z from 'zod';
import { Tool } from './tool';
import { BashTool } from './bash';
import { ReadTool } from './read';
import { WriteTool } from './write';
import { EditTool } from './edit';
import { GlobTool } from './glob';
import { GrepTool } from './grep';
import { ExcelTool } from './excel';
// MCP Tools
import { ReportThoughtTool } from '../mcp-tools/report-thought';
import { ReportCheckpointTool } from '../mcp-tools/report-checkpoint';
import { StartTaskTool } from '../mcp-tools/start-task';
import { CompleteTaskTool } from '../mcp-tools/complete-task';
import { AskUserQuestionTool } from '../mcp-tools/ask-user-question';
import { SafeFileDeletionTool } from '../mcp-tools/safe-file-deletion';

export namespace ToolRegistry {
  /**
   * Herramientas personalizadas por tenant
   */
  const customTools: Map<string, Tool.Info[]> = new Map();

  /**
   * Registra una herramienta personalizada para un tenant
   */
  export function register(tenantId: string, tool: Tool.Info): void {
    const tools = customTools.get(tenantId) || [];
    const idx = tools.findIndex((t) => t.id === tool.id);
    if (idx >= 0) {
      tools.splice(idx, 1, tool);
    } else {
      tools.push(tool);
    }
    customTools.set(tenantId, tools);
  }

  /**
   * Obtiene todas las herramientas disponibles para un tenant
   */
  export async function all(tenantId: string): Promise<Tool.Info[]> {
    const custom = customTools.get(tenantId) || [];

return [
      BashTool,
      ReadTool,
      GlobTool,
      GrepTool,
      EditTool,
      WriteTool,
      ExcelTool,
      // MCP Tools
      ReportThoughtTool,
      ReportCheckpointTool,
      StartTaskTool,
      CompleteTaskTool,
      AskUserQuestionTool,
      SafeFileDeletionTool,
      ...custom,
    ];
  }

  /**
   * Obtiene los IDs de todas las herramientas
   */
  export async function ids(tenantId: string): Promise<string[]> {
    const tools = await all(tenantId);
    return tools.map((t) => t.id);
  }

  /**
   * Obtiene las definiciones de herramientas para enviar al LLM
   */
  export async function tools(
    tenantId: string,
    agent?: Tool.AgentInfo,
  ): Promise<Array<{
    id: string;
    description: string;
    parameters: z.ZodType;
  }>> {
    const allTools = await all(tenantId);
    const result = await Promise.all(
      allTools.map(async (t) => {
        const tool = await t.init({ agent, tenantId });
        return {
          id: t.id,
          description: tool.description,
          parameters: tool.parameters,
        };
      }),
    );
    return result;
  }

  /**
   * Ejecuta una herramienta por ID
   */
  export async function execute(
    tenantId: string,
    toolId: string,
    args: any,
    ctx: Tool.Context,
  ): Promise<{ title: string; output: string; metadata: any }> {
    const tools = await all(tenantId);
    const toolInfo = tools.find((t) => t.id === toolId);

    if (!toolInfo) {
      throw new Error(`Tool not found: ${toolId}`);
    }

    const tool = await toolInfo.init({ tenantId, agent: { id: ctx.agent, name: ctx.agent, type: 'default' } });
    return tool.execute(args, ctx);
  }

  /**
   * Obtiene definiciones de herramientas en formato OpenAI/Anthropic
   */
  export async function getToolDefinitions(tenantId: string): Promise<Array<{
    name: string;
    description: string;
    input_schema: any;
  }>> {
    const tools = await all(tenantId);
    const definitions = await Promise.all(
      tools.map(async (t) => {
        const tool = await t.init({ tenantId });
        return {
          name: t.id,
          description: tool.description,
          input_schema: zodToJsonSchema(tool.parameters),
        };
      }),
    );
    return definitions;
  }

  /**
   * Limpia herramientas personalizadas de un tenant
   */
  export function clearTenantTools(tenantId: string): void {
    customTools.delete(tenantId);
  }
}

/**
 * Convierte un schema Zod a JSON Schema
 */
function zodToJsonSchema(zodSchema: z.ZodType): any {
  const schema: any = {
    type: 'object',
    properties: {},
    required: [],
  };

  if (zodSchema instanceof z.ZodObject) {
    const shape = zodSchema.shape;
    for (const [key, value] of Object.entries(shape)) {
      schema.properties[key] = zodTypeToJsonSchema(value as z.ZodType);

      // Check if optional
      if (!(value instanceof z.ZodOptional)) {
        schema.required.push(key);
      }
    }
  }

  if (schema.required.length === 0) {
    delete schema.required;
  }

  return schema;
}

/**
 * Convierte un tipo Zod individual a JSON Schema
 */
function zodTypeToJsonSchema(zodType: z.ZodType): any {
  if (zodType instanceof z.ZodString) {
    return { type: 'string', description: zodType.description };
  }
  if (zodType instanceof z.ZodNumber) {
    return { type: 'number', description: zodType.description };
  }
  if (zodType instanceof z.ZodBoolean) {
    return { type: 'boolean', description: zodType.description };
  }
  if (zodType instanceof z.ZodArray) {
    return { type: 'array', items: zodTypeToJsonSchema(zodType.element) };
  }
  if (zodType instanceof z.ZodOptional) {
    return zodTypeToJsonSchema(zodType.unwrap());
  }
  if (zodType instanceof z.ZodDefault) {
    const schema = zodTypeToJsonSchema(zodType._def.innerType);
    schema.default = zodType._def.defaultValue();
    return schema;
  }
  if (zodType instanceof z.ZodEnum) {
    return { type: 'string', enum: zodType._def.values };
  }
  if (zodType instanceof z.ZodNativeEnum) {
    return { type: 'string', enum: Object.values(zodType._def.values) };
  }
  if (zodType instanceof z.ZodLiteral) {
    return { const: zodType._def.value };
  }
  if (zodType instanceof z.ZodUnion) {
    return { oneOf: zodType._def.options.map(zodTypeToJsonSchema) };
  }
  if (zodType instanceof z.ZodRecord) {
    return { type: 'object', additionalProperties: zodTypeToJsonSchema(zodType._def.valueType) };
  }
  if (zodType instanceof z.ZodObject) {
    return zodToJsonSchema(zodType);
  }

  return { type: 'string' };
}
