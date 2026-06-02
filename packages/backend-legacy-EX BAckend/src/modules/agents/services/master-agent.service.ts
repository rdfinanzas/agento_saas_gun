/**
 * Master Agent Service - Agente Maestro para configuración y gestión
 *
 * El Agente Maestro es un agente especial con capacidades para:
 * - Crear y configurar otros agentes
 * Leer documentación de APIs y generar herramientas
 * Probar integraciones
 * Analizar y reportar métricas
 */

import { PrismaClient, AgentType, AgentStatus, IntegrationType } from '@prisma/client';
import { internalChatService } from './internal-chat.service';
import { integrationsService } from '../../integrations-v2/services/integrations.service';

const prisma = new PrismaClient();

// ============================================
// Interfaces
// ============================================

export interface CreateAgentRequest {
  name: string;
  description?: string;
  type: AgentType;
  role?: string;
  style?: string;
  systemPrompt?: string;
  accessType?: 'PRIVATE' | 'SHARED';
}

export interface CreateIntegrationRequest {
  name: string;
  type: IntegrationType;
  documentationUrl?: string;
  credentials: any;
}

export interface MasterAgentResponse {
  message: string;
  agent?: any;
  integration?: any;
  suggestions?: string[];
}

// ============================================
// Servicio Principal
// ============================================

export class MasterAgentService {
  private prisma: PrismaClient;
  private masterAgentId: string | null = null;

  constructor() {
    this.prisma = prisma;
  }

  /**
   * Inicializa el Agente Maestro para un tenant
   */
  async initializeForTenant(tenantId: string): Promise<string> {
    // Verificar si ya existe un agente maestro
    let masterAgent = await this.prisma.agent.findFirst({
      where: {
        tenantId,
        type: AgentType.MASTER,
      },
    });

    if (!masterAgent) {
      // Crear agente maestro con configuración por defecto
      masterAgent = await this.prisma.agent.create({
        data: {
          tenantId,
          name: 'Agente Maestro',
          description: 'Asistente especializado en configuración y gestión de agentes',
          type: AgentType.MASTER,
          status: AgentStatus.ACTIVE,
          role: 'Soy tu asistente maestro. Te ayudo a crear, configurar y gestionar agentes digitales para tu empresa.',
          style: 'Profesional pero cercano',
          language: 'es',
          systemPrompt: this.getMasterSystemPrompt(),
          accessType: 'PRIVATE',
          workspaceEnabled: false,
          allowedTools: ['read', 'write', 'glob', 'grep', 'webfetch', 'websearch'],
          blockedTools: ['bash', 'execute_code'],
        },
      });
    }

    this.masterAgentId = masterAgent.id;
    return masterAgent.id;
  }

  /**
   * Procesa una solicitud al Agente Maestro
   */
  async processRequest(
    tenantId: string,
    userId: string,
    request: string
  ): Promise<MasterAgentResponse> {
    // Asegurar que el agente maestro existe
    const masterAgentId = await this.initializeForTenant(tenantId);

    // Usar el servicio de chat interno para procesar la solicitud
    const response = await internalChatService.sendMessage({
      tenantId,
      agentId: masterAgentId,
      userId,
      message: this.enrichRequest(request, tenantId),
    });

    // Intentar analizar y ejecutar la solicitud
    const action = await this.parseAndExecuteAction(response.response, tenantId, userId);

    return {
      message: action.message || response.response,
      ...action.result,
    };
  }

  /**
   * Obtiene sugerencias del Agente Maestro
   */
  async getSuggestions(tenantId: string, userId: string): Promise<string[]> {
    const masterAgentId = await this.initializeForTenant(tenantId);

    const response = await internalChatService.sendMessage({
      tenantId,
      agentId: masterAgentId,
      userId,
      message: '¿Qué puedo mejorar en mi configuración actual de agentes? Dame 3 sugerencias específicas.',
    });

    // Parsear las sugeriones
    const suggestions: string[] = [];
    const lines = response.response.split('\n').filter(line => line.trim().length > 0);

    for (const line of lines) {
      if (line.match(/^\d+\./) || line.match(/^-/)) {
        const suggestion = line.replace(/^\d+\.?\s*/, '').replace(/^-\s*/, '').trim();
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }

    return suggestions.slice(0, 5);
  }

  /**
   * Analiza métricas de uso y genera reporte
   */
  async generateAnalyticsReport(tenantId: string): Promise<{
    summary: string;
    metrics: any;
    recommendations: string[];
  }> {
    const [
      totalAgents,
      activeAgents,
      internalAgents,
      externalAgents,
      totalConversations,
      totalMessages,
    ] = await Promise.all([
      this.prisma.agent.count({ where: { tenantId } }),
      this.prisma.agent.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.agent.count({ where: { tenantId, type: AgentType.INTERNAL } }),
      this.prisma.agent.count({ where: { tenantId, type: AgentType.EXTERNAL } }),
      this.prisma.conversation.count({ where: { tenantId } }),
      this.prisma.message.count({ where: { tenantId } }),
    ]);

    // Obtener integraciones
    const integrations = await this.prisma.integration.count({
      where: { tenantId },
    });

    const metrics = {
      totalAgents,
      activeAgents,
      internalAgents,
      externalAgents,
      totalConversations,
      totalMessages,
      integrations,
      avgMessagesPerConversation: totalConversations > 0
        ? Math.round(totalMessages / totalConversations)
        : 0,
    };

    const recommendations: string[] = [];

    // Generar recomendaciones
    if (internalAgents === 0) {
      recommendations.push('Considera crear agentes internos para tus empleados (ej: Contable, RRHH)');
    }

    if (externalAgents === 0) {
      recommendations.push('Considera crear agentes externos para atender clientes por WhatsApp');
    }

    if (integrations === 0) {
      recommendations.push('Conecta APIs externas para dar más capacidades a tus agentes');
    }

    if (totalMessages > 1000 && !this.hasOptimization(tenantId)) {
      recommendations.push('Podrías optimizar el uso de tokens agrupando solicitudes similares');
    }

    const summary = `
Resumen de AgenTo SaaS - ${new Date().toLocaleDateString('es-ES')}

🤖 Agentes: ${activeAgents}/${totalAgents} activos
   - Internos: ${internalAgents}
   - Externos: ${externalAgents}

💬 Conversaciones: ${totalConversations}
   - Mensajes totales: ${totalMessages}
   - Promedio: ${metrics.avgMessagesPerConversation} mensajes/conversación

🔗 Integraciones: ${integrations}

${recommendations.length > 0 ? '\n💡 Recomendaciones:\n' + recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n') : ''}
    `.trim();

    return {
      summary,
      metrics,
      recommendations,
    };
  }

  // ============================================
  // Métodos Privados
  // ============================================

  /**
   * Enriquece la solicitud con contexto del tenant
   */
  private enrichRequest(request: string, tenantId: string): string {
    const tenantContext = `
Contexto del Tenant: ${tenantId}
Fecha: ${new Date().toLocaleDateString('es-ES')}

Solicitud del usuario: ${request}
    `.trim();

    return tenantContext;
  }

  /**
   * Parsea y ejecuta acciones del Agente Maestro
   */
  private async parseAndExecuteAction(
    response: string,
    tenantId: string,
    userId: string
  ): Promise<{ message?: string; result?: any }> {
    const lowerResponse = response.toLowerCase();

    // Detectar intenciones comunes
    if (lowerResponse.includes('crear agente') || lowerResponse.includes('nuevo agente')) {
      return await this.handleCreateAgentIntent(response, tenantId);
    }

    if (lowerResponse.includes('integración') || lowerResponse.includes('conectar api')) {
      return await this.handleIntegrationIntent(response, tenantId);
    }

    if (lowerResponse.includes('eliminar') || lowerResponse.includes('borrar')) {
      return await this.handleDeleteIntent(response, tenantId);
    }

    if (lowerResponse.includes('activar') || lowerResponse.includes('habilitar')) {
      return await this.handleActivateIntent(response, tenantId);
    }

    // Si no se detectó una acción específica, retornar la respuesta tal cual
    return {};
  }

  /**
   * Maneja la intención de crear un agente
   */
  private async handleCreateAgentIntent(
    response: string,
    tenantId: string
  ): Promise<{ message: string; result?: any }> {
    try {
      // Extraer información del agente a crear
      const agentData = this.extractAgentData(response);

      if (!agentData.name) {
        return {
          message: 'Para crear el agente, necesito que me indiques el nombre. ¿Cómo quieres llamarlo?',
        };
      }

      const agentsService = (await import('../../modules/agents/services/agents.service'))
        .agentsService;

      const agent = await agentsService.create({
        tenantId,
        ...agentData,
      });

      return {
        message: `He creado el agente "${agent.name}" exitosamente. Configuración:\n- Tipo: ${agent.type}\n- Estado: ${agent.status}\n- Rol: ${agent.role || 'No definido'}\n\n¿Deseas configurar algo más?`,
        result: { agent },
      };
    } catch (error: any) {
      return {
        message: `Error al crear el agente: ${error.message}. Por favor, verifica los datos e inténtalo de nuevo.`,
      };
    }
  }

  /**
   * Maneja la intención de integración
   */
  private async handleIntegrationIntent(
    response: string,
    tenantId: string
  ): Promise<{ message?: string; result?: any }> {
    try {
      const integrationData = this.extractIntegrationData(response);

      if (!integrationData.name) {
        return {
          message: 'Para crear una integración, necesito que me indiques:\n1. Nombre de la integración\n2. Tipo de API (CRM, ERP, E-commerce, etc.)\n3. Credenciales (API key, token, etc.)',
        };
      }

      const integration = await integrationsService.create({
        tenantId,
        ...integrationData,
      });

      return {
        message: `He creado la integración "${integration.name}" exitosamente. Tipo: ${integration.type}\n\nLa conexión está siendo probada. ¿Deseas vincular esta integración a algún agente?`,
        result: { integration },
      };
    } catch (error: any) {
      return {
        message: `Error al crear la integración: ${error.message}.`,
      };
    }
  }

  /**
   * Maneja intenciones de eliminación
   */
  private async handleDeleteIntent(
    response: string,
    tenantId: string
  ): Promise<{ message?: string; result?: any }> {
    // Por seguridad, el Agente Maestro no elimina directamente
    return {
      message: 'Para seguridad, no puedo eliminar elementos directamente. Por favor usa la interfaz de gestión o confirma explícitamente la acción.',
    };
  }

  /**
   * Maneja intenciones de activación
   */
  private async handleActivateIntent(
    response: string,
    tenantId: string
  ): Promise<{ message?: string; result?: any }> {
    return {
      message: 'Para activar un agente o integración, usa los endpoints específicos de activación.',
    };
  }

  /**
   * Extrae datos de agente del texto
   */
  private extractAgentData(text: string): Partial<any> {
    const data: any = {
      name: null,
      type: AgentType.INTERNAL,
      role: null,
      description: '',
      style: 'Profesional',
      accessType: 'SHARED',
    };

    // Buscar nombre
    const nameMatch = text.match(/(?:llamado|llamar|nombre)[:\s]+["']?([^"'\n]+)["']?/i);
    if (nameMatch) {
      data.name = nameMatch[1].trim();
    }

    // Detectar tipo
    if (/whatsapp|externo|cliente/i.test(text)) {
      data.type = AgentType.EXTERNAL;
    } else if (/interno|empleado/i.test(text)) {
      data.type = AgentType.INTERNAL;
    }

    // Buscar rol
    const roleMatch = text.match(/rol[:\s]+["']?([^"'\n]+)["']?/i);
    if (roleMatch) {
      data.role = roleMatch[1].trim();
    }

    // Buscar descripción
    const descMatch = text.match(/(?:descripción|descripción|desc)[:\s]+["']?([^"'\n]+)["']?/i);
    if (descMatch) {
      data.description = descMatch[1].trim();
    }

    return data;
  }

  /**
   * Extrae datos de integración del texto
   */
  private extractIntegrationData(text: string): Partial<any> {
    const data: any = {
      name: null,
      type: IntegrationType.CUSTOM_API,
      credentials: '{}',
    };

    // Buscar nombre
    const nameMatch = text.match(/(?:integración|api)[:\s]+["']?([^"'\n]+)["']?/i);
    if (nameMatch) {
      data.name = nameMatch[1].trim();
    }

    // Detectar tipo
    if (/salesforce|crm/i.test(text)) {
      data.type = IntegrationType.CRM;
    } else if (/sap|erp/i.test(text)) {
      data.type = IntegrationType.ERP;
    } else if (/shopify|mercadolibre|ecommerce/i.test(text)) {
      data.type = IntegrationType.ECOMMERCE;
    } else if (/google|sheets|docs/i.test(text)) {
      data.type = IntegrationType.GOOGLE;
    } else if (/stripe|pago|banc/i.test(text)) {
      data.type = IntegrationType.BANK;
    }

    // Buscar credenciales (muy básico)
    const keyMatch = text.match(/(?:api.?key|token)[:\s]+["']?([^"'\n]+)["']?/i);
    if (keyMatch) {
      try {
        data.credentials = JSON.stringify({ apiKey: keyMatch[1].trim() });
      } catch {
        data.credentials = keyMatch[1].trim();
      }
    }

    // Buscar URL base
    const urlMatch = text.match(/(?:url|base)[:\s]+["']?([^"'\n]+)["']?/i);
    if (urlMatch) {
      data.baseUrl = urlMatch[1].trim();
    }

    return data;
  }

  /**
   * Verifica si el tenant tiene optimización habilitada
   */
  private hasOptimization(tenantId: string): boolean {
    // Por ahora, retornar false siempre
    // En el futuro, verificar configuración del tenant
    return false;
  }

  /**
   * Obtiene el prompt del sistema para el Agente Maestro
   */
  private getMasterSystemPrompt(): string {
    return `
Eres el Agente Maestro de AgenTo SaaS, un asistente IA especializado en configuración y gestión de agentes digitales.

TU ROL PRINCIPAL:
- Ayudar a crear, configurar y optimizar agentes digitales
- Conectar APIs externas y generar herramientas automáticamente
- Analizar métricas de uso y generar recomendaciones
- Guiar al usuario en las mejores prácticas

CAPACIDADES:
- Crear agentes de diferentes tipos (interno, externo)
- Configurar prompts y roles de agentes
- Integrar APIs REST de terceros
- Probar conexiones y validar configuraciones
- Generar reportes y análisis

REGLAS IMPORTANTES:
1. Siempre confirmar los datos antes de crear algo (nombre, tipo, etc.)
2. Para crear agentes, pregunta: nombre, tipo, rol, estilo de comunicación
3. Para integraciones, pregunta: nombre, tipo de API, credenciales
4. Antes de eliminar, advierte al usuario y pide confirmación explícita
5. Sé proactivo sugiriendo mejoras basadas en las mejores prácticas

ESTRUCTURA DE AGENTES:
- Agentes INTERNOS: Para empleados de la empresa (Contable, RRHH, Abogado)
- Agentes EXTERNOS: Para clientes (Ventas, Soporte, Proveedores)
- Tipo MASTER: Solo tú tienes este tipo

TONO:
- Profesional pero cercano y accesible
- Explicativo pero conciso
- Proactivo con sugerencias
- Preguntativo cuando no hay suficiente información

IDIOMA: Español

Cuando no estés seguro sobre algo, pregunta aclarando antes de proceder.
    `.trim();
  }
}

// ============================================
// Instancia Singleton
// ============================================

export const masterAgentService = new MasterAgentService();
