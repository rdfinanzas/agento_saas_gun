/**
 * GlobTool - Búsqueda de archivos por patrón
 * Adaptado desde OpenCode para multi-tenant
 */

import z from 'zod';
import * as path from 'path';
import * as fs from 'fs';
import { Tool } from './tool';

export const GlobTool = Tool.define('glob', {
  description: `Busca archivos que coincidan con un patrón glob.
- Patrones de ejemplo: "**/*.js" (todos los archivos JS), "src/**/*.ts" (archivos TS en src), "*.json" (archivos JSON en el directorio actual)
- Es rápido para encontrar archivos por nombre, pero para buscar contenido usa el tool 'grep'.
- Retorna rutas absolutas a los archivos encontrados.`,
  parameters: z.object({
    pattern: z.string().describe('El patrón glob para buscar archivos'),
    path: z.string().optional().describe('El directorio donde buscar. Por defecto usa el workspace.'),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: 'glob',
      patterns: [params.pattern],
      always: ['*'],
      metadata: {
        pattern: params.pattern,
        path: params.path,
      },
    });

    let searchPath = params.path ?? ctx.workspacePath;
    searchPath = path.isAbsolute(searchPath) ? searchPath : path.resolve(ctx.workspacePath, searchPath);

    // Verificar que está dentro del workspace
    const normalizedSearch = path.normalize(searchPath);
    const normalizedWorkspace = path.normalize(ctx.workspacePath);
    if (!normalizedSearch.startsWith(normalizedWorkspace)) {
      throw new Error(`No se puede buscar fuera del workspace: ${searchPath}`);
    }

    const files: Array<{ path: string; mtime: number }> = [];
    const limit = 100;
    let truncated = false;

    // Función recursiva para buscar archivos
    const searchFiles = async (dir: string, pattern: string) => {
      if (files.length >= limit + 100) return; // Permitir algo más para ordenar

      const entries = await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => []);

      for (const entry of entries) {
        if (files.length >= limit + 100) {
          truncated = true;
          break;
        }

        const fullPath = path.join(dir, entry.name);

        // Ignorar directorios ocultos y node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        if (entry.isDirectory()) {
          await searchFiles(fullPath, pattern);
        } else if (entry.isFile()) {
          if (matchGlob(entry.name, pattern) || matchGlob(fullPath.replace(searchPath + path.sep, ''), pattern)) {
            const stat = await fs.promises.stat(fullPath).catch(() => null);
            files.push({
              path: fullPath,
              mtime: stat?.mtime.getTime() ?? 0,
            });
          }
        }
      }
    };

    await searchFiles(searchPath, params.pattern);

    // Ordenar por fecha de modificación (más recientes primero)
    files.sort((a, b) => b.mtime - a.mtime);

    // Limitar resultados
    const limitedFiles = truncated ? files.slice(0, limit) : files;
    const actuallyTruncated = files.length > limit;

    const output: string[] = [];
    if (limitedFiles.length === 0) {
      output.push('No se encontraron archivos');
    } else {
      output.push(...limitedFiles.map((f) => f.path));
      if (actuallyTruncated) {
        output.push('');
        output.push(
          `(Resultados truncados: mostrando los primeros ${limit} de ${files.length}. Considera usar un path o patrón más específico.)`,
        );
      }
    }

    return {
      title: path.relative(ctx.workspacePath, searchPath),
      metadata: {
        count: files.length,
        truncated: actuallyTruncated,
      },
      output: output.join('\n'),
    };
  },
});

/**
 * Coincidencia simple de patrón glob
 */
function matchGlob(filename: string, pattern: string): boolean {
  // Convertir patrón glob a regex simple
  let regex = pattern
    .replace(/\*\*/g, '<<<DOUBLESTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<DOUBLESTAR>>>/g, '.*')
    .replace(/\?/g, '[^/]')
    .replace(/\./g, '\\.');

  // Asegurar que coincide el nombre completo
  if (!regex.startsWith('^')) regex = '^' + regex;
  if (!regex.endsWith('$')) regex = regex + '$';

  try {
    return new RegExp(regex, 'i').test(filename);
  } catch {
    return false;
  }
}
