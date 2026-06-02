/**
 * GrepTool - Búsqueda de contenido en archivos
 * Adaptado desde OpenCode para multi-tenant
 */

import z from 'zod';
import * as path from 'path';
import * as fs from 'fs';
import { Tool } from './tool';

const MAX_LINE_LENGTH = 2000;

export const GrepTool = Tool.define('grep', {
  description: `Busca contenido dentro de archivos usando expresiones regulares.
- Úsalo para buscar patrones de texto en el código.
- El patrón soporta sintaxis de expresiones regulares.
- Puedes filtrar por tipo de archivo usando el parámetro 'include'.
- Retorna las líneas coincidentes con su número de línea.`,
  parameters: z.object({
    pattern: z.string().describe('El patrón regex a buscar en el contenido de los archivos'),
    path: z.string().optional().describe('El directorio donde buscar. Por defecto usa el workspace.'),
    include: z.string().optional().describe('Patrón de archivos a incluir (ej. "*.js", "*.{ts,tsx}")'),
  }),
  async execute(params, ctx) {
    if (!params.pattern) {
      throw new Error('El patrón es requerido');
    }

    await ctx.ask({
      permission: 'grep',
      patterns: [params.pattern],
      always: ['*'],
      metadata: {
        pattern: params.pattern,
        path: params.path,
        include: params.include,
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

    // Compilar regex
    let regex: RegExp;
    try {
      regex = new RegExp(params.pattern, 'gm');
    } catch (e) {
      throw new Error(`Patrón regex inválido: ${params.pattern}`);
    }

    const matches: Array<{
      path: string;
      modTime: number;
      lineNum: number;
      lineText: string;
    }> = [];

    // Función recursiva para buscar en archivos
    const searchInDir = async (dir: string) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => []);

      for (const entry of entries) {
        // Ignorar directorios ocultos y node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await searchInDir(fullPath);
        } else if (entry.isFile()) {
          // Verificar filtro de extensión
          if (params.include) {
            const ext = path.extname(entry.name);
            const includePatterns = params.include.replace(/[{}]/g, '').split(',');
            const extensions = includePatterns.map((p) => p.trim().replace('*', ''));

            if (!extensions.some((ext2) => entry.name.endsWith(ext2))) {
              continue;
            }
          }

          // Buscar en el archivo
          try {
            const content = await fs.promises.readFile(fullPath, 'utf-8');
            const lines = content.split('\n');
            const stat = await fs.promises.stat(fullPath);

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (regex.test(line)) {
                matches.push({
                  path: fullPath,
                  modTime: stat.mtime.getTime(),
                  lineNum: i + 1,
                  lineText: line,
                });

                // Reset regex lastIndex
                regex.lastIndex = 0;
              }
            }
          } catch {
            // Ignorar archivos que no se pueden leer
          }
        }
      }
    };

    await searchInDir(searchPath);

    // Ordenar por fecha de modificación
    matches.sort((a, b) => b.modTime - a.modTime);

    const limit = 100;
    const truncated = matches.length > limit;
    const finalMatches = truncated ? matches.slice(0, limit) : matches;

    if (finalMatches.length === 0) {
      return {
        title: params.pattern,
        metadata: { matches: 0, truncated: false },
        output: 'No se encontraron coincidencias',
      };
    }

    const outputLines = [`Se encontraron ${matches.length} coincidencias${truncated ? ` (mostrando primeras ${limit})` : ''}`];

    let currentFile = '';
    for (const match of finalMatches) {
      if (currentFile !== match.path) {
        if (currentFile !== '') {
          outputLines.push('');
        }
        currentFile = match.path;
        outputLines.push(`${match.path}:`);
      }

      const truncatedLineText =
        match.lineText.length > MAX_LINE_LENGTH
          ? match.lineText.substring(0, MAX_LINE_LENGTH) + '...'
          : match.lineText;
      outputLines.push(`  Línea ${match.lineNum}: ${truncatedLineText}`);
    }

    if (truncated) {
      outputLines.push('');
      outputLines.push(
        `(Resultados truncados: mostrando ${limit} de ${matches.length} coincidencias. Considera usar un path o patrón más específico.)`,
      );
    }

    return {
      title: params.pattern,
      metadata: {
        matches: matches.length,
        truncated,
      },
      output: outputLines.join('\n'),
    };
  },
});
