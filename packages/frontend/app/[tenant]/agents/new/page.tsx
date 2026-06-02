'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Bot,
  HelpCircle,
  Save,
  Loader2,
  Globe,
  MessageSquare,
  Sparkles,
  Users,
  Settings,
} from 'lucide-react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

// ============================================
// NUEVA ARQUITECTURA V2 - Agentes Desacoplados
// ============================================

interface AgentV2Config {
  name: string;
  description?: string;
  type: 'INTERNAL' | 'EXTERNAL' | 'MASTER';
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED';
  role?: string;
  style?: string;
  language: string;
  systemPrompt?: string;
  instructions?: string;
  accessType: 'PRIVATE' | 'SHARED' | 'PUBLIC';
  workspaceEnabled: boolean;
  allowedTools: string[];
  blockedTools: string[];
  linkToWhatsApp?: boolean;
  whatsappConfigId?: string;
}

const AGENT_TYPES = [
  {
    value: 'INTERNAL',
    label: 'Agente Interno',
    description: 'Para empleados - Acceso via Web Chat',
    iconName: 'Users',
    color: 'blue',
  },
  {
    value: 'EXTERNAL',
    label: 'Agente Externo',
    description: 'Para clientes - Acceso via WhatsApp',
    iconName: 'MessageSquare',
    color: 'green',
  },
  {
    value: 'MASTER',
    label: 'Agente Maestro',
    description: 'Para configuracion - Crea y gestiona otros agentes',
    iconName: 'Sparkles',
    color: 'purple',
  },
];

const AGENT_STYLES = [
  { value: 'profesional', label: 'Profesional' },
  { value: 'amigable', label: 'Amigable' },
  { value: 'formal', label: 'Formal' },
  { value: 'casual', label: 'Casual' },
];

const ACCESS_TYPES = [
  {
    value: 'PRIVATE',
    label: 'Privado',
    description: 'Solo tu puedes usar este agente',
  },
  {
    value: 'SHARED',
    label: 'Compartido',
    description: 'Todos los usuarios del tenant pueden usarlo',
  },
  {
    value: 'PUBLIC',
    label: 'Publico',
    description: 'Accesible desde fuera (para agentes externos)',
  },
];

const PREDEFINED_ROLES = {
  INTERNAL: [
    { value: 'contable', label: 'Contable' },
    { value: 'rrhh', label: 'Recursos Humanos' },
    { value: 'abogado', label: 'Abogado' },
    { value: 'operaciones', label: 'Operaciones' },
    { value: 'soporte_interno', label: 'Soporte Interno' },
  ],
  EXTERNAL: [
    { value: 'ventas', label: 'Ventas' },
    { value: 'soporte', label: 'Soporte Tecnico' },
    { value: 'atencion', label: 'Atencion al Cliente' },
    { value: 'proveedores', label: 'Atencion a Proveedores' },
  ],
  MASTER: [
    { value: 'maestro', label: 'Agente Maestro' },
  ],
};

const COMMON_TOOLS = [
  { value: 'read', label: 'Leer Archivos', description: 'Leer contenido de archivos' },
  { value: 'websearch', label: 'Busqueda Web', description: 'Buscar informacion en internet' },
  { value: 'webfetch', label: 'Obtener URLs', description: 'Obtener contenido de URLs' },
  { value: 'glob', label: 'Buscar Archivos', description: 'Buscar archivos por patron' },
  { value: 'grep', label: 'Buscar en Archivos', description: 'Buscar texto dentro de archivos' },
  { value: 'knowledge', label: 'Base de Conocimiento', description: 'Consultar knowledge base' },
];

const ADVANCED_TOOLS = [
  ...COMMON_TOOLS,
  { value: 'write', label: 'Escribir Archivos', description: 'Crear y modificar archivos' },
  { value: 'bash', label: 'Ejecutar Comandos', description: 'Ejecutar comandos de terminal' },
  { value: 'task', label: 'Crear Subtareas', description: 'Crear subtareas agenticas' },
];

export default function NewAgentPageV2() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenant as string;

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [whatsappConfigs, setWhatsappConfigs] = useState<any[]>([]);

  const [config, setConfig] = useState<AgentV2Config>({
    name: '',
    description: '',
    type: 'INTERNAL',
    status: 'DRAFT',
    role: '',
    style: 'profesional',
    language: 'es',
    systemPrompt: '',
    instructions: '',
    accessType: 'SHARED',
    workspaceEnabled: false,
    allowedTools: [],
    blockedTools: [],
    linkToWhatsApp: false,
    whatsappConfigId: '',
  });

  // Cargar configuraciones de WhatsApp existentes
  useEffect(() => {
    loadWhatsappConfigs();
  }, []);

  const loadWhatsappConfigs = async () => {
    const token = storage.getItem<string>('token');
    if (!token) return;

    try {
      const response = await api.get('/whatsapp/configs', token);
      if (response.data?.configs) {
        setWhatsappConfigs(response.data.configs);
      }
    } catch (error) {
      console.error('Error loading WhatsApp configs:', error);
    }
  };

  const updateConfig = <K extends keyof AgentV2Config>(key: K, value: AgentV2Config[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const toggleTool = (toolValue: string) => {
    setConfig(prev => {
      const isAllowed = prev.allowedTools.includes(toolValue);
      const newAllowed = isAllowed
        ? prev.allowedTools.filter(t => t !== toolValue)
        : [...prev.allowedTools, toolValue];

      const newBlocked = isAllowed
        ? prev.blockedTools
        : prev.blockedTools.filter(t => t !== toolValue);

      return { ...prev, allowedTools: newAllowed, blockedTools: newBlocked };
    });
  };

  const handleSave = async () => {
    const token = storage.getItem<string>('token');
    if (!token) {
      router.push('/login');
      return;
    }

    if (!config.name.trim()) {
      alert('El nombre del agente es obligatorio');
      setActiveTab('basic');
      return;
    }

    setIsLoading(true);
    try {
      const agentResponse = await api.post('/agents', {
        name: config.name,
        description: config.description,
        type: config.type,
        status: config.status,
        role: config.role,
        style: config.style,
        language: config.language,
        systemPrompt: config.systemPrompt,
        instructions: config.instructions,
        accessType: config.accessType,
        workspaceEnabled: config.workspaceEnabled,
        allowedTools: config.allowedTools.length > 0 ? config.allowedTools : undefined,
        blockedTools: config.blockedTools.length > 0 ? config.blockedTools : undefined,
      }, token);

      const agentId = agentResponse.data?.id;

      if (!agentId) {
        throw new Error('No se pudo crear el agente');
      }

      if (config.type === 'EXTERNAL' && config.linkToWhatsApp && config.whatsappConfigId) {
        await api.post(`/whatsapp/${config.whatsappConfigId}/link-agent`, {
          agentId,
        }, token);
      }

      router.push(`/${tenantSlug}/agents`);

    } catch (err: any) {
      console.error('Error creating agent:', err);
      alert('Error al crear el agente: ' + (err.response?.data?.error || err.message || 'Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeChange = (type: 'INTERNAL' | 'EXTERNAL' | 'MASTER') => {
    setConfig(prev => ({
      ...prev,
      type,
      role: PREDEFINED_ROLES[type][0]?.value || '',
      workspaceEnabled: type === 'INTERNAL',
      linkToWhatsApp: type === 'EXTERNAL' ? prev.linkToWhatsApp : false,
      allowedTools: [],
      blockedTools: type === 'INTERNAL' || type === 'MASTER' ? ['bash', 'write', 'task'] : [],
    }));
    setActiveTab('basic');
  };

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Users': return <Users className="h-6 w-6" />;
      case 'MessageSquare': return <MessageSquare className="h-6 w-6" />;
      case 'Sparkles': return <Sparkles className="h-6 w-6" />;
      default: return <Bot className="h-6 w-6" />;
    }
  };

  const getTypeCardStyles = (typeValue: string, isSelected: boolean) => {
    if (!isSelected) {
      return 'border-muted hover:border-muted-foreground/50';
    }

    switch (typeValue) {
      case 'INTERNAL':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-950/20';
      case 'EXTERNAL':
        return 'border-green-500 bg-green-50 dark:bg-green-950/20';
      case 'MASTER':
        return 'border-purple-500 bg-purple-50 dark:bg-purple-950/20';
      default:
        return 'border-muted hover:border-muted-foreground/50';
    }
  };

  const getTypeIconBg = (typeValue: string) => {
    switch (typeValue) {
      case 'INTERNAL': return 'bg-blue-500';
      case 'EXTERNAL': return 'bg-green-500';
      case 'MASTER': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const availableRoles = PREDEFINED_ROLES[config.type] || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/${tenantSlug}/agents`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nuevo Agente V2</h1>
          <p className="text-muted-foreground">
            Crea un agente digital desacoplado de canales
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-purple-900 dark:text-purple-100 mb-1">
              Nueva Arquitectura V2 - Agentes Desacoplados
            </h3>
            <p className="text-sm text-purple-700 dark:text-purple-300">
              Los agentes ahora son independientes de los canales. Primero creas el agente,
              luego puedes vincularlo a WhatsApp u otros canales segun el tipo.
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">
            <Bot className="mr-2 h-4 w-4" />
            Basico
          </TabsTrigger>
          <TabsTrigger value="identity">
            <Settings className="mr-2 h-4 w-4" />
            Identidad
          </TabsTrigger>
          <TabsTrigger value="tools">
            <Bot className="mr-2 h-4 w-4" />
            Herramientas
          </TabsTrigger>
          <TabsTrigger value="whatsapp">
            <MessageSquare className="mr-2 h-4 w-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="knowledge">
            <HelpCircle className="mr-2 h-4 w-4" />
            Conocimiento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tipo de Agente</CardTitle>
                <CardDescription>
                  Selecciona el tipo de agente segun su proposito
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {AGENT_TYPES.map((type) => (
                    <div
                      key={type.value}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${getTypeCardStyles(type.value, config.type === type.value)}`}
                      onClick={() => handleTypeChange(type.value as any)}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`h-6 w-6 ${getTypeIconBg(type.value)} text-white rounded p-1 flex items-center justify-center`}>
                          {getIconComponent(type.iconName)}
                        </div>
                        <div>
                          <h4 className="font-semibold">{type.label}</h4>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Informacion Basica</CardTitle>
                <CardDescription>
                  Define los datos principales del agente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre del Agente *</Label>
                    <Input
                      id="name"
                      value={config.name}
                      onChange={(e) => updateConfig('name', e.target.value)}
                      placeholder="Ej: Contable, Ventas, Soporte"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Estado Inicial</Label>
                    <Select
                      value={config.status}
                      onValueChange={(value: any) => updateConfig('status', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">Borrador</SelectItem>
                        <SelectItem value="ACTIVE">Activo</SelectItem>
                        <SelectItem value="PAUSED">Pausado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripcion (opcional)</Label>
                  <Textarea
                    id="description"
                    value={config.description}
                    onChange={(e) => updateConfig('description', e.target.value)}
                    placeholder="Describe brevemente que hace este agente..."
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="accessType">Tipo de Acceso</Label>
                    <Select
                      value={config.accessType}
                      onValueChange={(value: any) => updateConfig('accessType', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCESS_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex flex-col">
                              <span>{type.label}</span>
                              <span className="text-xs text-muted-foreground">{type.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {config.type === 'INTERNAL' && (
                    <div className="space-y-2">
                      <Label htmlFor="workspace">Habilitar Workspace</Label>
                      <Select
                        value={config.workspaceEnabled ? 'true' : 'false'}
                        onValueChange={(value) => updateConfig('workspaceEnabled', value === 'true')}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Si - Habilitar workspace para este agente</SelectItem>
                          <SelectItem value="false">No - Sin workspace</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="identity">
          <Card>
            <CardHeader>
              <CardTitle>Identidad del Agente</CardTitle>
              <CardDescription>
                Define como se presenta y comunica tu agente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Rol Predefinido</Label>
                  <Select
                    value={config.role}
                    onValueChange={(value) => updateConfig('role', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="style">Estilo de Comunicacion</Label>
                  <Select
                    value={config.style}
                    onValueChange={(value) => updateConfig('style', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AGENT_STYLES.map((style) => (
                        <SelectItem key={style.value} value={style.value}>
                          {style.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Idioma</Label>
                <Select
                  value={config.language}
                  onValueChange={(value) => updateConfig('language', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Espanol</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="pt">Portugues</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Prompt (opcional)</Label>
                <Textarea
                  id="systemPrompt"
                  value={config.systemPrompt}
                  onChange={(e) => updateConfig('systemPrompt', e.target.value)}
                  placeholder="Prompt del sistema que define la personalidad del agente..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Si no defines uno, se usara un prompt predefinido segun el tipo de agente
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Instrucciones Adicionales (opcional)</Label>
                <Textarea
                  id="instructions"
                  value={config.instructions}
                  onChange={(e) => updateConfig('instructions', e.target.value)}
                  placeholder="Instrucciones especificas para este agente..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools">
          <Card>
            <CardHeader>
              <CardTitle>Herramientas del Agente</CardTitle>
              <CardDescription>
                Define que herramientas puede usar el agente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Badge variant="default" className="bg-green-500">Permitidas</Badge>
                      Herramientas permitidas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-60 overflow-y-auto">
                    {(config.type === 'INTERNAL' || config.type === 'MASTER' ? COMMON_TOOLS : ADVANCED_TOOLS).map((tool) => {
                      const isAllowed = config.allowedTools.includes(tool.value);
                      return (
                        <div key={tool.value} className="flex items-start gap-2 p-2 rounded hover:bg-muted/50">
                          <input
                            type="checkbox"
                            id={`allow-${tool.value}`}
                            checked={isAllowed}
                            onChange={() => toggleTool(tool.value)}
                            className="mt-0.5 rounded"
                          />
                          <div className="flex-1">
                            <label htmlFor={`allow-${tool.value}`} className="text-sm font-medium cursor-pointer">
                              {tool.label}
                            </label>
                            <p className="text-xs text-muted-foreground">{tool.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Badge variant="destructive">Bloqueadas</Badge>
                      Herramientas bloqueadas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-60 overflow-y-auto">
                    {ADVANCED_TOOLS.map((tool) => {
                      const isBlocked = config.blockedTools.includes(tool.value);
                      return (
                        <div key={tool.value} className="flex items-start gap-2 p-2 rounded hover:bg-muted/50">
                          <input
                            type="checkbox"
                            id={`block-${tool.value}`}
                            checked={isBlocked}
                            onChange={() => {
                              setConfig((prev) => {
                                const newBlocked = isBlocked
                                  ? prev.blockedTools.filter((t) => t !== tool.value)
                                  : [...prev.blockedTools, tool.value];

                                const newAllowed = isBlocked
                                  ? prev.allowedTools
                                  : prev.allowedTools.filter((t) => t !== tool.value);

                                return { ...prev, blockedTools: newBlocked, allowedTools: newAllowed };
                              });
                            }}
                            className="mt-0.5 rounded"
                          />
                          <div className="flex-1">
                            <label htmlFor={`block-${tool.value}`} className="text-sm font-medium cursor-pointer">
                              {tool.label}
                            </label>
                            <p className="text-xs text-muted-foreground">{tool.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">Informacion</p>
                <ul className="text-blue-800 dark:text-blue-200 space-y-1 text-xs">
                  <li>• <strong>Agentes Internos/Master:</strong> Solo lectura por defecto</li>
                  <li>• <strong>Agentes Externos:</strong> Todas las herramientas disponibles</li>
                  <li>• Las herramientas bloqueadas tienen prioridad sobre las permitidas</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp">
          <div className="space-y-4">
            {config.type === 'INTERNAL' || config.type === 'MASTER' ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">WhatsApp no disponible</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Los agentes de tipo {config.type === 'INTERNAL' ? 'Interno' : 'Maestro'}
                      no se vinculan a WhatsApp.
                    </p>
                    <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg max-w-md mx-auto">
                      <p className="font-medium mb-1">Flujo correcto:</p>
                      <ul className="space-y-1">
                        <li>• Agentes <strong>INTERNOS:</strong> Se usan via Web Chat para empleados</li>
                        <li>• Agentes <strong>EXTERNOS:</strong> Se vinculan a WhatsApp para atender clientes</li>
                        <li>• Agentes <strong>MASTER:</strong> Solo para configuracion y gestion</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Vincular a WhatsApp</CardTitle>
                    <CardDescription>
                      Opcional: Selecciona una configuracion de WhatsApp existente para vincular este agente
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="linkToWhatsApp"
                        checked={config.linkToWhatsApp}
                        onChange={(e) => updateConfig('linkToWhatsApp', e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="linkToWhatsApp" className="cursor-pointer">
                        Vincular este agente a una configuracion de WhatsApp
                      </Label>
                    </div>

                    {config.linkToWhatsApp && (
                      <>
                        {whatsappConfigs.length === 0 ? (
                          <div className="text-center py-6 border rounded-lg">
                            <p className="text-sm text-muted-foreground mb-3">
                              No hay configuraciones de WhatsApp disponibles
                            </p>
                            <Button
                              variant="outline"
                              onClick={() => router.push(`/${tenantSlug}/whatsapp`)}
                            >
                              <Globe className="mr-2 h-4 w-4" />
                              Ir a WhatsApp
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label>Selecciona una configuracion de WhatsApp</Label>
                            <Select
                              value={config.whatsappConfigId}
                              onValueChange={(value) => updateConfig('whatsappConfigId', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona una configuracion" />
                              </SelectTrigger>
                              <SelectContent>
                                {whatsappConfigs.map((cfg: any) => (
                                  <SelectItem key={cfg.id} value={cfg.id}>
                                    <div className="flex flex-col">
                                      <span className="font-medium">
                                        {cfg.phoneNumber || `Config ${cfg.id.slice(0, 8)}`}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {cfg.isActive ? 'Activo' : 'Inactivo'}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Crear Nueva Configuracion de WhatsApp</CardTitle>
                    <CardDescription>
                      No tienes una configuracion de WhatsApp? Crea una nueva primero.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => router.push(`/${tenantSlug}/whatsapp`)}
                    >
                      <Globe className="mr-2 h-4 w-4" />
                      Ir a Configuracion de WhatsApp
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="knowledge">
          <Card>
            <CardHeader>
              <CardTitle>Base de Conocimiento</CardTitle>
              <CardDescription>
                Configura la knowledge base del agente (proximamente)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Proximamente</h3>
                <p className="text-sm text-muted-foreground">
                  Esta funcionalidad estara disponible proximamente.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => router.push(`/${tenantSlug}/agents`)}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Crear Agente
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
