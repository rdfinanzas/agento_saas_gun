/**
 * Tipos para el sistema de Skills
 * Adaptado desde Accomplish Agent-Core
 */

// Fuente del skill
export type SkillSource = 'official' | 'community' | 'custom';

// Skill completo
export interface Skill {
  id: string;
  tenantId: string; // Multi-tenant
  name: string;
  command: string;
  description: string;
  source: SkillSource;
  isEnabled: boolean;
  isVerified: boolean;
  isHidden: boolean;
  filePath: string;
  githubUrl?: string;
  content?: string; // Contenido del skill
  updatedAt: string;
  createdAt: string;
}

// Frontmatter del skill (metadata)
export interface SkillFrontmatter {
  name: string;
  description: string;
  command?: string;
  verified?: boolean;
  hidden?: boolean;
}

// Opciones del SkillsManager
export interface SkillsManagerOptions {
  tenantId: string;
  bundledSkillsPath?: string;
  userSkillsPath: string;
}

// DTOs para API
export class CreateSkillDto {
  name!: string;
  description!: string;
  command?: string;
  content?: string;
  source?: SkillSource;
}

export class UpdateSkillDto {
  name?: string;
  description?: string;
  command?: string;
  content?: string;
  isEnabled?: boolean;
}

export class SkillResponseDto {
  id!: string;
  tenantId!: string;
  name!: string;
  command!: string;
  description!: string;
  source!: SkillSource;
  isEnabled!: boolean;
  isVerified!: boolean;
  isHidden!: boolean;
  updatedAt!: string;
}
