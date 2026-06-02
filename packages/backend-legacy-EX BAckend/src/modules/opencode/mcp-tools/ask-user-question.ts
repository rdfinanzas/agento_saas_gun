/**
 * AskUserQuestionTool - Pregunta al usuario durante la ejecución
 * Adaptado desde Accomplish Agent-Core para multi-tenant
 */

import z from 'zod';
import { Tool } from '../tools/tool';

interface QuestionOption {
  label: string;
  value: string;
  description?: string;
}

interface AskUserQuestionMetadata extends Tool.Metadata {
  questions: Array<{
    question: string;
    header?: string;
    options?: QuestionOption[];
    multiSelect?: boolean;
    answer?: string | string[];
  }>;
}

export const AskUserQuestionTool = Tool.define('ask_user_question', async () => {
  return {
    description: `Pregunta al usuario cuando necesites clarificación o input.
- Úsalo cuando necesites información que no puedes obtener de otra forma
- Puedes proporcionar opciones predefinidas o permitir respuesta libre
- Si proporcionas opciones, el usuario puede seleccionar una o escribir una respuesta personalizada`,
    parameters: z.object({
      questions: z.array(z.object({
        question: z.string().describe('La pregunta a hacer al usuario'),
        header: z.string().optional().describe('Encabezado corto para la pregunta (máx 12 caracteres)'),
        options: z.array(z.object({
          label: z.string().describe('Texto de la opción'),
          value: z.string().describe('Valor de la opción'),
          description: z.string().optional().describe('Descripción de la opción'),
        })).optional().describe('Opciones predefinidas. Si no se proporcionan, el usuario puede responder libremente'),
        multiSelect: z.boolean().optional().describe('Permitir seleccionar múltiples opciones (default: false)'),
      })).min(1).max(4).describe('Lista de preguntas (1-4)'),
    }),
    async execute(
      params: {
        questions: Array<{
          question: string;
          header?: string;
          options?: QuestionOption[];
          multiSelect?: boolean;
        }>;
      },
      ctx: Tool.Context
    ): Promise<Tool.ExecuteResult<AskUserQuestionMetadata>> {
      const { questions } = params;

      // Log para debugging
      console.log(`[ask-user-question] ${questions.length} question(s)`);
      questions.forEach((q, i) => {
        console.log(`[ask-user-question] Q${i + 1}: ${q.question}`);
        if (q.options) {
          console.log(`[ask-user-question] Options: ${q.options.map(o => o.label).join(', ')}`);
        }
      });

      // En un sistema real, esto enviaría la pregunta al usuario y esperaría respuesta
      // Por ahora, devolvemos un placeholder indicando que la pregunta está pendiente

      let output = '❓ Pregunta(s) enviada al usuario:\n\n';
      questions.forEach((q, i) => {
        output += `**Pregunta ${i + 1}**`;
        if (q.header) output += ` [${q.header}]`;
        output += `: ${q.question}\n`;

        if (q.options && q.options.length > 0) {
          output += 'Opciones:\n';
          q.options.forEach((opt) => {
            output += `  - ${opt.label}`;
            if (opt.description) output += `: ${opt.description}`;
            output += '\n';
          });
          if (q.multiSelect) {
            output += '  (Permitir selección múltiple)\n';
          }
        }
        output += '\n';
      });

      output += '\n*Esperando respuesta del usuario...*';

      // En producción, aquí se integraría con el sistema de notificaciones
      // y se esperaría la respuesta del usuario

      return {
        title: 'User Question Pending',
        output,
        metadata: {
          questions: questions.map(q => ({
            question: q.question,
            header: q.header,
            options: q.options,
            multiSelect: q.multiSelect,
          })),
        },
      };
    },
  };
});
