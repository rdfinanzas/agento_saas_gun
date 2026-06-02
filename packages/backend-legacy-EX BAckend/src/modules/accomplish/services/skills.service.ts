/**
 * SkillsService - Servicio para gestión de Skills
 *
 * Maneja la instalación, configuración y ejecución de skills
 * desde el marketplace y skills locales
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// Interfaces
export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  author: string;
  command?: string;
  content: string;
  tags: string[];
  isOfficial: boolean;
  isInstalled: boolean;
  installedVersion?: string;
  rating: number;
  ratingsCount: number;
}

export interface InstalledSkillDetail {
  id: string;
  tenantId: string;
  marketplaceSkillId: string;
  localSkillId: string;
  installedVersion: string;
  skill: Skill;
  config?: Record<string, any>;
  enabledTools: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  category?: string;
  dangerous?: boolean;
}

export interface ToolExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export class SkillsService {
  /**
   * Obtiene los skills instalados del tenant
   */
  async getInstalledSkills(tenantId: string): Promise<InstalledSkillDetail[]> {
    const installations = await prisma.installedSkill.findMany({
      where: { tenantId },
      include: {
        marketplaceSkill: true,
      },
    });

    return installations.map((inst) => ({
      id: inst.id,
      tenantId: inst.tenantId,
      marketplaceSkillId: inst.marketplaceSkillId,
      localSkillId: inst.localSkillId,
      installedVersion: inst.installedVersion,
      skill: this.mapToSkill(inst.marketplaceSkill, true),
      enabledTools: this.getSkillTools(inst.marketplaceSkill),
    }));
  }

  /**
   * Obtiene skills disponibles en el marketplace
   */
  async getMarketplaceSkills(filters?: {
    category?: string;
    search?: string;
    tags?: string[];
  }): Promise<Skill[]> {
    const where: any = {
      status: 'PUBLISHED',
    };

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { tags: { hasSome: [filters.search] } },
      ];
    }

    if (filters?.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    const skills = await prisma.marketplaceSkill.findMany({
      where,
      orderBy: [
        { isOfficial: 'desc' },
        { rating: 'desc' },
        { downloads: 'desc' },
      ],
    });

    return skills.map((skill) => this.mapToSkill(skill, false));
  }

  /**
   * Installa un skill del marketplace
   */
  async installSkill(
    tenantId: string,
    marketplaceSkillId: string,
    config?: Record<string, any>
  ): Promise<InstalledSkillDetail> {
    // Verificar que el skill existe
    const skill = await prisma.marketplaceSkill.findUnique({
      where: { id: marketplaceSkillId },
    });

    if (!skill) {
      throw new Error('Skill no encontrado');
    }

    if (skill.status !== 'PUBLISHED') {
      throw new Error('Skill no disponible');
    }

    // Verificar si ya está instalado
    const existing = await prisma.installedSkill.findUnique({
      where: {
        tenantId_marketplaceSkillId: {
          tenantId,
          marketplaceSkillId,
        },
      },
    });

    if (existing) {
      throw new Error('Skill ya instalado');
    }

    // Crear instalación
    const installation = await prisma.installedSkill.create({
      data: {
        id: uuidv4(),
        tenantId,
        marketplaceSkillId,
        localSkillId: `${tenantId}-${marketplaceSkillId}`,
        installedVersion: skill.version,
      },
      include: {
        marketplaceSkill: true,
      },
    });

    // Incrementar descargas
    await prisma.marketplaceSkill.update({
      where: { id: marketplaceSkillId },
      data: {
        downloads: {
          increment: 1,
        },
      },
    });

    return {
      id: installation.id,
      tenantId: installation.tenantId,
      marketplaceSkillId: installation.marketplaceSkillId,
      localSkillId: installation.localSkillId,
      installedVersion: installation.installedVersion,
      skill: this.mapToSkill(skill, true),
      config,
      enabledTools: this.getSkillTools(skill),
    };
  }

  /**
   * Desinstala un skill
   */
  async uninstallSkill(tenantId: string, installationId: string): Promise<void> {
    const installation = await prisma.installedSkill.findFirst({
      where: {
        id: installationId,
        tenantId,
      },
    });

    if (!installation) {
      throw new Error('Instalación no encontrada');
    }

    await prisma.installedSkill.delete({
      where: { id: installationId },
    });
  }

  /**
   * Actualiza la configuración de un skill instalado
   */
  async updateSkillConfig(
    tenantId: string,
    installationId: string,
    config: Record<string, any>
  ): Promise<InstalledSkillDetail> {
    const installation = await prisma.installedSkill.findFirst({
      where: {
        id: installationId,
        tenantId,
      },
      include: {
        marketplaceSkill: true,
      },
    });

    if (!installation) {
      throw new Error('Instalación no encontrada');
    }

    // Guardar config en metadata del tenant
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const currentSettings = (tenant?.settings as any) || {};
    const currentSkills = currentSettings.skills || {};

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...currentSettings,
          skills: {
            ...currentSkills,
            [installation.marketplaceSkillId]: config,
          },
        },
      },
    });

    return {
      id: installation.id,
      tenantId: installation.tenantId,
      marketplaceSkillId: installation.marketplaceSkillId,
      localSkillId: installation.localSkillId,
      installedVersion: installation.installedVersion,
      skill: this.mapToSkill(installation.marketplaceSkill, true),
      config,
      enabledTools: this.getSkillTools(installation.marketplaceSkill),
    };
  }

  /**
   * Obtiene las herramientas (tools) proporcionadas por un skill
   */
  getSkillTools(skill: any): string[] {
    // Analizar el contenido del skill para extraer las herramientas
    // Esto es una implementación básica - en producción se parsearía el YAML/JSON del skill
    const tools: string[] = [];

    if (skill.category === 'integration') {
      tools.push(`${skill.name.toLowerCase()}_query`);
      tools.push(`${skill.name.toLowerCase()}_execute`);
    } else if (skill.category === 'automation') {
      tools.push(`${skill.name.toLowerCase()}_trigger`);
      tools.push(`${skill.name.toLowerCase()}_status`);
    } else if (skill.category === 'data') {
      tools.push(`${skill.name.toLowerCase()}_read`);
      tools.push(`${skill.name.toLowerCase()}_write`);
    }

    return tools;
  }

  /**
   * Convierte un skill a definición de tool para OpenCode
   */
  skillToTool(installedSkill: InstalledSkillDetail): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    const skillName = installedSkill.skill.name.toLowerCase().replace(/\s+/g, '_');

    // Crear herramientas basadas en la categoría del skill
    switch (installedSkill.skill.category) {
      case 'integration':
        tools.push({
          name: `${skillName}_query`,
          description: `Consulta datos de ${installedSkill.skill.name}`,
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Consulta a ejecutar' },
              params: { type: 'object', description: 'Parámetros de la consulta' },
            },
            required: ['query'],
          },
          category: 'integration',
        });
        tools.push({
          name: `${skillName}_execute`,
          description: `Ejecuta una acción en ${installedSkill.skill.name}`,
          inputSchema: {
            type: 'object',
            properties: {
              action: { type: 'string', description: 'Acción a ejecutar' },
              params: { type: 'object', description: 'Parámetros de la acción' },
            },
            required: ['action'],
          },
          category: 'integration',
          dangerous: true,
        });
        break;

      case 'data':
        tools.push({
          name: `${skillName}_read`,
          description: `Lee datos de ${installedSkill.skill.name}`,
          inputSchema: {
            type: 'object',
            properties: {
              source: { type: 'string', description: 'Fuente de datos' },
              filters: { type: 'object', description: 'Filtros a aplicar' },
            },
            required: ['source'],
          },
          category: 'data',
        });
        tools.push({
          name: `${skillName}_write`,
          description: `Escribe datos en ${installedSkill.skill.name}`,
          inputSchema: {
            type: 'object',
            properties: {
              destination: { type: 'string', description: 'Destino de datos' },
              data: { type: 'object', description: 'Datos a escribir' },
            },
            required: ['destination', 'data'],
          },
          category: 'data',
          dangerous: true,
        });
        break;

      case 'automation':
        tools.push({
          name: `${skillName}_trigger`,
          description: `Dispara una automatización de ${installedSkill.skill.name}`,
          inputSchema: {
            type: 'object',
            properties: {
              trigger: { type: 'string', description: 'Tipo de trigger' },
              payload: { type: 'object', description: 'Payload del trigger' },
            },
            required: ['trigger'],
          },
          category: 'automation',
        });
        break;

      default:
        // Herramienta genérica
        tools.push({
          name: skillName,
          description: installedSkill.skill.description,
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Entrada para el skill' },
            },
            required: ['input'],
          },
          category: 'custom',
        });
    }

    return tools;
  }

  /**
   * Ejecuta un skill instalado
   */
  async executeSkill(
    tenantId: string,
    installationId: string,
    toolName: string,
    input: Record<string, any>
  ): Promise<ToolExecutionResult> {
    const installation = await prisma.installedSkill.findFirst({
      where: {
        id: installationId,
        tenantId,
      },
      include: {
        marketplaceSkill: true,
      },
    });

    if (!installation) {
      return {
        success: false,
        error: 'Skill no encontrado',
      };
    }

    // Obtener configuración del skill
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    const skillConfig = (tenant?.settings as any)?.skills?.[installation.marketplaceSkillId] || {};

    try {
      // Ejecutar el skill según su tipo
      // En producción, esto invocaría el comando o función del skill
      const result = await this.invokeSkill(
        installation.marketplaceSkill,
        toolName,
        input,
        skillConfig
      );

      return {
        success: true,
        output: result,
        metadata: {
          skillId: installation.id,
          toolName,
          executedAt: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Error ejecutando skill',
      };
    }
  }

  /**
   * Invoca la ejecución real del skill
   */
  private async invokeSkill(
    skill: any,
    toolName: string,
    input: Record<string, any>,
    config: Record<string, any>
  ): Promise<any> {
    // Implementación básica - en producción esto ejecutaría el comando del skill
    // o haría una llamada HTTP a un endpoint específico

    if (skill.command) {
      // Si tiene un comando, ejecutarlo
      // NOTA: En producción esto debe hacerse con sandboxing
      return {
        message: `Skill ${skill.name} ejecutado con comando: ${skill.command}`,
        input,
        config,
      };
    }

    // Si no tiene comando, retornar un mock del resultado
    return {
      skill: skill.name,
      tool: toolName,
      result: `Simulación de ejecución de ${toolName}`,
      input,
    };
  }

  /**
   * Obtiene skills por categoría
   */
  async getSkillsByCategory(category: string): Promise<Skill[]> {
    return this.getMarketplaceSkills({ category });
  }

  /**
   * Busca skills por tags
   */
  async searchSkillsByTag(tag: string): Promise<Skill[]> {
    return this.getMarketplaceSkills({ tags: [tag] });
  }

  /**
   * Valida si un skill es compatible con el tenant
   */
  async validateSkillCompatibility(
    tenantId: string,
    marketplaceSkillId: string
  ): Promise<{ compatible: boolean; reason?: string }> {
    const skill = await prisma.marketplaceSkill.findUnique({
      where: { id: marketplaceSkillId },
    });

    if (!skill) {
      return { compatible: false, reason: 'Skill no encontrado' };
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subscriptionTier: true },
    });

    // Validar compatibilidad según plan
    if (skill.compatibility && skill.compatibility.length > 0) {
      if (!skill.compatibility.includes(tenant?.subscriptionTier || 'FREE')) {
        return {
          compatible: false,
          reason: `Este skill requiere un plan ${skill.compatibility.join(' o ')}`,
        };
      }
    }

    return { compatible: true };
  }

  /**
   * Mapea una entidad de BD a la interfaz Skill
   */
  private mapToSkill(skill: any, isInstalled: boolean): Skill {
    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      version: skill.version,
      author: skill.author,
      command: skill.command,
      content: skill.content,
      tags: skill.tags || [],
      isOfficial: skill.isOfficial,
      isInstalled,
      rating: Number(skill.rating) || 0,
      ratingsCount: skill.ratingsCount || 0,
    };
  }

  /**
   * Obtiene un skill del marketplace por ID
   */
  async getMarketplaceSkill(skillId: string): Promise<Skill | null> {
    const skill = await prisma.marketplaceSkill.findUnique({
      where: { id: skillId },
    });

    return skill ? this.mapToSkill(skill, false) : null;
  }

  /**
   * Actualiza un skill instalado a una nueva versión
   */
  async updateSkill(
    tenantId: string,
    installationId: string
  ): Promise<InstalledSkillDetail> {
    const installation = await prisma.installedSkill.findFirst({
      where: {
        id: installationId,
        tenantId,
      },
      include: {
        marketplaceSkill: true,
      },
    });

    if (!installation) {
      throw new Error('Instalación no encontrada');
    }

    const skill = installation.marketplaceSkill;

    // Actualizar versión
    const updated = await prisma.installedSkill.update({
      where: { id: installationId },
      data: {
        installedVersion: skill.version,
      },
      include: {
        marketplaceSkill: true,
      },
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      marketplaceSkillId: updated.marketplaceSkillId,
      localSkillId: updated.localSkillId,
      installedVersion: updated.installedVersion,
      skill: this.mapToSkill(skill, true),
      enabledTools: this.getSkillTools(skill),
    };
  }
}

// Singleton instance
export const skillsService = new SkillsService();
