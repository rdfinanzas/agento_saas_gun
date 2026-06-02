/**
 * Controller para gestión de Skills
 */

import { Request, Response } from 'express';
import { getSkillsManager } from '../internal/classes/SkillsManager';

export class SkillsController {
  /**
   * Obtiene todos los skills
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const manager = getSkillsManager();

      const skills = manager.getAllSkills(tenantId);

      res.json(skills);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene skills habilitados
   */
  async getEnabled(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const manager = getSkillsManager();

      const skills = manager.getEnabledSkills(tenantId);

      res.json(skills);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene un skill por ID
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { skillId } = req.params;
      const manager = getSkillsManager();

      const skill = manager.getSkillById(tenantId, skillId);

      if (!skill) {
        res.status(404).json({ error: 'Skill no encontrado' });
        return;
      }

      res.json(skill);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene el contenido de un skill
   */
  async getContent(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { skillId } = req.params;
      const manager = getSkillsManager();

      const content = manager.getSkillContent(tenantId, skillId);

      if (!content) {
        res.status(404).json({ error: 'Skill no encontrado' });
        return;
      }

      res.json({ content });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Crea un nuevo skill
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { name, description, content, command } = req.body;

      if (!name || !description || !content) {
        res.status(400).json({ error: 'name, description y content son requeridos' });
        return;
      }

      const manager = getSkillsManager();
      const skill = manager.createSkill(tenantId, name, description, content, command);

      res.status(201).json(skill);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Agrega un skill desde URL o archivo
   */
  async addFromSource(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { source } = req.body;

      if (!source) {
        res.status(400).json({ error: 'source es requerido (URL o path de archivo)' });
        return;
      }

      const manager = getSkillsManager();
      const skill = await manager.addSkill(tenantId, source);

      if (!skill) {
        res.status(400).json({ error: 'No se pudo agregar el skill' });
        return;
      }

      res.status(201).json(skill);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Habilita/deshabilita un skill
   */
  async setEnabled(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { skillId } = req.params;
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        res.status(400).json({ error: 'enabled es requerido (boolean)' });
        return;
      }

      const manager = getSkillsManager();
      const success = manager.setSkillEnabled(tenantId, skillId, enabled);

      if (!success) {
        res.status(404).json({ error: 'Skill no encontrado' });
        return;
      }

      res.json({
        success: true,
        message: enabled ? 'Skill habilitado' : 'Skill deshabilitado',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Elimina un skill
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { skillId } = req.params;
      const manager = getSkillsManager();

      const success = manager.deleteSkill(tenantId, skillId);

      if (!success) {
        res.status(404).json({ error: 'Skill no encontrado o no se puede eliminar' });
        return;
      }

      res.json({ success: true, message: 'Skill eliminado' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const skillsController = new SkillsController();
