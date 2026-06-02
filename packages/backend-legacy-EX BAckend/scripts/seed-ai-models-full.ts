/**
 * Seed completo para proveedores y modelos de IA
 * Basado en accomplish/packages/agent-core/src/common/types/provider.ts
 * Uso: npx ts-node scripts/seed-ai-models-full.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuración completa basada en accomplish
const PROVIDERS = [
  {
    provider: 'anthropic',
    displayName: 'Anthropic',
    description: 'Modelos de IA de Anthropic - Claude (Opus, Sonnet, Haiku)',
    isActive: true,
    isDefault: true,
    apiKeyName: 'ANTHROPIC_API_KEY',
    configSchema: {
      baseUrl: 'https://api.anthropic.com',
      defaultModelId: 'anthropic/claude-opus-4-5',
      modelsEndpoint: {
        url: 'https://api.anthropic.com/v1/models',
        authStyle: 'x-api-key',
        extraHeaders: { 'anthropic-version': '2023-06-01' },
        responseFormat: 'anthropic',
        modelIdPrefix: 'anthropic/',
        modelFilter: '^claude-/',
      },
    },
    models: [], // Se cargan dinámicamente
  },
  {
    provider: 'openai',
    displayName: 'OpenAI',
    description: 'Modelos de IA de OpenAI - GPT-4, GPT-3.5',
    isActive: true,
    isDefault: false,
    apiKeyName: 'OPENAI_API_KEY',
    configSchema: {
      baseUrl: 'https://api.openai.com',
      defaultModelId: 'openai/gpt-5.2',
      modelsEndpoint: {
        url: 'https://api.openai.com/v1/models',
        authStyle: 'bearer',
        responseFormat: 'openai',
        modelIdPrefix: 'openai/',
        modelFilter: '^gpt-|^o[134]|^chatgpt-/',
      },
    },
    models: [],
  },
  {
    provider: 'google',
    displayName: 'Google AI',
    description: 'Modelos de IA de Google - Gemini',
    isActive: true,
    isDefault: false,
    apiKeyName: 'GOOGLE_GENERATIVE_AI_API_KEY',
    configSchema: {
      baseUrl: 'https://generativelanguage.googleapis.com',
      defaultModelId: 'google/gemini-3-pro-preview',
      modelsEndpoint: {
        url: 'https://generativelanguage.googleapis.com/v1beta/models',
        authStyle: 'query-param',
        responseFormat: 'google',
        modelIdPrefix: 'google/',
      },
    },
    models: [],
  },
  {
    provider: 'xai',
    displayName: 'xAI',
    description: 'Modelos Grok de xAI',
    isActive: true,
    isDefault: false,
    apiKeyName: 'XAI_API_KEY',
    configSchema: {
      baseUrl: 'https://api.x.ai',
      defaultModelId: 'xai/grok-4',
      modelsEndpoint: {
        url: 'https://api.x.ai/v1/models',
        authStyle: 'bearer',
        responseFormat: 'openai',
        modelIdPrefix: 'xai/',
      },
    },
    models: [],
  },
  {
    provider: 'deepseek',
    displayName: 'DeepSeek',
    description: 'Modelos de IA de DeepSeek - Especializados en código',
    isActive: true,
    isDefault: false,
    apiKeyName: 'DEEPSEEK_API_KEY',
    configSchema: {
      baseUrl: 'https://api.deepseek.com',
      defaultModelId: 'deepseek/deepseek-chat',
      modelsEndpoint: {
        url: 'https://api.deepseek.com/models',
        authStyle: 'bearer',
        responseFormat: 'openai',
        modelIdPrefix: 'deepseek/',
      },
    },
    models: [],
  },
  {
    provider: 'moonshot',
    displayName: 'Moonshot AI',
    description: 'Modelos Kimi de Moonshot AI',
    isActive: true,
    isDefault: false,
    apiKeyName: 'MOONSHOT_API_KEY',
    configSchema: {
      baseUrl: 'https://api.moonshot.cn/v1',
      defaultModelId: 'moonshot/kimi-k2.5',
      modelsEndpoint: {
        url: 'https://api.moonshot.cn/v1/models',
        authStyle: 'bearer',
        responseFormat: 'openai',
        modelIdPrefix: 'moonshot/',
      },
    },
    models: [],
  },
  {
    provider: 'kimi-coding',
    displayName: 'Kimi Coding',
    description: 'Modelos Kimi especializados en programación',
    isActive: true,
    isDefault: false,
    apiKeyName: 'KIMI_CODING_API_KEY',
    configSchema: {
      baseUrl: 'https://api.kimi.com/coding',
      defaultModelId: 'kimi-coding/k2p5',
    },
    models: [
      {
        modelId: 'k2p5',
        displayName: 'Kimi K2.5',
        description: 'Modelo Kimi K2.5 especializado en código',
        isActive: true,
        maxTokens: 262144,
        supportsVision: false,
        supportsTools: true,
        supportsStreaming: true,
      },
      {
        modelId: 'kimi-k2-thinking',
        displayName: 'Kimi K2 Thinking',
        description: 'Kimi K2 con capacidades de reasoning',
        isActive: true,
        maxTokens: 262144,
        supportsVision: false,
        supportsTools: true,
        supportsStreaming: true,
      },
    ],
  },
  {
    provider: 'zai',
    displayName: 'Z.AI Coding Plan',
    description: 'Modelos GLM de Z.AI',
    isActive: true,
    isDefault: false,
    apiKeyName: 'ZAI_API_KEY',
    configSchema: {
      baseUrl: 'https://open.bigmodel.cn',
      defaultModelId: 'zai/glm-4.7-flashx',
      modelsEndpoint: {
        url: 'https://open.bigmodel.cn/api/paas/v4/models',
        authStyle: 'bearer',
        responseFormat: 'openai',
        modelIdPrefix: 'zai/',
      },
    },
    models: [],
  },
  {
    provider: 'bedrock',
    displayName: 'Amazon Bedrock',
    description: 'Modelos de IA de AWS Bedrock (requiere configuración AWS)',
    isActive: false, // Requiere configuración especial
    isDefault: false,
    apiKeyName: '',
    configSchema: {
      requiresApiKey: false,
      note: 'Requiere configuración de credenciales AWS',
    },
    models: [],
  },
  {
    provider: 'vertex',
    displayName: 'Google Vertex AI',
    description: 'Modelos de IA de Google Vertex (requiere configuración GCP)',
    isActive: false, // Requiere configuración especial
    isDefault: false,
    apiKeyName: '',
    configSchema: {
      requiresApiKey: false,
      note: 'Requiere configuración de credenciales GCP',
    },
    models: [],
  },
  {
    provider: 'minimax',
    displayName: 'MiniMax',
    description: 'Modelos de IA de MiniMax',
    isActive: true,
    isDefault: false,
    apiKeyName: 'MINIMAX_API_KEY',
    configSchema: {
      baseUrl: 'https://api.minimax.io',
      defaultModelId: 'minimax/MiniMax-M2.5',
    },
    models: [
      {
        modelId: 'MiniMax-M2',
        displayName: 'MiniMax M2',
        description: 'Modelo MiniMax M2',
        isActive: true,
        maxTokens: 196608,
        supportsVision: false,
        supportsTools: true,
        supportsStreaming: true,
      },
      {
        modelId: 'MiniMax-M2.1',
        displayName: 'MiniMax M2.1',
        description: 'Modelo MiniMax M2.1',
        isActive: true,
        maxTokens: 204800,
        supportsVision: false,
        supportsTools: true,
        supportsStreaming: true,
      },
      {
        modelId: 'MiniMax-M2.1-highspeed',
        displayName: 'MiniMax M2.1 Highspeed',
        description: 'MiniMax M2.1 de alta velocidad',
        isActive: true,
        maxTokens: 204800,
        supportsVision: false,
        supportsTools: true,
        supportsStreaming: true,
      },
      {
        modelId: 'MiniMax-M2.5',
        displayName: 'MiniMax M2.5',
        description: 'Modelo MiniMax M2.5',
        isActive: true,
        maxTokens: 204800,
        supportsVision: false,
        supportsTools: true,
        supportsStreaming: true,
      },
      {
        modelId: 'MiniMax-M2.5-highspeed',
        displayName: 'MiniMax M2.5 Highspeed',
        description: 'MiniMax M2.5 de alta velocidad',
        isActive: true,
        maxTokens: 204800,
        supportsVision: false,
        supportsTools: true,
        supportsStreaming: true,
      },
    ],
  },
  {
    provider: 'opencode',
    displayName: 'OpenCode Zen (Free Models)',
    description: 'Modelos gratuitos proporcionados por OpenCode',
    isActive: true,
    isDefault: false,
    apiKeyName: 'OPENCODE_API_KEY',
    configSchema: {
      baseUrl: 'https://api.opencode.ai',
      defaultModelId: 'opencode/big-pickle',
    },
    models: [
      {
        modelId: 'big-pickle',
        displayName: 'Big Pickle (Free)',
        description: 'Modelo gratuito de OpenCode - Big Pickle',
        isActive: true,
        maxTokens: 128000,
        supportsVision: false,
        supportsTools: false,
        supportsStreaming: true,
        costPer1kTokens: 0,
      },
      {
        modelId: 'gpt-5-nano',
        displayName: 'GPT 5 Nano (Free)',
        description: 'GPT 5 Nano gratuito de OpenCode',
        isActive: true,
        maxTokens: 128000,
        supportsVision: false,
        supportsTools: false,
        supportsStreaming: true,
        costPer1kTokens: 0,
      },
      {
        modelId: 'minimax-m2.5-free',
        displayName: 'MiniMax M2.5 Free (Limited)',
        description: 'MiniMax M2.5 gratuito con límites',
        isActive: true,
        maxTokens: 204800,
        supportsVision: false,
        supportsTools: false,
        supportsStreaming: true,
        costPer1kTokens: 0,
      },
    ],
  },
];

async function seedAIModels() {
  console.log('Starting AI Models seed (FULL VERSION)...\n');

  try {
    // Limpiar proveedores existentes para evitar duplicados
    await prisma.aIModel.deleteMany({});
    await prisma.aIProvider.deleteMany({});
    console.log('Cleared existing providers and models\n');

    // Crear proveedores y modelos
    for (const providerData of PROVIDERS) {
      console.log(`Processing provider: ${providerData.provider}`);

      // Crear proveedor
      const provider = await prisma.aIProvider.create({
        data: {
          provider: providerData.provider,
          displayName: providerData.displayName,
          description: providerData.description,
          isActive: providerData.isActive,
          isDefault: providerData.isDefault,
          apiKeyName: providerData.apiKeyName,
          configSchema: providerData.configSchema as any,
        },
      });

      console.log(`  ✓ Created provider ${providerData.displayName}`);

      // Crear modelos
      for (const modelData of providerData.models) {
        await prisma.aIModel.create({
          data: {
            providerId: provider.id,
            modelId: modelData.modelId,
            displayName: modelData.displayName,
            description: modelData.description,
            isActive: modelData.isActive,
            maxTokens: modelData.maxTokens,
            supportsVision: modelData.supportsVision || false,
            supportsTools: modelData.supportsTools !== undefined ? modelData.supportsTools : true,
            supportsStreaming: modelData.supportsStreaming !== undefined ? modelData.supportsStreaming : true,
            costPer1kTokens: modelData.costPer1kTokens,
          },
        });
        console.log(`    → Created model ${modelData.displayName}`);
      }
    }

    console.log('\n✅ AI Models seed completed successfully!\n');

    // Resumen
    const providers = await prisma.aIProvider.findMany({
      include: { models: true },
      orderBy: { displayName: 'asc' },
    });

    console.log('Providers created:');
    let totalModels = 0;
    providers.forEach((p) => {
      const status = p.isActive ? '✓' : '✗';
      const def = p.isDefault ? '[DEFAULT]' : '';
      console.log(`  ${status} ${p.displayName} ${def}: ${p.models.length} models`);
      totalModels += p.models.length;
    });
    console.log(`\nTotal: ${providers.length} providers, ${totalModels} models`);
    console.log('\nNote: Providers with dynamic models (empty list) fetch models from their API when used.');

  } catch (error: any) {
    console.error('❌ Error seeding AI models:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

seedAIModels();
