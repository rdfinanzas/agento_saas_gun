/**
 * Config Generator - Genera configuración de OpenCode por tenant
 *
 * Crea el archivo opencode.json con:
 * - System prompt personalizado
 * - Agentes definidos
 * - Permisos según modo
 */

import * as fs from 'fs';
import * as path from 'path';

export interface OpenCodeConfig {
  model?: string;
  provider?: string;
  agent?: Record<string, AgentConfig>;
  permission?: Record<string, 'allow' | 'deny' | 'ask'>;
  mcpServers?: Record<string, McpServerConfig>;
}

export interface AgentConfig {
  prompt: string;
  description?: string;
  tools?: string[];
}

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface TenantConfigInput {
  tenantId: string;
  mode: 'FULL' | 'LIMITED';
  agentName: string;
  agentRole: string;
  agentStyle: string;
  agentLanguage: string;
  businessName: string;
  businessType?: string;
  businessDescription?: string;
  businessHours?: Record<string, string>;
  businessPolicies?: Record<string, string>;
  knowledgeBase?: Record<string, any>;
  faq?: Record<string, string>;
  provider?: string;
  model?: string;
  allowedTools?: string[];
  blockedTools?: string[];
}

/**
 * Genera la configuración de OpenCode para un tenant
 */
export function generateOpenCodeConfig(input: TenantConfigInput): OpenCodeConfig {
  const systemPrompt = buildSystemPrompt(input);
  const permissions = buildPermissions(input.mode, input.allowedTools, input.blockedTools);

  const config: OpenCodeConfig = {
    model: input.model || 'claude-sonnet-4-20250514',
    provider: input.provider || 'anthropic',
    agent: {
      'agento-agent': {
        prompt: systemPrompt,
        description: `Agente de WhatsApp para ${input.businessName}`,
        tools: input.mode === 'LIMITED'
          ? ['read', 'glob', 'grep', 'list']
          : ['bash', 'read', 'write', 'edit', 'glob', 'grep', 'list', 'webfetch', 'websearch'],
      },
    },
    permission: permissions,
  };

  return config;
}

/**
 * Construye el system prompt
 */
function buildSystemPrompt(input: TenantConfigInput): string {
  const parts: string[] = [];

  // Identidad
  parts.push(`<identity>
Eres ${input.agentName}, ${input.agentRole}.
Estilo de comunicación: ${input.agentStyle}.
Idioma: ${input.agentLanguage}.
</identity>`);

  // Negocio
  if (input.businessName) {
    parts.push(`<business>
Nombre: ${input.businessName}
Tipo: ${input.businessType || 'No especificado'}
${input.businessDescription ? `Descripción: ${input.businessDescription}` : ''}
</business>`);
  }

  // Horarios
  if (input.businessHours && Object.keys(input.businessHours).length > 0) {
    parts.push(`<hours>
${Object.entries(input.businessHours).map(([day, time]) => `${day}: ${time}`).join('\n')}
</hours>`);
  }

  // Políticas
  if (input.businessPolicies && Object.keys(input.businessPolicies).length > 0) {
    parts.push(`<policies>
${Object.entries(input.businessPolicies).map(([key, value]) => `- ${key}: ${value}`).join('\n')}
</policies>`);
  }

  // FAQ
  if (input.faq && Object.keys(input.faq).length > 0) {
    parts.push(`<faq>
${Object.entries(input.faq).map(([q, a]) => `P: ${q}\nR: ${a}`).join('\n\n')}
</faq>`);
  }

  // Knowledge base
  if (input.knowledgeBase && Object.keys(input.knowledgeBase).length > 0) {
    parts.push(`<knowledge>
${JSON.stringify(input.knowledgeBase, null, 2)}
</knowledge>`);
  }

  // Reglas según modo
  if (input.mode === 'LIMITED') {
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
 * Construye los permisos según el modo
 */
function buildPermissions(
  mode: 'FULL' | 'LIMITED',
  allowedTools?: string[],
  blockedTools?: string[]
): Record<string, 'allow' | 'deny' | 'ask'> {
  const permissions: Record<string, 'allow' | 'deny' | 'ask'> = {};

  if (mode === 'LIMITED') {
    // Por defecto denegar todo
    permissions['*'] = 'deny';

    // Permitir tools de solo lectura
    const defaultAllowed = ['read', 'glob', 'grep', 'list', 'todoread'];
    const allowed = allowedTools || defaultAllowed;

    for (const tool of allowed) {
      permissions[tool] = 'allow';
    }

    // Bloquear explícitamente tools peligrosas
    const defaultBlocked = ['bash', 'write', 'edit', 'task', 'todowrite'];
    const blocked = blockedTools || defaultBlocked;

    for (const tool of blocked) {
      permissions[tool] = 'deny';
    }
  } else {
    // Modo FULL: permitir todo por defecto
    permissions['*'] = 'allow';

    // Pero denegar explícitamente las bloqueadas
    if (blockedTools) {
      for (const tool of blockedTools) {
        permissions[tool] = 'deny';
      }
    }
  }

  return permissions;
}

/**
 * Guarda la configuración en un archivo
 */
export function saveOpenCodeConfig(
  config: OpenCodeConfig,
  configPath: string
): void {
  // Asegurar que el directorio existe
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Guardar configuración
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Carga la configuración desde un archivo
 */
export function loadOpenCodeConfig(configPath: string): OpenCodeConfig | null {
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Genera y guarda la configuración para un tenant
 */
export function generateAndSaveConfig(
  input: TenantConfigInput,
  configDir: string
): string {
  const config = generateOpenCodeConfig(input);
  const configPath = path.join(configDir, 'opencode.json');
  saveOpenCodeConfig(config, configPath);
  return configPath;
}
