'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface Template {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  config: {
    category?: string;
    tags?: string[];
    welcomeMessage?: string;
  };
}

const CATEGORY_ICONS: Record<string, string> = {
  food: '🍔',
  health: '💊',
  retail: '👗',
  services: '💼',
  other: '🏪',
};

export default function OnboardingTemplate() {
  const router = useRouter();
  const { token } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    // Cargar templates disponibles
    api.get<Template[]>('/agents/templates?isPublic=true', token)
      .then((data) => {
        setTemplates(data || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [token, router]);

  const handleDeploy = async () => {
    if (!selected) return;

    setDeploying(true);
    try {
      await api.post('/agents/templates/deploy', { templateId: selected }, token);
      router.push('/onboarding/integration');
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo deployar el template'));
      setDeploying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Elegi tu rubro</h1>
        <p className="text-gray-600 mb-8">
          Selecciona el template que mejor se adapte a tu negocio. Podes personalizarlo despues.
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 mb-8">
            {templates.map((tpl) => {
              const category = tpl.config?.category || 'other';
              const icon = CATEGORY_ICONS[category] || '🏪';

              return (
                <button
                  key={tpl.id}
                  onClick={() => setSelected(tpl.id)}
                  className={`p-6 rounded-xl border-2 text-left transition-all ${
                    selected === tpl.id
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="text-4xl mb-3">{icon}</div>
                  <h3 className="font-semibold text-gray-900">{tpl.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{tpl.shortDescription}</p>
                  {tpl.config?.tags && (
                    <div className="flex gap-1 mt-3 flex-wrap">
                      {tpl.config.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between">
          <button
            onClick={() => router.push('/onboarding/whatsapp')}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Atras
          </button>
          <button
            onClick={handleDeploy}
            disabled={!selected || deploying}
            className={`px-8 py-3 rounded-lg font-medium ${
              selected
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {deploying ? 'Configurando...' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}
