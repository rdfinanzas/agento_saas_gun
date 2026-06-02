'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Bot,
  Loader2,
  ChevronLeft,
  Plus,
  Edit,
  Trash2,
  Settings,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Mapeo de proveedores a nombres de variables de entorno
const PROVIDER_API_KEY_NAMES: Record<string, string> = {
  'anthropic': 'ANTHROPIC_API_KEY',
  'openai': 'OPENAI_API_KEY',
  'google': 'GOOGLE_API_KEY',
  'deepseek': 'DEEPSEEK_API_KEY',
  'kimi-coding': 'KIMI_API_KEY',
  'kimi': 'KIMI_API_KEY',
  'opencode': 'OPENCODE_API_KEY',
  'cohere': 'COHERE_API_KEY',
  'replicate': 'REPLICATE_API_TOKEN',
  'huggingface': 'HUGGINGFACE_API_KEY',
  'together': 'TOGETHER_API_KEY',
  'mistral': 'MISTRAL_API_KEY',
  'groq': 'GROQ_API_KEY',
  'perplexity': 'PERPLEXITY_API_KEY',
};

// Función para obtener el apiKeyName basado en el provider
function getApiKeyName(provider: string): string {
  return PROVIDER_API_KEY_NAMES[provider.toLowerCase()] || `${provider.toUpperCase()}_API_KEY`;
}

interface AIModel {
  id: string;
  modelId: string;
  displayName: string;
  description?: string;
  isActive: boolean;
  maxTokens?: number;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsStreaming: boolean;
  costPer1kTokens?: number;
}

interface AIProvider {
  id: string;
  provider: string;
  displayName: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  apiKeyName: string;
  hasApiKey?: boolean;
  models: AIModel[];
}

interface ProvidersResponse {
  providers: AIProvider[];
}

// Tipo para configuración global
interface GlobalConfig {
  id: string;
  defaultProvider: string;
  defaultModel: string;
  allowTenantModels: boolean;
}

interface TenantPermission {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  canUseOwnModel: boolean;
  hasOwnModel: boolean;
  ownProvider: string | null;
  ownModel: string | null;
}

export default function AdminAIModelsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ProvidersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providerDialog, setProviderDialog] = useState(false);
  const [modelDialog, setModelDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [editProvider, setEditProvider] = useState<Partial<AIProvider>>({});
  const [editApiKey, setEditApiKey] = useState('');
  const [editModel, setEditModel] = useState<Partial<AIModel>>({});

  // Estado para configuración global y permisos
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null);
  const [tenantPermissions, setTenantPermissions] = useState<TenantPermission[]>([]);
  const [activeTab, setActiveTab] = useState<'models' | 'permissions'>('models');

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      // Cargar proveedores
      const result = await api.get<{ success: boolean; data: AIProvider[] }>('/admin/ai-providers', token);

      // Convert string boolean values to actual booleans for providers
      const providersWithBooleans = result.data.map(provider => ({
        ...provider,
        isActive: provider.isActive === 'true' || provider.isActive === true,
        isDefault: provider.isDefault === 'true' || provider.isDefault === true,
        models: provider.models.map(model => ({
          ...model,
          isActive: model.isActive === 'true' || model.isActive === true,
          supportsVision: model.supportsVision === 'true' || model.supportsVision === true,
          supportsTools: model.supportsTools === 'true' || model.supportsTools === true,
          supportsStreaming: model.supportsStreaming === 'true' || model.supportsStreaming === true,
        })),
      }));

      setData({ providers: providersWithBooleans });

      // Si no hay configuración global, usar el proveedor marcado como isDefault
      const globalConfigResult = await api.get<{ success: boolean; data: GlobalConfig }>('/ai-config/global', token).catch(() => ({ success: false }));
      if (!globalConfigResult.success && providersWithBooleans.length > 0) {
        const defaultProvider = providersWithBooleans.find(p => p.isDefault);
        if (defaultProvider) {
          setGlobalConfig({
            id: '',
            defaultProvider: defaultProvider.provider,
            defaultModel: 'gpt-4o-mini',
            allowTenantModels: false,
          });
        }
      } else if (globalConfigResult.success) {
        setGlobalConfig(globalConfigResult.data);
      }

      // Cargar configuración global
      try {
        const globalResult = await api.get<{ success: boolean; data: GlobalConfig }>('/ai-config/global', token);
        if (globalResult.success) {
          setGlobalConfig(globalResult.data);
        }
      } catch (err) {
        console.log('Global config not found, will create from providers with isDefault flag');
      }

      // Cargar permisos de tenants
      try {
        const tenantsResult = await api.get<{ success: boolean; data: TenantPermission[] }>('/ai-config/tenants', token);
        if (tenantsResult.success) {
          setTenantPermissions(tenantsResult.data);
        }
      } catch (err) {
        console.log('Tenant permissions not found');
      }

    } catch (err) {
      console.error('Error loading AI providers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProvider = async () => {
    setSaving(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      const isEdit = !!editProvider.id;
      const endpoint = isEdit
        ? `/admin/ai-providers/${editProvider.id}`
        : '/admin/ai-providers';

      // Only send the fields that should be updated
      const providerData = {
        provider: editProvider.provider,
        displayName: editProvider.displayName,
        description: editProvider.description,
        apiKeyName: editProvider.apiKeyName,
        configSchema: editProvider.configSchema,
        isActive: editProvider.isActive,
        isDefault: editProvider.isDefault,
      };

      await (isEdit ? api.put : api.post)(
        endpoint,
        providerData,
        token
      );

      // Guardar API key si se proporcionó
      if (editApiKey && editProvider.provider) {
        await api.post('/admin/api-keys', {
          provider: editProvider.provider,
          apiKey: editApiKey,
        }, token);

        toast({
          title: 'API Key guardada',
          description: `La API key de ${editProvider.provider} se guardó correctamente`,
        });
      }

      setProviderDialog(false);
      setEditProvider({});
      setEditApiKey('');
      loadProviders();

      if (!editApiKey) {
        toast({
          title: 'Proveedor guardado',
          description: `El proveedor ${editProvider.displayName} se guardó correctamente`,
        });
      }
    } catch (err) {
      console.error('Error saving provider:', err);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el proveedor',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveModel = async () => {
    setSaving(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      const isEdit = !!editModel.id;
      const endpoint = isEdit
        ? `/admin/ai-models/${editModel.id}`
        : '/admin/ai-models';

      // Only send the fields that should be updated
      const modelData = {
        providerId: selectedProvider?.id,
        modelId: editModel.modelId,
        displayName: editModel.displayName,
        description: editModel.description,
        isActive: editModel.isActive,
        maxTokens: editModel.maxTokens,
        supportsVision: editModel.supportsVision,
        supportsTools: editModel.supportsTools,
        supportsStreaming: editModel.supportsStreaming,
        costPer1kTokens: editModel.costPer1kTokens,
      };

      await (isEdit ? api.put : api.post)(
        endpoint,
        modelData,
        token
      );

      setModelDialog(false);
      setEditModel({});
      setSelectedModel(null);
      loadProviders();

      toast({
        title: 'Modelo guardado',
        description: `El modelo ${editModel.displayName} se guardó correctamente`,
      });
    } catch (err) {
      console.error('Error saving model:', err);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el modelo',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteModel = async () => {
    setSaving(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token || !selectedModel?.id) return;

      await api.delete(`/admin/ai-models/${selectedModel.id}`, token);

      setDeleteDialog(false);
      setSelectedModel(null);
      loadProviders();

      toast({
        title: 'Modelo eliminado',
        description: `El modelo ${selectedModel.displayName} se eliminó correctamente`,
      });
    } catch (err) {
      console.error('Error deleting model:', err);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el modelo',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleProviderActive = async (provider: AIProvider) => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      const newActiveState = !provider.isActive;

      // Optimistic update - actualiza proveedor Y sus modelos localmente
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          providers: prev.providers.map(p => {
            if (p.id === provider.id) {
              return {
                ...p,
                isActive: newActiveState,
                // Si se desactiva el proveedor, también desactivar sus modelos
                models: p.models.map(m => ({
                  ...m,
                  isActive: newActiveState ? m.isActive : false,
                })),
              };
            }
            return p;
          }),
        };
      });

      await api.put(`/admin/ai-providers/${provider.id}`, {
        ...provider,
        isActive: newActiveState,
      }, token);

      // No necesitamos recargar, el estado local ya está actualizado
    } catch (err) {
      console.error('Error toggling provider:', err);
      // En caso de error, recargar para obtener el estado correcto
      await loadProviders();
    }
  };

  const toggleModelActive = async (model: AIModel) => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      const newActiveState = !model.isActive;

      // Optimistic update
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          providers: prev.providers.map(p => ({
            ...p,
            models: p.models.map(m =>
              m.id === model.id ? { ...m, isActive: newActiveState } : m
            ),
          })),
        };
      });

      await api.put(`/admin/ai-models/${model.id}`, {
        ...model,
        isActive: newActiveState,
      }, token);

      // No necesitamos recargar, el estado local ya está actualizado
    } catch (err) {
      console.error('Error toggling model:', err);
      // En caso de error, recargar para obtener el estado correcto
      await loadProviders();
    }
  };

  const toggleProviderDefault = async (provider: AIProvider) => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      const newDefaultState = !provider.isDefault;

      // Optimistic update - solo puede haber un default a la vez
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          providers: prev.providers.map(p => ({
            ...p,
            isDefault: p.id === provider.id ? newDefaultState : false,
          })),
        };
      });

      await api.put(`/admin/ai-providers/${provider.id}`, {
        ...provider,
        isDefault: newDefaultState,
      }, token);

      toast({
        title: 'Proveedor actualizado',
        description: newDefaultState
          ? `${provider.displayName} es ahora el proveedor por defecto`
          : `${provider.displayName} ya no es el proveedor por defecto`,
      });
    } catch (err) {
      console.error('Error toggling provider default:', err);
      // En caso de error, recargar para obtener el estado correcto
      await loadProviders();
    }
  };

  const openProviderDialog = (provider?: AIProvider) => {
    if (provider) {
      // Convert string boolean values to actual booleans for editing
      setEditProvider({
        ...provider,
        isActive: provider.isActive === 'true' || provider.isActive === true,
        isDefault: provider.isDefault === 'true' || provider.isDefault === true,
      });
      setEditApiKey('');
    } else {
      setEditProvider({
        provider: '',
        displayName: '',
        apiKeyName: '',
        isActive: true,
      });
      setEditApiKey('');
    }
    setProviderDialog(true);
  };

  const openModelDialog = (provider: AIProvider, model?: AIModel) => {
    setSelectedProvider(provider);
    if (model) {
      // Convert string boolean values to actual booleans for editing
      setEditModel({
        ...model,
        isActive: model.isActive === 'true' || model.isActive === true,
        supportsVision: model.supportsVision === 'true' || model.supportsVision === true,
        supportsTools: model.supportsTools === 'true' || model.supportsTools === true,
        supportsStreaming: model.supportsStreaming === 'true' || model.supportsStreaming === true,
      });
    } else {
      setEditModel({
        modelId: '',
        displayName: '',
        isActive: true,
        supportsTools: true,
        supportsStreaming: true,
      });
    }
    setModelDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Modelos de IA</h1>
          <p className="text-muted-foreground">
            Configura los proveedores de IA y sus modelos disponibles
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'models' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('models')}
          >
            <Bot className="mr-2 h-4 w-4" />
            Proveedores
          </Button>
          <Button
            variant={activeTab === 'permissions' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('permissions')}
          >
            <Shield className="mr-2 h-4 w-4" />
            Permisos Tenants
          </Button>
          <Link href="/admin">
            <Button variant="outline" size="sm">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
          </Link>
        </div>
      </div>

      {/* ============================================ */}
      {/* PROVEEDORES Y MODELOS (solo muestra si activeTab === 'models') */}
      {/* ============================================ */}
      {activeTab === 'models' && (
        <>
      {/* ============================================ */}
      {/* PROVEEDORES Y MODELOS */}
      {/* ============================================ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Proveedores y Modelos ({data?.providers.length || 0})</CardTitle>
            </div>
            <Button onClick={() => openProviderDialog()} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Proveedor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data?.providers.map((provider) => (
            <div key={provider.id} className="mb-6 last:mb-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  <h3 className="font-semibold">{provider.displayName}</h3>
                  <Badge variant={provider.isActive ? 'default' : 'secondary'}>
                    {provider.provider}
                  </Badge>
                  {provider.hasApiKey ? (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      ✓ API Key
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-red-600 border-red-600">
                      ✗ Sin Key
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Activo</span>
                    <Switch
                      checked={provider.isActive}
                      onCheckedChange={() => toggleProviderActive(provider)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Default</span>
                    <Switch
                      checked={provider.isDefault}
                      onCheckedChange={() => toggleProviderDefault(provider)}
                      disabled={!provider.isActive}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openProviderDialog(provider)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openModelDialog(provider)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Modelo
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                {provider.description || 'Sin descripción'}
              </p>

              {provider.models.length > 0 && (
                <div className="ml-6 border-l-2 border-muted pl-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Modelo</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Tokens Max</TableHead>
                        <TableHead>Características</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {provider.models.map((model) => (
                        <TableRow key={model.id}>
                          <TableCell className="font-medium">
                            {model.displayName}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {model.modelId}
                          </TableCell>
                          <TableCell>
                            {model.maxTokens ? model.maxTokens.toLocaleString() : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {model.supportsVision && (
                                <Badge variant="outline" className="text-xs">
                                  Vision
                                </Badge>
                              )}
                              {model.supportsTools && (
                                <Badge variant="outline" className="text-xs">
                                  Tools
                                </Badge>
                              )}
                              {model.supportsStreaming && (
                                <Badge variant="outline" className="text-xs">
                                  Streaming
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={model.isActive}
                              onCheckedChange={() => toggleModelActive(model)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openModelDialog(provider, model)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedModel(model);
                                  setDeleteDialog(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
        </>
      )}

      {/* Provider Dialog */}
      <Dialog open={providerDialog} onOpenChange={setProviderDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editProvider.id ? 'Configurar API Key' : 'Nuevo Proveedor'}
            </DialogTitle>
            <DialogDescription>
              {editProvider.id
                ? `Configurar la API Key para ${editProvider.displayName || editProvider.provider}`
                : 'Configura un proveedor de IA (Anthropic, OpenAI, Google, etc.)'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editProvider.id && (
              <>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Proveedor</Label>
                  <div className="font-medium">{editProvider.displayName || editProvider.provider}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Variable de entorno</Label>
                  <div className="font-mono text-sm bg-muted px-3 py-2 rounded">
                    {editProvider.apiKeyName || getApiKeyName(editProvider.provider || '')}
                  </div>
                </div>
              </>
            )}
            {!editProvider.id && (
              <>
                <div>
                  <Label>Nombre del proveedor</Label>
                  <Input
                    value={editProvider.provider || ''}
                    onChange={(e) => {
                      const newProvider = e.target.value;
                      setEditProvider({
                        ...editProvider,
                        provider: newProvider,
                        apiKeyName: getApiKeyName(newProvider),
                      });
                    }}
                    placeholder="anthropic"
                  />
                </div>
                <div>
                  <Label>Nombre para mostrar</Label>
                  <Input
                    value={editProvider.displayName || ''}
                    onChange={(e) =>
                      setEditProvider({
                        ...editProvider,
                        displayName: e.target.value,
                      })
                    }
                    placeholder="Anthropic (Claude)"
                  />
                </div>
                <div>
                  <Label>Variable de entorno</Label>
                  <Input
                    value={editProvider.apiKeyName || getApiKeyName(editProvider.provider || '')}
                    readOnly
                    className="bg-muted cursor-not-allowed font-mono"
                    placeholder="ANTHROPIC_API_KEY"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Generado automáticamente basado en el proveedor
                  </p>
                </div>
                <div>
                  <Label>Descripción</Label>
                  <Textarea
                    value={editProvider.description || ''}
                    onChange={(e) =>
                      setEditProvider({
                        ...editProvider,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                  />
                </div>
                <div>
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={editApiKey}
                    onChange={(e) => setEditApiKey(e.target.value)}
                    placeholder="sk-..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    La API key se guardará de forma segura encriptada
                  </p>
                </div>
              </>
            )}
            {editProvider.id && (
              <>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Proveedor</Label>
                  <div className="font-medium">{editProvider.displayName || editProvider.provider}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Variable de entorno</Label>
                  <div className="font-mono text-sm bg-muted px-3 py-2 rounded">
                    {editProvider.apiKeyName || getApiKeyName(editProvider.provider || '')}
                  </div>
                </div>
                <div>
                  <Label>Actualizar API Key (opcional)</Label>
                  <Input
                    type="password"
                    value={editApiKey}
                    onChange={(e) => setEditApiKey(e.target.value)}
                    placeholder="Deja vacío para mantener la actual..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    La nueva API key reemplazará la existente. Deja vacío para no cambiarla.
                  </p>
                </div>
              </>
            )}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={editProvider.isActive ?? true}
                  onCheckedChange={(checked) =>
                    setEditProvider({ ...editProvider, isActive: checked })
                  }
                />
                <Label>Activo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editProvider.isDefault ?? false}
                  onCheckedChange={(checked) =>
                    setEditProvider({ ...editProvider, isDefault: checked })
                  }
                />
                <Label>Por defecto</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProviderDialog(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveProvider} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Model Dialog */}
      <Dialog open={modelDialog} onOpenChange={setModelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editModel?.id ? 'Editar' : 'Nuevo'} Modelo
            </DialogTitle>
            <DialogDescription>
              Configura un modelo de IA para el proveedor{' '}
              {selectedProvider?.displayName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ID del modelo</Label>
              <Input
                value={editModel?.modelId || ''}
                onChange={(e) =>
                  setEditModel({ ...editModel!, modelId: e.target.value })
                }
                placeholder="claude-3-5-sonnet-20241022"
              />
            </div>
            <div>
              <Label>Nombre para mostrar</Label>
              <Input
                value={editModel?.displayName || ''}
                onChange={(e) =>
                  setEditModel({ ...editModel!, displayName: e.target.value })
                }
                placeholder="Claude 3.5 Sonnet"
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                value={editModel?.description || ''}
                onChange={(e) =>
                  setEditModel({ ...editModel!, description: e.target.value })
                }
                rows={2}
              />
            </div>
            <div>
              <Label>Tokens máximos</Label>
              <Input
                type="number"
                value={editModel?.maxTokens || ''}
                onChange={(e) =>
                  setEditModel({
                    ...editModel!,
                    maxTokens: parseInt(e.target.value) || undefined,
                  })
                }
                placeholder="200000"
              />
            </div>
            <div>
              <Label>Costo por 1000 tokens (USD)</Label>
              <Input
                type="number"
                step="0.001"
                value={editModel?.costPer1kTokens || ''}
                onChange={(e) =>
                  setEditModel({
                    ...editModel!,
                    costPer1kTokens: parseFloat(e.target.value) || undefined,
                  })
                }
                placeholder="0.003"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={editModel?.isActive ?? true}
                  onCheckedChange={(checked) =>
                    setEditModel({ ...editModel!, isActive: checked })
                  }
                />
                <Label>Activo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editModel?.supportsVision ?? false}
                  onCheckedChange={(checked) =>
                    setEditModel({ ...editModel!, supportsVision: checked })
                  }
                />
                <Label>Soporta visión</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editModel?.supportsTools ?? true}
                  onCheckedChange={(checked) =>
                    setEditModel({ ...editModel!, supportsTools: checked })
                  }
                />
                <Label>Soporta herramientas</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editModel?.supportsStreaming ?? true}
                  onCheckedChange={(checked) =>
                    setEditModel({ ...editModel!, supportsStreaming: checked })
                  }
                />
                <Label>Soporta streaming</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModelDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveModel} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Modelo</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar el modelo{' '}
              <strong>{selectedModel?.displayName}</strong>? Esta acción no se
              puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteModel}
              disabled={saving}
            >
              {saving ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* PERMISOS POR TENANT (solo muestra si activeTab === 'permissions') */}
      {/* ============================================ */}
      {activeTab === 'permissions' && (
        <Card>
          <CardHeader>
            <CardTitle>Permisos por Tenant</CardTitle>
            <CardDescription>
              Autoriza a los tenants para usar sus propios modelos de IA
            </CardDescription>
          </CardHeader>
            <CardContent>
              {tenantPermissions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay tenants configurados
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenantPermissions.map((tenant) => (
                      <TableRow key={tenant.tenantId}>
                        <TableCell className="font-medium">
                          {tenant.tenantName}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {tenant.tenantSlug}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {tenant.hasOwnModel ? (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                ✓ {tenant.ownProvider}/{tenant.ownModel}
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                Usa default global
                              </Badge>
                            )}
                            {!tenant.canUseOwnModel && !globalConfig?.allowTenantModels && (
                              <Badge variant="secondary" className="text-xs">
                                No autorizado
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={tenant.canUseOwnModel}
                                onCheckedChange={async () => {
                                  try {
                                    const token = storage.getItem<string>('token');
                                    if (!token) return;

                                    setTenantPermissions(prev =>
                                      prev.map(t =>
                                        t.tenantId === tenant.tenantId
                                          ? { ...t, canUseOwnModel: !t.canUseOwnModel }
                                          : t
                                      )
                                    );

                                    await api.put(`/ai-config/tenants/${tenant.tenantId}`, {
                                      canUseOwnModel: !tenant.canUseOwnModel,
                                    }, token);

                                    toast({
                                      title: 'Permiso actualizado',
                                      description: !tenant.canUseOwnModel
                                        ? `✓ ${tenant.tenantName} autorizado`
                                        : `✗ ${tenant.tenantName} desautorizado`,
                                    });
                                  } catch (err) {
                                    console.error('Error updating tenant permission:', err);
                                    loadProviders();
                                    toast({
                                      title: 'Error',
                                      description: 'No se pudo actualizar el permiso',
                                      variant: 'destructive',
                                    });
                                  }
                                }}
                                disabled={!globalConfig?.allowTenantModels}
                              />
                              <span className="text-sm text-muted-foreground">
                                {tenant.canUseOwnModel ? 'Autorizado' : 'No autorizado'}
                              </span>
                            </div>
                            {!globalConfig?.allowTenantModels && (
                              <p className="text-xs text-muted-foreground">
                                Habilita "Permitir modelos personalizados" arriba primero
                              </p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
      )}
    </div>
  );
}
