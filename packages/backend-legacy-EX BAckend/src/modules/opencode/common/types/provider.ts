/**
 * Tipos de Proveedores de IA para AgenTo SaaS
 * Adaptado desde Accomplish/OpenCode
 */

// Tipos de proveedores soportados
export type ProviderType =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'xai'
  | 'deepseek'
  | 'openrouter'
  | 'moonshot'
  | 'zai'
  | 'minimax'
  | 'kimi-coding'
  | 'opencode'
  | 'ollama'
  | 'bedrock'
  | 'vertex'
  | 'azure-foundry'
  | 'litellm'
  | 'lmstudio'
  | 'custom';

// Configuración de un modelo
export interface ModelConfig {
  id: string;
  fullId?: string;
  name: string;
  provider: ProviderType;
  contextWindow: number;
  maxOutput: number;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  inputPrice?: number;  // por 1M tokens
  outputPrice?: number; // por 1M tokens
  deprecated?: boolean;
  recommended?: boolean;
}

// Configuración de un proveedor
export interface ProviderConfig {
  id: ProviderType;
  name: string;
  requiresApiKey: boolean;
  apiKeyEnvVar?: string;
  baseUrl?: string;
  models: ModelConfig[];
  features: {
    streaming: boolean;
    tools: boolean;
    vision: boolean;
  };
}

// Endpoints para Z.AI por región
export const ZAI_ENDPOINTS: Record<string, string> = {
  international: 'https://api.z.ai/v1',
  china: 'https://api.zai.zhipuai.cn/v1',
};

// Modelos por defecto por proveedor
export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    requiresApiKey: true,
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    models: [
      {
        id: 'claude-sonnet-4-20250514',
        fullId: 'anthropic:claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        provider: 'anthropic',
        contextWindow: 200000,
        maxOutput: 16000,
        supportsTools: true,
        supportsVision: true,
        supportsStreaming: true,
        inputPrice: 3,
        outputPrice: 15,
        recommended: true,
      },
      {
        id: 'claude-opus-4-20250514',
        fullId: 'anthropic:claude-opus-4-20250514',
        name: 'Claude Opus 4',
        provider: 'anthropic',
        contextWindow: 200000,
        maxOutput: 32000,
        supportsTools: true,
        supportsVision: true,
        supportsStreaming: true,
        inputPrice: 15,
        outputPrice: 75,
      },
      {
        id: 'claude-3-5-haiku-20241022',
        fullId: 'anthropic:claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        provider: 'anthropic',
        contextWindow: 200000,
        maxOutput: 8192,
        supportsTools: true,
        supportsVision: true,
        supportsStreaming: true,
        inputPrice: 0.80,
        outputPrice: 4,
      },
    ],
    features: { streaming: true, tools: true, vision: true },
  },
  {
    id: 'openai',
    name: 'OpenAI',
    requiresApiKey: true,
    apiKeyEnvVar: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      {
        id: 'gpt-4o',
        fullId: 'openai:gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        contextWindow: 128000,
        maxOutput: 16384,
        supportsTools: true,
        supportsVision: true,
        supportsStreaming: true,
        inputPrice: 2.5,
        outputPrice: 10,
        recommended: true,
      },
      {
        id: 'gpt-4-turbo',
        fullId: 'openai:gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        contextWindow: 128000,
        maxOutput: 4096,
        supportsTools: true,
        supportsVision: true,
        supportsStreaming: true,
        inputPrice: 10,
        outputPrice: 30,
      },
      {
        id: 'gpt-3.5-turbo',
        fullId: 'openai:gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        contextWindow: 16385,
        maxOutput: 4096,
        supportsTools: true,
        supportsVision: false,
        supportsStreaming: true,
        inputPrice: 0.5,
        outputPrice: 1.5,
      },
    ],
    features: { streaming: true, tools: true, vision: true },
  },
  {
    id: 'google',
    name: 'Google AI',
    requiresApiKey: true,
    apiKeyEnvVar: 'GOOGLE_API_KEY',
    models: [
      {
        id: 'gemini-2.0-flash',
        fullId: 'google:gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        provider: 'google',
        contextWindow: 1000000,
        maxOutput: 8192,
        supportsTools: true,
        supportsVision: true,
        supportsStreaming: true,
        inputPrice: 0.1,
        outputPrice: 0.4,
        recommended: true,
      },
      {
        id: 'gemini-1.5-pro',
        fullId: 'google:gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'google',
        contextWindow: 2000000,
        maxOutput: 8192,
        supportsTools: true,
        supportsVision: true,
        supportsStreaming: true,
        inputPrice: 1.25,
        outputPrice: 5,
      },
    ],
    features: { streaming: true, tools: true, vision: true },
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    requiresApiKey: true,
    apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      {
        id: 'deepseek-chat',
        fullId: 'deepseek:deepseek-chat',
        name: 'DeepSeek Chat',
        provider: 'deepseek',
        contextWindow: 64000,
        maxOutput: 4096,
        supportsTools: true,
        supportsVision: false,
        supportsStreaming: true,
        inputPrice: 0.14,
        outputPrice: 0.28,
        recommended: true,
      },
      {
        id: 'deepseek-reasoner',
        fullId: 'deepseek:deepseek-reasoner',
        name: 'DeepSeek Reasoner',
        provider: 'deepseek',
        contextWindow: 64000,
        maxOutput: 4096,
        supportsTools: false,
        supportsVision: false,
        supportsStreaming: true,
        inputPrice: 0.55,
        outputPrice: 2.19,
      },
    ],
    features: { streaming: true, tools: true, vision: false },
  },
  {
    id: 'xai',
    name: 'xAI',
    requiresApiKey: true,
    apiKeyEnvVar: 'XAI_API_KEY',
    baseUrl: 'https://api.x.ai/v1',
    models: [
      {
        id: 'grok-2-latest',
        fullId: 'xai:grok-2-latest',
        name: 'Grok 2',
        provider: 'xai',
        contextWindow: 131072,
        maxOutput: 8192,
        supportsTools: true,
        supportsVision: false,
        supportsStreaming: true,
        recommended: true,
      },
    ],
    features: { streaming: true, tools: true, vision: false },
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    requiresApiKey: true,
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      {
        id: 'auto',
        fullId: 'openrouter:auto',
        name: 'Auto (Best)',
        provider: 'openrouter',
        contextWindow: 128000,
        maxOutput: 4096,
        supportsTools: true,
        supportsVision: true,
        supportsStreaming: true,
        recommended: true,
      },
    ],
    features: { streaming: true, tools: true, vision: true },
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    requiresApiKey: false,
    baseUrl: 'http://localhost:11434/v1',
    models: [
      {
        id: 'llama3.2',
        fullId: 'ollama:llama3.2',
        name: 'Llama 3.2',
        provider: 'ollama',
        contextWindow: 128000,
        maxOutput: 4096,
        supportsTools: true,
        supportsVision: true,
        supportsStreaming: true,
        recommended: true,
      },
      {
        id: 'qwen2.5',
        fullId: 'ollama:qwen2.5',
        name: 'Qwen 2.5',
        provider: 'ollama',
        contextWindow: 128000,
        maxOutput: 4096,
        supportsTools: true,
        supportsVision: false,
        supportsStreaming: true,
      },
    ],
    features: { streaming: true, tools: true, vision: true },
  },
  {
    id: 'bedrock',
    name: 'AWS Bedrock',
    requiresApiKey: false, // Usa credenciales AWS
    models: [
      {
        id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        name: 'Claude 3.5 Sonnet (Bedrock)',
        provider: 'bedrock',
        contextWindow: 200000,
        maxOutput: 8192,
        supportsTools: true,
        supportsVision: true,
        supportsStreaming: true,
        recommended: true,
      },
    ],
    features: { streaming: true, tools: true, vision: true },
  },
  {
    id: 'vertex',
    name: 'Google Vertex AI',
    requiresApiKey: false, // Usa credenciales GCP
    models: [
      {
        id: 'gemini-2.0-flash-001',
        name: 'Gemini 2.0 Flash (Vertex)',
        provider: 'vertex',
        contextWindow: 1000000,
        maxOutput: 8192,
        supportsTools: true,
        supportsVision: true,
        supportsStreaming: true,
        recommended: true,
      },
    ],
    features: { streaming: true, tools: true, vision: true },
  },
  {
    id: 'azure-foundry',
    name: 'Azure AI Foundry',
    requiresApiKey: true,
    apiKeyEnvVar: 'AZURE_API_KEY',
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o (Azure)',
        provider: 'azure-foundry',
        contextWindow: 128000,
        maxOutput: 8192,
        supportsTools: true,
        supportsVision: true,
        supportsStreaming: true,
        recommended: true,
      },
    ],
    features: { streaming: true, tools: true, vision: true },
  },
  {
    id: 'litellm',
    name: 'LiteLLM Proxy',
    requiresApiKey: true,
    apiKeyEnvVar: 'LITELLM_API_KEY',
    models: [],
    features: { streaming: true, tools: true, vision: true },
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (Local)',
    requiresApiKey: false,
    baseUrl: 'http://localhost:1234/v1',
    models: [],
    features: { streaming: true, tools: true, vision: true },
  },
  {
    id: 'kimi-coding',
    name: 'Kimi Coding',
    requiresApiKey: true,
    apiKeyEnvVar: 'KIMI_API_KEY',
    baseUrl: 'https://api.kimi.com/coding',
    models: [
      {
        id: 'k2p5',
        name: 'Kimi K2.5',
        provider: 'kimi-coding',
        contextWindow: 128000,
        maxOutput: 8192,
        supportsTools: true,
        supportsVision: false,
        supportsStreaming: true,
        recommended: true,
      },
    ],
    features: { streaming: true, tools: true, vision: false },
  },
  {
    id: 'moonshot',
    name: 'Moonshot (Kimi)',
    requiresApiKey: true,
    apiKeyEnvVar: 'MOONSHOT_API_KEY',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: [
      {
        id: 'kimi-k2.5',
        name: 'Kimi K2.5',
        provider: 'moonshot',
        contextWindow: 128000,
        maxOutput: 8192,
        supportsTools: true,
        supportsVision: false,
        supportsStreaming: true,
      },
    ],
    features: { streaming: true, tools: true, vision: false },
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    requiresApiKey: true,
    apiKeyEnvVar: 'MINIMAX_API_KEY',
    baseUrl: 'https://api.minimax.io',
    models: [
      {
        id: 'MiniMax-Text-01',
        name: 'MiniMax Text 01',
        provider: 'minimax',
        contextWindow: 1000000,
        maxOutput: 8192,
        supportsTools: true,
        supportsVision: false,
        supportsStreaming: true,
      },
    ],
    features: { streaming: true, tools: true, vision: false },
  },
  {
    id: 'zai',
    name: 'Z.AI',
    requiresApiKey: true,
    apiKeyEnvVar: 'ZAI_API_KEY',
    models: [
      {
        id: 'glm-4-plus',
        name: 'GLM-4 Plus',
        provider: 'zai',
        contextWindow: 128000,
        maxOutput: 4096,
        supportsTools: true,
        supportsVision: false,
        supportsStreaming: true,
      },
    ],
    features: { streaming: true, tools: true, vision: false },
  },
  {
    id: 'opencode',
    name: 'OpenCode Zen',
    requiresApiKey: true,
    apiKeyEnvVar: 'OPENCODE_API_KEY',
    baseUrl: 'https://opencode.ai/zen',
    models: [
      {
        id: 'auto',
        name: 'Auto Select',
        provider: 'opencode',
        contextWindow: 128000,
        maxOutput: 4096,
        supportsTools: true,
        supportsVision: true,
        supportsStreaming: true,
        recommended: true,
      },
    ],
    features: { streaming: true, tools: true, vision: true },
  },
  {
    id: 'custom',
    name: 'Custom Provider',
    requiresApiKey: false,
    models: [],
    features: { streaming: true, tools: true, vision: true },
  },
];

// Modelo por defecto
export const DEFAULT_MODEL: ModelConfig = DEFAULT_PROVIDERS[0].models[0];

// Configuración de proveedor para un tenant
export interface TenantProviderConfig {
  provider: ProviderType;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
  config?: Record<string, any>;
}

// Configuración de settings del proveedor
export interface ProviderSettings {
  defaultProvider?: ProviderType;
  defaultModel?: string;
  providers: TenantProviderConfig[];
}

// Mensaje de conversación para LLM
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
}

// Bloque de contenido
export interface ContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  source?: { type: string; media_type: string; data: string };
  id?: string;
  name?: string;
  input?: any;
  tool_use_id?: string;
  content?: string | ContentBlock[];
  is_error?: boolean;
}
