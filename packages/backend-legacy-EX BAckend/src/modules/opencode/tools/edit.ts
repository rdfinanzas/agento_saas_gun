/**
 * EditTool - Edición de Archivos
 * Adaptado desde OpenCode para multi-tenant
 */

import z from 'zod';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Tool } from './tool';
import { createTwoFilesPatch, diffLines } from 'diff';

interface EditMetadata extends Tool.Metadata {
  filepath: string;
  created: boolean;
  diff?: string;
  filediff?: {
    file: string;
    before: string;
    after: string;
    additions: number;
    deletions: number;
  };
}

export const EditTool = Tool.define('edit', async () => {
  return {
    description: `Edita un archivo reemplazando texto específico.
- Úsalo cuando quieras hacer cambios parciales en un archivo existente.
- El oldString debe coincidir exactamente con el contenido actual del archivo.
- Si quieres reemplazar múltiples ocurrencias, usa replaceAll: true.
- Para crear un archivo nuevo, usa el tool 'write' en su lugar.`,
    parameters: z.object({
      filePath: z.string().describe('La ruta absoluta al archivo a modificar'),
      oldString: z.string().describe('El texto a reemplazar'),
      newString: z.string().describe('El texto de reemplazo (debe ser diferente de oldString)'),
      replaceAll: z.boolean().optional().describe('Reemplazar todas las ocurrencias (por defecto false)'),
    }),
    async execute(params: { filePath: string; oldString: string; newString: string; replaceAll?: boolean }, ctx: Tool.Context): Promise<Tool.ExecuteResult<EditMetadata>> {
      if (!params.filePath) {
        throw new Error('filePath es requerido');
      }

      if (params.oldString === params.newString) {
        throw new Error('No hay cambios: oldString y newString son idénticos.');
      }

      let filepath = params.filePath;
      if (!path.isAbsolute(filepath)) {
        filepath = path.resolve(ctx.workspacePath, filepath);
      }

      // Verificar que está dentro del workspace
      const normalizedPath = path.normalize(filepath);
      const normalizedWorkspace = path.normalize(ctx.workspacePath);
      if (!normalizedPath.startsWith(normalizedWorkspace)) {
        throw new Error(`No se puede editar fuera del workspace: ${filepath}`);
      }

      // Manejar caso especial: oldString vacío = crear archivo nuevo
      if (params.oldString === '') {
        await ctx.ask({
          permission: 'edit',
          patterns: [path.relative(ctx.workspacePath, filepath)],
          always: ['*'],
          metadata: {
            filepath,
            content: params.newString.substring(0, 500),
          },
        });

        await fs.mkdir(path.dirname(filepath), { recursive: true });
        await fs.writeFile(filepath, params.newString, 'utf-8');

        return {
          title: path.relative(ctx.workspacePath, filepath),
          output: 'Archivo creado exitosamente.',
          metadata: {
            filepath,
            created: true,
          },
        };
      }

      // Verificar que el archivo existe
      const stat = await fs.stat(filepath).catch(() => null);
      if (!stat) throw new Error(`Archivo no encontrado: ${filepath}`);
      if (stat.isDirectory()) throw new Error(`La ruta es un directorio, no un archivo: ${filepath}`);

      // Leer contenido actual
      const contentOld = await fs.readFile(filepath, 'utf-8');
      const contentNew = replace(contentOld, params.oldString, params.newString, params.replaceAll);

      // Crear diff
      const diff = trimDiff(
        createTwoFilesPatch(filepath, filepath, normalizeLineEndings(contentOld), normalizeLineEndings(contentNew)),
      );

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

      // Escribir archivo
      await fs.writeFile(filepath, contentNew, 'utf-8');

      // Calcular estadísticas del diff
      const filediff = {
        file: filepath,
        before: contentOld,
        after: contentNew,
        additions: 0,
        deletions: 0,
      };

      for (const change of diffLines(contentOld, contentNew)) {
        if (change.added) filediff.additions += change.count || 0;
        if (change.removed) filediff.deletions += change.count || 0;
      }

      return {
        title: path.relative(ctx.workspacePath, filepath),
        output: 'Edición aplicada exitosamente.',
        metadata: {
          filepath,
          created: false,
          diff,
          filediff,
        },
      };
    },
  };
});

/**
 * Normaliza los finales de línea
 */
function normalizeLineEndings(text: string): string {
  return text.replaceAll('\r\n', '\n');
}

/**
 * Recorta el diff
 */
export function trimDiff(diff: string): string {
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

/**
 * Reemplaza texto en el contenido usando múltiples estrategias
 */
function replace(content: string, oldString: string, newString: string, replaceAll = false): string {
  if (oldString === newString) {
    throw new Error('No hay cambios: oldString y newString son idénticos.');
  }

  let notFound = true;

  // Estrategias de reemplazo
  const replacers = [
    simpleReplacer,
    lineTrimmedReplacer,
    blockAnchorReplacer,
    whitespaceNormalizedReplacer,
    indentationFlexibleReplacer,
    trimmedBoundaryReplacer,
    multiOccurrenceReplacer,
  ];

  for (const replacer of replacers) {
    for (const search of replacer(content, oldString)) {
      const index = content.indexOf(search);
      if (index === -1) continue;
      notFound = false;

      if (replaceAll) {
        return content.replaceAll(search, newString);
      }

      const lastIndex = content.lastIndexOf(search);
      if (index !== lastIndex) continue;

      return content.substring(0, index) + newString + content.substring(index + search.length);
    }
  }

  if (notFound) {
    throw new Error(
      'No se pudo encontrar oldString en el archivo. Debe coincidir exactamente, incluyendo espacios en blanco, indentación y finales de línea.',
    );
  }

  throw new Error('Se encontraron múltiples coincidencias para oldString. Proporciona más contexto para hacer la coincidencia única.');
}

// Reemplazadores

function* simpleReplacer(_content: string, find: string): Generator<string> {
  yield find;
}

function* lineTrimmedReplacer(content: string, find: string): Generator<string> {
  const originalLines = content.split('\n');
  const searchLines = find.split('\n');

  if (searchLines[searchLines.length - 1] === '') {
    searchLines.pop();
  }

  for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
    let matches = true;

    for (let j = 0; j < searchLines.length; j++) {
      const originalTrimmed = originalLines[i + j].trim();
      const searchTrimmed = searchLines[j].trim();

      if (originalTrimmed !== searchTrimmed) {
        matches = false;
        break;
      }
    }

    if (matches) {
      let matchStartIndex = 0;
      for (let k = 0; k < i; k++) {
        matchStartIndex += originalLines[k].length + 1;
      }

      let matchEndIndex = matchStartIndex;
      for (let k = 0; k < searchLines.length; k++) {
        matchEndIndex += originalLines[i + k].length;
        if (k < searchLines.length - 1) {
          matchEndIndex += 1;
        }
      }

      yield content.substring(matchStartIndex, matchEndIndex);
    }
  }
}

function* blockAnchorReplacer(content: string, find: string): Generator<string> {
  const originalLines = content.split('\n');
  const searchLines = find.split('\n');

  if (searchLines.length < 3) return;
  if (searchLines[searchLines.length - 1] === '') searchLines.pop();

  const firstLineSearch = searchLines[0].trim();
  const lastLineSearch = searchLines[searchLines.length - 1].trim();

  for (let i = 0; i < originalLines.length; i++) {
    if (originalLines[i].trim() !== firstLineSearch) continue;

    for (let j = i + 2; j < originalLines.length; j++) {
      if (originalLines[j].trim() === lastLineSearch) {
        let matchStartIndex = 0;
        for (let k = 0; k < i; k++) {
          matchStartIndex += originalLines[k].length + 1;
        }
        let matchEndIndex = matchStartIndex;
        for (let k = i; k <= j; k++) {
          matchEndIndex += originalLines[k].length;
          if (k < j) matchEndIndex += 1;
        }
        yield content.substring(matchStartIndex, matchEndIndex);
        break;
      }
    }
  }
}

function* whitespaceNormalizedReplacer(content: string, find: string): Generator<string> {
  const normalizeWhitespace = (text: string) => text.replace(/\s+/g, ' ').trim();
  const normalizedFind = normalizeWhitespace(find);

  const lines = content.split('\n');
  for (const line of lines) {
    if (normalizeWhitespace(line) === normalizedFind) {
      yield line;
    }
  }

  const findLines = find.split('\n');
  if (findLines.length > 1) {
    for (let i = 0; i <= lines.length - findLines.length; i++) {
      const block = lines.slice(i, i + findLines.length);
      if (normalizeWhitespace(block.join('\n')) === normalizedFind) {
        yield block.join('\n');
      }
    }
  }
}

function* indentationFlexibleReplacer(content: string, find: string): Generator<string> {
  const removeIndentation = (text: string) => {
    const lines = text.split('\n');
    const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
    if (nonEmptyLines.length === 0) return text;

    const minIndent = Math.min(
      ...nonEmptyLines.map((line) => {
        const match = line.match(/^(\s*)/);
        return match ? match[1].length : 0;
      }),
    );

    return lines.map((line) => (line.trim().length === 0 ? line : line.slice(minIndent))).join('\n');
  };

  const normalizedFind = removeIndentation(find);
  const contentLines = content.split('\n');
  const findLines = find.split('\n');

  for (let i = 0; i <= contentLines.length - findLines.length; i++) {
    const block = contentLines.slice(i, i + findLines.length).join('\n');
    if (removeIndentation(block) === normalizedFind) {
      yield block;
    }
  }
}

function* trimmedBoundaryReplacer(content: string, find: string): Generator<string> {
  const trimmedFind = find.trim();
  if (trimmedFind === find) return;

  if (content.includes(trimmedFind)) {
    yield trimmedFind;
  }

  const lines = content.split('\n');
  const findLines = find.split('\n');

  for (let i = 0; i <= lines.length - findLines.length; i++) {
    const block = lines.slice(i, i + findLines.length).join('\n');
    if (block.trim() === trimmedFind) {
      yield block;
    }
  }
}

function* multiOccurrenceReplacer(content: string, find: string): Generator<string> {
  let startIndex = 0;

  while (true) {
    const index = content.indexOf(find, startIndex);
    if (index === -1) break;

    yield find;
    startIndex = index + find.length;
  }
}
