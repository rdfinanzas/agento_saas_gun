/**
 * ReportThoughtTool - Reporta pensamientos del agente al stream
 * Adaptado desde Accomplish Agent-Core para multi-tenant
 */

import z from 'zod';
import { Tool } from '../tools/tool';

interface ReportThoughtMetadata extends Tool.Metadata {
  category: string;
  content: string;
}

export const ReportThoughtTool = Tool.define('report_thought', async () => {
  return {
    description: `Reporta un pensamiento al stream de pensamientos para visibilidad en tiempo real del razonamiento del agente.
- Úsalo frecuentemente para narrar lo que ves y haces.
- Categorías:
  - observation: lo que observas (resultados de comandos, contenido de archivos)
  - reasoning: por qué estás tomando una decisión
  - decision: qué decidiste hacer
  - action: qué estás ejecutando`,
    parameters: z.object({
      content: z.string().describe('El contenido del pensamiento a mostrar'),
      category: z.enum(['observation', 'reasoning', 'decision', 'action']).describe(
        'Categoría: observation (lo que ves), reasoning (por qué), decision (qué elegiste), action (qué estás haciendo)'
      ),
    }),
    async execute(
      params: { content: string; category: 'observation' | 'reasoning' | 'decision' | 'action' },
      ctx: Tool.Context
    ): Promise<Tool.ExecuteResult<ReportThoughtMetadata>> {
      const { content, category } = params;

      // Log para debugging
      console.log(`[thought] [${category}] ${content}`);

      // Aquí se podría enviar a un servicio de streaming si está disponible
      // Por ahora solo registramos y devolvemos confirmación

      return {
        title: `Thought: ${category}`,
        output: 'Pensamiento registrado.',
        metadata: {
          category,
          content,
        },
      };
    },
  };
});
