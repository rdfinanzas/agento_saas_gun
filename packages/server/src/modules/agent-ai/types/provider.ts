import type { ZaiRegion } from './providerSettings.js';

export const ZAI_ENDPOINTS: Record<ZaiRegion, string> = {
  china: 'https://open.bigmodel.cn/api/paas/v4',
  international: 'https://api.z.ai/api/coding/paas/v4',
};

export type ProviderType =
  | 'anthropic'
  | 'openai'
  | 'openrouter'
  | 'google'
  | 'xai'
  | 'ollama'
  | 'deepseek'
  | 'moonshot'
  | 'kimi-coding'
  | 'zai'
  | 'azure-foundry'
  | 'custom'
  | 'bedrock'
  | 'litellm'
  | 'minimax'
  | 'lmstudio'
  | 'vertex'
  | 'opencode';

export type ApiKeyProvider =
  | 'anthropic'
  | 'openai'
  | 'openrouter'
  | 'google'
  | 'xai'
  | 'deepseek'
  | 'moonshot'
  | 'kimi-coding'
  | 'zai'
  | 'azure-foundry'
  | 'custom'
  | 'bedrock'
  | 'litellm'
  | 'minimax'
  | 'lmstudio'
  | 'vertex'
  | 'elevenlabs'
  | 'opencode';

/**
 * Providers that accept API key storage via the setApiKey IPC handler.
 * This is the allowlist of providers that can have their API keys stored.
 * Uses Set<string> to allow runtime checking of untrusted input strings.
 */
export const ALLOWED_API_KEY_PROVIDERS: ReadonlySet<string> = new Set<string>([
  'anthropic',
  'openai',
  'openrouter',
  'google',
  'xai',
  'deepseek',
  'moonshot',
  'kimi-coding',
  'zai',
  'azure-foundry',
  'custom',
  'bedrock',
  'litellm',
  'minimax',
  'lmstudio',
  'vertex',
  'elevenlabs',
  'opencode',
]);

/**
 * Providers that use standard OpenAI-compatible API key validation.
 * These providers can be validated using a simple test request to their API.
 * Uses Set<string> to allow runtime checking of untrusted input strings.
 */
export const STANDARD_VALIDATION_PROVIDERS: ReadonlySet<string> = new Set<string>([
  'anthropic',
  'openai',
  'google',
  'xai',
  'deepseek',
  'openrouter',
  'moonshot',
  'zai',
  'minimax',
]);

export interface ModelsEndpointConfig {
  /** Full URL to the models listing endpoint */
  url: string;
  /** How the API key is passed in the request */
  authStyle: 'bearer' | 'x-api-key' | 'query-param';
  /** Additional headers to include (e.g., anthropic-version) */
  extraHeaders?: Record<string, string>;
  /** Which response shape parser to use */
  responseFormat: 'openai' | 'anthropic' | 'google';
  /** Prefix prepended to model IDs (e.g., 'anthropic/') */
  modelIdPrefix?: string;
  /** Optional regex to filter model IDs */
  modelFilter?: RegExp;
}

export interface ProviderConfig {
  id: ProviderType;
  name: string;
  models: ModelConfig[];
  requiresApiKey: boolean;
  apiKeyEnvVar?: string;
  baseUrl?: string;
  /** Auto-selected model when connecting (e.g., 'anthropic/claude-opus-4-6') */
  defaultModelId?: string;
  /** Config for dynamically fetching models from the provider API */
  modelsEndpoint?: ModelsEndpointConfig;
}

export interface ModelConfig {
  id: string;
  displayName: string;
  provider: ProviderType;
  fullId: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  supportsVision?: boolean;
}

export interface SelectedModel {
  provider: ProviderType;
  model: string;
  baseUrl?: string;
  deploymentName?: string;
}

export interface OllamaModelInfo {
  id: string;
  displayName: string;
  size: number;
  toolSupport?: 'supported' | 'unsupported' | 'unknown';
}

export interface OllamaConfig {
  baseUrl: string;
  enabled: boolean;
  lastValidated?: number;
  models?: OllamaModelInfo[];
}

export interface AzureFoundryConfig {
  baseUrl: string;
  deploymentName: string;
  authType: 'api-key' | 'entra-id';
  enabled: boolean;
  lastValidated?: number;
}

export interface LiteLLMModel {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
}

export interface LiteLLMConfig {
  baseUrl: string;
  enabled: boolean;
  lastValidated?: number;
  models?: LiteLLMModel[];
}

export interface LMStudioModel {
  id: string;
  name: string;
  toolSupport: 'supported' | 'unsupported' | 'unknown';
}

export interface LMStudioConfig {
  baseUrl: string;
  enabled: boolean;
  lastValidated?: number;
  models?: LMStudioModel[];
}

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    requiresApiKey: true,
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    defaultModelId: 'anthropic/claude-opus-4-5',
    modelsEndpoint: {
      url: 'https://api.anthropic.com/v1/models',
      authStyle: 'x-api-key',
      extraHeaders: { 'anthropic-version': '2023-06-01' },
      responseFormat: 'anthropic',
      modelIdPrefix: 'anthropic/',
      modelFilter: /^claude-/,
    },
    models: [],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    requiresApiKey: true,
    apiKeyEnvVar: 'OPENAI_API_KEY',
    defaultModelId: 'openai/gpt-5.2',
    modelsEndpoint: {
      url: 'https://api.openai.com/v1/models',
      authStyle: 'bearer',
      responseFormat: 'openai',
      modelIdPrefix: 'openai/',
      modelFilter: /^gpt-|^o[134]|^chatgpt-/,
    },
    models: [],
  },
  {
    id: 'google',
    name: 'Google AI',
    requiresApiKey: true,
    apiKeyEnvVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
    defaultModelId: 'google/gemini-3-pro-preview',
    modelsEndpoint: {
      url: 'https://generativelanguage.googleapis.com/v1beta/models',
      authStyle: 'query-param',
      responseFormat: 'google',
      modelIdPrefix: 'google/',
    },
    models: [],
  },
  {
    id: 'xai',
    name: 'xAI',
    requiresApiKey: true,
    apiKeyEnvVar: 'XAI_API_KEY',
    baseUrl: 'https://api.x.ai',
    defaultModelId: 'xai/grok-4',
    modelsEndpoint: {
      url: 'https://api.x.ai/v1/models',
      authStyle: 'bearer',
      responseFormat: 'openai',
      modelIdPrefix: 'xai/',
    },
    models: [],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    requiresApiKey: true,
    apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com',
    defaultModelId: 'deepseek/deepseek-chat',
    modelsEndpoint: {
      url: 'https://api.deepseek.com/models',
      authStyle: 'bearer',
      responseFormat: 'openai',
      modelIdPrefix: 'deepseek/',
    },
    models: [],
  },
  {
    id: 'moonshot',
    name: 'Moonshot AI',
    requiresApiKey: true,
    apiKeyEnvVar: 'MOONSHOT_API_KEY',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModelId: 'moonshot/kimi-k2.5',
    modelsEndpoint: {
      url: 'https://api.moonshot.cn/v1/models',
      authStyle: 'bearer',
      responseFormat: 'openai',
      modelIdPrefix: 'moonshot/',
    },
    models: [],
  },
  {
    id: 'kimi-coding',
    name: 'Kimi Coding',
    requiresApiKey: true,
    apiKeyEnvVar: 'KIMI_CODING_API_KEY',
    baseUrl: 'https://api.kimi.com/coding',
    defaultModelId: 'kimi-coding/k2p5',
    models: [
      {
        id: 'k2p5',
        displayName: 'Kimi K2.5',
        provider: 'kimi-coding',
        fullId: 'kimi-coding/k2p5',
        contextWindow: 262144,
      },
      {
        id: 'kimi-k2-thinking',
        displayName: 'Kimi K2 Thinking',
        provider: 'kimi-coding',
        fullId: 'kimi-coding/kimi-k2-thinking',
        contextWindow: 262144,
      },
    ],
  },
  {
    id: 'zai',
    name: 'Z.AI Coding Plan',
    requiresApiKey: true,
    apiKeyEnvVar: 'ZAI_API_KEY',
    baseUrl: 'https://open.bigmodel.cn',
    defaultModelId: 'zai/glm-4.7-flashx',
    modelsEndpoint: {
      url: 'https://open.bigmodel.cn/api/paas/v4/models',
      authStyle: 'bearer',
      responseFormat: 'openai',
      modelIdPrefix: 'zai/',
    },
    models: [],
  },
  {
    id: 'bedrock',
    name: 'Amazon Bedrock',
    requiresApiKey: false,
    models: [],
  },
  {
    id: 'vertex',
    name: 'Google Vertex AI',
    requiresApiKey: false,
    models: [],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    requiresApiKey: true,
    apiKeyEnvVar: 'MINIMAX_API_KEY',
    baseUrl: 'https://api.minimax.io',
    defaultModelId: 'minimax/MiniMax-M2.5',
    models: [
      {
        id: 'MiniMax-M2',
        displayName: 'MiniMax M2',
        provider: 'minimax',
        fullId: 'minimax/MiniMax-M2',
        contextWindow: 196608,
        supportsVision: false,
      },
      {
        id: 'MiniMax-M2.1',
        displayName: 'MiniMax M2.1',
        provider: 'minimax',
        fullId: 'minimax/MiniMax-M2.1',
        contextWindow: 204800,
        supportsVision: false,
      },
      {
        id: 'MiniMax-M2.1-highspeed',
        displayName: 'MiniMax M2.1 Highspeed',
        provider: 'minimax',
        fullId: 'minimax/MiniMax-M2.1-highspeed',
        contextWindow: 204800,
        supportsVision: false,
      },
      {
        id: 'MiniMax-M2.5',
        displayName: 'MiniMax M2.5',
        provider: 'minimax',
        fullId: 'minimax/MiniMax-M2.5',
        contextWindow: 204800,
        supportsVision: false,
      },
      {
        id: 'MiniMax-M2.5-highspeed',
        displayName: 'MiniMax M2.5 Highspeed',
        provider: 'minimax',
        fullId: 'minimax/MiniMax-M2.5-highspeed',
        contextWindow: 204800,
        supportsVision: false,
      },
    ],
  },
  {
    id: 'opencode',
    name: 'OpenCode Zen (Free Models)',
    requiresApiKey: true,
    apiKeyEnvVar: 'OPENCODE_API_KEY',
    defaultModelId: 'opencode/big-pickle',
    models: [
      {
        id: 'big-pickle',
        displayName: 'Big Pickle (Free)',
        provider: 'opencode',
        fullId: 'opencode/big-pickle',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        supportsVision: false,
      },
      {
        id: 'gpt-5-nano',
        displayName: 'GPT 5 Nano (Free)',
        provider: 'opencode',
        fullId: 'opencode/gpt-5-nano',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        supportsVision: false,
      },
      {
        id: 'minimax-m2.5-free',
        displayName: 'MiniMax M2.5 Free (Limited)',
        provider: 'opencode',
        fullId: 'opencode/minimax-m2.5-free',
        contextWindow: 204800,
        maxOutputTokens: 4096,
        supportsVision: false,
      },
    ],
  },
];

export const DEFAULT_MODEL: SelectedModel = {
  provider: 'anthropic',
  model: 'anthropic/claude-opus-4-5',
};
