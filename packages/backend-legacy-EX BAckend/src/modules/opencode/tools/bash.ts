/**
 * BashTool - Ejecución de Comandos Shell
 * Adaptado desde OpenCode para multi-tenant
 */

import z from 'zod';
import { spawn } from 'child_process';
import * as path from 'path';
import { Tool } from './tool';

const DEFAULT_TIMEOUT = 2 * 60 * 1000; // 2 minutos
const MAX_METADATA_LENGTH = 30_000;

export const BashTool = Tool.define('bash', {
  description: `Ejecuta un comando de shell bash en un directorio de trabajo especificado con un tiempo de espera opcional.

Instrucciones de uso:
- Puedes usar cualquier comando de bash que desees.
- SIEMPRE proporciona una descripción clara de lo que hace el comando.
- Si el comando tarda más de 120 segundos, se detendrá automáticamente.
- Los comandos se ejecutan de forma asíncrona.
- Si un comando crea un archivo o directorio fuera del directorio de trabajo, se pedirá confirmación.

Argumentos:
- command: El comando de bash a ejecutar
- description: Una descripción clara de 5-10 palabras de lo que hace el comando
- timeout: Tiempo de espera opcional en milisegundos (por defecto 120000)
- workdir: Directorio de trabajo opcional (por defecto usa el workspace del tenant)`,
  parameters: z.object({
    command: z.string().describe('El comando a ejecutar'),
    timeout: z.number().describe('Tiempo de espera opcional en milisegundos').optional(),
    workdir: z.string().describe('Directorio de trabajo opcional').optional(),
    description: z.string().describe('Descripción clara de 5-10 palabras de lo que hace el comando'),
  }),
  async execute(params, ctx) {
    const cwd = params.workdir || ctx.workspacePath;

    if (params.timeout !== undefined && params.timeout < 0) {
      throw new Error(`Valor de timeout inválido: ${params.timeout}. Debe ser un número positivo.`);
    }

    const timeout = params.timeout ?? DEFAULT_TIMEOUT;

    // Verificar permisos (en un sistema real, esto iría al sistema de permisos)
    await ctx.ask({
      permission: 'bash',
      patterns: [params.command],
      always: ['*'],
      metadata: { command: params.command, cwd },
    });

    // Determinar el shell a usar
    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';

    const proc = spawn(params.command, {
      shell,
      cwd,
      env: {
        ...process.env,
        // Agregar variables de entorno del tenant si es necesario
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });

    let output = '';

    // Inicializar metadata con output vacío
    ctx.metadata({
      metadata: {
        output: '',
        description: params.description,
      },
    });

    const append = (chunk: Buffer) => {
      output += chunk.toString();
      ctx.metadata({
        metadata: {
          output: output.length > MAX_METADATA_LENGTH ? output.slice(0, MAX_METADATA_LENGTH) + '\n\n...' : output,
          description: params.description,
        },
      });
    };

    proc.stdout?.on('data', append);
    proc.stderr?.on('data', append);

    let timedOut = false;
    let aborted = false;
    let exited = false;

    const kill = () => {
      if (!exited) {
        try {
          if (process.platform !== 'win32') {
            process.kill(-proc.pid!);
          } else {
            proc.kill();
          }
        } catch (e) {
          // El proceso ya puede haber terminado
        }
      }
    };

    if (ctx.abort.aborted) {
      aborted = true;
      await kill();
    }

    const abortHandler = () => {
      aborted = true;
      void kill();
    };

    ctx.abort.addEventListener('abort', abortHandler, { once: true });

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      void kill();
    }, timeout + 100);

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeoutTimer);
        ctx.abort.removeEventListener('abort', abortHandler);
      };

      proc.once('exit', () => {
        exited = true;
        cleanup();
        resolve();
      });

      proc.once('error', (error) => {
        exited = true;
        cleanup();
        reject(error);
      });
    });

    const resultMetadata: string[] = [];

    if (timedOut) {
      resultMetadata.push(`El comando fue terminado después de exceder el timeout de ${timeout} ms`);
    }

    if (aborted) {
      resultMetadata.push('El usuario abortó el comando');
    }

    if (resultMetadata.length > 0) {
      output += '\n\n<bash_metadata>\n' + resultMetadata.join('\n') + '\n</bash_metadata>';
    }

    return {
      title: params.description,
      metadata: {
        output: output.length > MAX_METADATA_LENGTH ? output.slice(0, MAX_METADATA_LENGTH) + '\n\n...' : output,
        exit: proc.exitCode,
        description: params.description,
      },
      output,
    };
  },
});
