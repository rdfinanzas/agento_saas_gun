/**
 * Integrations Service - Gestión de Integraciones con APIs externas
 *
 * Permite a los tenants conectar APIs externas (CRM, ERP, E-commerce, etc.)
 * y generar tools dinámicamente para que los agentes puedan usarlas.
 */

import { PrismaClient, IntegrationType, IntegrationStatus } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// ============================================
// Interfaces
// ============================================

export interface CreateIntegrationInput {
  tenantId: string;
  name: string;
  type: IntegrationType;
  credentials: string; // JSON encriptado
  baseUrl?: string;
  webhookUrl?: string;
}

export interface UpdateIntegrationInput {
  name?: string;
  status?: IntegrationStatus;
  credentials?: string;
  baseUrl?: string;
  webhookUrl?: string;
}

export interface IntegrationConfig {
  tenantId: string;
  integrationId: string;
  name: string;
  type: IntegrationType;
  credentials: Record<string, any>;
  baseUrl?: string;
  webhookUrl?: string;
}

export interface GeneratedTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  endpoint: string;
  method: string;
  headers?: Record<string, string>;
}

// ============================================
// Servicio Principal
// ============================================

export class IntegrationsService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = prisma;
  }

  /**
   * Crea una nueva integración
   */
  async create(data: CreateIntegrationInput): Promise<any> {
    const { tenantId, credentials, ...integrationData } = data;

    // Validar credenciales según el tipo
    const parsedCredentials = this.validateAndParseCredentials(
      data.type,
      credentials
    );

    // Encriptar credenciales antes de guardar
    const encryptedCredentials = this.encryptCredentials(parsedCredentials);

    const integration = await this.prisma.integration.create({
      data: {
        ...integrationData,
        credentials: encryptedCredentials,
        status: IntegrationStatus.PENDING,
        tenant: {
          connect: { id: tenantId },
        },
      },
    });

    // Probar conexión
    try {
      await this.testConnection(integration.id);

      // Marcar como activa si la conexión fue exitosa
      return await this.prisma.integration.update({
        where: { id: integration.id },
        data: { status: IntegrationStatus.ACTIVE },
      });
    } catch (error) {
      // Si falla, dejar en PENDING con el error
      console.error('[Integrations] Connection test failed:', error);
      return integration;
    }
  }

  /**
   * Obtiene todas las integraciones de un tenant
   */
  async getByTenant(tenantId: string): Promise<any[]> {
    const integrations = await this.prisma.integration.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    // Desencriptar credenciales para retornar
    return integrations.map(integration => ({
      ...integration,
      credentials: this.decryptCredentials(integration.credentials),
    }));
  }

  /**
   * Obtiene una integración por ID
   */
  async getById(id: string, tenantId: string): Promise<any | null> {
    const integration = await this.prisma.integration.findFirst({
      where: { id, tenantId },
    });

    if (!integration) {
      return null;
    }

    return {
      ...integration,
      credentials: this.decryptCredentials(integration.credentials),
    };
  }

  /**
   * Actualiza una integración
   */
  async update(id: string, tenantId: string, data: UpdateIntegrationInput): Promise<any> {
    const existing = await this.prisma.integration.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new Error('Integration not found');
    }

    const updateData: any = { ...data };

    if (data.credentials) {
      const parsedCredentials = this.validateAndParseCredentials(
        existing.type,
        data.credentials
      );
      updateData.credentials = this.encryptCredentials(parsedCredentials);
    }

    const integration = await this.prisma.integration.update({
      where: { id },
      data: updateData,
    });

    // Si se actualizaron credenciales, probar conexión
    if (data.credentials || data.baseUrl) {
      try {
        await this.testConnection(integration.id);
        await this.prisma.integration.update({
          where: { id },
          data: { status: IntegrationStatus.ACTIVE },
        });
      } catch (error) {
        await this.prisma.integration.update({
          where: { id },
          data: { status: IntegrationStatus.ERROR },
        });
      }
    }

    return {
      ...integration,
      credentials: this.decryptCredentials(integration.credentials),
    };
  }

  /**
   * Elimina una integración
   */
  async delete(id: string, tenantId: string): Promise<void> {
    const integration = await this.prisma.integration.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { agentIntegrations: true } },
      },
    });

    if (!integration) {
      throw new Error('Integration not found');
    }

    if (integration._count.agentIntegrations > 0) {
      throw new Error('Cannot delete integration with active agent links');
    }

    await this.prisma.integration.delete({
      where: { id },
    });
  }

  /**
   * Vincula una integración a un agente
   */
  async linkToAgent(
    integrationId: string,
    agentId: string,
    tenantId: string,
    config?: Record<string, any>
  ): Promise<any> {
    // Verificar que ambos existen y pertenecen al tenant
    const [integration, agent] = await Promise.all([
      this.prisma.integration.findFirst({ where: { id: integrationId, tenantId } }),
      this.prisma.agent.findFirst({ where: { id: agentId, tenantId } }),
    ]);

    if (!integration) {
      throw new Error('Integration not found');
    }

    if (!agent) {
      throw new Error('Agent not found');
    }

    // Generar tools automáticamente basado en la integración
    const tools = await this.generateTools(integration);

    const agentIntegration = await this.prisma.agentIntegration.create({
      data: {
        agentId,
        integrationId,
        tools,
        config: config || {},
        status: IntegrationStatus.ACTIVE,
      },
    });

    return agentIntegration;
  }

  /**
   * Desvincula una integración de un agente
   */
  async unlinkFromAgent(
    integrationId: string,
    agentId: string,
    tenantId: string
  ): Promise<void> {
    const agentIntegration = await this.prisma.agentIntegration.findFirst({
      where: {
        integrationId,
        agentId,
      },
      include: {
        agent: true,
      },
    });

    if (!agentIntegration) {
      throw new Error('Agent integration not found');
    }

    if (agentIntegration.agent.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }

    await this.prisma.agentIntegration.delete({
      where: {
        agentId_integrationId: {
          agentId,
          integrationId,
        },
      },
    });
  }

  /**
   * Obtiene las tools de un agente
   */
  async getAgentTools(agentId: string, tenantId: string): Promise<any[]> {
    const agentIntegrations = await this.prisma.agentIntegration.findMany({
      where: {
        agentId,
        status: IntegrationStatus.ACTIVE,
      },
      include: {
        integration: true,
      },
    });

    const allTools: any[] = [];

    for (const agentIntegration of agentIntegrations) {
      if (!agentIntegration.integration) continue;

      const integration = agentIntegration.integration;

      // Verificar que pertenece al tenant
      if (integration.tenantId !== tenantId) continue;

      const tools = agentIntegration.tools as any[];
      allTools.push(...tools);
    }

    return allTools;
  }

  /**
   * Prueba la conexión de una integración
   */
  async testConnection(integrationId: string): Promise<boolean> {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new Error('Integration not found');
    }

    const credentials = this.decryptCredentials(integration.credentials);

    try {
      switch (integration.type) {
        case IntegrationType.CUSTOM_API:
          return await this.testCustomApi(integration.baseUrl!, credentials);

        case IntegrationType.GOOGLE:
          return await this.testGoogleIntegration(credentials);

        case IntegrationType.BANK:
          return await this.testStripeIntegration(credentials);

        default:
          // Para otros tipos, hacer una prueba genérica
          return await this.testGenericIntegration(integration);
      }
    } catch (error) {
      console.error(`[Integrations] Connection test failed for ${integration.name}:`, error);
      return false;
    }
  }

  // ============================================
  // Métodos Privados
  // ============================================

  /**
   * Valida y parsea las credenciales según el tipo
   */
  private validateAndParseCredentials(
    type: IntegrationType,
    credentials: string
  ): Record<string, any> {
    const parsed = JSON.parse(credentials);

    switch (type) {
      case IntegrationType.CUSTOM_API:
        return z.object({
          apiKey: z.string().optional(),
          authToken: z.string().optional(),
          username: z.string().optional(),
          password: z.string().optional(),
        }).parse(parsed);

      case IntegrationType.GOOGLE:
        return z.object({
          clientId: z.string(),
          clientSecret: z.string(),
          refreshToken: z.string().optional(),
        }).parse(parsed);

      case IntegrationType.BANK:
      case IntegrationType.BANK:
        return z.object({
          apiKey: z.string(),
        }).parse(parsed);

      default:
        return parsed;
    }
  }

  /**
   * Encripta credenciales
   */
  private encryptCredentials(credentials: Record<string, any>): string {
    // Por ahora, solo codificar en base64
    // En producción, usar encriptación real
    return Buffer.from(JSON.stringify(credentials)).toString('base64');
  }

  /**
   * Desencripta credenciales
   */
  private decryptCredentials(encrypted: string): Record<string, any> {
    try {
      const decoded = Buffer.from(encrypted, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch (error) {
      console.error('[Integrations] Error decrypting credentials:', error);
      return {};
    }
  }

  /**
   * Genera tools automáticamente basado en la integración
   */
  private async generateTools(integration: any): Promise<any[]> {
    const credentials = this.decryptCredentials(integration.credentials);
    const tools: GeneratedTool[] = [];

    switch (integration.type) {
      case IntegrationType.CUSTOM_API:
        tools.push(...await this.generateCustomApiTools(integration, credentials));
        break;

      case IntegrationType.GOOGLE:
        tools.push(...await this.generateGoogleTools(credentials));
        break;

      case IntegrationType.BANK:
        tools.push(...await this.generateStripeTools(credentials));
        break;

      default:
        // Tools genéricas para cualquier API REST
        tools.push({
          name: `${this.sanitizeName(integration.name)}_get`,
          description: `Hacer una petición GET a ${integration.name}`,
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Ruta del endpoint' },
              params: { type: 'object', description: 'Parámetros de consulta' },
            },
          },
          endpoint: `${integration.baseUrl || ''}{path}`,
          method: 'GET',
          headers: this.buildAuthHeaders(integration.type, credentials),
        });
    }

    return tools;
  }

  /**
   * Genera tools para API personalizada
   */
  private async generateCustomApiTools(
    integration: any,
    credentials: Record<string, any>
  ): Promise<GeneratedTool[]> {
    // Aquí se podrían leer endpoints de OpenAPI/Swagger
    // Por ahora, crear tools genéricas CRUD
    const baseName = this.sanitizeName(integration.name);
    const baseUrl = integration.baseUrl || '';

    return [
      {
        name: `${baseName}_get`,
        description: `Obtener datos de ${integration.name}`,
        parameters: {
          type: 'object',
          properties: {
            endpoint: { type: 'string', description: 'Endpoint a consultar' },
            params: { type: 'object', description: 'Parámetros de query' },
          },
        },
        endpoint: `${baseUrl}{endpoint}`,
        method: 'GET',
        headers: this.buildAuthHeaders(integration.type, credentials),
      },
      {
        name: `${baseName}_post`,
        description: `Crear datos en ${integration.name}`,
        parameters: {
          type: 'object',
          properties: {
            endpoint: { type: 'string', description: 'Endpoint donde crear' },
            data: { type: 'object', description: 'Datos a crear' },
          },
        },
        endpoint: `${baseUrl}{endpoint}`,
        method: 'POST',
        headers: this.buildAuthHeaders(integration.type, credentials),
      },
      {
        name: `${baseName}_put`,
        description: `Actualizar datos en ${integration.name}`,
        parameters: {
          type: 'object',
          properties: {
            endpoint: { type: 'string', description: 'Endpoint a actualizar' },
            data: { type: 'object', description: 'Datos a actualizar' },
          },
        },
        endpoint: `${baseUrl}{endpoint}`,
        method: 'PUT',
        headers: this.buildAuthHeaders(integration.type, credentials),
      },
      {
        name: `${baseName}_delete`,
        description: `Eliminar datos de ${integration.name}`,
        parameters: {
          type: 'object',
          properties: {
            endpoint: { type: 'string', description: 'Endpoint a eliminar' },
          },
        },
        endpoint: `${baseUrl}{endpoint}`,
        method: 'DELETE',
        headers: this.buildAuthHeaders(integration.type, credentials),
      },
    ];
  }

  /**
   * Genera tools para Google (Sheets, Docs, etc.)
   */
  private async generateGoogleTools(credentials: Record<string, any>): Promise<GeneratedTool[]> {
    const baseName = 'google';

    return [
      {
        name: `${baseName}_sheets_read`,
        description: 'Leer datos de una hoja de cálculo de Google Sheets',
        parameters: {
          type: 'object',
          properties: {
            spreadsheetId: { type: 'string', description: 'ID del spreadsheet' },
            range: { type: 'string', description: 'Rango a leer (ej: A1:C10)' },
          },
        },
        endpoint: `https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken || credentials.apiKey}`,
        },
      },
      {
        name: `${baseName}_sheets_write`,
        description: 'Escribir datos en una hoja de cálculo de Google Sheets',
        parameters: {
          type: 'object',
          properties: {
            spreadsheetId: { type: 'string', description: 'ID del spreadsheet' },
            range: { type: 'string', description: 'Rango donde escribir' },
            values: { type: 'array', description: 'Valores a escribir' },
          },
        },
        endpoint: `https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}:append`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken || credentials.apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    ];
  }

  /**
   * Genera tools para Stripe
   */
  private async generateStripeTools(credentials: Record<string, any>): Promise<GeneratedTool[]> {
    const baseName = 'stripe';

    return [
      {
        name: `${baseName}_create_customer`,
        description: 'Crear un nuevo cliente en Stripe',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Nombre del cliente' },
            email: { type: 'string', description: 'Email del cliente' },
            phone: { type: 'string', description: 'Teléfono del cliente' },
          },
        },
        endpoint: `https://api.stripe.com/v1/customers`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
      {
        name: `${baseName}_create_charge`,
        description: 'Crear un cobro en Stripe',
        parameters: {
          type: 'object',
          properties: {
            amount: { type: 'number', description: 'Monto del cobro (en centavos)' },
            currency: { type: 'string', description: 'Moneda (ej: usd, mxn)' },
            customer: { type: 'string', description: 'ID del cliente' },
          },
        },
        endpoint: `https://api.stripe.com/v1/charges`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    ];
  }

  /**
   * Construye headers de autenticación según el tipo
   */
  private buildAuthHeaders(
    type: IntegrationType,
    credentials: Record<string, any>
  ): Record<string, string> {
    const headers: Record<string, string> = {};

    switch (type) {
      case IntegrationType.CUSTOM_API:
        if (credentials.apiKey) {
          headers['Authorization'] = `Bearer ${credentials.apiKey}`;
        } else if (credentials.authToken) {
          headers['Authorization'] = `Token ${credentials.authToken}`;
        }
        break;

      case IntegrationType.GOOGLE:
        if (credentials.accessToken) {
          headers['Authorization'] = `Bearer ${credentials.accessToken}`;
        } else if (credentials.apiKey) {
          headers['x-goog-api-key'] = credentials.apiKey;
        }
        break;

      case IntegrationType.BANK:
        headers['Authorization'] = `Bearer ${credentials.apiKey}`;
        break;

      default:
        if (credentials.apiKey) {
          headers['X-API-Key'] = credentials.apiKey;
        }
    }

    return headers;
  }

  /**
   * Prueba conexión con API personalizada
   */
  private async testCustomApi(
    baseUrl: string,
    credentials: Record<string, any>
  ): Promise<boolean> {
    try {
      const headers = this.buildAuthHeaders(IntegrationType.CUSTOM_API, credentials);

      const response = await fetch(baseUrl, {
        method: 'HEAD',
        headers,
      });

      return response.ok || response.status === 405; // 405 Method Not Allowed significa que el servidor existe
    } catch {
      return false;
    }
  }

  /**
   * Prueba conexión con Google
   */
  private async testGoogleIntegration(credentials: Record<string, any>): Promise<boolean> {
    try {
      const token = credentials.accessToken || credentials.apiKey;

      const response = await fetch('https://www.googleapis.com/oauth2/v3/tokeninfo', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Prueba conexión con Stripe
   */
  private async testStripeIntegration(credentials: Record<string, any>): Promise<boolean> {
    try {
      const response = await fetch('https://api.stripe.com/v1/charges', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
        },
      });

      // Stripe devuelve 401 si la key es inválida pero el servidor existe
      return response.status === 200 || response.status === 401;
    } catch {
      return false;
    }
  }

  /**
   * Prueba genérica de conexión
   */
  private async testGenericIntegration(integration: any): Promise<boolean> {
    if (!integration.baseUrl) {
      return false; // No hay forma de probar sin URL
    }

    try {
      const response = await fetch(integration.baseUrl, {
        method: 'HEAD',
      });

      return response.ok || response.status === 405;
    } catch {
      return false;
    }
  }

  /**
   * Sanitiza un nombre para usarlo como identificador
   */
  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }
}

// ============================================
// Instancia Singleton
// ============================================

export const integrationsService = new IntegrationsService();
