/**
 * CompleteTaskTool - Marca una tarea como completada
 * Adaptado desde Accomplish Agent-Core para multi-tenant
 */

import z from 'zod';
import { Tool } from '../tools/tool';

interface CompleteTaskMetadata extends Tool.Metadata {
  status: 'success' | 'blocked' | 'partial';
  summary: string;
  originalRequestSummary?: string;
  remainingWork?: string;
}

export const CompleteTaskTool = Tool.define('complete_task', async () => {
  return {
    description: `Llama esta herramienta cuando hayas terminado una tarea. Debes proporcionar un resumen de lo que lograste.
- Status:
  - success: tarea completada exitosamente
  - blocked: no pudiste completar la tarea debido a un bloqueo
  - partial: completaste parte de la tarea pero quedó trabajo pendiente`,
    parameters: z.object({
      status: z.enum(['success', 'blocked', 'partial']).describe(
        'success (completada), blocked (bloqueada), partial (parcialmente completada)'
      ),
      summary: z.string().describe('Resumen específico de lo que lograste. Sé específico sobre cada parte.'),
      original_request_summary: z.string().optional().describe('Resumen breve de la solicitud original'),
      remaining_work: z.string().optional().describe('Si está bloqueado o parcial, describe qué queda y por qué no pudiste completarlo'),
    }),
    async execute(
      params: {
        status: 'success' | 'blocked' | 'partial';
        summary: string;
        original_request_summary?: string;
        remaining_work?: string;
      },
      ctx: Tool.Context
    ): Promise<Tool.ExecuteResult<CompleteTaskMetadata>> {
      const { status, summary, original_request_summary, remaining_work } = params;

      // Log para debugging
      console.log(`[complete-task] Status: ${status}`);
      console.log(`[complete-task] Summary: ${summary}`);
      if (original_request_summary) console.log(`[complete-task] Original: ${original_request_summary}`);
      if (remaining_work) console.log(`[complete-task] Remaining: ${remaining_work}`);

      // Construir respuesta
      let output = '';

      switch (status) {
        case 'success':
          output = '✅ Tarea completada exitosamente.\n\n';
          break;
        case 'blocked':
          output = '🚫 Tarea bloqueada.\n\n';
          break;
        case 'partial':
          output = '⏳ Tarea parcialmente completada.\n\n';
          break;
      }

      output += `**Resumen:** ${summary}`;

      if (remaining_work && (status === 'blocked' || status === 'partial')) {
        output += `\n\n**Trabajo pendiente:** ${remaining_work}`;
      }

      return {
        title: `Task ${status === 'success' ? 'Complete' : status === 'blocked' ? 'Blocked' : 'Partial'}`,
        output,
        metadata: {
          status,
          summary,
          originalRequestSummary: original_request_summary,
          remainingWork: remaining_work,
        },
      };
    },
  };
});
