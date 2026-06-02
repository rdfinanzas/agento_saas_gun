/**
 * SkillsMarketplaceService - Marketplace de Skills
 * Permite compartir e instalar skills preconstruidas
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../../config/database';
import { getSkillsManager } from '../internal/classes/SkillsManager';

// Interfaces
export interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  author: string;
  authorId: string;
  version: string;
  content: string;
  command?: string;
  tags: string[];
  downloads: number;
  rating: number;
  ratingsCount: number;
  isVerified: boolean;
  isOfficial: boolean;
  compatibility: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type SkillCategory =
  | 'integration'
  | 'automation'
  | 'communication'
  | 'data'
  | 'productivity'
  | 'analytics'
  | 'custom';

export interface MarketplaceFilter {
  category?: SkillCategory;
  search?: string;
  tags?: string[];
  verified?: boolean;
  sortBy?: 'downloads' | 'rating' | 'recent';
}

export interface SkillReview {
  id: string;
  skillId: string;
  userId: string;
  userName: string;
  rating: number;
  comment?: string;
  createdAt: Date;
}

export class SkillsMarketplaceService {
  /**
   * Obtiene skills del marketplace con filtros
   */
  async getSkills(filters: MarketplaceFilter = {}): Promise<Partial<MarketplaceSkill>[]> {
    const { category, search, tags, verified, sortBy = 'downloads' } = filters;

    // Build where clause
    const where: any = { status: 'PUBLISHED' };

    if (category) {
      where.category = category;
    }

    if (verified) {
      where.isVerified = true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    // Build orderBy
    let orderBy: any = {};
    switch (sortBy) {
      case 'downloads':
        orderBy = { downloads: 'desc' };
        break;
      case 'rating':
        orderBy = { rating: 'desc' };
        break;
      case 'recent':
        orderBy = { createdAt: 'desc' };
        break;
    }

    const skills = await prisma.marketplaceSkill.findMany({
      where,
      orderBy,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        author: true,
        version: true,
        tags: true,
        downloads: true,
        rating: true,
        ratingsCount: true,
        isVerified: true,
        isOfficial: true,
        compatibility: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return skills.map(s => ({
      ...s,
      category: s.category as SkillCategory,
      rating: Number(s.rating),
    }));
  }

  /**
   * Obtiene un skill del marketplace por ID
   */
  async getSkillById(skillId: string): Promise<MarketplaceSkill | null> {
    const skill = await prisma.marketplaceSkill.findUnique({
      where: { id: skillId, status: 'PUBLISHED' },
    });

    if (!skill) return null;

    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      category: skill.category as SkillCategory,
      author: skill.author,
      authorId: skill.authorId,
      version: skill.version,
      content: skill.content,
      command: skill.command || undefined,
      tags: skill.tags as string[],
      downloads: skill.downloads,
      rating: Number(skill.rating),
      ratingsCount: skill.ratingsCount,
      isVerified: skill.isVerified,
      isOfficial: skill.isOfficial,
      compatibility: skill.compatibility as string[],
      createdAt: skill.createdAt,
      updatedAt: skill.updatedAt,
    };
  }

  /**
   * Instala un skill del marketplace en el tenant
   */
  async installSkill(tenantId: string, skillId: string): Promise<{ success: boolean; message: string; skill?: any }> {
    // Get skill from marketplace
    const marketplaceSkill = await prisma.marketplaceSkill.findUnique({
      where: { id: skillId, status: 'PUBLISHED' },
    });

    if (!marketplaceSkill) {
      return { success: false, message: 'Skill no encontrado en el marketplace' };
    }

    // Check if already installed
    const existing = await prisma.installedSkill.findFirst({
      where: { tenantId, marketplaceSkillId: skillId },
    });

    if (existing) {
      return { success: false, message: 'Skill ya está instalado' };
    }

    // Install skill using SkillsManager
    const manager = getSkillsManager();
    const skill = manager.createSkill(
      tenantId,
      marketplaceSkill.name,
      marketplaceSkill.description,
      marketplaceSkill.content,
      marketplaceSkill.command || undefined
    );

    // Record installation
    await prisma.installedSkill.create({
      data: {
        id: uuidv4(),
        tenantId,
        marketplaceSkillId: skillId,
        installedVersion: marketplaceSkill.version,
        localSkillId: skill.id,
      },
    });

    // Increment download count
    await prisma.marketplaceSkill.update({
      where: { id: skillId },
      data: { downloads: { increment: 1 } },
    });

    return {
      success: true,
      message: 'Skill instalado correctamente',
      skill,
    };
  }

  /**
   * Desinstala un skill del marketplace
   */
  async uninstallSkill(tenantId: string, skillId: string): Promise<{ success: boolean; message: string }> {
    const installed = await prisma.installedSkill.findFirst({
      where: { tenantId, marketplaceSkillId: skillId },
    });

    if (!installed) {
      return { success: false, message: 'Skill no está instalado' };
    }

    // Delete local skill
    const manager = getSkillsManager();
    manager.deleteSkill(tenantId, installed.localSkillId);

    // Remove installation record
    await prisma.installedSkill.delete({
      where: { id: installed.id },
    });

    return { success: true, message: 'Skill desinstalado correctamente' };
  }

  /**
   * Publica un skill al marketplace
   */
  async publishSkill(
    tenantId: string,
    userId: string,
    userName: string,
    skillId: string,
    category: SkillCategory,
    tags: string[],
    compatibility: string[] = []
  ): Promise<{ success: boolean; message: string; marketplaceId?: string }> {
    // Get local skill
    const manager = getSkillsManager();
    const skill = manager.getSkillById(tenantId, skillId);

    if (!skill) {
      return { success: false, message: 'Skill no encontrado' };
    }

    // Check if already published by this user
    const existing = await prisma.marketplaceSkill.findFirst({
      where: { authorId: userId, name: skill.name },
    });

    if (existing) {
      return { success: false, message: 'Ya tienes un skill publicado con este nombre' };
    }

    // Create marketplace entry
    const marketplaceSkill = await prisma.marketplaceSkill.create({
      data: {
        id: uuidv4(),
        name: skill.name,
        description: skill.description,
        category: category as string,
        author: userName,
        authorId: userId,
        version: '1.0.0',
        content: skill.content || '',
        command: skill.command || undefined,
        tags,
        compatibility,
        status: 'PUBLISHED',
        downloads: 0,
        rating: 0,
        ratingsCount: 0,
        isVerified: false,
        isOfficial: false,
      },
    });

    return {
      success: true,
      message: 'Skill publicado al marketplace',
      marketplaceId: marketplaceSkill.id,
    };
  }

  /**
   * Actualiza un skill publicado
   */
  async updatePublishedSkill(
    userId: string,
    marketplaceSkillId: string,
    updates: {
      description?: string;
      content?: string;
      tags?: string[];
      version?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    const skill = await prisma.marketplaceSkill.findUnique({
      where: { id: marketplaceSkillId },
    });

    if (!skill) {
      return { success: false, message: 'Skill no encontrado' };
    }

    if (skill.authorId !== userId) {
      return { success: false, message: 'No tienes permiso para actualizar este skill' };
    }

    await prisma.marketplaceSkill.update({
      where: { id: marketplaceSkillId },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });

    return { success: true, message: 'Skill actualizado correctamente' };
  }

  /**
   * Elimina un skill del marketplace
   */
  async unpublishSkill(userId: string, marketplaceSkillId: string): Promise<{ success: boolean; message: string }> {
    const skill = await prisma.marketplaceSkill.findUnique({
      where: { id: marketplaceSkillId },
    });

    if (!skill) {
      return { success: false, message: 'Skill no encontrado' };
    }

    if (skill.authorId !== userId) {
      return { success: false, message: 'No tienes permiso para eliminar este skill' };
    }

    await prisma.marketplaceSkill.update({
      where: { id: marketplaceSkillId },
      data: { status: 'REMOVED' },
    });

    return { success: true, message: 'Skill eliminado del marketplace' };
  }

  /**
   * Añade una reseña a un skill
   */
  async addReview(
    tenantId: string,
    userId: string,
    userName: string,
    skillId: string,
    rating: number,
    comment?: string
  ): Promise<{ success: boolean; message: string }> {
    if (rating < 1 || rating > 5) {
      return { success: false, message: 'Rating debe ser entre 1 y 5' };
    }

    // Check if skill exists
    const skill = await prisma.marketplaceSkill.findUnique({
      where: { id: skillId },
    });

    if (!skill) {
      return { success: false, message: 'Skill no encontrado' };
    }

    // Check if already reviewed
    const existing = await prisma.skillReview.findFirst({
      where: { skillId, userId },
    });

    if (existing) {
      // Update existing review
      await prisma.skillReview.update({
        where: { id: existing.id },
        data: { rating, comment },
      });
    } else {
      // Create new review
      await prisma.skillReview.create({
        data: {
          id: uuidv4(),
          skillId,
          userId,
          userName,
          rating,
          comment,
        },
      });
    }

    // Recalculate average rating
    const reviews = await prisma.skillReview.findMany({
      where: { skillId },
      select: { rating: true },
    });

    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await prisma.marketplaceSkill.update({
      where: { id: skillId },
      data: {
        rating: Math.round(avgRating * 10) / 10,
        ratingsCount: reviews.length,
      },
    });

    return { success: true, message: 'Reseña añadida correctamente' };
  }

  /**
   * Obtiene reseñas de un skill
   */
  async getReviews(skillId: string, limit: number = 10): Promise<SkillReview[]> {
    const reviews = await prisma.skillReview.findMany({
      where: { skillId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return reviews.map((r) => ({
      id: r.id,
      skillId: r.skillId,
      userId: r.userId,
      userName: r.userName,
      rating: r.rating,
      comment: r.comment || undefined,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Obtiene skills instalados en el tenant
   */
  async getInstalledSkills(tenantId: string): Promise<any[]> {
    const installed = await prisma.installedSkill.findMany({
      where: { tenantId },
      include: {
        marketplaceSkill: {
          select: {
            name: true,
            description: true,
            version: true,
            author: true,
            category: true,
          },
        },
      },
    });

    return installed.map((i) => ({
      id: i.id,
      marketplaceSkillId: i.marketplaceSkillId,
      localSkillId: i.localSkillId,
      installedVersion: i.installedVersion,
      installedAt: i.createdAt,
      skill: i.marketplaceSkill,
    }));
  }

  /**
   * Obtiene categorías disponibles
   */
  getCategories(): { id: SkillCategory; name: string; description: string }[] {
    return [
      { id: 'integration', name: 'Integraciones', description: 'Conectores con sistemas externos' },
      { id: 'automation', name: 'Automatización', description: 'Tareas automatizadas' },
      { id: 'communication', name: 'Comunicación', description: 'Herramientas de comunicación' },
      { id: 'data', name: 'Datos', description: 'Procesamiento de datos' },
      { id: 'productivity', name: 'Productividad', description: 'Mejora de productividad' },
      { id: 'analytics', name: 'Analytics', description: 'Análisis y métricas' },
      { id: 'custom', name: 'Personalizado', description: 'Skills personalizados' },
    ];
  }

  /**
   * Obtiene tags populares
   */
  async getPopularTags(limit: number = 20): Promise<{ tag: string; count: number }[]> {
    const skills = await prisma.marketplaceSkill.findMany({
      where: { status: 'PUBLISHED' },
      select: { tags: true },
    });

    const tagCounts = new Map<string, number>();

    skills.forEach((skill) => {
      (skill.tags as string[]).forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Obtiene skills del usuario en el marketplace
   */
  async getMyPublishedSkills(userId: string): Promise<Partial<MarketplaceSkill>[]> {
    const skills = await prisma.marketplaceSkill.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return skills.map(s => ({
      ...s,
      category: s.category as SkillCategory,
      rating: Number(s.rating),
      command: s.command || undefined,
    }));
  }
}

export const skillsMarketplaceService = new SkillsMarketplaceService();
