/**
 * Controller para gestión de Providers de IA
 */

import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../../types/express';
import { llmService } from '../services/llm.service';
import {
  listAllProviders,
  getModelsForProvider,
  getDefaultModelForProvider,
  getProviderById,
} from '../providers/models';
import { validateApiKey } from '../providers/validation';
import type { ProviderType } from '../common/types/provider';

export class ProvidersController {
  /**
   * Lista todos los providers disponibles
   */
  async listProviders(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const allProviders = listAllProviders();

      // Verificar cuáles tienen API key configurada
      const providersWithStatus = await Promise.all(
        allProviders.map(async (provider) => {
          const apiKey = await llmService.getApiKey(tenantId, provider.id);
          return {
            id: provider.id,
            name: provider.name,
            requiresApiKey: provider.requiresApiKey,
            configured: !!apiKey || !provider.requiresApiKey,
            models: provider.models.map((m) => ({
              id: m.id,
              name: m.name,
              recommended: m.recommended,
            })),
            features: provider.features,
          };
        })
      );

      res.json(providersWithStatus);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene los modelos disponibles para un provider
   */
  async getProviderModels(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { provider } = req.params;
      const providerConfig = getProviderById(provider as ProviderType);

      if (!providerConfig) {
        res.status(404).json({ error: 'Provider no encontrado' });
        return;
      }

      const models = getModelsForProvider(provider as ProviderType);
      const defaultModel = getDefaultModelForProvider(provider as ProviderType);

      res.json({
        provider: provider as ProviderType,
        providerName: providerConfig.name,
        models: models.map((m) => ({
          id: m.id,
          fullId: m.fullId,
          name: m.name,
          provider: m.provider,
          contextWindow: m.contextWindow,
          maxOutput: m.maxOutput,
          supportsTools: m.supportsTools,
          supportsVision: m.supportsVision,
          supportsStreaming: m.supportsStreaming,
          inputPrice: m.inputPrice,
          outputPrice: m.outputPrice,
          recommended: m.recommended,
          deprecated: m.deprecated,
        })),
        defaultModel: defaultModel
          ? {
              id: defaultModel.id,
              name: defaultModel.name,
            }
          : undefined,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Almacena una API key para un provider
   */
  async storeApiKey(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { provider, apiKey, baseUrl, metadata } = req.body;

      if (!provider || !apiKey) {
        res.status(400).json({ error: 'Provider y apiKey son requeridos' });
        return;
      }

      // Validar API key antes de almacenar
      const validation = await validateApiKey(provider, apiKey, { baseUrl });
      if (!validation.valid) {
        res.status(400).json({
          error: 'API key inválida',
          details: validation.error,
        });
        return;
      }

      await llmService.storeApiKey(tenantId, provider, apiKey, baseUrl, metadata);

      res.json({
        success: true,
        message: `API key para ${provider} almacenada correctamente`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Valida una API key sin almacenarla
   */
  async validateApiKey(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { provider, apiKey, baseUrl } = req.body;

      if (!provider || !apiKey) {
        res.status(400).json({ error: 'Provider y apiKey son requeridos' });
        return;
      }

      const validation = await validateApiKey(provider, apiKey, { baseUrl });

      res.json({
        valid: validation.valid,
        error: validation.error,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Elimina una API key
   */
  async deleteApiKey(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { provider } = req.params;

      const deleted = await llmService.deleteApiKey(tenantId, provider as ProviderType);

      if (deleted) {
        res.json({ success: true, message: `API key para ${provider} eliminada` });
      } else {
        res.status(404).json({ error: 'API key no encontrada' });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Verifica el estado de las API keys configuradas
   */
  async getApiKeysStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const allProviders = listAllProviders();

      const statuses = await Promise.all(
        allProviders.map(async (provider) => {
          const apiKey = await llmService.getApiKey(tenantId, provider.id);
          return {
            provider: provider.id,
            name: provider.name,
            configured: !!apiKey,
            requiresApiKey: provider.requiresApiKey,
          };
        })
      );

      res.json(statuses);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Ejecuta un test de conexión con un provider
   */
  async testConnection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { provider } = req.params;
      const { prompt } = req.body;

      const testPrompt = prompt || 'Responde con "OK" para confirmar conexión.';

      const result = await llmService.executeRequest({
        provider: provider as ProviderType,
        messages: [{ role: 'user', content: testPrompt }],
        tenantId,
        maxTokens: 100,
      });

      res.json({
        success: true,
        response: result.content,
        tokensUsed: result.usage?.totalTokens,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export const providersController = new ProvidersController();
