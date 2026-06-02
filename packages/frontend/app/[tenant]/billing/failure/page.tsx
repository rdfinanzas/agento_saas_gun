'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function BillingFailurePage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = (params?.tenant as string) || '';
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          router.push(`/${tenantSlug}/billing`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router, tenantSlug]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pago Rechazado</h1>
        <p className="text-gray-600 mb-6">
          Lo sentimos, el pago no pudo ser procesado. Por favor, verifica tus datos e
          intenta nuevamente.
        </p>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-medium text-yellow-800 mb-2">Posibles causas:</h3>
          <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
            <li>Fondos insuficientes</li>
            <li>Datos de tarjeta incorrectos</li>
            <li>Tarjeta bloqueada o vencida</li>
            <li>Problemas de conexión</li>
          </ul>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-500">
            Serás redirigido en <span className="font-medium text-gray-900">{countdown}</span> segundos.
          </p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => router.push(`/${tenantSlug}/billing`)}
            className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
          >
            Volver
          </button>
          <button
            onClick={() => router.push(`/${tenantSlug}/billing`)}
            className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Intentar de Nuevo
          </button>
        </div>
      </div>
    </div>
  );
}
