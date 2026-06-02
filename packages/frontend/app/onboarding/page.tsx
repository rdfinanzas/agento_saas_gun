'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface Step {
  id: number;
  title: string;
  description: string;
  path: string;
}

const STEPS: Step[] = [
  { id: 1, title: 'WhatsApp', description: 'Conecta tu numero', path: '/onboarding/whatsapp' },
  { id: 2, title: 'Template', description: 'Elige tu rubro', path: '/onboarding/template' },
  { id: 3, title: 'Integracion', description: 'Conecta tu ERP', path: '/onboarding/integration' },
  { id: 4, title: 'Listo!', description: 'Prueba tu bot', path: '/onboarding/ready' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    setLoading(false);
  }, [token, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Configurar mi negocio</h1>
          <span className="text-sm text-gray-500">Paso {currentStep} de 4</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="max-w-4xl mx-auto px-6 mt-8">
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((step) => (
            <button
              key={step.id}
              onClick={() => {
                setCurrentStep(step.id);
                router.push(step.path);
              }}
              className="flex flex-col items-center gap-2"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step.id <= currentStep
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step.id}
              </div>
              <span className={`text-xs ${step.id <= currentStep ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                {step.title}
              </span>
            </button>
          ))}
        </div>

        {/* Stepper line */}
        <div className="relative -mt-14 mb-10 mx-12">
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200" />
          <div
            className="absolute top-5 left-0 h-0.5 bg-blue-600 transition-all"
            style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl border p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Bienvenido a AgenTo!</h2>
          <p className="text-gray-600 mb-6">
            Vamos a configurar tu asistente de WhatsApp en 4 pasos simples.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => router.push('/onboarding/whatsapp')}
              className="p-6 border-2 border-blue-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
            >
              <div className="text-3xl mb-3">📱</div>
              <h3 className="font-semibold text-gray-900">1. Conectar WhatsApp</h3>
              <p className="text-sm text-gray-500 mt-1">Vincula tu numero de WhatsApp</p>
            </button>

            <button
              onClick={() => router.push('/onboarding/template')}
              className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
            >
              <div className="text-3xl mb-3">🏪</div>
              <h3 className="font-semibold text-gray-900">2. Elegir rubro</h3>
              <p className="text-sm text-gray-500 mt-1">Configura tu tipo de negocio</p>
            </button>

            <button
              onClick={() => router.push('/onboarding/integration')}
              className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
            >
              <div className="text-3xl mb-3">🔗</div>
              <h3 className="font-semibold text-gray-900">3. Conectar sistema</h3>
              <p className="text-sm text-gray-500 mt-1">Dolibarr, API o ninguno</p>
            </button>

            <button
              onClick={() => router.push('/onboarding/ready')}
              className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
            >
              <div className="text-3xl mb-3">🚀</div>
              <h3 className="font-semibold text-gray-900">4. Probar</h3>
              <p className="text-sm text-gray-500 mt-1">Envia un mensaje de test</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
