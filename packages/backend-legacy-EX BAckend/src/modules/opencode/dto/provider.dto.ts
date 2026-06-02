/**
 * DTOs para gestión de Providers de IA
 */

import { IsString, IsOptional, IsBoolean, IsEnum, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import type { ProviderType } from '../common/types/provider';

// DTOs para API Keys
export class StoreApiKeyDto {
  @IsEnum([
    'anthropic', 'openai', 'google', 'xai', 'deepseek', 'openrouter',
    'moonshot', 'zai', 'minimax', 'kimi-coding', 'opencode', 'ollama',
    'bedrock', 'vertex', 'azure-foundry', 'litellm', 'lmstudio', 'custom'
  ])
  provider: ProviderType;

  @IsString()
  apiKey: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class ValidateApiKeyDto {
  @IsEnum([
    'anthropic', 'openai', 'google', 'xai', 'deepseek', 'openrouter',
    'moonshot', 'zai', 'minimax', 'kimi-coding', 'opencode', 'ollama',
    'bedrock', 'vertex', 'azure-foundry', 'litellm', 'lmstudio', 'custom'
  ])
  provider: ProviderType;

  @IsString()
  apiKey: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;
}

// DTOs para configuración de tenant
export class TenantProviderConfigDto {
  @IsEnum([
    'anthropic', 'openai', 'google', 'xai', 'deepseek', 'openrouter',
    'moonshot', 'zai', 'minimax', 'kimi-coding', 'opencode', 'ollama',
    'bedrock', 'vertex', 'azure-foundry', 'litellm', 'lmstudio', 'custom'
  ])
  provider: ProviderType;

  @IsOptional()
  @IsString()
  model?: string;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  config?: Record<string, any>;
}

export class UpdateProviderSettingsDto {
  @IsOptional()
  defaultProvider?: ProviderType;

  @IsOptional()
  @IsString()
  defaultModel?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TenantProviderConfigDto)
  providers?: TenantProviderConfigDto[];
}

// DTOs para respuestas
export class ProviderResponseDto {
  id: ProviderType;
  name: string;
  requiresApiKey: boolean;
  configured: boolean;
  models: {
    id: string;
    name: string;
    recommended?: boolean;
  }[];
  features: {
    streaming: boolean;
    tools: boolean;
    vision: boolean;
  };
}

export class ApiKeyStatusDto {
  provider: ProviderType;
  configured: boolean;
  lastValidated?: Date;
  isValid?: boolean;
}

export class ValidationResultDto {
  valid: boolean;
  error?: string;
}

// DTO para modelos disponibles
export class ModelInfoDto {
  id: string;
  fullId?: string;
  name: string;
  provider: ProviderType;
  contextWindow: number;
  maxOutput: number;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  inputPrice?: number;
  outputPrice?: number;
  recommended?: boolean;
  deprecated?: boolean;
}

export class ProviderModelsDto {
  provider: ProviderType;
  providerName: string;
  models: ModelInfoDto[];
  defaultModel?: ModelInfoDto;
}
