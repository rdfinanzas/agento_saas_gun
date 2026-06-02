/**
 * ReportCheckpointTool - Reporta checkpoints de progreso
 * Adaptado desde Accomplish Agent-Core para multi-tenant
 */

import z from 'zod';
import { Tool } from '../tools/tool';

interface ReportCheckpointMetadata extends Tool.Metadata {
  status: 'progress' | 'complete' | 'stuck';
  summary: string;
  nextPlanned?: string;
  blocker?: string;
}

export const ReportCheckpointTool = Tool.define('report_checkpoint', async () => {
  return {
    description: `Reporta un checkpoint de progreso. Úsalo para marcar hitos significativos, completar subtareas, o cuando estás bloqueado.
- Status:
  - progress: trabajo en curso
  - complete: tarea finalizada
  - stuck: bloqueado/necesita ayuda`,
    parameters: z.object({
      status: z.enum(['progress', 'complete', 'stuck']).describe(
        'Status: progress (trabajo en curso), complete (tarea finalizada), stuck (bloqueado/necesita ayuda)'
      ),
      summary: z.string().describe('Resumen breve de lo que se logró o el estado actual'),
      nextPlanned: z.string().optional().describe('Qué planeas hacer a continuación (opcional, para status progress)'),
      blocker: z.string().optional().describe('Descripción de qué está bloqueando el progreso (opcional, para status stuck)'),
    }),
    async execute(
      params: {
        status: 'progress' | 'complete' | 'stuck';
        summary: string;
        nextPlanned?: string;
        blocker?: string;
      },
      ctx: Tool.Context
    ): Promise<Tool.ExecuteResult<ReportCheckpointMetadata>> {
      const { status, summary, nextPlanned, blocker } = params;

      // Log para debugging
      console.log(`[checkpoint] [${status}] ${summary}`);
      if (nextPlanned) console.log(`[checkpoint] Next: ${nextPlanned}`);
      if (blocker) console.log(`[checkpoint] Blocker: ${blocker}`);

      let output = `Checkpoint registrado: ${status}`;
      if (status === 'progress' && nextPlanned) {
        output += `\nPróximo paso: ${nextPlanned}`;
      } else if (status === 'stuck' && blocker) {
        output += `\nBloqueador: ${blocker}`;
      }

      return {
        title: `Checkpoint: ${status}`,
        output,
        metadata: {
          status,
          summary,
          nextPlanned,
          blocker,
        },
      };
    },
  };
});
