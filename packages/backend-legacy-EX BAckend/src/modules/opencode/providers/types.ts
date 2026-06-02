/**
 * Tipos adicionales para Providers
 */

export type ZaiRegion = 'international' | 'china';

export interface ProviderCredential {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  region?: ZaiRegion;
  metadata?: Record<string, any>;
}

export interface ModelFetchResult {
  success: boolean;
  models?: ModelInfo[];
  error?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
  maxOutput?: number;
  supportsTools?: boolean;
  supportsVision?: boolean;
  inputPrice?: number;
  outputPrice?: number;
}
