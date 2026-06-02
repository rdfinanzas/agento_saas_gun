/**
 * API Key Validation Service
 * Validates API keys by making test requests to provider endpoints
 * Based on accomplish's validation logic
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ValidationOptions {
  timeout?: number;
}

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Fetch with timeout utility
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Validate DeepSeek API key
 */
async function validateDeepSeek(apiKey: string, options?: ValidationOptions): Promise<ValidationResult> {
  try {
    const response = await fetchWithTimeout(
      'https://api.deepseek.com/models',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: options?.timeout,
      }
    );

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 401) {
      return { valid: false, error: 'API key inválida para DeepSeek' };
    }

    const errorData = await response.json().catch(() => ({}));
    return {
      valid: false,
      error: (errorData as any)?.error?.message || `Error ${response.status}`
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { valid: false, error: 'Timeout: No se pudo conectar con DeepSeek' };
    }
    return { valid: false, error: 'Error de conexión con DeepSeek' };
  }
}

/**
 * Validate Kimi Coding API key
 */
async function validateKimiCoding(apiKey: string, options?: ValidationOptions): Promise<ValidationResult> {
  try {
    const response = await fetchWithTimeout(
      'https://api.moonshot.cn/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'kimi-k2.5',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        }),
        timeout: options?.timeout,
      }
    );

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 401) {
      return { valid: false, error: 'API key inválida para Kimi Coding' };
    }

    const errorData = await response.json().catch(() => ({}));
    return {
      valid: false,
      error: (errorData as any)?.error?.message || `Error ${response.status}`
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { valid: false, error: 'Timeout: No se pudo conectar con Kimi' };
    }
    return { valid: false, error: 'Error de conexión con Kimi' };
  }
}

/**
 * Validate OpenCode API key
 */
async function validateOpenCode(apiKey: string, options?: ValidationOptions): Promise<ValidationResult> {
  try {
    const response = await fetchWithTimeout(
      'https://opencode.ai/zen/v1/models',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: options?.timeout,
      }
    );

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 401) {
      return { valid: false, error: 'API key inválida para OpenCode' };
    }

    const errorData = await response.json().catch(() => ({}));
    return {
      valid: false,
      error: (errorData as any)?.error?.message || `Error ${response.status}`
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { valid: false, error: 'Timeout: No se pudo conectar con OpenCode' };
    }
    return { valid: false, error: 'Error de conexión con OpenCode' };
  }
}

/**
 * Validate Anthropic API key
 */
async function validateAnthropic(apiKey: string, options?: ValidationOptions): Promise<ValidationResult> {
  try {
    const response = await fetchWithTimeout(
      'https://api.anthropic.com/v1/models',
      {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        timeout: options?.timeout,
      }
    );

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 401) {
      return { valid: false, error: 'API key inválida para Anthropic' };
    }

    const errorData = await response.json().catch(() => ({}));
    return {
      valid: false,
      error: (errorData as any)?.error?.message || `Error ${response.status}`
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { valid: false, error: 'Timeout: No se pudo conectar con Anthropic' };
    }
    return { valid: false, error: 'Error de conexión con Anthropic' };
  }
}

/**
 * Validate OpenAI API key
 */
async function validateOpenAI(apiKey: string, options?: ValidationOptions): Promise<ValidationResult> {
  try {
    const response = await fetchWithTimeout(
      'https://api.openai.com/v1/models',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: options?.timeout,
      }
    );

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 401) {
      return { valid: false, error: 'API key inválida para OpenAI' };
    }

    const errorData = await response.json().catch(() => ({}));
    return {
      valid: false,
      error: (errorData as any)?.error?.message || `Error ${response.status}`
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { valid: false, error: 'Timeout: No se pudo conectar con OpenAI' };
    }
    return { valid: false, error: 'Error de conexión con OpenAI' };
  }
}

/**
 * Validate Google API key
 */
async function validateGoogle(apiKey: string, options?: ValidationOptions): Promise<ValidationResult> {
  try {
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
      {
        method: 'GET',
        timeout: options?.timeout,
      }
    );

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'API key inválida para Google' };
    }

    const errorData = await response.json().catch(() => ({}));
    return {
      valid: false,
      error: (errorData as any)?.error?.message || `Error ${response.status}`
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { valid: false, error: 'Timeout: No se pudo conectar con Google' };
    }
    return { valid: false, error: 'Error de conexión con Google' };
  }
}

/**
 * Provider type for validation
 */
export type ApiProvider = 'deepseek' | 'kimi-coding' | 'opencode' | 'anthropic' | 'openai' | 'google';

/**
 * Main validation function for all providers
 */
export async function validateApiKey(
  provider: ApiProvider,
  apiKey: string,
  options?: ValidationOptions
): Promise<ValidationResult> {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'API key está vacía' };
  }

  switch (provider) {
    case 'deepseek':
      return validateDeepSeek(apiKey, options);
    case 'kimi-coding':
      return validateKimiCoding(apiKey, options);
    case 'opencode':
      return validateOpenCode(apiKey, options);
    case 'anthropic':
      return validateAnthropic(apiKey, options);
    case 'openai':
      return validateOpenAI(apiKey, options);
    case 'google':
      return validateGoogle(apiKey, options);
    default:
      return { valid: false, error: `Proveedor ${provider} no soportado para validación automática` };
  }
}

/**
 * Validate multiple API keys in parallel
 */
export async function validateApiKeys(
  keys: Partial<Record<'deepseek' | 'kimi' | 'opencode', string>>,
  options?: ValidationOptions
): Promise<Record<string, ValidationResult>> {
  const results: Record<string, ValidationResult> = {};

  const validations = Promise.all([
    keys.deepseek
      ? validateApiKey('deepseek', keys.deepseek, options).then(r => ({ deepseek: r }))
      : Promise.resolve({ deepseek: { valid: true } as ValidationResult }),

    keys.kimi
      ? validateApiKey('kimi-coding', keys.kimi, options).then(r => ({ kimi: r }))
      : Promise.resolve({ kimi: { valid: true } as ValidationResult }),

    keys.opencode
      ? validateApiKey('opencode', keys.opencode, options).then(r => ({ opencode: r }))
      : Promise.resolve({ opencode: { valid: true } as ValidationResult }),
  ]);

  const [deepseekResult, kimiResult, opencodeResult] = await validations;

  return {
    ...deepseekResult,
    ...kimiResult,
    ...opencodeResult,
  };
}
