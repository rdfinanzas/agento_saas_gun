/**
 * SkillLoaderService - Servicio para cargar skills instalados como herramientas
 *
 * Convierte skills instalados del marketplace en herramientas dinámicas
 * que pueden ser usadas por el agente de WhatsApp
 */

import { PrismaClient } from '@prisma/client';
import { skillsService } from '../../accomplish/services/skills.service';

const prisma = new PrismaClient();

// ============================================
// Interfaces
// ============================================

export interface SkillTool {
  name: string;
  description: string;
  parameters?: SkillParameter[];
  handler: string;
  category: string;
  dangerous?: boolean;
}

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  enum?: string[];
}

export interface SkillExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
}

// ============================================
// Cache
// ============================================

interface CacheEntry {
  tools: SkillTool[];
  timestamp: number;
}

const SKILL_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// ============================================
// Service
// ============================================

export class SkillLoaderService {
  /**
   * Carga skills instalados y los convierte a formato de tools
   * con cache de 5 minutos
   */
  async loadSkillsAsTools(tenantId: string): Promise<SkillTool[]> {
    const now = Date.now();
    const cached = SKILL_CACHE.get(tenantId);

    // Verificar cache válido
    if (cached && now - cached.timestamp < CACHE_TTL) {
      console.log(`[SkillLoader] Using cached skills for tenant ${tenantId}`);
      return cached.tools;
    }

    console.log(`[SkillLoader] Loading skills for tenant ${tenantId}`);

    try {
      // Obtener skills instalados usando el servicio existente
      const installedSkills = await skillsService.getInstalledSkills(tenantId);

      // Convertir cada skill a herramienta
      const tools: SkillTool[] = [];

      for (const installedSkill of installedSkills) {
        const skillTools = skillsService.skillToTool(installedSkill);

        for (const tool of skillTools) {
          tools.push({
            name: tool.name,
            description: tool.description,
            parameters: this.convertInputSchemaToParameters(tool.inputSchema),
            handler: 'skill',
            category: tool.category || 'custom',
            dangerous: tool.dangerous || false,
          });
        }
      }

      // Guardar en cache
      SKILL_CACHE.set(tenantId, {
        tools,
        timestamp: now,
      });

      console.log(`[SkillLoader] Loaded ${tools.length} tools from ${installedSkills.length} skills`);

      return tools;
    } catch (error: any) {
      console.error(`[SkillLoader] Error loading skills for tenant ${tenantId}:`, error);
      return [];
    }
  }

  /**
   * Convierte un schema de input de Prisma/Zod a parámetros legibles
   */
  private convertInputSchemaToParameters(schema: any): SkillParameter[] {
    if (!schema || !schema.properties) {
      return [];
    }

    const parameters: SkillParameter[] = [];
    const required = (schema.required as string[]) || [];

    for (const [name, propSchema] of Object.entries(schema.properties)) {
      const prop = propSchema as any;

      parameters.push({
        name,
        type: this.mapJsonTypeToSkillType(prop.type),
        description: prop.description || name,
        required: required.includes(name),
        enum: prop.enum,
      });
    }

    return parameters;
  }

  /**
   * Mapea tipos JSON a tipos de SkillParameter
   */
  private mapJsonTypeToSkillType(jsonType: string): SkillParameter['type'] {
    switch (jsonType) {
      case 'string':
        return 'string';
      case 'number':
      case 'integer':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'object':
        return 'object';
      case 'array':
        return 'array';
      default:
        return 'string';
    }
  }

  /**
   * Ejecuta un skill instalado
   */
  async executeSkill(
    tenantId: string,
    toolName: string,
    input: Record<string, any>
  ): Promise<SkillExecutionResult> {
    try {
      // Buscar el skill que corresponde a esta herramienta
      const installedSkills = await skillsService.getInstalledSkills(tenantId);
      let targetSkill = null;

      for (const installedSkill of installedSkills) {
        const skillTools = skillsService.skillToTool(installedSkill);
        const foundTool = skillTools.find((t) => t.name === toolName);

        if (foundTool) {
          targetSkill = installedSkill;
          break;
        }
      }

      if (!targetSkill) {
        return {
          success: false,
          error: `Skill no encontrado para herramienta: ${toolName}`,
        };
      }

      // Ejecutar usando el servicio de skills
      const result = await skillsService.executeSkill(
        tenantId,
        targetSkill.id,
        toolName,
        input
      );

      return {
        success: result.success,
        output: result.output,
        error: result.error,
      };
    } catch (error: any) {
      console.error(`[SkillLoader] Error executing skill ${toolName}:`, error);
      return {
        success: false,
        error: error.message || 'Error ejecutando skill',
      };
    }
  }

  /**
   * Invalida el cache de skills para un tenant
   */
  invalidateCache(tenantId: string): void {
    SKILL_CACHE.delete(tenantId);
    console.log(`[SkillLoader] Cache invalidated for tenant ${tenantId}`);
  }

  /**
   * Invalida todo el cache (para cuando se instala/desinstala un skill)
   */
  invalidateAllCache(): void {
    SKILL_CACHE.clear();
    console.log('[SkillLoader] All cache invalidated');
  }

  /**
   * Obtiene nombres de herramientas de skills
   */
  async getSkillToolNames(tenantId: string): Promise<string[]> {
    const tools = await this.loadSkillsAsTools(tenantId);
    return tools.map((t) => t.name);
  }

  /**
   * Verifica si una herramienta es un skill
   */
  isSkillTool(toolName: string, tenantId: string): boolean {
    const cached = SKILL_CACHE.get(tenantId);
    if (!cached) return false;

    return cached.tools.some((t) => t.name === toolName);
  }

  /**
   * Limpia cache expirado
   */
  cleanExpiredCache(): void {
    const now = Date.now();

    for (const [tenantId, entry] of SKILL_CACHE.entries()) {
      if (now - entry.timestamp > CACHE_TTL) {
        SKILL_CACHE.delete(tenantId);
      }
    }
  }
}

// Singleton instance
export const skillLoaderService = new SkillLoaderService();

// Limpiar cache cada 10 minutos
setInterval(() => {
  skillLoaderService.cleanExpiredCache();
}, 10 * 60 * 1000);
