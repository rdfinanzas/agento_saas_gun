'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2,
  Eye,
  Save,
  Rocket,
  Package,
  Zap,
  Globe,
  Database,
  MessageSquare,
  BarChart3,
  Plus,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

export interface SkillData {
  id?: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  tags: string[];
  version: string;
  content: string;
  command?: string;
  compatibility: string[];
  documentation?: string;
  configurationSchema?: Record<string, any>;
}

interface SkillEditorProps {
  tenantSlug: string;
  initialData?: Partial<SkillData>;
  onSave?: (data: SkillData) => void;
  onCancel?: () => void;
  mode?: 'create' | 'edit';
}

const CATEGORY_OPTIONS = [
  { value: 'integration', label: 'Integraciones', icon: Globe },
  { value: 'automation', label: 'Automatización', icon: Zap },
  { value: 'communication', label: 'Comunicación', icon: MessageSquare },
  { value: 'data', label: 'Datos', icon: Database },
  { value: 'analytics', label: 'Analytics', icon: BarChart3 },
  { value: 'productivity', label: 'Productividad', icon: Package },
];

const COMPATIBILITY_OPTIONS = [
  'AgentO v1.x',
  'AgentO v2.x',
  'Todas las versiones',
];

export function SkillEditor({
  tenantSlug,
  initialData,
  onSave,
  onCancel,
  mode = 'create',
}: SkillEditorProps) {
  const [formData, setFormData] = useState<SkillData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    category: initialData?.category || 'custom',
    icon: initialData?.icon || '',
    tags: initialData?.tags || [],
    version: initialData?.version || '1.0.0',
    content: initialData?.content || '',
    command: initialData?.command || '',
    compatibility: initialData?.compatibility || [],
    documentation: initialData?.documentation || '',
    configurationSchema: initialData?.configurationSchema || {},
  });

  const [newTag, setNewTag] = useState('');
  const [activeTab, setActiveTab] = useState('basic');
  const [isSaving, setSaving] = useState(false);
  const [isPublishing, setPublishing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'El nombre es requerido';
    }
    if (!formData.description.trim()) {
      errors.description = 'La descripción es requerida';
    }
    if (!formData.content.trim()) {
      errors.content = 'El contenido del skill es requerido';
    }
    if (formData.tags.length === 0) {
      errors.tags = 'Añade al menos una etiqueta';
    }
    if (formData.compatibility.length === 0) {
      errors.compatibility = 'Selecciona al menos una versión compatible';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveDraft = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      // Save as draft to local storage or API
      const draftKey = `skill_draft_${tenantSlug}`;
      storage.setItem(draftKey, {
        ...formData,
        savedAt: new Date().toISOString(),
      });

      if (onSave) {
        onSave(formData);
      }

      alert('Borrador guardado correctamente');
    } catch (err: any) {
      console.error('Error saving draft:', err);
      alert('Error al guardar el borrador');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!validateForm()) return;

    setPublishing(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      // Validate JSON content
      try {
        JSON.parse(formData.content);
      } catch (e) {
        alert('El contenido del skill debe ser un JSON válido');
        setPublishing(false);
        return;
      }

      const result = await api.post<{ success: boolean; marketplaceId?: string }>(
        '/opencode/skills-marketplace/publish',
        {
          skillId: formData.id,
          name: formData.name,
          description: formData.description,
          category: formData.category,
          tags: formData.tags,
          compatibility: formData.compatibility,
          content: formData.content,
          command: formData.command,
          documentation: formData.documentation,
          configurationSchema: formData.configurationSchema,
        },
        token
      );

      if (result?.success) {
        alert('Skill publicado correctamente en el marketplace');

        // Clear draft
        const draftKey = `skill_draft_${tenantSlug}`;
        storage.removeItem(draftKey);

        if (onSave) {
          onSave({ ...formData, id: result.marketplaceId });
        }
      }
    } catch (err: any) {
      console.error('Error publishing skill:', err);
      alert('Error al publicar el skill: ' + (err.message || 'Error desconocido'));
    } finally {
      setPublishing(false);
    }
  };

  const handleUpdate = async () => {
    if (!validateForm()) return;

    setPublishing(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      // Validate JSON content
      try {
        JSON.parse(formData.content);
      } catch (e) {
        alert('El contenido del skill debe ser un JSON válido');
        setPublishing(false);
        return;
      }

      await api.patch<{ success: boolean }>(
        `/opencode/skills-marketplace/skills/${formData.id}`,
        {
          description: formData.description,
          content: formData.content,
          tags: formData.tags,
          documentation: formData.documentation,
          configurationSchema: formData.configurationSchema,
        },
        token
      );

      alert('Skill actualizado correctamente');

      if (onSave) {
        onSave(formData);
      }
    } catch (err: any) {
      console.error('Error updating skill:', err);
      alert('Error al actualizar el skill');
    } finally {
      setPublishing(false);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  const toggleCompatibility = (comp: string) => {
    setFormData({
      ...formData,
      compatibility: formData.compatibility.includes(comp)
        ? formData.compatibility.filter(c => c !== comp)
        : [...formData.compatibility, comp],
    });
  };

  const selectedCategory = CATEGORY_OPTIONS.find(c => c.value === formData.category);
  const CategoryIcon = selectedCategory?.icon || Package;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <CategoryIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {mode === 'create' ? 'Crear Nuevo Skill' : 'Editar Skill'}
              </h2>
              <p className="text-muted-foreground">
                {mode === 'create'
                  ? 'Crea un skill para compartir en el marketplace'
                  : 'Edita la información de tu skill'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowPreview(true)}>
              <Eye className="mr-2 h-4 w-4" />
              Vista previa
            </Button>
            {mode === 'create' ? (
              <>
                <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Guardar borrador
                </Button>
                <Button onClick={handlePublish} disabled={isPublishing}>
                  {isPublishing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="mr-2 h-4 w-4" />
                  )}
                  Publicar
                </Button>
              </>
            ) : (
              <Button onClick={handleUpdate} disabled={isPublishing}>
                {isPublishing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Actualizar
              </Button>
            )}
            {onCancel && (
              <Button variant="ghost" onClick={onCancel}>
                Cancelar
              </Button>
            )}
          </div>
        </div>

        {/* Editor Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Básico</TabsTrigger>
            <TabsTrigger value="content">Contenido</TabsTrigger>
            <TabsTrigger value="config">Configuración</TabsTrigger>
            <TabsTrigger value="docs">Documentación</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información Básica</CardTitle>
                <CardDescription>
                  Define la información principal de tu skill
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Nombre del Skill *</label>
                  <Input
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Integración con Slack"
                    className="mt-1"
                  />
                  {validationErrors.name && (
                    <p className="text-sm text-destructive mt-1">{validationErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium">Descripción corta *</label>
                  <Input
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Una breve descripción de tu skill"
                    className="mt-1"
                    maxLength={200}
                  />
                  {validationErrors.description && (
                    <p className="text-sm text-destructive mt-1">{validationErrors.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.description.length}/200 caracteres
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Categoría *</label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map(opt => {
                        const Icon = opt.icon;
                        return (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {opt.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Versión</label>
                  <Input
                    value={formData.version}
                    onChange={e => setFormData({ ...formData, version: e.target.value })}
                    placeholder="1.0.0"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Etiquetas *</label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={newTag}
                      onChange={e => setNewTag(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && addTag()}
                      placeholder="Añadir etiqueta"
                    />
                    <Button type="button" onClick={addTag}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {validationErrors.tags && (
                    <p className="text-sm text-destructive mt-1">{validationErrors.tags}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => removeTag(tag)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Compatibilidad *</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {COMPATIBILITY_OPTIONS.map(comp => (
                      <Badge
                        key={comp}
                        variant={formData.compatibility.includes(comp) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleCompatibility(comp)}
                      >
                        {formData.compatibility.includes(comp) && (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        )}
                        {comp}
                      </Badge>
                    ))}
                  </div>
                  {validationErrors.compatibility && (
                    <p className="text-sm text-destructive mt-1">{validationErrors.compatibility}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Contenido del Skill</CardTitle>
                <CardDescription>
                  Define el código/JSON que implementa la funcionalidad del skill
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Contenido (JSON) *</label>
                  <Textarea
                    value={formData.content}
                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                    placeholder='{ "name": "my-skill", "actions": [...] }'
                    className="mt-1 font-mono text-sm"
                    rows={15}
                  />
                  {validationErrors.content && (
                    <p className="text-sm text-destructive mt-1">{validationErrors.content}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Formato JSON válido con la definición del skill
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Comando (opcional)</label>
                  <Input
                    value={formData.command}
                    onChange={e => setFormData({ ...formData, command: e.target.value })}
                    placeholder="/comando-personalizado"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Comando para activar este skill (ej: /analizar)
                  </p>
                </div>

                <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    El contenido debe ser un JSON válido. Se validará antes de publicar.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent value="config" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Esquema de Configuración</CardTitle>
                <CardDescription>
                  Define los parámetros que los usuarios pueden configurar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Define campos de configuración que los usuarios podrán ajustar al instalar tu skill.
                  Esto se representa como un objeto JSON donde cada clave es un campo de configuración.
                </p>

                <div>
                  <label className="text-sm font-medium">Esquema de configuración (JSON)</label>
                  <Textarea
                    value={JSON.stringify(formData.configurationSchema || {}, null, 2)}
                    onChange={e => {
                      try {
                        const schema = JSON.parse(e.target.value);
                        setFormData({ ...formData, configurationSchema: schema });
                      } catch (err) {
                        // Invalid JSON, don't update
                      }
                    }}
                    placeholder={`{\n  "apiKey": {\n    "type": "text",\n    "label": "API Key",\n    "description": "Tu clave de API",\n    "required": true\n  }\n}`}
                    className="mt-1 font-mono text-sm"
                    rows={12}
                  />
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Vista previa del formulario:</p>
                  {Object.keys(formData.configurationSchema || {}).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Añade campos al esquema para ver la vista previa
                    </p>
                  ) : (
                    <div className="space-y-3 p-4 bg-muted rounded-lg">
                      {Object.entries(formData.configurationSchema || {}).map(([key, schema]: [string, any]) => (
                        <div key={key}>
                          <label className="text-sm font-medium">
                            {schema.label || key}
                            {schema.required && <span className="text-destructive ml-1">*</span>}
                          </label>
                          {schema.type === 'textarea' ? (
                            <Textarea
                              placeholder={schema.placeholder}
                              disabled
                              className="mt-1"
                            />
                          ) : (
                            <Input
                              type={schema.type || 'text'}
                              placeholder={schema.placeholder}
                              disabled
                              className="mt-1"
                            />
                          )}
                          {schema.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {schema.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documentation Tab */}
          <TabsContent value="docs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Documentación</CardTitle>
                <CardDescription>
                  Instrucciones de uso y ejemplos para los usuarios
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Documentación de uso</label>
                  <Textarea
                    value={formData.documentation || ''}
                    onChange={e => setFormData({ ...formData, documentation: e.target.value })}
                    placeholder="## Cómo usar este skill&#10;&#10;1. Instala el skill&#10;2. Configura los parámetros&#10;3. Usa el comando /tu-comando"
                    className="mt-1"
                    rows={12}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Usa Markdown para formatear la documentación
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CategoryIcon className="h-5 w-5 text-primary" />
              </div>
              {formData.name || 'Sin nombre'}
            </DialogTitle>
            <DialogDescription>
              Vista previa de cómo se verá tu skill en el marketplace
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {CATEGORY_OPTIONS.find(c => c.value === formData.category)?.label}
              </Badge>
              <Badge variant="secondary">v{formData.version}</Badge>
            </div>

            <p className="text-muted-foreground">
              {formData.description || 'Sin descripción'}
            </p>

            <div>
              <p className="text-sm font-medium mb-2">Etiquetas:</p>
              <div className="flex flex-wrap gap-2">
                {formData.tags.length > 0 ? (
                  formData.tags.map(tag => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sin etiquetas</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Compatibilidad:</p>
              <div className="flex flex-wrap gap-2">
                {formData.compatibility.length > 0 ? (
                  formData.compatibility.map(comp => (
                    <Badge key={comp} variant="outline">{comp}</Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sin compatibilidad definida</p>
                )}
              </div>
            </div>

            {formData.documentation && (
              <div>
                <p className="text-sm font-medium mb-2">Documentación:</p>
                <div className="p-4 bg-muted rounded-lg">
                  <pre className="whitespace-pre-wrap text-sm">{formData.documentation}</pre>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
