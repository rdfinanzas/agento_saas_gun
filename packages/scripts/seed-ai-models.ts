/**
 * Seed para poblar la tabla de proveedores y modelos de IA
 * Basado en la configuración de OpenCode
 * Uso: npx ts-node scripts/seed-ai-models.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Proveedores basados en OpenCode
const PROVIDERS = [
  {
    provider: 'anthropic',
    displayName: 'Anthropic (Claude)',
    description: 'Modelos de IA de Anthropic - Claude',
    isActive: true,
    isDefault: true,
    apiKeyName: 'ANTHROPIC_API_KEY',
    configSchema: {
      baseUrl: 'https://api.anthropic.com/v1',
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
    models: [
      {
        modelId: 'claude-sonnet-4-20250514',
        displayName: 'Claude Sonnet 4 (2025-05)',
        description: 'Modelo más reciente de Claude Sonnet con capacidades mejoradas',
        isActive: true,
        maxTokens: 200000,
        supportsVision: true,
        supportsTools: true,
        supportsStreaming: true,
        costPer1kTokens: 0.003,
      },
      {
        modelId: 'claude-3-5-sonnet-20241022',
        displayName: 'Claude 3.5 Sonnet',
        description: 'Modelo balancecido de Claude para tareas generales',
        isActive: true,
        maxTokens: 200000,
        supportsVision: true,
        supportsTools: true,
        supportsStreaming: true,
        costPer1kTokens: 0.003,
      },
      {
        modelId: 'claude-3-5-haiku-20241022',
        displayName: 'Claude 3.5 Haiku',
        description: 'Modelo rápido y económico de Claude',
        isActive: true,
        maxTokens: 200000,
        supportsVision: false,
        supportsTools: true,
        supportsStreaming: true,
        costPer1kTokens: 0.0008,
      },
    ],
  },
  {
    provider: 'openai',
    displayName: 'OpenAI (GPT)',
    description: 'Modelos de IA de OpenAI - GPT-4, GPT-3.5',
    isActive: true,
    isDefault: false,
    apiKeyName: 'OPENAI_API_KEY',
    configSchema: {
      baseUrl: 'https://api.openai.com/v1',
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
    models: [
      {
        modelId: 'gpt-4-turbo',
        displayName: 'GPT-4 Turbo',
        description: 'Modelo GPT-4 más rápido y económico',
        isActive: true,
        maxTokens: 128000,
        supportsVision: true,
        supportsTools: true,
        supportsStreaming: true,
        costPer1kTokens: 0.01,
      },
      {
        modelId: 'gpt-4',
        displayName: 'GPT-4',
        description: 'Modelo GPT-4 original',
        isActive: true,
        maxTokens: 8192,
        supportsVision: true,
        supportsTools: true,
        supportsStreaming: false,
        costPer1kTokens: 0.03,
      },
      {
        modelId: 'gpt-3.5-turbo',
        displayName: 'GPT-3.5 Turbo',
        description: 'Modelo rápido y económico',
        isActive: true,
        maxTokens: 16385,
        supportsVision: false,
        supportsTools: true,
        supportsStreaming: true,
        costPer1kTokens: 0.0005,
      },
    ],
  },
  {
    provider: 'google',
    displayName: 'Google (Gemini)',
    description: 'Modelos de IA de Google - Gemini',
    isActive: true,
    isDefault: false,
    apiKeyName: 'GOOGLE_API_KEY',
    configSchema: {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      supportsStreaming: true,
      supportsTools: false,
      supportsVision: true,
    },
    models: [
      {
        modelId: 'gemini-2.0-flash-exp',
        displayName: 'Gemini 2.0 Flash (Experimental)',
        description: 'Modelo multimodal rápido de Gemini',
        isActive: true,
        maxTokens: 1000000,
        supportsVision: true,
        supportsTools: false,
        supportsStreaming: true,
        costPer1kTokens: 0.0001,
      },
      {
        modelId: 'gemini-1.5-pro',
        displayName: 'Gemini 1.5 Pro',
        description: 'Modelo Pro de Gemini',
        isActive: true,
        maxTokens: 2000000,
        supportsVision: true,
        supportsTools: false,
        supportsStreaming: true,
        costPer1kTokens: 0.0035,
      },
    ],
  },
  {
    provider: 'deepseek',
    displayName: 'DeepSeek',
    description: 'Modelos de IA de DeepSeek - Especializados en código',
    isActive: true,
    isDefault: false,
    apiKeyName: 'DEEPSEEK_API_KEY',
    configSchema: {
      baseUrl: 'https://api.deepseek.com/v1',
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: false,
    },
    models: [
      {
        modelId: 'deepseek-chat',
        displayName: 'DeepSeek Chat',
        description: 'Modelo de chat general de DeepSeek',
        isActive: true,
        maxTokens: 128000,
        supportsVision: false,
        supportsTools: true,
        supportsStreaming: true,
        costPer1kTokens: 0.00014,
      },
      {
        modelId: 'deepseek-coder',
        displayName: 'DeepSeek Coder',
        description: 'Modelo especializado en programación',
        isActive: true,
        maxTokens: 128000,
        supportsVision: false,
        supportsTools: true,
        supportsStreaming: true,
        costPer1kTokens: 0.00014,
      },
    ],
  },
];

async function seedAIModels() {
  console.log('Starting AI Models seed...\n');

  try {
    // Crear proveedores y modelos
    for (const providerData of PROVIDERS) {
      console.log(`Processing provider: ${providerData.provider}`);

      // Verificar si el proveedor ya existe
      let provider = await prisma.aIProvider.findUnique({
        where: { provider: providerData.provider },
      });

      if (provider) {
        console.log(`  ✓ Provider already exists, updating...`);
        // Actualizar proveedor
        provider = await prisma.aIProvider.update({
          where: { provider: providerData.provider },
          data: {
            displayName: providerData.displayName,
            description: providerData.description,
            isActive: providerData.isActive,
            isDefault: providerData.isDefault,
            apiKeyName: providerData.apiKeyName,
            configSchema: providerData.configSchema as any,
          },
        });
      } else {
        console.log(`  → Creating new provider...`);
        // Crear proveedor
        provider = await prisma.aIProvider.create({
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
      }

      // Procesar modelos
      for (const modelData of providerData.models) {
        const existingModel = await prisma.aIModel.findUnique({
          where: {
            providerId_modelId: {
              providerId: provider.id,
              modelId: modelData.modelId,
            },
          },
        });

        if (existingModel) {
          console.log(`    ✓ Model ${modelData.modelId} already exists, updating...`);
          await prisma.aIModel.update({
            where: { id: existingModel.id },
            data: {
              displayName: modelData.displayName,
              description: modelData.description,
              isActive: modelData.isActive,
              maxTokens: modelData.maxTokens,
              supportsVision: modelData.supportsVision,
              supportsTools: modelData.supportsTools,
              supportsStreaming: modelData.supportsStreaming,
              costPer1kTokens: modelData.costPer1kTokens,
            },
          });
        } else {
          console.log(`    → Creating model ${modelData.modelId}...`);
          await prisma.aIModel.create({
            data: {
              providerId: provider.id,
              modelId: modelData.modelId,
              displayName: modelData.displayName,
              description: modelData.description,
              isActive: modelData.isActive,
              maxTokens: modelData.maxTokens,
              supportsVision: modelData.supportsVision,
              supportsTools: modelData.supportsTools,
              supportsStreaming: modelData.supportsStreaming,
              costPer1kTokens: modelData.costPer1kTokens,
            },
          });
        }
      }
    }

    console.log('\n✅ AI Models seed completed successfully!');
    console.log('\nProviders created/updated:');
    const providers = await prisma.aIProvider.findMany({
      include: { models: true },
    });
    providers.forEach((p) => {
      console.log(`  - ${p.displayName}: ${p.models.length} models`);
    });

  } catch (error: any) {
    console.error('❌ Error seeding AI models:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

seedAIModels();
