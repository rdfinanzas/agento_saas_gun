/**
 * Skills Controller - Controlador para gestión de Skills
 *
 * Maneja las solicitudes HTTP relacionadas con skills
 */

import { Request, Response } from 'express';
import { skillsService } from '../services';
import {
  SkillDto,
  InstalledSkillDto,
  InstallSkillDto,
  UpdateSkillConfigDto,
  ExecuteSkillDto,
  SkillExecutionResultDto,
  MarketplaceQueryDto,
  MarketplaceResponseDto,
} from '../dto/accomplish.dto';

export class SkillsController {
  /**
   * Obtiene los skills instalados del tenant
   */
  async getInstalledSkills(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;

      const skills = await skillsService.getInstalledSkills(tenantId);

      res.json({
        success: true,
        data: skills,
      });
    } catch (error: any) {
      console.error('Error getting installed skills:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error obteniendo skills instalados',
      });
    }
  }

  /**
   * Obtiene skills del marketplace
   */
  async getMarketplaceSkills(req: Request, res: Response): Promise<void> {
    try {
      const { category, search, tags, page = 1, pageSize = 20 } = req.query;

      const filters: MarketplaceQueryDto = {
        category: category as string,
        search: search as string,
        tags: tags ? (tags as string).split(',') : undefined,
        page: Number(page),
        pageSize: Number(pageSize),
      };

      let skills;
      let total;

      if (category) {
        skills = await skillsService.getSkillsByCategory(category as string);
        total = skills.length;
      } else if (filters.tags && filters.tags.length > 0) {
        skills = await skillsService.searchSkillsByTag(filters.tags[0]);
        total = skills.length;
      } else {
        skills = await skillsService.getMarketplaceSkills({
          category: filters.category,
          search: filters.search,
          tags: filters.tags,
        });
        total = skills.length;
      }

      // Aplicar paginación
      const startIndex = (filters.page! - 1) * filters.pageSize!;
      const endIndex = startIndex + filters.pageSize!;
      const paginatedSkills = skills.slice(startIndex, endIndex);

      const response: MarketplaceResponseDto = {
        skills: paginatedSkills,
        total,
        page: filters.page!,
        pageSize: filters.pageSize!,
      };

      res.json({
        success: true,
        data: response,
      });
    } catch (error: any) {
      console.error('Error getting marketplace skills:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error obteniendo skills del marketplace',
      });
    }
  }

  /**
   * Obtiene un skill específico del marketplace
   */
  async getMarketplaceSkill(req: Request, res: Response): Promise<void> {
    try {
      const { skillId } = req.params;

      const skill = await skillsService.getMarketplaceSkill(skillId);

      if (!skill) {
        res.status(404).json({
          success: false,
          error: 'Skill no encontrado',
        });
        return;
      }

      res.json({
        success: true,
        data: skill,
      });
    } catch (error: any) {
      console.error('Error getting marketplace skill:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error obteniendo skill',
      });
    }
  }

  /**
   * Instala un skill del marketplace
   */
  async installSkill(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { marketplaceSkillId, config }: InstallSkillDto = req.body;

      if (!marketplaceSkillId) {
        res.status(400).json({
          success: false,
          error: 'marketplaceSkillId es requerido',
        });
        return;
      }

      // Validar compatibilidad
      const compatibility = await skillsService.validateSkillCompatibility(
        tenantId,
        marketplaceSkillId
      );

      if (!compatibility.compatible) {
        res.status(400).json({
          success: false,
          error: compatibility.reason,
        });
        return;
      }

      const installedSkill = await skillsService.installSkill(
        tenantId,
        marketplaceSkillId,
        config
      );

      res.status(201).json({
        success: true,
        data: installedSkill,
      });
    } catch (error: any) {
      console.error('Error installing skill:', error);

      if (error.message === 'Skill ya instalado') {
        res.status(409).json({
          success: false,
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Error instalando skill',
      });
    }
  }

  /**
   * Desinstala un skill
   */
  async uninstallSkill(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { installationId } = req.params;

      await skillsService.uninstallSkill(tenantId, installationId);

      res.json({
        success: true,
        message: 'Skill desinstalado correctamente',
      });
    } catch (error: any) {
      console.error('Error uninstalling skill:', error);

      if (error.message === 'Instalación no encontrada') {
        res.status(404).json({
          success: false,
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Error desinstalando skill',
      });
    }
  }

  /**
   * Actualiza la configuración de un skill instalado
   */
  async updateSkillConfig(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { installationId } = req.params;
      const { config }: UpdateSkillConfigDto = req.body;

      if (!config || typeof config !== 'object') {
        res.status(400).json({
          success: false,
          error: 'config es requerido y debe ser un objeto',
        });
        return;
      }

      const updatedSkill = await skillsService.updateSkillConfig(
        tenantId,
        installationId,
        config
      );

      res.json({
        success: true,
        data: updatedSkill,
      });
    } catch (error: any) {
      console.error('Error updating skill config:', error);

      if (error.message === 'Instalación no encontrada') {
        res.status(404).json({
          success: false,
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Error actualizando configuración del skill',
      });
    }
  }

  /**
   * Ejecuta un skill instalado
   */
  async executeSkill(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { installationId, toolName, input }: ExecuteSkillDto = req.body;

      if (!installationId || !toolName) {
        res.status(400).json({
          success: false,
          error: 'installationId y toolName son requeridos',
        });
        return;
      }

      const result = await skillsService.executeSkill(
        tenantId,
        installationId,
        toolName,
        input || {}
      );

      res.json({
        success: result.success,
        data: result,
      });
    } catch (error: any) {
      console.error('Error executing skill:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error ejecutando skill',
      });
    }
  }

  /**
   * Actualiza un skill instalado a una nueva versión
   */
  async updateSkill(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { installationId } = req.params;

      const updatedSkill = await skillsService.updateSkill(
        tenantId,
        installationId
      );

      res.json({
        success: true,
        data: updatedSkill,
      });
    } catch (error: any) {
      console.error('Error updating skill:', error);

      if (error.message === 'Instalación no encontrada') {
        res.status(404).json({
          success: false,
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Error actualizando skill',
      });
    }
  }

  /**
   * Obtiene las herramientas disponibles de un skill instalado
   */
  async getSkillTools(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { installationId } = req.params;

      const installedSkills = await skillsService.getInstalledSkills(tenantId);
      const skill = installedSkills.find((s) => s.id === installationId);

      if (!skill) {
        res.status(404).json({
          success: false,
          error: 'Skill no encontrado',
        });
        return;
      }

      const tools = skillsService.skillToTool(skill);

      res.json({
        success: true,
        data: tools,
      });
    } catch (error: any) {
      console.error('Error getting skill tools:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error obteniendo herramientas del skill',
      });
    }
  }

  /**
   * Valida la compatibilidad de un skill con el tenant
   */
  async validateSkillCompatibility(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { marketplaceSkillId } = req.params;

      const result = await skillsService.validateSkillCompatibility(
        tenantId,
        marketplaceSkillId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error validating skill compatibility:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error validando compatibilidad del skill',
      });
    }
  }
}

// Singleton instance
export const skillsController = new SkillsController();
