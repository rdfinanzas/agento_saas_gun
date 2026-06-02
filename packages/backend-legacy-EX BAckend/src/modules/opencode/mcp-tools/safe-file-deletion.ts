/**
 * SafeFileDeletionTool - Eliminación segura de archivos
 * Adaptado desde Accomplish Agent-Core para multi-tenant
 */

import z from 'zod';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Tool } from '../tools/tool';

interface SafeFileDeletionMetadata extends Tool.Metadata {
  targetPath: string;
  deletedFiles: string[];
  deletedDirs: string[];
  skippedFiles: string[];
  trashPath?: string;
}

// Archivos y directorios protegidos que nunca se deben eliminar
const PROTECTED_PATHS = [
  '.git',
  '.env',
  '.env.local',
  '.env.production',
  'node_modules',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  '.gitignore',
];

const PROTECTED_EXTENSIONS = [
  '.env',
  '.key',
  '.pem',
  '.p12',
  '.pfx',
];

export const SafeFileDeletionTool = Tool.define('safe_file_deletion', async () => {
  return {
    description: `Elimina archivos de forma segura moviéndolos a una papelera temporal en lugar de eliminarlos permanentemente.
- NUNCA elimina archivos protegidos (.env, .git, package.json, etc.)
- Mueve los archivos a .trash/{timestamp}/ para posible recuperación
- Valida que el archivo esté dentro del workspace`,
    parameters: z.object({
      targetPath: z.string().describe('Ruta al archivo o directorio a eliminar'),
      dryRun: z.boolean().optional().describe('Solo mostrar qué se eliminaría sin eliminar realmente (default: false)'),
      reason: z.string().optional().describe('Razón de la eliminación para el log'),
    }),
    async execute(
      params: {
        targetPath: string;
        dryRun?: boolean;
        reason?: string;
      },
      ctx: Tool.Context
    ): Promise<Tool.ExecuteResult<SafeFileDeletionMetadata>> {
      const { targetPath, dryRun = false, reason } = params;

      // Resolver ruta absoluta
      let resolvedPath = targetPath;
      if (!path.isAbsolute(resolvedPath)) {
        resolvedPath = path.resolve(ctx.workspacePath, resolvedPath);
      }

      // Verificar que está dentro del workspace
      const normalizedPath = path.normalize(resolvedPath);
      const normalizedWorkspace = path.normalize(ctx.workspacePath);
      if (!normalizedPath.startsWith(normalizedWorkspace)) {
        throw new Error(`No se puede eliminar fuera del workspace: ${targetPath}`);
      }

      // Verificar que existe
      const stat = await fs.stat(resolvedPath).catch(() => null);
      if (!stat) {
        throw new Error(`Archivo o directorio no encontrado: ${targetPath}`);
      }

      // Verificar protección
      const relativePath = path.relative(ctx.workspacePath, resolvedPath);
      const pathParts = relativePath.split(path.sep);
      const fileName = path.basename(resolvedPath);
      const ext = path.extname(fileName).toLowerCase();

      // Verificar si algún componente de la ruta está protegido
      for (const part of pathParts) {
        if (PROTECTED_PATHS.includes(part)) {
          throw new Error(`No se puede eliminar: "${part}" es un archivo/directorio protegido`);
        }
      }

      // Verificar extensión protegida
      if (PROTECTED_EXTENSIONS.includes(ext)) {
        throw new Error(`No se puede eliminar: los archivos ${ext} están protegidos`);
      }

      // Crear directorio de papelera
      const trashBase = path.join(ctx.workspacePath, '.trash');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const trashPath = path.join(trashBase, timestamp);

      const deletedFiles: string[] = [];
      const deletedDirs: string[] = [];
      const skippedFiles: string[] = [];

      // Función para mover a papelera
      const moveToTrash = async (filePath: string): Promise<void> => {
        const relative = path.relative(ctx.workspacePath, filePath);
        const trashTarget = path.join(trashPath, relative);

        if (dryRun) {
          return;
        }

        await fs.mkdir(path.dirname(trashTarget), { recursive: true });
        await fs.rename(filePath, trashTarget);
      };

      // Función para procesar recursivamente
      const processPath = async (filePath: string): Promise<void> => {
        const fileStat = await fs.stat(filePath);
        const name = path.basename(filePath);
        const fileExt = path.extname(name).toLowerCase();

        // Verificar protección individual
        if (PROTECTED_PATHS.includes(name) || PROTECTED_EXTENSIONS.includes(fileExt)) {
          skippedFiles.push(filePath);
          return;
        }

        if (fileStat.isDirectory()) {
          const entries = await fs.readdir(filePath, { withFileTypes: true });
          for (const entry of entries) {
            await processPath(path.join(filePath, entry.name));
          }
          // Eliminar directorio si está vacío después de procesar
          const remaining = await fs.readdir(filePath).catch(() => []);
          if (remaining.length === 0) {
            await moveToTrash(filePath);
            deletedDirs.push(filePath);
          } else {
            skippedFiles.push(filePath);
          }
        } else {
          await moveToTrash(filePath);
          deletedFiles.push(filePath);
        }
      };

      // Log
      console.log(`[safe-file-deletion] Target: ${targetPath}`);
      console.log(`[safe-file-deletion] Resolved: ${resolvedPath}`);
      console.log(`[safe-file-deletion] Dry run: ${dryRun}`);
      if (reason) console.log(`[safe-file-deletion] Reason: ${reason}`);

      // Ejecutar
      await processPath(resolvedPath);

      // Construir respuesta
      let output = '';

      if (dryRun) {
        output = '**Simulación de eliminación**\n\n';
      } else {
        output = '**Eliminación completada**\n\n';
      }

      if (deletedFiles.length > 0) {
        output += `Archivos movidos a papelera (${deletedFiles.length}):\n`;
        deletedFiles.forEach(f => {
          output += `  - ${path.relative(ctx.workspacePath, f)}\n`;
        });
        output += '\n';
      }

      if (deletedDirs.length > 0) {
        output += `Directorios eliminados (${deletedDirs.length}):\n`;
        deletedDirs.forEach(d => {
          output += `  - ${path.relative(ctx.workspacePath, d)}\n`;
        });
        output += '\n';
      }

      if (skippedFiles.length > 0) {
        output += `Archivos omitidos (protegidos) (${skippedFiles.length}):\n`;
        skippedFiles.forEach(f => {
          output += `  - ${path.relative(ctx.workspacePath, f)}\n`;
        });
      }

      if (!dryRun && (deletedFiles.length > 0 || deletedDirs.length > 0)) {
        output += `\n*Carpeta de papelera: .trash/${timestamp}*`;
      }

      return {
        title: dryRun ? 'Dry Run: File Deletion' : 'Safe File Deletion',
        output,
        metadata: {
          targetPath: resolvedPath,
          deletedFiles,
          deletedDirs,
          skippedFiles,
          trashPath: dryRun ? undefined : trashPath,
        },
      };
    },
  };
});
