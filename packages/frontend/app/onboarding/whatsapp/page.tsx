'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function OnboardingWhatsApp() {
  const router = useRouter();
  const { token } = useAuth();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'creating' | 'connecting' | 'connected' | 'error'>('idle');
  const [instanceName, setInstanceName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      router.push('/login');
    }
  }, [token, router]);

  const handleConnect = async () => {
    setStatus('creating');
    setError('');

    try {
      // Crear instancia en Evolution API via nuestro backend
      const result = await api.post('/whatsapp/evolution/create-instance', {
        instanceName: instanceName || undefined,
      }, token || undefined);

      setInstanceName(result.instanceName);

      // Obtener QR code
      setStatus('connecting');
      const qr = await api.get(`/whatsapp/evolution/qr/${result.instanceName}`, token);
      setQrCode(qr.base64);

      // Polling de estado cada 3 segundos
      const poll = setInterval(async () => {
        try {
          const statusResult = await api.get(`/whatsapp/evolution/status/${result.instanceName}`, token);
          if (statusResult.status === 'open') {
            setStatus('connected');
            clearInterval(poll);
          }
        } catch {
          // Continue polling
        }
      }, 3000);

    } catch (err: any) {
      setError(err.message || 'Error al conectar');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Conectar WhatsApp</h1>
        <p className="text-gray-600 mb-8">
          Vincula tu numero de WhatsApp Business para que el bot pueda responder a tus clientes.
        </p>

        <div className="bg-white rounded-xl border p-8">
          {status === 'idle' && (
            <div className="text-center">
              <div className="text-6xl mb-6">📱</div>
              <p className="text-gray-600 mb-6">
                Vamos a crear una instancia de WhatsApp. Necesitas escanear un codigo QR con tu telefono.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la instancia (opcional)
                </label>
                <input
                  type="text"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  placeholder="mi-negocio"
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <button
                onClick={handleConnect}
                className="bg-green-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-green-700"
              >
                Conectar WhatsApp
              </button>
            </div>
          )}

          {status === 'creating' && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4" />
              <p className="text-gray-600">Creando instancia...</p>
            </div>
          )}

          {status === 'connecting' && (
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-4">Escanea este codigo QR</h3>
              {qrCode ? (
                <img
                  src={`data:image/png;base64,${qrCode}`}
                  alt="QR Code"
                  className="mx-auto border rounded-lg"
                  style={{ maxWidth: '300px' }}
                />
              ) : (
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto" />
              )}
              <p className="text-sm text-gray-500 mt-4">
                Abre WhatsApp en tu telefono → Menu → Dispositivos vinculados → Vincular dispositivo
              </p>
              <p className="text-sm text-gray-400 mt-2">Esperando conexion...</p>
            </div>
          )}

          {status === 'connected' && (
            <div className="text-center">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-xl font-semibold text-green-600 mb-2">WhatsApp conectado!</h3>
              <p className="text-gray-600 mb-6">Tu numero ya esta vinculado.</p>
              <button
                onClick={() => router.push('/onboarding/template')}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700"
              >
                Siguiente: Elegir rubro
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="text-6xl mb-4">❌</div>
              <h3 className="text-lg font-semibold text-red-600 mb-2">Error</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={() => setStatus('idle')}
                className="bg-gray-600 text-white px-6 py-2 rounded-lg"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>

        {/* Back */}
        <button
          onClick={() => router.push('/onboarding')}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700"
        >
          ← Volver al inicio
        </button>
      </div>
    </div>
  );
}
