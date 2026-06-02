/**
 * Validación de API Keys para Proveedores de IA
 * Adaptado desde Accomplish/OpenCode
 */

import type { ProviderType } from '../common/types/provider';
import { ZAI_ENDPOINTS } from '../common/types/provider';
import type { ZaiRegion } from './types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ValidationOptions {
  baseUrl?: string;
  timeout?: number;
  zaiRegion?: ZaiRegion;
}

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Fetch con timeout para validaciones
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Valida una API key para un proveedor específico
 */
export async function validateApiKey(
  provider: ProviderType,
  apiKey: string,
  options?: ValidationOptions
): Promise<ValidationResult> {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;

  try {
    let response: Response;

    switch (provider) {
      case 'anthropic':
        response = await fetchWithTimeout(
          'https://api.anthropic.com/v1/messages',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-3-haiku-20240307',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'test' }],
            }),
          },
          timeout
        );
        break;

      case 'openai': {
        const baseUrl = (options?.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
        response = await fetchWithTimeout(
          `${baseUrl}/models`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          },
          timeout
        );
        break;
      }

      case 'google':
        response = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
          {
            method: 'GET',
          },
          timeout
        );
        break;

      case 'xai':
        response = await fetchWithTimeout(
          'https://api.x.ai/v1/models',
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          },
          timeout
        );
        break;

      case 'deepseek':
        response = await fetchWithTimeout(
          'https://api.deepseek.com/models',
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          },
          timeout
        );
        break;

      case 'openrouter':
        response = await fetchWithTimeout(
          'https://openrouter.ai/api/v1/auth/key',
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          },
          timeout
        );
        break;

      case 'moonshot':
        response = await fetchWithTimeout(
          'https://api.moonshot.cn/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'kimi-k2.5',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'test' }],
            }),
          },
          timeout
        );
        break;

      case 'zai': {
        const zaiRegion = options?.zaiRegion ?? 'international';
        const zaiEndpoint = ZAI_ENDPOINTS[zaiRegion as string] || ZAI_ENDPOINTS.international;
        response = await fetchWithTimeout(
          `${zaiEndpoint}/models`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          },
          timeout
        );
        break;
      }

      case 'minimax':
        response = await fetchWithTimeout(
          'https://api.minimax.io/anthropic/v1/messages',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'MiniMax-M2.5',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'test' }],
            }),
          },
          timeout
        );
        break;

      case 'kimi-coding':
        response = await fetchWithTimeout(
          'https://api.kimi.com/coding/v1/messages',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'k2p5',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'test' }],
            }),
          },
          timeout
        );
        break;

      case 'opencode':
        response = await fetchWithTimeout(
          'https://opencode.ai/zen/v1/models',
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          },
          timeout
        );
        break;

      case 'ollama':
      case 'bedrock':
      case 'vertex':
      case 'azure-foundry':
      case 'litellm':
      case 'lmstudio':
      case 'custom':
      default:
        // Estos proveedores no requieren validación de API key estándar
        return { valid: true };
    }

    if (response.ok) {
      return { valid: true };
    }

    const errorData = await response.json().catch(() => ({}));
    const errorMessage =
      (errorData as { error?: { message?: string } })?.error?.message ||
      `API returned status ${response.status}`;

    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key' };
    }

    return { valid: false, error: errorMessage };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        valid: false,
        error: 'Request timed out. Please check your internet connection and try again.',
      };
    }
    return {
      valid: false,
      error: 'Failed to validate API key. Check your internet connection.',
    };
  }
}

/**
 * Valida configuración de Ollama
 */
export async function validateOllamaConnection(
  baseUrl: string = 'http://localhost:11434'
): Promise<ValidationResult> {
  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/api/tags`,
      { method: 'GET' },
      5000
    );

    if (response.ok) {
      return { valid: true };
    }
    return { valid: false, error: `Ollama returned status ${response.status}` };
  } catch (error) {
    return {
      valid: false,
      error: 'Cannot connect to Ollama. Make sure it is running.',
    };
  }
}

/**
 * Valida configuración de LM Studio
 */
export async function validateLMStudioConnection(
  baseUrl: string = 'http://localhost:1234'
): Promise<ValidationResult> {
  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/v1/models`,
      { method: 'GET' },
      5000
    );

    if (response.ok) {
      return { valid: true };
    }
    return { valid: false, error: `LM Studio returned status ${response.status}` };
  } catch (error) {
    return {
      valid: false,
      error: 'Cannot connect to LM Studio. Make sure it is running.',
    };
  }
}

/**
 * Valida configuración de LiteLLM
 */
export async function validateLiteLLMConnection(
  baseUrl: string,
  apiKey?: string
): Promise<ValidationResult> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetchWithTimeout(
      `${baseUrl}/models`,
      { method: 'GET', headers },
      10000
    );

    if (response.ok) {
      return { valid: true };
    }
    return { valid: false, error: `LiteLLM returned status ${response.status}` };
  } catch (error) {
    return {
      valid: false,
      error: 'Cannot connect to LiteLLM proxy.',
    };
  }
}
