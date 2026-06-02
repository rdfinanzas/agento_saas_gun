'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Key, Loader2, Check, Eye, EyeOff, Save, XCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface ProviderKeys {
  deepseek?: string;
  kimi?: string;
  opencode?: string;
}

interface ValidationResults {
  valid: boolean;
  results?: Record<string, { valid: boolean; error?: string }>;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ProviderKeys>({});
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResults | null>(null);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      // Check if keys are configured (simple endpoint that just checks if keys exist)
      const result = await api.get<{ keys: Partial<Record<string, boolean>> }>('/admin/api-keys/status', token);
      console.log('API Keys status:', result);
    } catch (err) {
      console.error('Error loading keys:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setValidationResults(null);

    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      // First validate the API keys
      const keysToValidate = Object.fromEntries(
        Object.entries(keys).filter(([, value]) => value && value.trim().length > 0)
      );

      if (Object.keys(keysToValidate).length > 0) {
        setValidating(true);
        const validation = await api.post<ValidationResults>('/admin/api-keys/validate', keysToValidate, token);
        setValidating(false);

        setValidationResults(validation);

        if (!validation.valid) {
          // Don't save if validation failed
          return;
        }
      }

      // If validation passed, save the keys
      await api.post('/admin/api-keys', keys, token);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setValidationResults(null);
    } catch (err: any) {
      console.error('Error saving keys:', err);
      alert('Error al guardar: ' + (err.message || 'Error desconocido'));
      setValidating(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = (provider: string) => {
    setVisibleKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const providers = [
    {
      id: 'deepseek',
      name: 'DeepSeek',
      description: 'Modelos DeepSeek Chat y Coder',
      placeholder: 'sk-...',
      url: 'https://platform.deepseek.com/api_keys',
      icon: '🤖',
    },
    {
      id: 'kimi',
      name: 'Kimi Coding',
      description: 'Modelos Kimi de Moonshot AI',
      placeholder: 'sk-...',
      url: '#',
      icon: '🌙',
    },
    {
      id: 'opencode',
      name: 'OpenCode (Gratis)',
      description: 'Modelos gratuitos GLM-4, MiniMax, Kimi',
      placeholder: 'sk-opencode-...',
      url: 'https://opencode.ai/auth',
      icon: '🆓',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin">
            <span>←</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Key className="h-8 w-8" />
            API Keys Globales
          </h1>
          <p className="text-muted-foreground">
            Configura las API keys de los proveedores de IA (disponibles para todos los tenants)
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1">
        {providers.map((provider) => (
          <Card key={provider.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{provider.icon}</div>
                  <div>
                    <CardTitle>{provider.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {provider.description}
                    </CardDescription>
                  </div>
                </div>
                {provider.url !== '#' && (
                  <a
                    href={provider.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Obtener API Key →
                  </a>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor={`key-${provider.id}`}>API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id={`key-${provider.id}`}
                      type={visibleKeys[provider.id] ? 'text' : 'password'}
                      placeholder={provider.placeholder}
                      value={keys[provider.id as keyof ProviderKeys] || ''}
                      onChange={(e) => {
                        setKeys(prev => ({ ...prev, [provider.id]: e.target.value }));
                        setValidationResults(null); // Clear validation when key changes
                      }}
                      className={`font-mono text-sm ${
                        validationResults?.results?.[provider.id]?.error ? 'border-red-500' :
                        validationResults?.results?.[provider.id]?.valid ? 'border-green-500' : ''
                      }`}
                    />
                    {/* Validation status indicator */}
                    {validationResults?.results?.[provider.id] && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {validationResults.results[provider.id].valid ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleVisibility(provider.id)}
                  >
                    {visibleKeys[provider.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {/* Validation error message */}
                {validationResults?.results?.[provider.id]?.error && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {validationResults.results[provider.id].error}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col items-end gap-3">
        {/* Validation error summary */}
        {validationResults && !validationResults.valid && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 max-w-md">
            <p className="text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              <span>Una o más API keys no son válidas. Por favor corrige los errores antes de guardar.</span>
            </p>
          </div>
        )}

        <Button onClick={handleSave} disabled={saving || validating} size="lg" className="gap-2">
          {validating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Validando...
            </>
          ) : saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : saved ? (
            <>
              <Check className="h-4 w-4" />
              ¡Guardado!
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Guardar API Keys
            </>
          )}
        </Button>
      </div>

      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>🔒 Seguridad:</strong> Las API keys se almacenan usando AES-256-GCM (el mismo sistema que accomplish).
            Las keys se comparten entre todos los tenants del sistema.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
