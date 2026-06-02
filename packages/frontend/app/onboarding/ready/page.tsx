'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function OnboardingReady() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleTest = async () => {
    if (!testMessage.trim()) return;

    setSending(true);
    setTestResponse('');

    try {
      const result = await api.post('/chat/test', {
        message: testMessage,
      }, token);

      setTestResponse(result.content || result.response || 'Respuesta recibida');
      setSent(true);
    } catch (err: any) {
      setTestResponse('Error: ' + (err.message || 'No se pudo enviar el mensaje de test'));
    } finally {
      setSending(false);
    }
  };

  const handleGoToDashboard = () => {
    // Obtener tenant slug del user y redirigir
    const tenantSlug = user?.tenantSlug || user?.tenant?.slug || 'default';
    router.push(`/${tenantSlug}/dashboard`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Todo listo!</h1>
          <p className="text-gray-600">
            Tu asistente de WhatsApp esta configurado y listo para responder a tus clientes.
          </p>
        </div>

        {/* Test message */}
        <div className="bg-white rounded-xl border p-8 mb-6">
          <h2 className="text-lg font-semibold mb-4">Probar tu bot</h2>
          <p className="text-sm text-gray-500 mb-4">
            Envia un mensaje de prueba para verificar que todo funciona correctamente.
          </p>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Hola, que productos tienen?"
              className="flex-1 px-4 py-2 border rounded-lg"
              onKeyDown={(e) => e.key === 'Enter' && handleTest()}
            />
            <button
              onClick={handleTest}
              disabled={sending || !testMessage.trim()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {sending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>

          {testResponse && (
            <div className="bg-gray-50 border rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-1">Respuesta del bot:</p>
              <p className="text-gray-600">{testResponse}</p>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="bg-white rounded-xl border p-8 mb-6">
          <h2 className="text-lg font-semibold mb-4">Resumen de configuracion</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-green-500">✅</span>
              <span className="text-gray-700">WhatsApp conectado</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-green-500">✅</span>
              <span className="text-gray-700">Agente configurado</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-green-500">✅</span>
              <span className="text-gray-700">Template aplicado</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handleGoToDashboard}
          className="w-full bg-green-600 text-white py-4 rounded-xl text-lg font-semibold hover:bg-green-700"
        >
          Ir al Dashboard
        </button>

        <button
          onClick={() => router.push('/onboarding/integration')}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700 block mx-auto"
        >
          ← Atras
        </button>
      </div>
    </div>
  );
}
