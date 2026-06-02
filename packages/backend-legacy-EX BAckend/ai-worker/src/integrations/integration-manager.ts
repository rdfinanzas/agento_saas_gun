/**
 * Integrations Module - Integraciones disponibles para AI Worker
 */

export interface Integration {
  id: string;
  name: string;
  type: 'google-sheets' | 'excel' | 'api' | 'webhook' | 'database';
  enabled: boolean;
  config: Record<string, any>;
}

export interface IntegrationResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class IntegrationManager {
  private integrations: Map<string, Integration> = new Map();

  register(integration: Integration): void {
    this.integrations.set(integration.id, integration);
  }

  get(id: string): Integration | null {
    return this.integrations.get(id) || null;
  }

  getAll(): Integration[] {
    return Array.from(this.integrations.values());
  }

  getEnabled(): Integration[] {
    return this.getAll().filter(i => i.enabled);
  }

  async execute(integrationId: string, action: string, params: Record<string, any>): Promise<IntegrationResult> {
    const integration = this.integrations.get(integrationId);
    
    if (!integration) {
      return { success: false, error: `Integration ${integrationId} not found` };
    }

    if (!integration.enabled) {
      return { success: false, error: `Integration ${integrationId} is disabled` };
    }

    try {
      switch (integration.type) {
        case 'google-sheets':
          return await this.executeGoogleSheets(integration, action, params);
        case 'excel':
          return await this.executeExcel(integration, action, params);
        case 'api':
          return await this.executeApi(integration, action, params);
        case 'webhook':
          return await this.executeWebhook(integration, action, params);
        default:
          return { success: false, error: `Unknown integration type: ${integration.type}` };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeGoogleSheets(integration: Integration, action: string, params: Record<string, any>): Promise<IntegrationResult> {
    return { success: true, data: { message: 'Google Sheets integration placeholder' } };
  }

  private async executeExcel(integration: Integration, action: string, params: Record<string, any>): Promise<IntegrationResult> {
    return { success: true, data: { message: 'Excel integration placeholder' } };
  }

  private async executeApi(integration: Integration, action: string, params: Record<string, any>): Promise<IntegrationResult> {
    const { baseUrl, headers } = integration.config;
    
    try {
      const response = await fetch(`${baseUrl}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(params),
      });

      const data = await response.json();
      return { success: response.ok, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeWebhook(integration: Integration, action: string, params: Record<string, any>): Promise<IntegrationResult> {
    const { url, method = 'POST' } = integration.config;
    
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await response.text();
      return { success: response.ok, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export const integrationManager = new IntegrationManager();
