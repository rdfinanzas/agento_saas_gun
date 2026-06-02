/**
 * SkillsMarketplaceController - Controlador para marketplace de skills
 */

import { Request, Response } from 'express';
import { skillsMarketplaceService, SkillCategory } from '../services/skills-marketplace.service';

export class SkillsMarketplaceController {
  /**
   * Obtiene skills del marketplace
   * GET /marketplace/skills
   */
  async getSkills(req: Request, res: Response): Promise<void> {
    try {
      const { category, search, tags, verified, sortBy } = req.query;

      const filters = {
        category: category as SkillCategory | undefined,
        search: search as string | undefined,
        tags: tags ? (tags as string).split(',') : undefined,
        verified: verified === 'true',
        sortBy: sortBy as 'downloads' | 'rating' | 'recent' | undefined,
      };

      const skills = await skillsMarketplaceService.getSkills(filters);

      res.json({
        success: true,
        skills,
        count: skills.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene un skill por ID
   * GET /marketplace/skills/:skillId
   */
  async getSkillById(req: Request, res: Response): Promise<void> {
    try {
      const { skillId } = req.params;

      const skill = await skillsMarketplaceService.getSkillById(skillId);

      if (!skill) {
        res.status(404).json({ error: 'Skill no encontrado' });
        return;
      }

      res.json({
        success: true,
        skill,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Instala un skill
   * POST /marketplace/skills/:skillId/install
   */
  async installSkill(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { skillId } = req.params;

      const result = await skillsMarketplaceService.installSkill(tenantId, skillId);

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Desinstala un skill
   * DELETE /marketplace/skills/:skillId/install
   */
  async uninstallSkill(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { skillId } = req.params;

      const result = await skillsMarketplaceService.uninstallSkill(tenantId, skillId);

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Publica un skill al marketplace
   * POST /marketplace/publish
   */
  async publishSkill(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const userId = req.user?.userId || 'unknown';
      const userName = req.user?.name || 'Usuario';
      const { skillId, category, tags, compatibility } = req.body;

      if (!skillId || !category || !tags) {
        res.status(400).json({ error: 'skillId, category y tags son requeridos' });
        return;
      }

      const result = await skillsMarketplaceService.publishSkill(
        tenantId,
        userId,
        userName,
        skillId,
        category,
        tags,
        compatibility
      );

      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Actualiza un skill publicado
   * PATCH /marketplace/skills/:skillId
   */
  async updatePublishedSkill(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId || 'unknown';
      const { skillId } = req.params;
      const { description, content, tags, version } = req.body;

      const result = await skillsMarketplaceService.updatePublishedSkill(userId, skillId, {
        description,
        content,
        tags,
        version,
      });

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Elimina un skill del marketplace
   * DELETE /marketplace/skills/:skillId
   */
  async unpublishSkill(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId || 'unknown';
      const { skillId } = req.params;

      const result = await skillsMarketplaceService.unpublishSkill(userId, skillId);

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Añade una reseña
   * POST /marketplace/skills/:skillId/reviews
   */
  async addReview(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const userId = req.user?.userId || 'unknown';
      const userName = req.user?.name || 'Usuario';
      const { skillId } = req.params;
      const { rating, comment } = req.body;

      if (!rating) {
        res.status(400).json({ error: 'rating es requerido' });
        return;
      }

      const result = await skillsMarketplaceService.addReview(
        tenantId,
        userId,
        userName,
        skillId,
        rating,
        comment
      );

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene reseñas de un skill
   * GET /marketplace/skills/:skillId/reviews
   */
  async getReviews(req: Request, res: Response): Promise<void> {
    try {
      const { skillId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      const reviews = await skillsMarketplaceService.getReviews(skillId, limit);

      res.json({
        success: true,
        reviews,
        count: reviews.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene skills instalados
   * GET /marketplace/installed
   */
  async getInstalledSkills(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;

      const skills = await skillsMarketplaceService.getInstalledSkills(tenantId);

      res.json({
        success: true,
        skills,
        count: skills.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene categorías
   * GET /marketplace/categories
   */
  async getCategories(req: Request, res: Response): Promise<void> {
    try {
      const categories = skillsMarketplaceService.getCategories();

      res.json({
        success: true,
        categories,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene tags populares
   * GET /marketplace/tags
   */
  async getPopularTags(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 20;

      const tags = await skillsMarketplaceService.getPopularTags(limit);

      res.json({
        success: true,
        tags,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene mis skills publicados
   * GET /marketplace/my-skills
   */
  async getMyPublishedSkills(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId || 'unknown';

      const skills = await skillsMarketplaceService.getMyPublishedSkills(userId);

      res.json({
        success: true,
        skills,
        count: skills.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const skillsMarketplaceController = new SkillsMarketplaceController();
