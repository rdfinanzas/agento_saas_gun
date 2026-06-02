/**
 * Workspace Controller - Gestión del Workspace por tenant
 */

import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const WORKSPACE_BASE = process.env.WORKSPACE_PATH || path.join(process.cwd(), 'storage', 'tenants');

export class WorkspaceController {
  private getTenantPath(tenantId: string): string {
    return path.join(WORKSPACE_BASE, tenantId);
  }

  /**
   * Obtiene la estructura del workspace
   */
  async getStructure(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const tenantPath = this.getTenantPath(tenantId);

      if (!fs.existsSync(tenantPath)) {
        fs.mkdirSync(tenantPath, { recursive: true });
      }

      const structure = this.buildTree(tenantPath, tenantPath);

      res.json({
        tenantId,
        path: tenantPath,
        structure,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Lee el contenido de un archivo
   */
  async readFile(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { filePath } = req.params;

      const tenantPath = this.getTenantPath(tenantId);
      const fullPath = path.join(tenantPath, filePath);

      if (!this.isPathSafe(tenantPath, fullPath)) {
        res.status(403).json({ error: 'Path no permitido' });
        return;
      }

      if (!fs.existsSync(fullPath)) {
        res.status(404).json({ error: 'Archivo no encontrado' });
        return;
      }

      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        res.status(400).json({ error: 'Es un directorio' });
        return;
      }

      const content = fs.readFileSync(fullPath, 'utf-8');

      res.json({
        filePath,
        content,
        size: stats.size,
        modifiedAt: stats.mtime,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Crea o actualiza un archivo
   */
  async writeFile(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { filePath, content } = req.body;

      if (!filePath || content === undefined) {
        res.status(400).json({ error: 'filePath y content son requeridos' });
        return;
      }

      const tenantPath = this.getTenantPath(tenantId);
      const fullPath = path.join(tenantPath, filePath);

      if (!this.isPathSafe(tenantPath, fullPath)) {
        res.status(403).json({ error: 'Path no permitido' });
        return;
      }

      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, content, 'utf-8');

      res.json({
        success: true,
        filePath,
        path: fullPath,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Crea un directorio
   */
  async createDirectory(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { dirPath } = req.body;

      if (!dirPath) {
        res.status(400).json({ error: 'dirPath es requerido' });
        return;
      }

      const tenantPath = this.getTenantPath(tenantId);
      const fullPath = path.join(tenantPath, dirPath);

      if (!this.isPathSafe(tenantPath, fullPath)) {
        res.status(403).json({ error: 'Path no permitido' });
        return;
      }

      if (fs.existsSync(fullPath)) {
        res.status(400).json({ error: 'El directorio ya existe' });
        return;
      }

      fs.mkdirSync(fullPath, { recursive: true });

      res.json({
        success: true,
        dirPath,
        path: fullPath,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Elimina un archivo o directorio
   */
  async deleteItem(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { itemPath } = req.params;

      const tenantPath = this.getTenantPath(tenantId);
      const fullPath = path.join(tenantPath, itemPath);

      if (!this.isPathSafe(tenantPath, fullPath)) {
        res.status(403).json({ error: 'Path no permitido' });
        return;
      }

      if (!fs.existsSync(fullPath)) {
        res.status(404).json({ error: 'Archivo/directorio no encontrado' });
        return;
      }

      if (fs.statSync(fullPath).isDirectory()) {
        fs.rmSync(fullPath, { recursive: true });
      } else {
        fs.unlinkSync(fullPath);
      }

      res.json({
        success: true,
        itemPath,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Lista archivos con filtros
   */
  async listFiles(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { dirPath = '', extension, search } = req.query;

      const tenantPath = this.getTenantPath(tenantId);
      const fullPath = path.join(tenantPath, dirPath as string);

      if (!this.isPathSafe(tenantPath, fullPath)) {
        res.status(403).json({ error: 'Path no permitido' });
        return;
      }

      if (!fs.existsSync(fullPath)) {
        res.status(404).json({ error: 'Directorio no encontrado' });
        return;
      }

      const files = this.listDirectory(fullPath, extension as string, search as string);

      res.json({
        dirPath,
        files,
        count: files.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Busca archivos por contenido
   */
  async searchContent(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { query, fileTypes = '*' } = req.body;

      if (!query) {
        res.status(400).json({ error: 'query es requerido' });
        return;
      }

      const tenantPath = this.getTenantPath(tenantId);
      const results = this.searchInFiles(tenantPath, query, fileTypes);

      res.json({
        query,
        results,
        count: results.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Sube un archivo
   */
  async uploadFile(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;

      if (!req.file) {
        res.status(400).json({ error: 'No se recibió archivo' });
        return;
      }

      const tenantPath = this.getTenantPath(tenantId);
      const destPath = path.join(tenantPath, 'uploads');

      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }

      const finalPath = path.join(destPath, req.file.originalname);
      fs.copyFileSync(req.file.path, finalPath);
      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        filePath: `uploads/${req.file.originalname}`,
        path: finalPath,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  private buildTree(dirPath: string, basePath: string): any[] {
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    const items = fs.readdirSync(dirPath);
    const tree: any[] = [];

    for (const item of items) {
      if (item.startsWith('.')) continue;

      const fullPath = path.join(dirPath, item);
      const stats = fs.statSync(fullPath);

      tree.push({
        name: item,
        type: stats.isDirectory() ? 'directory' : 'file',
        path: path.relative(basePath, fullPath),
        size: stats.isFile() ? stats.size : undefined,
        modifiedAt: stats.mtime,
        children: stats.isDirectory() ? this.buildTree(fullPath, basePath) : undefined,
      });
    }

    return tree.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  private isPathSafe(basePath: string, targetPath: string): boolean {
    const normalizedBase = path.normalize(basePath);
    const normalizedTarget = path.normalize(targetPath);
    return normalizedTarget.startsWith(normalizedBase);
  }

  private listDirectory(dirPath: string, extension?: string, search?: string): any[] {
    const files: any[] = [];
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      if (item.startsWith('.')) continue;

      const fullPath = path.join(dirPath, item);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        files.push(...this.listDirectory(fullPath, extension, search));
      } else {
        if (extension && !item.endsWith(extension)) continue;
        if (search && !item.toLowerCase().includes(search.toLowerCase())) continue;

        files.push({
          name: item,
          path: path.relative(dirPath, fullPath),
          size: stats.size,
          modifiedAt: stats.mtime,
        });
      }
    }

    return files;
  }

  private searchInFiles(dirPath: string, query: string, fileTypes: string): any[] {
    const results: any[] = [];
    const types = fileTypes === '*' ? ['*'] : fileTypes.split(',').map(t => t.trim());
    const queryLower = query.toLowerCase();

    const search = (dir: string) => {
      if (!fs.existsSync(dir)) return;

      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (item.startsWith('.')) continue;

        const fullPath = path.join(dir, item);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          search(fullPath);
        } else {
          const ext = path.extname(item).slice(1);
          if (types.includes('*') || types.includes(ext)) {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              if (content.toLowerCase().includes(queryLower)) {
                const lines = content.split('\n');
                const matchLines = lines.filter(l => l.toLowerCase().includes(queryLower));
                results.push({
                  file: item,
                  path: path.relative(dirPath, fullPath),
                  matches: matchLines.length,
                  preview: matchLines[0]?.substring(0, 100),
                });
              }
            } catch {
              // Skip binary files
            }
          }
        }
      }
    };

    search(dirPath);
    return results;
  }
}

export const workspaceController = new WorkspaceController();
