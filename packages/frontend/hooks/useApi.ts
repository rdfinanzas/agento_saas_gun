'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from './useAuth';

interface UseApiOptions {
  showError?: boolean;
}

export function useApi(options: UseApiOptions = {}) {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(
    async <T,>(
      apiFunction: () => Promise<T>
    ): Promise<T | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await apiFunction();
        return result;
      } catch (err: any) {
        const errorMessage = err.message || 'An error occurred';
        setError(errorMessage);

        if (options.showError !== false) {
          console.error('API Error:', errorMessage);
          // Aquí podrías integrar un sistema de notificaciones (toast)
        }

        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [options.showError]
  );

  const get = useCallback(
    <T,>(endpoint: string) =>
      request<T>(() => api.get<T>(endpoint, token || undefined)),
    [token, request]
  );

  const post = useCallback(
    <T,>(endpoint: string, body: any) =>
      request<T>(() => api.post<T>(endpoint, body, token || undefined)),
    [token, request]
  );

  const put = useCallback(
    <T,>(endpoint: string, body: any) =>
      request<T>(() => api.put<T>(endpoint, body, token || undefined)),
    [token, request]
  );

  const patch = useCallback(
    <T,>(endpoint: string, body?: any) =>
      request<T>(() => api.patch<T>(endpoint, body, token || undefined)),
    [token, request]
  );

  const del = useCallback(
    <T,>(endpoint: string) =>
      request<T>(() => api.delete<T>(endpoint, token || undefined)),
    [token, request]
  );

  return {
    isLoading,
    error,
    get,
    post,
    put,
    patch,
    delete: del,
    clearError: () => setError(null),
  };
}
