'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function BillingPendingPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = (params?.tenant as string) || '';
  const [countdown, setCountdown] = useState(15);

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
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-yellow-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pago Pendiente</h1>
        <p className="text-gray-600 mb-6">
          Tu pago está siendo procesado. Esto puede tardar unos minutos.
          Te notificaremos cuando se complete.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-medium text-blue-800 mb-2">Métodos de pago pendientes:</h3>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Efectivo (OXXO, rapipago, etc.)</li>
            <li>Transferencia bancaria</li>
            <li>Pago en cuotas</li>
          </ul>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-500">
            Serás redirigido en <span className="font-medium text-gray-900">{countdown}</span> segundos.
          </p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => router.push(`/${tenantSlug}/dashboard`)}
            className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
          >
            Ir al Dashboard
          </button>
          <button
            onClick={() => router.push(`/${tenantSlug}/billing`)}
            className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Ver Facturación
          </button>
        </div>
      </div>
    </div>
  );
}
