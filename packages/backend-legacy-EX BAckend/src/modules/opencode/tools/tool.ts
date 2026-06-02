/**
 * Tool Base - Sistema de Herramientas para Agentes
 * Adaptado desde OpenCode para multi-tenant
 */

import z from 'zod';

export namespace Tool {
  /**
   * Metadatos de una herramienta
   */
  export interface Metadata {
    [key: string]: any;
  }

  /**
   * Contexto de inicialización
   */
  export interface InitContext {
    agent?: AgentInfo;
    tenantId: string;
  }

  /**
   * Información del agente
   */
  export interface AgentInfo {
    id: string;
    name: string;
    type: string;
  }

  /**
   * Contexto de ejecución de una herramienta
   */
  export type Context<M extends Metadata = Metadata> = {
    tenantId: string;
    sessionId: string;
    messageId: string;
    agent: string;
    abort: AbortSignal;
    callId?: string;
    extra?: { [key: string]: any };
    workspacePath: string;
    metadata(input: { title?: string; metadata?: M }): void;
    ask(input: PermissionRequest): Promise<void>;
  }

  /**
   * Solicitud de permiso
   */
  export interface PermissionRequest {
    permission: string;
    patterns: string[];
    always?: string[];
    metadata: Record<string, any>;
  }

  /**
   * Resultado de la ejecución de una herramienta
   */
  export interface ExecuteResult<M extends Metadata = Metadata> {
    title: string;
    metadata: M;
    output: string;
    attachments?: Attachment[];
  }

  /**
   * Información de una herramienta
   */
  export interface Info<Parameters extends z.ZodType = z.ZodType, M extends Metadata = Metadata> {
    id: string;
    init: (ctx?: InitContext) => Promise<{
      description: string;
      parameters: Parameters;
      execute(
        args: z.infer<Parameters>,
        ctx: Context,
      ): Promise<ExecuteResult<M>>;
      formatValidationError?(error: z.ZodError): string;
    }>;
  }

  /**
   * Adjunto (archivo, imagen)
   */
  export interface Attachment {
    type: 'file' | 'image';
    mime: string;
    url: string;
    name?: string;
  }

  export type InferParameters<T extends Info> = T extends Info<infer P> ? z.infer<P> : never;
  export type InferMetadata<T extends Info> = T extends Info<any, infer M> ? M : never;

  /**
   * Tipo para el resultado de init
   */
  export type InitResult<Parameters extends z.ZodType = z.ZodType, M extends Metadata = Metadata> = {
    description: string;
    parameters: Parameters;
    execute(
      args: z.infer<Parameters>,
      ctx: Context,
    ): Promise<{
      title: string;
      metadata: M;
      output: string;
      attachments?: Attachment[];
    }>;
    formatValidationError?(error: z.ZodError): string;
  };

  /**
   * Define una herramienta
   */
  export function define<Parameters extends z.ZodType, Result extends Metadata>(
    id: string,
    init: Info<Parameters, Result>['init'] | InitResult<Parameters, Result>,
  ): Info<Parameters, Result> {
    return {
      id,
      init: async (initCtx) => {
        const toolInfo = init instanceof Function ? await init(initCtx) : init as InitResult<Parameters, Result>;
        const execute = toolInfo.execute;

        toolInfo.execute = async (args, ctx) => {
          try {
            toolInfo.parameters.parse(args);
          } catch (error) {
            if (error instanceof z.ZodError && toolInfo.formatValidationError) {
              throw new Error(toolInfo.formatValidationError(error), { cause: error });
            }
            throw new Error(
              `The ${id} tool was called with invalid arguments: ${error}.\nPlease rewrite the input so it satisfies the expected schema.`,
              { cause: error },
            );
          }

          const result = await execute(args, ctx);
          return result;
        };

        return toolInfo;
      },
    };
  }
}
