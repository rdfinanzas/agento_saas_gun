/**
 * ReadTool - Lectura de Archivos y Directorios
 * Adaptado desde OpenCode para multi-tenant
 */

import z from 'zod';
import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createInterface } from 'readline';
import { Tool } from './tool';

const DEFAULT_READ_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;
const MAX_LINE_SUFFIX = `... (línea truncada a ${MAX_LINE_LENGTH} caracteres)`;
const MAX_BYTES = 50 * 1024;
const MAX_BYTES_LABEL = `${MAX_BYTES / 1024} KB`;

export const ReadTool = Tool.define('read', {
  description: `Lee un archivo del sistema de archivos local.
- Puedes acceder a archivos directamente usando este tool.
- Normalmente usarás este tool para leer archivos que el usuario ha subido o creado.
- Este tool puede leer archivos de texto (código, configuración, etc.) pero no archivos binarios (imágenes, videos, etc.).
- También puedes leer directorios listando sus contenidos.
- Puedes especificar opcionalmente los parámetros offset y limit para leer contenido parcialmente.`,
  parameters: z.object({
    filePath: z.string().describe('La ruta absoluta al archivo o directorio a leer'),
    offset: z.coerce.number().describe('El número de línea desde donde empezar a leer (comienza en 1)').optional(),
    limit: z.coerce.number().describe('El número máximo de líneas a leer (por defecto 2000)').optional(),
  }),
  async execute(params, ctx) {
    if (params.offset !== undefined && params.offset < 1) {
      throw new Error('El offset debe ser mayor o igual a 1');
    }

    let filepath = params.filePath;
    if (!path.isAbsolute(filepath)) {
      filepath = path.resolve(ctx.workspacePath, filepath);
    }

    const title = path.relative(ctx.workspacePath, filepath);

    // Verificar permisos
    await ctx.ask({
      permission: 'read',
      patterns: [filepath],
      always: ['*'],
      metadata: {},
    });

    // Verificar si existe
    const stat = await fs.stat(filepath).catch(() => null);

    if (!stat) {
      const dir = path.dirname(filepath);
      const base = path.basename(filepath);

      const suggestions = await fs
        .readdir(dir)
        .then((entries) =>
          entries
            .filter(
              (entry) =>
                entry.toLowerCase().includes(base.toLowerCase()) || base.toLowerCase().includes(entry.toLowerCase()),
            )
            .map((entry) => path.join(dir, entry))
            .slice(0, 3),
        )
        .catch(() => []);

      if (suggestions.length > 0) {
        throw new Error(`Archivo no encontrado: ${filepath}\n\n¿Quizás quisiste decir uno de estos?\n${suggestions.join('\n')}`);
      }

      throw new Error(`Archivo no encontrado: ${filepath}`);
    }

    // Si es un directorio
    if (stat.isDirectory()) {
      const dirents = await fs.readdir(filepath, { withFileTypes: true });
      const entries = await Promise.all(
        dirents.map(async (dirent) => {
          if (dirent.isDirectory()) return dirent.name + '/';
          if (dirent.isSymbolicLink()) {
            const target = await fs.stat(path.join(filepath, dirent.name)).catch(() => undefined);
            if (target?.isDirectory()) return dirent.name + '/';
          }
          return dirent.name;
        }),
      );
      entries.sort((a, b) => a.localeCompare(b));

      const limit = params.limit ?? DEFAULT_READ_LIMIT;
      const offset = params.offset ?? 1;
      const start = offset - 1;
      const sliced = entries.slice(start, start + limit);
      const truncated = start + sliced.length < entries.length;

      const output = [
        `<path>${filepath}</path>`,
        `<type>directory</type>`,
        `<entries>`,
        sliced.join('\n'),
        truncated
          ? `\n(Mostrando ${sliced.length} de ${entries.length} entradas. Usa el parámetro 'offset' para leer más allá de la entrada ${offset + sliced.length})`
          : `\n(${entries.length} entradas)`,
        `</entries>`,
      ].join('\n');

      return {
        title,
        output,
        metadata: {
          preview: sliced.slice(0, 20).join('\n'),
          truncated,
          totalLines: undefined as number | undefined,
        },
      };
    }

    // Verificar si es binario
    const isBinary = await isBinaryFile(filepath, Number(stat.size));
    if (isBinary) throw new Error(`No se puede leer archivo binario: ${filepath}`);

    // Leer archivo de texto
    const stream = createReadStream(filepath, { encoding: 'utf8' });
    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    const limit = params.limit ?? DEFAULT_READ_LIMIT;
    const offset = params.offset ?? 1;
    const start = offset - 1;
    const raw: string[] = [];
    let bytes = 0;
    let lines = 0;
    let truncatedByBytes = false;
    let hasMoreLines = false;

    try {
      for await (const text of rl) {
        lines += 1;
        if (lines <= start) continue;

        if (raw.length >= limit) {
          hasMoreLines = true;
          continue;
        }

        const line = text.length > MAX_LINE_LENGTH ? text.substring(0, MAX_LINE_LENGTH) + MAX_LINE_SUFFIX : text;
        const size = Buffer.byteLength(line, 'utf-8') + (raw.length > 0 ? 1 : 0);
        if (bytes + size > MAX_BYTES) {
          truncatedByBytes = true;
          hasMoreLines = true;
          break;
        }

        raw.push(line);
        bytes += size;
      }
    } finally {
      rl.close();
      stream.destroy();
    }

    if (lines < offset && !(lines === 0 && offset === 1)) {
      throw new Error(`El offset ${offset} está fuera de rango para este archivo (${lines} líneas)`);
    }

    const content = raw.map((line, index) => {
      return `${index + offset}: ${line}`;
    });
    const preview = raw.slice(0, 20).join('\n');

    let output = [`<path>${filepath}</path>`, `<type>file</type>`, '<content>'].join('\n');
    output += content.join('\n');

    const totalLines = lines;
    const lastReadLine = offset + raw.length - 1;
    const nextOffset = lastReadLine + 1;
    const truncated = hasMoreLines || truncatedByBytes;

    if (truncatedByBytes) {
      output += `\n\n(Salida limitada a ${MAX_BYTES_LABEL}. Mostrando líneas ${offset}-${lastReadLine}. Usa offset=${nextOffset} para continuar.)`;
    } else if (hasMoreLines) {
      output += `\n\n(Mostrando líneas ${offset}-${lastReadLine} de ${totalLines}. Usa offset=${nextOffset} para continuar.)`;
    } else {
      output += `\n\n(Fin del archivo - total ${totalLines} líneas)`;
    }
    output += '\n</content>';

    return {
      title,
      output,
      metadata: {
        preview,
        truncated,
        totalLines,
      },
    };
  },
});

/**
 * Verifica si un archivo es binario
 */
async function isBinaryFile(filepath: string, fileSize: number): Promise<boolean> {
  const ext = path.extname(filepath).toLowerCase();

  // Extensiones conocidas como binarias
  const binaryExtensions = [
    '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.class', '.jar',
    '.war', '.7z', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.odt', '.ods', '.odp', '.bin', '.dat', '.obj', '.o', '.a',
    '.lib', '.wasm', '.pyc', '.pyo', '.png', '.jpg', '.jpeg', '.gif',
    '.bmp', '.ico', '.pdf', '.mp3', '.mp4', '.avi', '.mov', '.wmv',
  ];

  if (binaryExtensions.includes(ext)) {
    return true;
  }

  if (fileSize === 0) return false;

  const fh = await fs.open(filepath, 'r');
  try {
    const sampleSize = Math.min(4096, fileSize);
    const bytes = Buffer.alloc(sampleSize);
    const result = await fh.read(bytes, 0, sampleSize, 0);
    if (result.bytesRead === 0) return false;

    let nonPrintableCount = 0;
    for (let i = 0; i < result.bytesRead; i++) {
      if (bytes[i] === 0) return true;
      if (bytes[i] < 9 || (bytes[i] > 13 && bytes[i] < 32)) {
        nonPrintableCount++;
      }
    }

    // Si >30% caracteres no imprimibles, es binario
    return nonPrintableCount / result.bytesRead > 0.3;
  } finally {
    await fh.close();
  }
}
