'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function OnboardingIntegration() {
  const router = useRouter();
  const { token } = useAuth();
  const [integrationType, setIntegrationType] = useState<string>('');
  const [config, setConfig] = useState({
    baseUrl: '',
    apiKey: '',
    name: '',
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push('/login');
    }
  }, [token, router]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const result = await api.post('/integrations/test', {
        type: integrationType,
        baseUrl: config.baseUrl,
        credentials: { apiKey: config.apiKey },
      }, token);

      setTestResult({ success: result.success, message: result.message });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Error de conexion' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/integrations', {
        name: config.name || integrationType,
        type: integrationType,
        baseUrl: config.baseUrl,
        credentials: JSON.stringify({ apiKey: config.apiKey }),
      }, token);

      router.push('/onboarding/ready');
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    router.push('/onboarding/ready');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Conectar tu sistema</h1>
        <p className="text-gray-600 mb-8">
          Conecta tu ERP o sistema de gestion para que el bot pueda buscar productos y crear pedidos.
          Podes saltar este paso y configurarlo despues.
        </p>

        <div className="bg-white rounded-xl border p-8">
          {/* Integration type selection */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <button
              onClick={() => setIntegrationType('ERP')}
              className={`p-4 rounded-lg border-2 text-center transition-all ${
                integrationType === 'ERP' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="text-2xl mb-1">🏢</div>
              <span className="text-sm font-medium">Dolibarr / ERP</span>
            </button>
            <button
              onClick={() => setIntegrationType('CUSTOM_API')}
              className={`p-4 rounded-lg border-2 text-center transition-all ${
                integrationType === 'CUSTOM_API' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="text-2xl mb-1">🔌</div>
              <span className="text-sm font-medium">API Custom</span>
            </button>
            <button
              onClick={handleSkip}
              className="p-4 rounded-lg border-2 border-gray-200 text-center hover:border-gray-300 transition-all"
            >
              <div className="text-2xl mb-1">⏭️</div>
              <span className="text-sm font-medium">Saltar</span>
            </button>
          </div>

          {/* Config form */}
          {integrationType && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL del sistema</label>
                <input
                  type="url"
                  value={config.baseUrl}
                  onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                  placeholder="https://mi-dolibarr.com"
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  type="password"
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  placeholder="Tu API key"
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

              {/* Test connection */}
              <button
                onClick={handleTest}
                disabled={testing || !config.baseUrl || !config.apiKey}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                {testing ? 'Probando...' : 'Probar conexion'}
              </button>

              {testResult && (
                <div className={`p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {testResult.message}
                </div>
              )}

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saving || (!testResult?.success && !config.baseUrl)}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar y continuar'}
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => router.push('/onboarding/template')}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700"
        >
          ← Atras
        </button>
      </div>
    </div>
  );
}
