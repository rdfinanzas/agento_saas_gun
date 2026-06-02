/**
 * WriteTool - Escritura de Archivos
 * Adaptado desde OpenCode para multi-tenant
 */

import z from 'zod';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Tool } from './tool';
import { createTwoFilesPatch } from 'diff';

export const WriteTool = Tool.define('write', {
  description: `Escribe contenido en un archivo, creándolo si no existe o sobrescribiéndolo si ya existe.
- Úsalo cuando quieras crear un archivo nuevo o reemplazar completamente el contenido de un archivo existente.
- Para modificaciones parciales, usa el tool 'edit' en su lugar.
- La ruta del archivo debe ser absoluta.
- El contenido se escribirá con codificación UTF-8.`,
  parameters: z.object({
    content: z.string().describe('El contenido a escribir en el archivo'),
    filePath: z.string().describe('La ruta absoluta al archivo a escribir'),
  }),
  async execute(params, ctx) {
    let filepath = params.filePath;
    if (!path.isAbsolute(filepath)) {
      filepath = path.join(ctx.workspacePath, filepath);
    }

    // Verificar que está dentro del workspace
    const normalizedPath = path.normalize(filepath);
    const normalizedWorkspace = path.normalize(ctx.workspacePath);
    if (!normalizedPath.startsWith(normalizedWorkspace)) {
      throw new Error(`No se puede escribir fuera del workspace: ${filepath}`);
    }

    // Verificar si existe y leer contenido anterior
    const exists = await fs.access(filepath).then(() => true).catch(() => false);
    const contentOld = exists ? await fs.readFile(filepath, 'utf-8') : '';

    // Crear diff para mostrar cambios
    const diff = trimDiff(createTwoFilesPatch(filepath, filepath, contentOld, params.content));

    // Solicitar permiso
    await ctx.ask({
      permission: 'edit',
      patterns: [path.relative(ctx.workspacePath, filepath)],
      always: ['*'],
      metadata: {
        filepath,
        diff,
      },
    });

    // Asegurar que el directorio existe
    const dir = path.dirname(filepath);
    await fs.mkdir(dir, { recursive: true });

    // Escribir archivo
    await fs.writeFile(filepath, params.content, 'utf-8');

    let output = 'Archivo escrito exitosamente.';
    if (!exists) {
      output = `Archivo creado exitosamente: ${path.relative(ctx.workspacePath, filepath)}`;
    }

    return {
      title: path.relative(ctx.workspacePath, filepath),
      metadata: {
        diff,
        filepath,
        exists,
        size: Buffer.byteLength(params.content, 'utf-8'),
      },
      output,
    };
  },
});

/**
 * Recorta el diff para mostrar solo los cambios relevantes
 */
function trimDiff(diff: string): string {
  const lines = diff.split('\n');
  const contentLines = lines.filter(
    (line) =>
      (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) &&
      !line.startsWith('---') &&
      !line.startsWith('+++'),
  );

  if (contentLines.length === 0) return diff;

  let min = Infinity;
  for (const line of contentLines) {
    const content = line.slice(1);
    if (content.trim().length > 0) {
      const match = content.match(/^(\s*)/);
      if (match) min = Math.min(min, match[1].length);
    }
  }

  if (min === Infinity || min === 0) return diff;

  const trimmedLines = lines.map((line) => {
    if (
      (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) &&
      !line.startsWith('---') &&
      !line.startsWith('+++')
    ) {
      const prefix = line[0];
      const content = line.slice(1);
      return prefix + content.slice(min);
    }
    return line;
  });

  return trimmedLines.join('\n');
}
