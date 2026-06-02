'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2,
  Bot,
  Sparkles,
  Search,
  CheckCircle,
  ArrowRight,
  Tag,
  Star,
  ShoppingCart,
  Pill,
  Shirt,
  GroceryBag,
  Briefcase,
} from 'lucide-react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

interface TemplateConfig {
  systemPrompt: string;
  instructions?: string;
  welcomeMessage?: string;
  tools: string[];
  skills: string[];
  variables: Array<{
    name: string;
    key: string;
    type: string;
    label: string;
    description?: string;
    default?: any;
    required: boolean;
    options?: Array<{ label: string; value: any }>;
  }>;
  category?: string;
  tags?: string[];
}

interface Template {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  type: string;
  isActive: boolean;
  isPublic: boolean;
  isOfficial: boolean;
  config: TemplateConfig;
  metadata: Record<string, any>;
  createdAt: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  food: { label: 'Alimentos', icon: ShoppingCart, color: 'text-orange-500' },
  health: { label: 'Salud', icon: Pill, color: 'text-green-500' },
  retail: { label: 'Retail', icon: Shirt, color: 'text-pink-500' },
  services: { label: 'Servicios', icon: Briefcase, color: 'text-blue-500' },
  Ventas: { label: 'Ventas', icon: ShoppingCart, color: 'text-emerald-500' },
  Operaciones: { label: 'Operaciones', icon: Bot, color: 'text-purple-500' },
  Soporte: { label: 'Soporte', icon: Bot, color: 'text-cyan-500' },
  Analytics: { label: 'Analytics', icon: Bot, color: 'text-indigo-500' },
};

function getCategoryConfig(category?: string) {
  if (!category) return { label: 'General', icon: Bot, color: 'text-gray-500' };
  return CATEGORY_CONFIG[category] || { label: category, icon: Bot, color: 'text-gray-500' };
}

export default function TemplatesPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenant as string;

  const [isLoading, setIsLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [variableValues, setVariableValues] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchTemplates() {
      setIsLoading(true);
      setError(null);
      try {
        const token = storage.getItem<string>('token');
        if (!token) {
          setError('No hay token de autenticacion');
          setIsLoading(false);
          return;
        }
        const response = await api.get<{ success: boolean; data: Template[] }>('/agents/templates', token);
        const templateList = response.data || response || [];
        setTemplates(Array.isArray(templateList) ? templateList : []);
      } catch (err: any) {
        console.error('Error fetching templates:', err);
        setError(err.message || 'Error al cargar templates');
      } finally {
        setIsLoading(false);
      }
    }
    if (tenantSlug) fetchTemplates();
  }, [tenantSlug]);

  const openPreview = (template: Template) => {
    setSelectedTemplate(template);
    setNewAgentName(template.name);
    // Initialize variable defaults
    const defaults: Record<string, any> = {};
    template.config?.variables?.forEach(v => {
      defaults[v.key] = v.default || '';
    });
    setVariableValues(defaults);
    setIsPreviewOpen(true);
  };

  const createAgentFromTemplate = async () => {
    if (!selectedTemplate || !newAgentName.trim()) return;
    setIsCreating(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      const response = await api.post<{ success: boolean; agentId?: string; error?: string }>(
        '/agents/templates/deploy',
        {
          templateId: selectedTemplate.id,
          agentName: newAgentName,
          variables: variableValues,
        },
        token
      );

      if (response.success && response.data?.agent?.id) {
        setIsPreviewOpen(false);
        router.push(`/${tenantSlug}/agents/${response.data.agent.id}`);
      } else {
        alert('Error: ' + (response.error || 'No se pudo crear el agente'));
      }
    } catch (err: any) {
      alert('Error al crear agente: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsCreating(false);
    }
  };

  const filteredTemplates = templates.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.config?.tags || []).some(tag => tag.toLowerCase().includes(q))
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates de Agentes</h1>
          <p className="text-muted-foreground">
            Crea agentes rapidamente a partir de templates pre-configurados por rubro
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              Templates Disponibles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              Oficiales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {templates.filter(t => t.isOfficial).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Categorias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {new Set(templates.map(t => t.config?.category).filter(Boolean)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar templates por nombre, rubro o tag..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => {
          const catConfig = getCategoryConfig(template.config?.category);
          const CategoryIcon = catConfig.icon;

          return (
            <Card
              key={template.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => openPreview(template)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CategoryIcon className={`h-5 w-5 ${catConfig.color}`} />
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                  </div>
                  {template.isOfficial && (
                    <Badge className="bg-blue-500 text-white text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Oficial
                    </Badge>
                  )}
                </div>
                <CardDescription>{template.description || template.shortDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 mb-3">
                  {(template.config?.tags || []).slice(0, 4).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{template.config?.tools?.length || 0} herramientas</span>
                  <span>·</span>
                  <span>{template.config?.variables?.length || 0} variables</span>
                  {template.config?.welcomeMessage && (
                    <>
                      <span>·</span>
                      <span className="truncate max-w-[150px]">"{template.config.welcomeMessage.substring(0, 30)}..."</span>
                    </>
                  )}
                </div>
                <Button size="sm" className="w-full mt-3" variant="outline">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Usar Template
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredTemplates.length === 0 && !error && (
        <div className="text-center py-12">
          <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No hay templates disponibles</h3>
          <p className="mt-2 text-muted-foreground">
            {searchQuery ? 'Intenta ajustar la busqueda' : 'No se encontraron templates en el sistema'}
          </p>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTemplate && (() => {
                const catConfig = getCategoryConfig(selectedTemplate.config?.category);
                const Icon = catConfig.icon;
                return <Icon className={`h-5 w-5 ${catConfig.color}`} />;
              })()}
              {selectedTemplate?.name}
            </DialogTitle>
            <DialogDescription>{selectedTemplate?.description}</DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4 py-4">
              {/* Tools */}
              {selectedTemplate.config?.tools?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Herramientas incluidas</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.config.tools.map((tool) => (
                      <Badge key={tool} variant="secondary">{tool}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* System Prompt */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Prompt del Sistema</h4>
                <div className="bg-muted p-3 rounded-md text-sm max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {selectedTemplate.config?.systemPrompt}
                </div>
              </div>

              {/* Welcome Message */}
              {selectedTemplate.config?.welcomeMessage && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Mensaje de Bienvenida</h4>
                  <div className="bg-green-50 dark:bg-green-950 p-3 rounded-md text-sm">
                    {selectedTemplate.config.welcomeMessage}
                  </div>
                </div>
              )}

              {/* Variables */}
              {selectedTemplate.config?.variables?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Configuracion</h4>
                  <div className="space-y-3">
                    {selectedTemplate.config.variables.map((variable) => (
                      <div key={variable.key}>
                        <label className="text-sm font-medium">
                          {variable.label}
                          {variable.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        {variable.type === 'select' && variable.options ? (
                          <select
                            className="w-full mt-1 p-2 border rounded-md text-sm"
                            value={variableValues[variable.key] || ''}
                            onChange={(e) => setVariableValues(prev => ({ ...prev, [variable.key]: e.target.value }))}
                          >
                            <option value="">Seleccionar...</option>
                            {variable.options.map(opt => (
                              <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
                            ))}
                          </select>
                        ) : variable.type === 'textarea' ? (
                          <textarea
                            className="w-full mt-1 p-2 border rounded-md text-sm"
                            rows={3}
                            placeholder={variable.description || variable.label}
                            value={variableValues[variable.key] || ''}
                            onChange={(e) => setVariableValues(prev => ({ ...prev, [variable.key]: e.target.value }))}
                          />
                        ) : variable.type === 'number' ? (
                          <Input
                            type="number"
                            className="mt-1"
                            placeholder={variable.description || variable.label}
                            value={variableValues[variable.key] || ''}
                            onChange={(e) => setVariableValues(prev => ({ ...prev, [variable.key]: Number(e.target.value) }))}
                          />
                        ) : (
                          <Input
                            className="mt-1"
                            placeholder={variable.description || variable.label}
                            value={variableValues[variable.key] || ''}
                            onChange={(e) => setVariableValues(prev => ({ ...prev, [variable.key]: e.target.value }))}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Agent Name */}
              <div className="space-y-2 pt-4 border-t">
                <label className="text-sm font-medium">Nombre del Agente</label>
                <Input
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="Ej: Mi Asistente de Ventas"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createAgentFromTemplate} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Crear Agente
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
