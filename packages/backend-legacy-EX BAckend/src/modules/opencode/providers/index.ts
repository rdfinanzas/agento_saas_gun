/**
 * Providers Module - Exportaciones principales
 */

export {
  validateApiKey,
  type ValidationResult,
  type ValidationOptions
} from './validation';

export {
  getModelsForProvider,
  getDefaultModelForProvider,
  isValidModel,
  findModelById,
  getProviderById,
  providerRequiresApiKey,
  getApiKeyEnvVar,
  getProviderName,
  modelSupportsTools,
  modelSupportsVision,
  getModelContextWindow,
  getModelMaxOutput,
  getModelInputPrice,
  getModelOutputPrice,
  listAllProviders,
  getConfiguredProviders,
  DEFAULT_PROVIDERS,
  DEFAULT_MODEL,
} from './models';

export {
  validateLiteLLMConnection,
  validateOllamaConnection,
  validateLMStudioConnection
} from './validation';
