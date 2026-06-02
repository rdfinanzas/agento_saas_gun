/**
 * WorkspaceManager - Gestión de workspaces aislados por tenant
 */

import * as fs from 'fs';
import * as path from 'path';

export class WorkspaceManager {
  private baseStoragePath: string;

  constructor(baseStoragePath?: string) {
    this.baseStoragePath = baseStoragePath || process.env.AGENTO_STORAGE_PATH || '/storage/tenants';
  }

  /**
   * Obtiene el path del workspace para un tenant
   */
  getWorkspacePath(tenantId: string): string {
    return path.join(this.baseStoragePath, tenantId, 'workspace');
  }

  /**
   * Verifica si el workspace existe
   */
  workspaceExists(tenantId: string): boolean {
    return fs.existsSync(this.getWorkspacePath(tenantId));
  }

  /**
   * Crea el workspace si no existe
   */
  ensureWorkspace(tenantId: string): string {
    const workspacePath = this.getWorkspacePath(tenantId);

    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true });

      // Crear package.json
      fs.writeFileSync(
        path.join(workspacePath, 'package.json'),
        JSON.stringify({ name: `tenant-${tenantId}-workspace`, private: true }, null, 2)
      );
    }

    return workspacePath;
  }

  /**
   * Limpia el workspace de un tenant
   */
  async cleanWorkspace(tenantId: string): Promise<void> {
    const workspacePath = this.getWorkspacePath(tenantId);
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  }

  /**
   * Lista archivos en el workspace
   */
  listFiles(tenantId: string, subdir?: string): string[] {
    const basePath = subdir
      ? path.join(this.getWorkspacePath(tenantId), subdir)
      : this.getWorkspacePath(tenantId);

    if (!fs.existsSync(basePath)) {
      return [];
    }

    return fs.readdirSync(basePath);
  }

  /**
   * Obtiene la ruta del archivo de configuración de OpenCode
   */
  getOpenCodeConfigPath(tenantId: string): string {
    return path.join(this.baseStoragePath, tenantId, 'opencode', 'opencode.json');
  }

  /**
   * Asegura que existe el directorio de configuración de OpenCode
   */
  ensureOpenCodeConfigDir(tenantId: string): string {
    const configDir = path.dirname(this.getOpenCodeConfigPath(tenantId));
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    return configDir;
  }
}

export const workspaceManager = new WorkspaceManager();
