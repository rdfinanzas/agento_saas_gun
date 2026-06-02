/**
 * SkillsManager - Gestión de Skills/Comandos del agente
 * Adaptado desde Accomplish Agent-Core para multi-tenant
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import matter from 'gray-matter';
import type { Skill, SkillSource, SkillFrontmatter, SkillsManagerOptions } from '../../common/types/skills';

/**
 * Gestor de Skills para el sistema multi-tenant
 */
export class SkillsManager {
  private readonly bundledSkillsPath: string;
  private readonly userSkillsPath: string;
  private initialized = false;

  // Cache de skills por tenant
  private skillsCache: Map<string, Skill[]> = new Map();

  constructor(options: SkillsManagerOptions) {
    this.bundledSkillsPath = options.bundledSkillsPath || path.join(process.cwd(), 'skills', 'bundled');
    this.userSkillsPath = options.userSkillsPath;
  }

  /**
   * Inicializa el SkillsManager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[SkillsManager] Initializing...');

    // Crear directorio de skills de usuario si no existe
    if (!fs.existsSync(this.userSkillsPath)) {
      fs.mkdirSync(this.userSkillsPath, { recursive: true });
    }

    // Crear directorio de skills oficiales si no existe
    if (!fs.existsSync(this.bundledSkillsPath)) {
      fs.mkdirSync(this.bundledSkillsPath, { recursive: true });
    }

    // Cargar skills oficiales por defecto
    await this.loadBundledSkills();

    this.initialized = true;
    console.log('[SkillsManager] Initialized');
  }

  /**
   * Carga skills oficiales incluidos
   */
  private async loadBundledSkills(): Promise<void> {
    const defaultSkills = [
      {
        name: 'Ventas',
        command: '/ventas',
        description: 'Asistente especializado en ventas y negociación',
        content: `---
name: Ventas
description: Asistente especializado en ventas y negociación
command: /ventas
verified: true
---

# Skill de Ventas

Eres un asistente experto en ventas. Tu objetivo es:

1. Identificar las necesidades del cliente
2. Presentar soluciones que se ajusten a sus requerimientos
3. Manejar objeciones de manera profesional
4. Cerrar tratos de forma efectiva

## Pautas de Comunicación

- Sé amable pero persuasivo
- Usa un tono profesional
- Destaca beneficios, no solo características
- Escucha activamente antes de responder
`,
      },
      {
        name: 'Soporte',
        command: '/soporte',
        description: 'Asistente para atención al cliente y resolución de problemas',
        content: `---
name: Soporte
description: Asistente para atención al cliente y resolución de problemas
command: /soporte
verified: true
---

# Skill de Soporte

Eres un asistente de soporte técnico y atención al cliente. Tu rol es:

1. Escuchar el problema del cliente con empatía
2. Diagnosticar la causa del issue
3. Proporcionar soluciones claras y paso a paso
4. Escalar cuando sea necesario

## Pautas

- Mantén la calma en todo momento
- Usa lenguaje simple y evita tecnicismos innecesarios
- Confirma que el cliente entendió la solución
- Documenta el caso para referencia futura
`,
      },
      {
        name: 'Agendamiento',
        command: '/agenda',
        description: 'Asistente para gestión de citas y reservaciones',
        content: `---
name: Agendamiento
description: Asistente para gestión de citas y reservaciones
command: /agenda
verified: true
---

# Skill de Agendamiento

Eres un asistente especializado en gestión de citas. Tu rol es:

1. Consultar disponibilidad
2. Programar citas
3. Confirmar reservaciones
4. Gestionar cancelaciones y reprogramaciones

## Pautas

- Verifica disponibilidad antes de confirmar
- Envía recordatorios
- Maneja conflictos de horario con alternativas
`,
      },
    ];

    for (const skill of defaultSkills) {
      const skillDir = path.join(this.bundledSkillsPath, skill.name.toLowerCase());
      if (!fs.existsSync(skillDir)) {
        fs.mkdirSync(skillDir, { recursive: true });
        fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skill.content);
      }
    }
  }

  /**
   * Obtiene todos los skills de un tenant
   */
  getAllSkills(tenantId: string): Skill[] {
    // Por ahora, todos los tenants tienen acceso a los skills oficiales
    // más sus skills personalizados
    const cacheKey = `tenant_${tenantId}`;

    if (this.skillsCache.has(cacheKey)) {
      return this.skillsCache.get(cacheKey)!;
    }

    const skills: Skill[] = [];

    // Cargar skills oficiales
    const bundledSkills = this.scanDirectory(this.bundledSkillsPath, 'official', tenantId);
    skills.push(...bundledSkills);

    // Cargar skills personalizados del tenant
    const tenantSkillsPath = path.join(this.userSkillsPath, tenantId);
    if (fs.existsSync(tenantSkillsPath)) {
      const userSkills = this.scanDirectory(tenantSkillsPath, 'custom', tenantId);
      skills.push(...userSkills);
    }

    this.skillsCache.set(cacheKey, skills);
    return skills;
  }

  /**
   * Obtiene skills habilitados
   */
  getEnabledSkills(tenantId: string): Skill[] {
    return this.getAllSkills(tenantId).filter(s => s.isEnabled);
  }

  /**
   * Obtiene un skill por ID
   */
  getSkillById(tenantId: string, skillId: string): Skill | null {
    const skills = this.getAllSkills(tenantId);
    return skills.find(s => s.id === skillId) || null;
  }

  /**
   * Obtiene un skill por comando
   */
  getSkillByCommand(tenantId: string, command: string): Skill | null {
    const skills = this.getAllSkills(tenantId);
    return skills.find(s => s.command === command) || null;
  }

  /**
   * Obtiene el contenido de un skill
   */
  getSkillContent(tenantId: string, skillId: string): string | null {
    const skill = this.getSkillById(tenantId, skillId);
    if (!skill) return null;

    try {
      return fs.readFileSync(skill.filePath, 'utf-8');
    } catch {
      return skill.content || null;
    }
  }

  /**
   * Habilita/deshabilita un skill
   */
  setSkillEnabled(tenantId: string, skillId: string, enabled: boolean): boolean {
    const skill = this.getSkillById(tenantId, skillId);
    if (!skill) return false;

    skill.isEnabled = enabled;
    skill.updatedAt = new Date().toISOString();

    // Invalidar cache
    this.skillsCache.delete(`tenant_${tenantId}`);

    return true;
  }

  /**
   * Agrega un skill desde un archivo
   */
  async addSkill(tenantId: string, sourcePath: string): Promise<Skill | null> {
    if (sourcePath.startsWith('http://') || sourcePath.startsWith('https://')) {
      return this.addFromUrl(tenantId, sourcePath);
    }

    return this.addFromFile(tenantId, sourcePath);
  }

  /**
   * Crea un skill directamente
   */
  createSkill(
    tenantId: string,
    name: string,
    description: string,
    content: string,
    command?: string
  ): Skill {
    const safeName = this.sanitizeSkillName(name);
    const skillId = `custom-${safeName}-${uuidv4().substring(0, 8)}`;
    const skillCommand = command || `/${safeName}`;

    const tenantSkillsPath = path.join(this.userSkillsPath, tenantId);
    if (!fs.existsSync(tenantSkillsPath)) {
      fs.mkdirSync(tenantSkillsPath, { recursive: true });
    }

    const skillDir = path.join(tenantSkillsPath, safeName);
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }

    const filePath = path.join(skillDir, 'SKILL.md');

    // Crear contenido con frontmatter
    const fullContent = `---
name: ${name}
description: ${description}
command: ${skillCommand}
---

${content}
`;

    fs.writeFileSync(filePath, fullContent);

    const skill: Skill = {
      id: skillId,
      tenantId,
      name,
      command: skillCommand,
      description,
      source: 'custom',
      isEnabled: true,
      isVerified: false,
      isHidden: false,
      filePath,
      content,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    // Invalidar cache
    this.skillsCache.delete(`tenant_${tenantId}`);

    return skill;
  }

  /**
   * Elimina un skill
   */
  deleteSkill(tenantId: string, skillId: string): boolean {
    const skill = this.getSkillById(tenantId, skillId);
    if (!skill) return false;

    if (skill.source === 'official') {
      console.warn('[SkillsManager] Cannot delete official skills');
      return false;
    }

    const skillDir = path.dirname(skill.filePath);
    if (fs.existsSync(skillDir)) {
      fs.rmSync(skillDir, { recursive: true });
    }

    // Invalidar cache
    this.skillsCache.delete(`tenant_${tenantId}`);

    return true;
  }

  /**
   * Escanea un directorio buscando skills
   */
  private scanDirectory(dirPath: string, defaultSource: SkillSource, tenantId: string): Skill[] {
    const skills: Skill[] = [];

    if (!fs.existsSync(dirPath)) {
      return skills;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillMdPath = path.join(dirPath, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillMdPath)) continue;

      try {
        const content = fs.readFileSync(skillMdPath, 'utf-8');
        const frontmatter = this.parseFrontmatter(content);

        const name = frontmatter.name || entry.name;
        const source = defaultSource;
        const id = this.generateId(name, source);
        const safeName = name
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');

        skills.push({
          id,
          tenantId,
          name,
          command: frontmatter.command || `/${safeName}`,
          description: frontmatter.description || '',
          source,
          isEnabled: true,
          isVerified: frontmatter.verified || false,
          isHidden: frontmatter.hidden || false,
          filePath: skillMdPath,
          content,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error(`[SkillsManager] Failed to parse ${skillMdPath}:`, err);
      }
    }

    return skills;
  }

  /**
   * Parsea frontmatter de un skill
   */
  private parseFrontmatter(content: string): SkillFrontmatter {
    try {
      const { data } = matter(content);
      return {
        name: data.name || '',
        description: data.description || '',
        command: data.command,
        verified: data.verified,
        hidden: data.hidden,
      };
    } catch {
      return { name: '', description: '' };
    }
  }

  /**
   * Genera ID único para skill
   */
  private generateId(name: string, source: SkillSource): string {
    const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    return `${source}-${safeName}`;
  }

  /**
   * Sanitiza nombre de skill
   */
  private sanitizeSkillName(name: string): string {
    return name
      .replace(/\.\./g, '')
      .replace(/[/\\]/g, '-')
      .replace(/[^a-zA-Z0-9-_\s]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .trim();
  }

  /**
   * Agrega skill desde archivo
   */
  private addFromFile(tenantId: string, sourcePath: string): Skill | null {
    try {
      const content = fs.readFileSync(sourcePath, 'utf-8');
      const frontmatter = this.validateSkillFrontmatter(content);

      return this.createSkill(
        tenantId,
        frontmatter.name,
        frontmatter.description,
        content,
        frontmatter.command
      );
    } catch (error) {
      console.error('[SkillsManager] Failed to add skill from file:', error);
      return null;
    }
  }

  /**
   * Agrega skill desde URL
   */
  private async addFromUrl(tenantId: string, rawUrl: string): Promise<Skill | null> {
    try {
      const fetchUrl = this.resolveGithubRawUrl(rawUrl);

      console.log('[SkillsManager] Fetching from:', fetchUrl);

      const response = await fetch(fetchUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const content = await response.text();
      const frontmatter = this.validateSkillFrontmatter(content);

      return this.createSkill(
        tenantId,
        frontmatter.name,
        frontmatter.description,
        content,
        frontmatter.command
      );
    } catch (error) {
      console.error('[SkillsManager] Failed to add skill from URL:', error);
      return null;
    }
  }

  /**
   * Resuelve URL de GitHub a raw URL
   */
  private resolveGithubRawUrl(rawUrl: string): string {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw new Error('Invalid URL format');
    }

    const allowedHosts = ['github.com', 'raw.githubusercontent.com'];
    if (!allowedHosts.includes(parsedUrl.hostname)) {
      throw new Error('URL must be from github.com or raw.githubusercontent.com');
    }

    if (parsedUrl.protocol !== 'https:') {
      throw new Error('URL must use HTTPS');
    }

    if (parsedUrl.hostname === 'raw.githubusercontent.com') {
      return rawUrl;
    }

    let fetchUrl = rawUrl;
    if (rawUrl.includes('/tree/')) {
      fetchUrl = rawUrl.replace('github.com', 'raw.githubusercontent.com').replace('/tree/', '/');
      if (!fetchUrl.endsWith('SKILL.md')) {
        fetchUrl = fetchUrl.replace(/\/?$/, '/SKILL.md');
      }
    } else if (rawUrl.includes('/blob/')) {
      fetchUrl = rawUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    } else {
      fetchUrl = rawUrl.replace('github.com', 'raw.githubusercontent.com');
      if (!fetchUrl.endsWith('SKILL.md')) {
        fetchUrl = fetchUrl.replace(/\/?$/, '/SKILL.md');
      }
    }
    return fetchUrl;
  }

  /**
   * Valida frontmatter de skill
   */
  private validateSkillFrontmatter(content: string): SkillFrontmatter & { name: string } {
    const frontmatter = this.parseFrontmatter(content);

    if (!frontmatter.name) {
      throw new Error('SKILL.md must have a name in frontmatter');
    }

    return frontmatter as SkillFrontmatter & { name: string };
  }

  /**
   * Invalida cache de un tenant
   */
  invalidateCache(tenantId: string): void {
    this.skillsCache.delete(`tenant_${tenantId}`);
  }
}

// Singleton
let skillsManagerInstance: SkillsManager | null = null;

export function getSkillsManager(options?: SkillsManagerOptions): SkillsManager {
  if (!skillsManagerInstance && options) {
    skillsManagerInstance = new SkillsManager(options);
  }
  if (!skillsManagerInstance) {
    throw new Error('SkillsManager not initialized. Call createSkillsManager first.');
  }
  return skillsManagerInstance;
}

export function createSkillsManager(options: SkillsManagerOptions): SkillsManager {
  skillsManagerInstance = new SkillsManager(options);
  return skillsManagerInstance;
}
