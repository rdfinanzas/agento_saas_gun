/**
 * Master Agent V2 Service - Capacidades Avanzadas
 *
 * Fase 5: Maestro Completo
 * - Lectura de documentación API (OpenAPI/Swagger)
 * - Creación automática de integraciones
 * - Recomendaciones inteligentes
 */

import { PrismaClient, AgentType, IntegrationType } from '@prisma/client';
import { internalChatService } from './internal-chat.service';
import { integrationsService } from '../../integrations-v2/services/integrations.service';

const prisma = new PrismaClient();

// ============================================
// Interfaces
// ============================================

export interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, any>;
  components?: {
    securitySchemes?: Record<string, any>;
    schemas?: Record<string, any>;
  };
}

export interface APIAnalysis {
  apiName: string;
  baseUrl: string;
  version: string;
  endpoints: Array<{
    path: string;
    method: string;
    summary?: string;
    description?: string;
    parameters?: any[];
    responses?: any;
  }>;
  authType: 'none' | 'apiKey' | 'bearer' | 'oauth2' | 'basic';
  authConfig?: any;
}

export interface IntegrationRecommendation {
  type: IntegrationType;
  name: string;
  description: string;
  confidence: number; // 0-1
  reasons: string[];
  estimatedSetupTime: string; // "5-10 min"
}

export interface SmartRecommendations {
  agents: Array<{
    name: string;
    type: AgentType;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  integrations: IntegrationRecommendation[];
  optimizations: Array<{
    area: string;
    current: string;
    suggested: string;
    impact: string;
  }>;
}

// ============================================
// Servicio Principal
// ============================================

export class MasterAgentV2Service {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = prisma;
  }

  /**
   * Analiza una especificación OpenAPI/Swagger
   */
  async analyzeOpenAPISpec(
    specUrlOrContent: string,
    isUrl: boolean = true
  ): Promise<APIAnalysis> {
    let spec: OpenAPISpec;

    if (isUrl) {
      // Obtener spec desde URL
      const response = await fetch(specUrlOrContent);
      if (!response.ok) {
        throw new Error(`Failed to fetch OpenAPI spec: ${response.statusText}`);
      }
      spec = await response.json();
    } else {
      // Parsear contenido JSON
      spec = JSON.parse(specUrlOrContent);
    }

    // Analizar endpoints
    const endpoints: any[] = [];
    const authTypes = new Set<string>();

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem as any)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
          const op = operation as any;

          endpoints.push({
            path,
            method: method.toUpperCase(),
            summary: op.summary || op.description || '',
            description: op.description || '',
            parameters: op.parameters || [],
            responses: op.responses || {},
          });

          // Detectar tipos de autenticación
          if (op.security) {
            for (const sec of op.security) {
              Object.keys(sec).forEach(key => authTypes.add(key));
            }
          }
        }
      }
    }

    // Determinar tipo de autenticación
    let authType: APIAnalysis['authType'] = 'none';
    let authConfig: any;

    if (spec.components?.securitySchemes) {
      const schemes = spec.components.securitySchemes;
      const schemeKeys = Object.keys(schemes);

      if (schemeKeys.length > 0) {
        const firstScheme = schemes[schemeKeys[0]];
        const schemeType = firstScheme.type?.toLowerCase() || firstScheme.in?.toLowerCase();

        if (schemeType === 'http' && firstScheme.scheme === 'bearer') {
          authType = 'bearer';
          authConfig = { bearerFormat: firstScheme.bearerFormat || 'JWT' };
        } else if (schemeType === 'http' && firstScheme.scheme === 'basic') {
          authType = 'basic';
        } else if (schemeType === 'apikey') {
          authType = 'apiKey';
          authConfig = {
            in: firstScheme.in || 'header',
            name: firstScheme.name || 'X-API-Key',
          };
        } else if (schemeType === 'oauth2') {
          authType = 'oauth2';
          authConfig = { flows: firstScheme.flows };
        }
      }
    }

    // Obtener base URL
    const baseUrl = spec.servers?.[0]?.url || specUrlOrContent;

    return {
      apiName: spec.info.title,
      baseUrl,
      version: spec.info.version,
      endpoints,
      authType,
      authConfig,
    };
  }

  /**
   * Crea una integración automáticamente desde una spec OpenAPI
   */
  async createIntegrationFromSpec(
    tenantId: string,
    specUrlOrContent: string,
    isUrl: boolean = true,
    credentials?: any
  ): Promise<{ integration: any; analysis: APIAnalysis }> {
    // Analizar la especificación
    const analysis = await this.analyzeOpenAPISpec(specUrlOrContent, isUrl);

    // Determinar tipo de integración
    const integrationType = this.detectIntegrationType(analysis);

    // Preparar credenciales si no se proporcionaron
    const finalCredentials = credentials || this.getDefaultCredentials(analysis.authType);

    // Crear la integración
    const integration = await integrationsService.create({
      tenantId,
      name: analysis.apiName,
      type: integrationType,
      credentials: JSON.stringify(finalCredentials),
      baseUrl: analysis.baseUrl,
    });

    return { integration, analysis };
  }

  /**
   * Genera recomendaciones inteligentes para un tenant
   */
  async generateSmartRecommendations(tenantId: string): Promise<SmartRecommendations> {
    // Obtener datos actuales del tenant
    const [
      agents,
      integrations,
      conversations,
      messages,
    ] = await Promise.all([
      this.prisma.agent.findMany({ where: { tenantId } }),
      this.prisma.integration.findMany({ where: { tenantId } }),
      this.prisma.conversation.findMany({
        where: { tenantId },
        include: { messages: true },
      }),
      this.prisma.message.findMany({
        where: { conversation: { tenantId } },
      }),
    ]);

    const recommendations: SmartRecommendations = {
      agents: [],
      integrations: [],
      optimizations: [],
    };

    // ============================================
    // Recomendaciones de Agentes
    // ============================================

    const hasInternalAgents = agents.some(a => a.type === AgentType.INTERNAL);
    const hasExternalAgents = agents.some(a => a.type === AgentType.EXTERNAL);

    if (!hasInternalAgents) {
      recommendations.agents.push({
        name: 'Contable',
        type: AgentType.INTERNAL,
        reason: 'No tienes agentes internos. Un agente contable puede ayudarte a gestionar facturas, impuestos y reportes financieros.',
        priority: 'high',
      });
    }

    if (!hasExternalAgents) {
      recommendations.agents.push({
        name: 'Ventas',
        type: AgentType.EXTERNAL,
        reason: 'No tienes agentes externos. Un agente de ventas puede atender clientes por WhatsApp 24/7.',
        priority: 'high',
      });
    }

    if (agents.length >= 3 && !agents.some(a => a.type === AgentType.MASTER)) {
      recommendations.agents.push({
        name: 'Agente Maestro',
        type: AgentType.MASTER,
        reason: 'Tienes varios agentes pero no un Agente Maestro para coordinarlos.',
        priority: 'medium',
      });
    }

    // ============================================
    // Recomendaciones de Integraciones
    // ============================================

    const integrationTypes = new Set(integrations.map(i => i.type));

    if (!integrationTypes.has(IntegrationType.CRM)) {
      recommendations.integrations.push({
        type: IntegrationType.CRM,
        name: 'Salesforce',
        description: 'Gestión de relaciones con clientes',
        confidence: 0.8,
        reasons: [
          'Mejora el seguimiento de leads',
          'Centraliza la información de clientes',
          'Automatiza el proceso de ventas',
        ],
        estimatedSetupTime: '15-20 min',
      });
    }

    if (!integrationTypes.has(IntegrationType.GOOGLE)) {
      recommendations.integrations.push({
        type: IntegrationType.GOOGLE,
        name: 'Google Sheets',
        description: 'Hojas de cálculo colaborativas',
        confidence: 0.9,
        reasons: [
          'Fácil de configurar',
          'Ideal para almacenar datos de conversaciones',
          'Los agentes pueden leer/escribir directamente',
        ],
        estimatedSetupTime: '5-10 min',
      });
    }

    if (agents.some(a => a.name.toLowerCase().includes('contable')) &&
        !integrationTypes.has(IntegrationType.ACCOUNTING)) {
      recommendations.integrations.push({
        type: IntegrationType.ACCOUNTING,
        name: 'QuickBooks',
        description: 'Software contable',
        confidence: 0.7,
        reasons: [
          'Ya tienes un agente contable',
          'Automatiza la creación de facturas',
          'Sincroniza con tus cuentas bancarias',
        ],
        estimatedSetupTime: '20-30 min',
      });
    }

    // ============================================
    // Recomendaciones de Optimización
    // ============================================

    // Analizar tiempos de respuesta
    if (conversations.length > 10) {
      const avgMessages = conversations.reduce((sum, c) => sum + c.messageCount, 0) / conversations.length;

      if (avgMessages > 20) {
        recommendations.optimizations.push({
          area: 'Eficiencia de conversaciones',
          current: `${avgMessages.toFixed(1)} mensajes promedio por conversación`,
          suggested: 'Implementar respuestas rápidas y templates',
          impact: 'Reducción del 30-40% en mensajes intercambiados',
        });
      }
    }

    // Detectar agentes sin uso
    const unusedAgents = agents.filter(a =>
      !conversations.some(c => c.agentId === a.id)
    );

    if (unusedAgents.length > 0) {
      recommendations.optimizations.push({
        area: 'Uso de agentes',
        current: `${unusedAgents.length} agentes sin conversaciones`,
        suggested: 'Archivar agentes no utilizados o vincularlos a un canal',
        impact: 'Mejora la organización y reduce costos',
      });
    }

    // Detectar falta de knowledge base
    const agentsWithoutKB = agents.filter(a => a.systemPrompt === null || a.systemPrompt === undefined);

    if (agentsWithoutKB.length > 2) {
      recommendations.optimizations.push({
        area: 'Knowledge Base',
        current: `${agentsWithoutKB.length} agentes sin system prompt`,
        suggested: 'Configurar system prompts específicos para cada agente',
        impact: 'Mejora la calidad y precisión de las respuestas',
      });
    }

    return recommendations;
  }

  /**
   * Chat mejorado con capacidad de análisis
   */
  async enhancedChat(
    tenantId: string,
    userId: string,
    message: string
  ): Promise<{ response: string; actions?: any[] }> {
    const lowerMessage = message.toLowerCase();

    // Detectar intenciones especiales
    if (lowerMessage.includes('openapi') || lowerMessage.includes('swagger')) {
      return await this.handleOpenAPIRequest(tenantId, message);
    }

    if (lowerMessage.includes('recomendar') || lowerMessage.includes('sugerencias') ||
        lowerMessage.includes('mejorar')) {
      const recommendations = await this.generateSmartRecommendations(tenantId);
      return {
        response: this.formatRecommendations(recommendations),
        actions: [
          { type: 'recommendations', data: recommendations },
        ],
      };
    }

    if (lowerMessage.includes('analizar') && lowerMessage.includes('api')) {
      return {
        response: 'Para analizar una API, necesito que me proporciones:\n' +
                  '1. La URL de la especificación OpenAPI/Swagger, o\n' +
                  '2. El contenido JSON de la especificación\n\n' +
                  'También necesitaré las credenciales si la API requiere autenticación.',
      };
    }

    // Usar el chat normal del Master Agent
    const masterAgentId = await this.ensureMasterAgent(tenantId);
    const response = await internalChatService.sendMessage({
      tenantId,
      agentId: masterAgentId,
      userId,
      message,
    });

    return { response: response.response };
  }

  // ============================================
  // Métodos Privados
  // ============================================

  /**
   * Asegura que exista un agente maestro para el tenant
   */
  private async ensureMasterAgent(tenantId: string): Promise<string> {
    let masterAgent = await this.prisma.agent.findFirst({
      where: {
        tenantId,
        type: AgentType.MASTER,
      },
    });

    if (!masterAgent) {
      masterAgent = await this.prisma.agent.create({
        data: {
          tenantId,
          name: 'Agente Maestro',
          description: 'Asistente especializado en configuración y gestión de agentes',
          type: AgentType.MASTER,
          status: 'ACTIVE',
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

    return masterAgent.id;
  }

  /**
   * Maneja solicitudes relacionadas con OpenAPI
   */
  private async handleOpenAPIRequest(
    tenantId: string,
    message: string
  ): Promise<{ response: string; suggestedActions?: string[] }> {
    // Extraer URL si existe
    const urlMatch = message.match(/https?:\/\/[^\s]+/);

    if (urlMatch) {
      try {
        const { integration, analysis } = await this.createIntegrationFromSpec(
          tenantId,
          urlMatch[0],
          true
        );

        return {
          response: `He analizado la API "${analysis.apiName}" (v${analysis.version}).\n\n` +
                    `📊 **Estadísticas:**\n` +
                    `- Base URL: ${analysis.baseUrl}\n` +
                    `- Endpoints encontrados: ${analysis.endpoints.length}\n` +
                    `- Tipo de autenticación: ${analysis.authType}\n\n` +
                    `✅ He creado la integración "${integration.name}" (${integration.type}).\n\n` +
                    `**Endpoints disponibles:**\n` +
                    analysis.endpoints.slice(0, 5).map(e => `- ${e.method} ${e.path}`).join('\n') +
                    (analysis.endpoints.length > 5 ? `\n- ... y ${analysis.endpoints.length - 5} más` : '') +
                    `\n\n**Siguientes pasos:**\n` +
                    `1. Configura las credenciales si la API requiere autenticación\n` +
                    `2. Vincula esta integración a un agente\n` +
                    `3. Prueba la conexión con el endpoint de prueba`,
          suggestedActions: [
            `Configurar credenciales para ${integration.name}`,
            `Vincular a un agente`,
            `Probar conexión`,
          ],
        };
      } catch (error: any) {
        return {
          response: `Error al analizar la API: ${error.message}\n\n` +
                    `Asegúrate de que:\n` +
                    `- La URL sea accesible públicamente\n` +
                    `- El formato sea OpenAPI 3.0 o Swagger 2.0\n` +
                    `- El JSON sea válido`,
        };
      }
    }

    return {
      response: 'Para crear una integración desde una especificación OpenAPI:\n\n' +
                'Proporciona la URL de la documentación. Por ejemplo:\n' +
                '- https://api.example.com/openapi.json\n' +
                '- https://api.example.com/swagger.json\n\n' +
                'O pega el contenido JSON directamente.',
    };
  }

  /**
   * Detecta el tipo de integración basado en el análisis
   */
  private detectIntegrationType(analysis: APIAnalysis): IntegrationType {
    const name = analysis.apiName.toLowerCase();
    const endpoints = analysis.endpoints.map(e => e.path.toLowerCase()).join(' ');

    if (name.includes('salesforce') || name.includes('hubspot') ||
        endpoints.includes('/customers') || endpoints.includes('/leads')) {
      return IntegrationType.CRM;
    }

    if (name.includes('stripe') || name.includes('paypal') ||
        endpoints.includes('/payments') || endpoints.includes('/charges')) {
      return IntegrationType.BANK;
    }

    if (name.includes('shopify') || name.includes('woocommerce') ||
        name.includes('mercadolibre') || name.includes('amazon')) {
      return IntegrationType.ECOMMERCE;
    }

    if (name.includes('sap') || name.includes('oracle')) {
      return IntegrationType.ERP;
    }

    if (name.includes('sheets') || name.includes('drive') || name.includes('google')) {
      return IntegrationType.GOOGLE;
    }

    return IntegrationType.CUSTOM_API;
  }

  /**
   * Obtiene credenciales por defecto según el tipo de auth
   */
  private getDefaultCredentials(authType: APIAnalysis['authType']): any {
    switch (authType) {
      case 'apiKey':
        return { apiKey: '' };
      case 'bearer':
        return { accessToken: '' };
      case 'basic':
        return { username: '', password: '' };
      case 'oauth2':
        return { clientId: '', clientSecret: '' };
      default:
        return {};
    }
  }

  /**
   * Formatea las recomendaciones para mostrarlas
   */
  private formatRecommendations(recs: SmartRecommendations): string {
    let response = '📋 **Recomendaciones para tu tenant**\n\n';

    // Agentes
    if (recs.agents.length > 0) {
      response += '🤖 **Agentes sugeridos:**\n';
      recs.agents.forEach((agent, i) => {
        const priorityIcon = agent.priority === 'high' ? '🔴' : agent.priority === 'medium' ? '🟡' : '🟢';
        response += `${i + 1}. ${priorityIcon} **${agent.name}** (${agent.type})\n`;
        response += `   ${agent.reason}\n`;
      });
      response += '\n';
    }

    // Integraciones
    if (recs.integrations.length > 0) {
      response += '🔗 **Integraciones sugeridas:**\n';
      recs.integrations.forEach((integration, i) => {
        response += `${i + 1}. **${integration.name}** - ${integration.description}\n`;
        response += `   ✅ ${integration.reasons.join(' | ')}\n`;
        response += `   ⏱️ Tiempo estimado: ${integration.estimatedSetupTime}\n`;
      });
      response += '\n';
    }

    // Optimizaciones
    if (recs.optimizations.length > 0) {
      response += '⚡ **Optimizaciones sugeridas:**\n';
      recs.optimizations.forEach((opt, i) => {
        response += `${i + 1}. **${opt.area}**\n`;
        response += `   Actual: ${opt.current}\n`;
        response += `   Sugerencia: ${opt.suggested}\n`;
        response += `   Impacto: ${opt.impact}\n`;
      });
    }

    return response;
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
- Analizar documentación de APIs (OpenAPI/Swagger)
- Probar conexiones y validar configuraciones
- Generar reportes y análisis
- Proporcionar recomendaciones inteligentes

CAPACIDADES ESPECIALES:
- Puedo leer y analizar especificaciones OpenAPI/Swagger
- Creo integraciones automáticamente desde documentación de APIs
- Genero recomendaciones basadas en el análisis de uso
- Detecto oportunidades de optimización

REGLAS IMPORTANTES:
1. Siempre confirmar los datos antes de crear algo
2. Ser específico en las recomendaciones
3. Explicar el impacto de cada cambio sugerido
4. Proactivo en sugerir mejoras

ESTRUCTURA DE AGENTES:
- Agentes INTERNOS: Para empleados (Contable, RRHH, Abogado)
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

export const masterAgentV2Service = new MasterAgentV2Service();
