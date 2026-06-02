/**
 * Gestión de Modelos de IA
 * Adaptado desde Accomplish/OpenCode
 */

import {
  DEFAULT_PROVIDERS,
  DEFAULT_MODEL,
  type ProviderType,
  type ModelConfig,
  type ProviderConfig,
} from '../common/types/provider';

export { DEFAULT_PROVIDERS, DEFAULT_MODEL };

/**
 * Obtiene todos los modelos disponibles para un proveedor
 */
export function getModelsForProvider(provider: ProviderType): ModelConfig[] {
  const providerConfig = DEFAULT_PROVIDERS.find((p) => p.id === provider);
  return providerConfig?.models ?? [];
}

/**
 * Obtiene el modelo por defecto para un proveedor
 */
export function getDefaultModelForProvider(provider: ProviderType): ModelConfig | undefined {
  const models = getModelsForProvider(provider);
  // Buscar primero el recomendado
  const recommended = models.find((m) => m.recommended);
  if (recommended) return recommended;
  return models[0];
}

/**
 * Verifica si un modelo es válido para un proveedor
 */
export function isValidModel(provider: ProviderType, modelId: string): boolean {
  const models = getModelsForProvider(provider);
  return models.some((m) => m.id === modelId || m.fullId === modelId);
}

/**
 * Busca un modelo por su ID en todos los proveedores
 */
export function findModelById(modelId: string): ModelConfig | undefined {
  for (const provider of DEFAULT_PROVIDERS) {
    const model = provider.models.find((m) => m.id === modelId || m.fullId === modelId);
    if (model) {
      return model;
    }
  }
  return undefined;
}

/**
 * Obtiene la configuración de un proveedor por su ID
 */
export function getProviderById(providerId: ProviderType): ProviderConfig | undefined {
  return DEFAULT_PROVIDERS.find((p) => p.id === providerId);
}

/**
 * Verifica si un proveedor requiere API key
 */
export function providerRequiresApiKey(provider: ProviderType): boolean {
  const providerConfig = getProviderById(provider);
  return providerConfig?.requiresApiKey ?? false;
}

/**
 * Obtiene la variable de entorno para la API key de un proveedor
 */
export function getApiKeyEnvVar(provider: ProviderType): string | undefined {
  const providerConfig = getProviderById(provider);
  return providerConfig?.apiKeyEnvVar;
}

/**
 * Obtiene el nombre legible de un proveedor
 */
export function getProviderName(provider: ProviderType): string {
  const providerConfig = getProviderById(provider);
  return providerConfig?.name ?? provider;
}

/**
 * Verifica si un modelo soporta herramientas
 */
export function modelSupportsTools(provider: ProviderType, modelId: string): boolean {
  const models = getModelsForProvider(provider);
  const model = models.find((m) => m.id === modelId || m.fullId === modelId);
  return model?.supportsTools ?? false;
}

/**
 * Verifica si un modelo soporta visión
 */
export function modelSupportsVision(provider: ProviderType, modelId: string): boolean {
  const models = getModelsForProvider(provider);
  const model = models.find((m) => m.id === modelId || m.fullId === modelId);
  return model?.supportsVision ?? false;
}

/**
 * Obtiene la ventana de contexto de un modelo
 */
export function getModelContextWindow(provider: ProviderType, modelId: string): number {
  const models = getModelsForProvider(provider);
  const model = models.find((m) => m.id === modelId || m.fullId === modelId);
  return model?.contextWindow ?? 4096;
}

/**
 * Obtiene el máximo de tokens de salida de un modelo
 */
export function getModelMaxOutput(provider: ProviderType, modelId: string): number {
  const models = getModelsForProvider(provider);
  const model = models.find((m) => m.id === modelId || m.fullId === modelId);
  return model?.maxOutput ?? 4096;
}

/**
 * Obtiene el precio de input de un modelo (por 1M tokens)
 */
export function getModelInputPrice(provider: ProviderType, modelId: string): number | undefined {
  const models = getModelsForProvider(provider);
  const model = models.find((m) => m.id === modelId || m.fullId === modelId);
  return model?.inputPrice;
}

/**
 * Obtiene el precio de output de un modelo (por 1M tokens)
 */
export function getModelOutputPrice(provider: ProviderType, modelId: string): number | undefined {
  const models = getModelsForProvider(provider);
  const model = models.find((m) => m.id === modelId || m.fullId === modelId);
  return model?.outputPrice;
}

/**
 * Lista todos los proveedores disponibles
 */
export function listAllProviders(): ProviderConfig[] {
  return DEFAULT_PROVIDERS;
}

/**
 * Obtiene los proveedores que tienen API key configurada
 */
export function getConfiguredProviders(apiKeys: Record<ProviderType, string | undefined>): ProviderType[] {
  return DEFAULT_PROVIDERS
    .filter((p) => !p.requiresApiKey || apiKeys[p.id])
    .map((p) => p.id);
}
