/**
 * StorageAdapter - Abstracción de almacenamiento
 *
 * Interfaz unificada para operaciones de almacenamiento
 * Permite cambiar entre disco local y S3 sin cambiar el código
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as fsSync from 'fs';

export interface StorageAdapter {
  /**
   * Lee un archivo
   */
  read(filePath: string): Promise<Buffer>;

  /**
   * Escribe un archivo
   */
  write(filePath: string, data: Buffer): Promise<void>;

  /**
   * Elimina un archivo
   */
  delete(filePath: string): Promise<void>;

  /**
   * Verifica si un archivo existe
   */
  exists(filePath: string): Promise<boolean>;

  /**
   * Lista archivos en un directorio
   */
  list(prefix: string): Promise<StorageFileInfo[]>;

  /**
   * Obtiene el tamaño de un archivo
   */
  getSize(filePath: string): Promise<number>;

  /**
   * Mueve un archivo
   */
  move(sourcePath: string, destPath: string): Promise<void>;

  /**
   * Copia un archivo
   */
  copy(sourcePath: string, destPath: string): Promise<void>;

  /**
   * Crea un directorio
   */
  mkdir(dirPath: string, recursive?: boolean): Promise<void>;

  /**
   * Elimina un directorio
   */
  rmdir(dirPath: string, recursive?: boolean): Promise<void>;

  /**
   * Obtiene la URL pública de un archivo (para S3)
   */
  getPublicUrl(filePath: string): string;
}

export interface StorageFileInfo {
  path: string;
  name: string;
  size: number;
  isDirectory: boolean;
  modifiedAt: Date;
}

/**
 * Implementación de almacenamiento en disco local
 */
export class DiskStorageAdapter implements StorageAdapter {
  constructor(private basePath: string) {
    // Asegurar que el directorio base existe
    if (!fsSync.existsSync(basePath)) {
      fsSync.mkdirSync(basePath, { recursive: true });
    }
  }

  /**
   * Obtiene la ruta completa del archivo
   */
  private getFullPath(filePath: string): string {
    // Normalizar el path para evitar directory traversal
    const normalizedPath = path.normalize(filePath).replace(/^\.+/, '');
    return path.join(this.basePath, normalizedPath);
  }

  async read(filePath: string): Promise<Buffer> {
    const fullPath = this.getFullPath(filePath);
    return await fs.readFile(fullPath);
  }

  async write(filePath: string, data: Buffer): Promise<void> {
    const fullPath = this.getFullPath(filePath);

    // Asegurar que el directorio existe
    const dir = path.dirname(fullPath);
    if (!fsSync.existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }

    await fs.writeFile(fullPath, data);
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = this.getFullPath(filePath);

    if (await this.exists(filePath)) {
      await fs.unlink(fullPath);
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const fullPath = this.getFullPath(filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string): Promise<StorageFileInfo[]> {
    const fullPath = this.getFullPath(prefix);

    if (!fsSync.existsSync(fullPath)) {
      return [];
    }

    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    const files: StorageFileInfo[] = [];

    for (const entry of entries) {
      const entryPath = path.join(fullPath, entry.name);
      const stats = await fs.stat(entryPath);

      files.push({
        path: path.join(prefix, entry.name),
        name: entry.name,
        size: stats.size,
        isDirectory: stats.isDirectory(),
        modifiedAt: stats.mtime,
      });
    }

    return files;
  }

  async getSize(filePath: string): Promise<number> {
    const fullPath = this.getFullPath(filePath);
    const stats = await fs.stat(fullPath);
    return stats.size;
  }

  async move(sourcePath: string, destPath: string): Promise<void> {
    const fullSourcePath = this.getFullPath(sourcePath);
    const fullDestPath = this.getFullPath(destPath);

    // Asegurar que el directorio destino existe
    const destDir = path.dirname(fullDestPath);
    if (!fsSync.existsSync(destDir)) {
      await fs.mkdir(destDir, { recursive: true });
    }

    await fs.rename(fullSourcePath, fullDestPath);
  }

  async copy(sourcePath: string, destPath: string): Promise<void> {
    const fullSourcePath = this.getFullPath(sourcePath);
    const fullDestPath = this.getFullPath(destPath);

    // Asegurar que el directorio destino existe
    const destDir = path.dirname(fullDestPath);
    if (!fsSync.existsSync(destDir)) {
      await fs.mkdir(destDir, { recursive: true });
    }

    await fs.copyFile(fullSourcePath, fullDestPath);
  }

  async mkdir(dirPath: string, recursive = true): Promise<void> {
    const fullPath = this.getFullPath(dirPath);
    await fs.mkdir(fullPath, { recursive });
  }

  async rmdir(dirPath: string, recursive = true): Promise<void> {
    const fullPath = this.getFullPath(dirPath);

    if (recursive) {
      await fs.rm(fullPath, { recursive: true, force: true });
    } else {
      await fs.rmdir(fullPath);
    }
  }

  getPublicUrl(filePath: string): string {
    // En disco local, no hay URL pública
    // Retornamos el path relativo para uso interno
    return `/storage/${filePath}`;
  }

  /**
   * Obtiene el tamaño total de un directorio
   */
  async getDirectorySize(dirPath: string): Promise<number> {
    const fullPath = this.getFullPath(dirPath);

    if (!fsSync.existsSync(fullPath)) {
      return 0;
    }

    let totalSize = 0;

    async function calculateSize(currentPath: string): Promise<void> {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          await calculateSize(entryPath);
        } else {
          const stats = await fs.stat(entryPath);
          totalSize += stats.size;
        }
      }
    }

    await calculateSize(fullPath);

    return totalSize;
  }

  /**
   * Cuenta archivos en un directorio recursivamente
   */
  async countFiles(dirPath: string): Promise<number> {
    const fullPath = this.getFullPath(dirPath);

    if (!fsSync.existsSync(fullPath)) {
      return 0;
    }

    let fileCount = 0;

    async function countRecursive(currentPath: string): Promise<void> {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          await countRecursive(entryPath);
        } else {
          fileCount++;
        }
      }
    }

    await countRecursive(fullPath);

    return fileCount;
  }
}

/**
 * Factory para crear el adaptador de almacenamiento apropiado
 */
export function createStorageAdapter(type: 'disk' | 's3' = 'disk', config?: any): StorageAdapter {
  switch (type) {
    case 'disk':
      return new DiskStorageAdapter(config?.basePath || process.cwd());

    case 's3':
      // TODO: Implementar S3StorageAdapter
      throw new Error('S3 storage adapter not implemented yet');

    default:
      throw new Error(`Unknown storage type: ${type}`);
  }
}

/**
 * Singleton instance del adaptador de disco
 */
export const diskStorageAdapter = new DiskStorageAdapter(
  process.env.WORKSPACE_PATH || path.join(process.cwd(), 'storage', 'tenants')
);
