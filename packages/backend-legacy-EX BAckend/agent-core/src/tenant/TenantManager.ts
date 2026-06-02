/**
 * TenantManager - Gestión de configuración por tenant
 *
 * Cada tenant tiene:
 * - Configuración de agente personalizada
 * - Workspace aislado
 * - Archivo opencode.json propio
 */

import * as fs from 'fs';
import * as path from 'path';

export interface SkillTool {
  name: string;
  description: string;
  category: string;
  dangerous?: boolean;
}

export interface TenantConfig {
  tenantId: string;
  mode: 'FULL' | 'LIMITED';

  // Identidad del agente
  agentName: string;
  agentRole: string;
  agentStyle: string;
  agentLanguage: string;

  // Información del negocio
  businessName: string;
  businessType: string;
  businessDescription: string;
  businessHours: Record<string, string>;
  businessPolicies: Record<string, string>;

  // Conocimiento
  knowledgeBase: Record<string, any>;
  faq: Record<string, string>;

  // Configuración LLM
  provider: string;
  model: string;

  // Tools
  allowedTools: string[];
  blockedTools: string[];

  // Skills dinámicos (opcional, para agentes WhatsApp)
  skills?: SkillTool[];
}

export interface WorkspaceInfo {
  path: string;
  configPath: string;
  exists: boolean;
}

export class TenantManager {
  private baseStoragePath: string;
  private configs: Map<string, TenantConfig> = new Map();

  constructor(baseStoragePath?: string) {
    this.baseStoragePath = baseStoragePath || process.env.AGENTO_STORAGE_PATH || '/storage/tenants';
  }

  /**
   * Obtiene la configuración de un tenant
   */
  async getConfig(tenantId: string): Promise<TenantConfig | null> {
    if (this.configs.has(tenantId)) {
      return this.configs.get(tenantId)!;
    }

    const configPath = this.getConfigPath(tenantId);
    if (!fs.existsSync(configPath)) {
      return null;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    this.configs.set(tenantId, config);
    return config;
  }

  /**
   * Guarda la configuración de un tenant
   */
  async saveConfig(config: TenantConfig): Promise<void> {
    const configPath = this.getConfigPath(config.tenantId);
    const configDir = path.dirname(configPath);

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    this.configs.set(config.tenantId, config);
  }

  /**
   * Obtiene o crea el workspace de un tenant
   */
  async getWorkspace(tenantId: string): Promise<WorkspaceInfo> {
    const workspacePath = this.getWorkspacePath(tenantId);
    const exists = fs.existsSync(workspacePath);

    if (!exists) {
      fs.mkdirSync(workspacePath, { recursive: true });

      // Crear package.json para el workspace
      const packageJson = {
        name: `tenant-${tenantId}-workspace`,
        private: true
      };
      fs.writeFileSync(
        path.join(workspacePath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
    }

    return {
      path: workspacePath,
      configPath: this.getOpenCodeConfigPath(tenantId),
      exists: true
    };
  }

  /**
   * Genera el archivo opencode.json para un tenant
   */
  async generateOpenCodeConfig(tenantId: string): Promise<string> {
    const config = await this.getConfig(tenantId);
    if (!config) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const openCodeConfig = this.buildOpenCodeConfig(config);
    const configPath = this.getOpenCodeConfigPath(tenantId);
    const configDir = path.dirname(configPath);

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(configPath, JSON.stringify(openCodeConfig, null, 2));
    return configPath;
  }

  /**
   * Construye la configuración de OpenCode
   */
  private buildOpenCodeConfig(config: TenantConfig): Record<string, any> {
    const isLimited = config.mode === 'LIMITED';

    return {
      '$schema': 'https://opencode.ai/config.json',
      'model': `${config.provider}/${config.model}`,
      'default_agent': 'agento-agent',

      'agent': {
        'agento-agent': {
          'description': `Agente de ${config.businessName || 'WhatsApp'}`,
          'prompt': this.buildSystemPrompt(config),
          'mode': 'primary'
        }
      },

      'permission': isLimited ? this.getLimitedPermissions() : this.getFullPermissions()
    };
  }

  /**
   * Construye el system prompt
   */
  private buildSystemPrompt(config: TenantConfig): string {
    const parts: string[] = [];

    // Identidad
    parts.push(`<identity>
Eres ${config.agentName || 'Asistente'}, ${config.agentRole || 'Agente de Atención al Cliente'}.
Estilo de comunicación: ${config.agentStyle || 'Profesional y amigable'}.
Idioma: ${config.agentLanguage || 'Español'}.
</identity>`);

    // Negocio
    if (config.businessName) {
      parts.push(`<business>
Nombre: ${config.businessName}
Tipo: ${config.businessType || 'No especificado'}
${config.businessDescription ? `Descripción: ${config.businessDescription}` : ''}
</business>`);
    }

    // Horarios
    if (config.businessHours && Object.keys(config.businessHours).length > 0) {
      parts.push(`<hours>
${Object.entries(config.businessHours).map(([day, time]) => `${day}: ${time}`).join('\n')}
</hours>`);
    }

    // Políticas
    if (config.businessPolicies && Object.keys(config.businessPolicies).length > 0) {
      parts.push(`<policies>
${Object.entries(config.businessPolicies).map(([key, value]) => `- ${key}: ${value}`).join('\n')}
</policies>`);
    }

    // FAQ
    if (config.faq && Object.keys(config.faq).length > 0) {
      parts.push(`<faq>
${Object.entries(config.faq).map(([q, a]) => `P: ${q}\nR: ${a}`).join('\n\n')}
</faq>`);
    }

    // Knowledge base
    if (config.knowledgeBase && Object.keys(config.knowledgeBase).length > 0) {
      parts.push(`<knowledge>
${JSON.stringify(config.knowledgeBase, null, 2)}
</knowledge>`);
    }

    // Reglas según modo
    if (config.mode === 'LIMITED') {
      parts.push(`<rules>
- Responde SOLO basándote en la información proporcionada
- Si no tienes información, dilo honestamente
- Sé conciso (máximo 2-3 párrafos cortos)
- NO puedes ejecutar código ni comandos
- NO puedes modificar archivos
- Si el cliente parece molesto, ofrece conectarlo con un humano
- Usa un tono amigable pero profesional
</rules>`);
    }

    return parts.join('\n\n');
  }

  /**
   * Permisos para modo LIMITADO
   */
  private getLimitedPermissions(): Record<string, any> {
    return {
      '*': 'deny',
      'read': 'allow',
      'glob': 'allow',
      'grep': 'allow',
      'list': 'allow'
    };
  }

  /**
   * Permisos para modo FULL
   */
  private getFullPermissions(): Record<string, any> {
    return {
      '*': 'allow'
    };
  }

  // Paths
  private getTenantPath(tenantId: string): string {
    return path.join(this.baseStoragePath, tenantId);
  }

  private getWorkspacePath(tenantId: string): string {
    return path.join(this.getTenantPath(tenantId), 'workspace');
  }

  private getConfigPath(tenantId: string): string {
    return path.join(this.getTenantPath(tenantId), 'config.json');
  }

  private getOpenCodeConfigPath(tenantId: string): string {
    return path.join(this.getTenantPath(tenantId), 'opencode', 'opencode.json');
  }
}

export const tenantManager = new TenantManager();
