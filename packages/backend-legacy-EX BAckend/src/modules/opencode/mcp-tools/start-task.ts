/**
 * StartTaskTool - Inicia una tarea y registra el plan
 * Adaptado desde Accomplish Agent-Core para multi-tenant
 */

import z from 'zod';
import { Tool } from '../tools/tool';

interface StartTaskMetadata extends Tool.Metadata {
  originalRequest: string;
  needsPlanning: boolean;
  goal?: string;
  steps?: string[];
  verification?: string[];
  skills: string[];
}

export const StartTaskTool = Tool.define('start_task', async () => {
  return {
    description: `Llama esta herramienta PRIMERO antes de ejecutar cualquier tarea. Captura tu plan. Las otras herramientas fallarán hasta que se llame esta.
- Para tareas simples (saludos, preguntas, búsquedas rápidas): needs_planning=false
- Para tareas multi-paso: needs_planning=true, y proporciona goal, steps, y verification`,
    parameters: z.object({
      original_request: z.string().describe('Repite exactamente la solicitud original del usuario'),
      needs_planning: z.boolean().describe(
        'true para tareas multi-paso que necesitan un plan, false para mensajes simples (saludos, preguntas, búsquedas rápidas)'
      ),
      goal: z.string().optional().describe('Lo que planeas lograr (requerido cuando needs_planning es true)'),
      steps: z.array(z.string()).optional().describe('Acciones planificadas para lograr el objetivo, en orden (requerido cuando needs_planning es true)'),
      verification: z.array(z.string()).optional().describe('Cómo verificarás que la tarea está completa (requerido cuando needs_planning es true)'),
      skills: z.array(z.string()).describe('Nombres de skills o comandos relevantes para esta tarea. Usa [] si no aplica ningún skill.'),
    }),
    async execute(
      params: {
        original_request: string;
        needs_planning: boolean;
        goal?: string;
        steps?: string[];
        verification?: string[];
        skills: string[];
      },
      ctx: Tool.Context
    ): Promise<Tool.ExecuteResult<StartTaskMetadata>> {
      const { original_request, needs_planning, goal, steps, verification, skills } = params;

      // Validar que si needs_planning es true, se proporcionen los campos requeridos
      if (needs_planning) {
        if (!goal || !steps?.length || !verification?.length) {
          throw new Error('goal, steps, y verification son requeridos cuando needs_planning es true');
        }
      }

      // Log para debugging
      console.log(`[start-task] Request: ${original_request}`);
      console.log(`[start-task] Planning: ${needs_planning}`);
      if (goal) console.log(`[start-task] Goal: ${goal}`);
      if (steps) console.log(`[start-task] Steps: ${steps.join(' -> ')}`);
      if (verification) console.log(`[start-task] Verification: ${verification.join(', ')}`);
      console.log(`[start-task] Skills: ${skills.join(', ') || 'none'}`);

      // Construir respuesta
      let output = 'Plan registrado. Procede con la ejecución.\n\n';

      if (needs_planning && goal && steps) {
        output += `**Objetivo:** ${goal}\n\n`;
        output += `**Pasos planificados:**\n`;
        steps.forEach((step, i) => {
          output += `${i + 1}. ${step}\n`;
        });
        output += `\n**Verificación:**\n`;
        verification?.forEach((v, i) => {
          output += `- ${v}\n`;
        });
      }

      return {
        title: 'Task Started',
        output,
        metadata: {
          originalRequest: original_request,
          needsPlanning: needs_planning,
          goal,
          steps,
          verification,
          skills,
        },
      };
    },
  };
});
