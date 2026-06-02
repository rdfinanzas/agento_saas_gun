'use client';

import { useEffect, useState } from 'react';
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
  MessageSquare,
  FlaskConical,
  BarChart3,
  Save,
  Loader2,
  Power,
  PowerOff,
  Play,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  TrendingUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

interface Agent {
  id: string;
  phoneNumberId: string;
  phoneNumber?: string;
  agentMode: 'FULL' | 'LIMITED';
  isActive: boolean;
  isDraft: boolean;
  agentName?: string;
  agentRole?: string;
  agentStyle?: string;
  agentLanguage?: string;
  businessName?: string;
  businessType?: string;
  businessDescription?: string;
  businessHours?: any;
  businessPolicies?: any[];
  agentInstructions?: string;
  faq?: any[];
  allowedTools?: string[];
  blockedTools?: string[];
  createdAt: string;
  updatedAt: string;
}

interface Conversation {
  id: string;
  phoneNumber: string;
  contactName?: string;
  status: string;
  lastMessageAt: string;
  _count?: { messages: number };
}

interface Message {
  id: string;
  direction: string;
  content: string;
  createdAt: string;
}

interface AgentStats {
  totalConversations: number;
  totalMessages: number;
  avgResponseTime: number;
  activeConversations: number;
  topQueries: Array<{ query: string; count: number }>;
  dailyStats: Array<{ date: string; conversations: number; messages: number }>;
}

// PLAN #4: Constantes de herramientas
const LIMITED_MODE_TOOLS = [
  { value: 'read', label: 'Leer Archivos', description: 'Leer contenido de archivos' },
  { value: 'glob', label: 'Buscar Archivos', description: 'Buscar archivos por patrón' },
  { value: 'grep', label: 'Buscar en Archivos', description: 'Buscar texto dentro de archivos' },
  { value: 'excel_read', label: 'Leer Excel', description: 'Leer archivos Excel' },
  { value: 'sheets_read', label: 'Leer Google Sheets', description: 'Leer hojas de cálculo de Google' },
  { value: 'knowledge_query', label: 'Consultar Base de Conocimiento', description: 'Buscar en la base de conocimiento' },
];

const FULL_MODE_TOOLS = [
  ...LIMITED_MODE_TOOLS,
  { value: 'bash', label: 'Ejecutar Comandos', description: 'Ejecutar comandos de terminal' },
  { value: 'write', label: 'Escribir Archivos', description: 'Crear y modificar archivos' },
  { value: 'edit', label: 'Editar Archivos', description: 'Editar líneas específicas de archivos' },
  { value: 'excel_write', label: 'Escribir Excel', description: 'Crear y modificar archivos Excel' },
  { value: 'sheets_write', label: 'Escribir Google Sheets', description: 'Modificar hojas de cálculo de Google' },
  { value: 'sheets_append', label: 'Agregar a Google Sheets', description: 'Agregar filas a hojas de cálculo' },
  { value: 'task', label: 'Crear Subtareas', description: 'Crear subtareas agenticas' },
];

const DANGEROUS_TOOLS = ['bash', 'write', 'edit', 'task'];

const getToolsForMode = (mode: 'FULL' | 'LIMITED') => {
  return mode === 'FULL' ? FULL_MODE_TOOLS : LIMITED_MODE_TOOLS;
};

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenant as string;
  const agentId = params?.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<AgentStats | null>(null);

  // Sandbox state
  const [sandboxMessage, setSandboxMessage] = useState('');
  const [sandboxResponse, setSandboxResponse] = useState('');
  const [sandboxHistory, setSandboxHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    loadAgent();
    loadConversations();
    loadStats();
  }, [agentId]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
    }
  }, [selectedConversation]);

  const loadAgent = async () => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      const data = await api.get<Agent>(`/whatsapp/agents/${agentId}`, token);
      setAgent(data);
    } catch (err) {
      console.error('Error loading agent:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversations = async () => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      const data = await api.get<Conversation[]>(`/whatsapp/agents/${agentId}/conversations`, token);
      setConversations(data || []);
    } catch (err) {
      console.error('Error loading conversations:', err);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      const data = await api.get<Message[]>(`/whatsapp/conversations/${conversationId}/messages`, token);
      setMessages(data || []);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const loadStats = async () => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      const data = await api.get<AgentStats>(`/whatsapp/agents/${agentId}/stats`, token);
      setStats(data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const toggleAgentStatus = async () => {
    if (!agent) return;

    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.patch(`/whatsapp/agents/${agentId}/toggle`, {}, token);
      setAgent({ ...agent, isActive: !agent.isActive });
    } catch (err) {
      console.error('Error toggling agent:', err);
      alert('Error al cambiar estado del agente');
    }
  };

  // PLAN #4: Manejo de herramientas
  const toggleAllowedTool = (toolValue: string) => {
    if (!agent) return;

    const isAllowed = agent.allowedTools?.includes(toolValue);
    const newAllowed = isAllowed
      ? (agent.allowedTools || []).filter(t => t !== toolValue)
      : [...(agent.allowedTools || []), toolValue];

    // Si se agrega a allowed, quitar de blocked
    const newBlocked = isAllowed
      ? agent.blockedTools
      : (agent.blockedTools || []).filter(t => t !== toolValue);

    setAgent({ ...agent, allowedTools: newAllowed, blockedTools: newBlocked });
  };

  const toggleBlockedTool = (toolValue: string) => {
    if (!agent) return;

    const isBlocked = agent.blockedTools?.includes(toolValue);
    const newBlocked = isBlocked
      ? (agent.blockedTools || []).filter(t => t !== toolValue)
      : [...(agent.blockedTools || []), toolValue];

    // Si se agrega a blocked, quitar de allowed
    const newAllowed = isBlocked
      ? agent.allowedTools
      : (agent.allowedTools || []).filter(t => t !== toolValue);

    setAgent({ ...agent, allowedTools: newAllowed, blockedTools: newBlocked });
  };

  const resetToolsToDefault = () => {
    if (!agent) return;

    const defaultBlocked = agent.agentMode === 'FULL' ? [] : DANGEROUS_TOOLS;
    setAgent({ ...agent, allowedTools: [], blockedTools: defaultBlocked });
  };

  const saveAgent = async () => {
    if (!agent) return;

    setIsSaving(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.put(`/whatsapp/agents/${agentId}`, {
        agentName: agent.agentName,
        agentRole: agent.agentRole,
        agentStyle: agent.agentStyle,
        agentLanguage: agent.agentLanguage,
        businessName: agent.businessName,
        businessType: agent.businessType,
        businessDescription: agent.businessDescription,
        agentInstructions: agent.agentInstructions,
        allowedTools: agent.allowedTools || [],
        blockedTools: agent.blockedTools || [],
      }, token);

      alert('Agente actualizado correctamente');
    } catch (err) {
      console.error('Error saving agent:', err);
      alert('Error al guardar el agente');
    } finally {
      setIsSaving(false);
    }
  };

  const testSandbox = async () => {
    if (!sandboxMessage.trim()) return;

    setIsTesting(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      const response = await api.post<{ response: string; conversationHistory: any[] }>(
        '/whatsapp/agents/' + agentId + '/chat',
        { message: sandboxMessage, history: sandboxHistory },
        token
      );

      setSandboxHistory(response.conversationHistory || []);
      setSandboxResponse(response.response);
      setSandboxMessage('');
    } catch (err) {
      console.error('Error testing agent:', err);
      alert('Error al probar el agente');
    } finally {
      setIsTesting(false);
    }
  };

  const takeOverConversation = async (conversationId: string) => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.post(`/whatsapp/conversations/${conversationId}/takeover`, {}, token);
      loadConversations();
      alert('Has tomado control de la conversación');
    } catch (err) {
      console.error('Error taking over:', err);
      alert('Error al tomar control');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Agente no encontrado</h2>
        <Button className="mt-4" onClick={() => router.push(`/${tenantSlug}/agents`)}>
          Volver a agentes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/${tenantSlug}/agents`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {agent.agentName || 'Agente sin nombre'}
              </h1>
              <Badge variant={agent.isActive ? 'default' : 'secondary'}>
                {agent.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
              {agent.isDraft && (
                <Badge variant="outline">
                  <FlaskConical className="mr-1 h-3 w-3" />
                  Modo Sandbox
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {agent.businessName || agent.phoneNumberId}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant={agent.isActive ? 'destructive' : 'default'}
            onClick={toggleAgentStatus}
          >
            {agent.isActive ? (
              <>
                <PowerOff className="mr-2 h-4 w-4" />
                Desactivar
              </>
            ) : (
              <>
                <Power className="mr-2 h-4 w-4" />
                Activar
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">
            <Bot className="mr-2 h-4 w-4" />
            Configuración
          </TabsTrigger>
          <TabsTrigger value="conversations">
            <MessageSquare className="mr-2 h-4 w-4" />
            Conversaciones
          </TabsTrigger>
          <TabsTrigger value="sandbox">
            <FlaskConical className="mr-2 h-4 w-4" />
            Sandbox
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Identidad del Agente</CardTitle>
                <CardDescription>Configura cómo se presenta y comunica tu agente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input
                      value={agent.agentName || ''}
                      onChange={e => setAgent({ ...agent, agentName: e.target.value })}
                      placeholder="Nombre del agente"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Idioma</Label>
                    <Select
                      value={agent.agentLanguage || 'es'}
                      onValueChange={value => setAgent({ ...agent, agentLanguage: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="pt">Português</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rol</Label>
                    <Select
                      value={agent.agentRole || ''}
                      onValueChange={value => setAgent({ ...agent, agentRole: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un rol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ventas">Ventas</SelectItem>
                        <SelectItem value="soporte">Soporte Técnico</SelectItem>
                        <SelectItem value="atencion">Atención al Cliente</SelectItem>
                        <SelectItem value="proveedores">Atención a Proveedores</SelectItem>
                        <SelectItem value="operaciones">Operaciones</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estilo</Label>
                    <Select
                      value={agent.agentStyle || 'profesional'}
                      onValueChange={value => setAgent({ ...agent, agentStyle: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="formal">Formal</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="amigable">Amigable</SelectItem>
                        <SelectItem value="profesional">Profesional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Información Empresarial</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre de la Empresa</Label>
                    <Input
                      value={agent.businessName || ''}
                      onChange={e => setAgent({ ...agent, businessName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rubro</Label>
                    <Input
                      value={agent.businessType || ''}
                      onChange={e => setAgent({ ...agent, businessType: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Textarea
                    value={agent.businessDescription || ''}
                    onChange={e => setAgent({ ...agent, businessDescription: e.target.value })}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Instrucciones del Agente</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={agent.agentInstructions || ''}
                  onChange={e => setAgent({ ...agent, agentInstructions: e.target.value })}
                  placeholder="Instrucciones personalizadas para el agente..."
                  rows={6}
                />
              </CardContent>
            </Card>

            {/* PLAN #4: Configuración de Herramientas */}
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Herramientas</CardTitle>
                <CardDescription>
                  Modo actual: <Badge variant="secondary">{agent.agentMode === 'LIMITED' ? 'Limitado' : 'Completo'}</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {agent.allowedTools && agent.allowedTools.length > 0
                      ? 'Selecciona herramientas específicas (vacío = usa las del modo)'
                      : 'Usará las herramientas por defecto del modo'
                    }
                  </p>
                  <Button variant="outline" size="sm" onClick={resetToolsToDefault}>
                    Restablecer valores por defecto
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Herramientas Permitidas */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <Badge variant="default" className="bg-green-500">Permitidas</Badge>
                      Herramientas permitidas
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {getToolsForMode(agent.agentMode).map(tool => {
                        const isAllowed = agent.allowedTools?.includes(tool.value);
                        return (
                          <div key={tool.value} className="flex items-start gap-2 p-2 rounded hover:bg-muted/50">
                            <input
                              type="checkbox"
                              id={`allow-${tool.value}`}
                              checked={isAllowed}
                              onChange={() => toggleAllowedTool(tool.value)}
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
                    </div>
                  </div>

                  {/* Herramientas Bloqueadas */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <Badge variant="destructive">Bloqueadas</Badge>
                      Herramientas bloqueadas
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {FULL_MODE_TOOLS.map(tool => {
                        const isBlocked = agent.blockedTools?.includes(tool.value);
                        const isInMode = getToolsForMode(agent.agentMode).some(t => t.value === tool.value);
                        return (
                          <div key={tool.value} className={`flex items-start gap-2 p-2 rounded hover:bg-muted/50 ${!isInMode ? 'opacity-50' : ''}`}>
                            <input
                              type="checkbox"
                              id={`block-${tool.value}`}
                              checked={isBlocked}
                              onChange={() => toggleBlockedTool(tool.value)}
                              disabled={!isInMode}
                              className="mt-0.5 rounded"
                            />
                            <div className="flex-1">
                              <label htmlFor={`block-${tool.value}`} className="text-sm font-medium cursor-pointer">
                                {tool.label}
                              </label>
                              <p className="text-xs text-muted-foreground">
                                {tool.description}
                                {!isInMode && ' (No disponible en este modo)'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">💡 Información</p>
                  <ul className="text-blue-800 dark:text-blue-200 space-y-1 text-xs">
                    <li>• <strong>Modo Limitado:</strong> Solo permite herramientas seguras (lectura, consulta)</li>
                    <li>• <strong>Modo Completo:</strong> Permite todas las herramientas incluidas ejecución de código</li>
                    <li>• Si no seleccionas herramientas permitidas, se usarán las del modo por defecto</li>
                    <li>• Las herramientas bloqueadas tienen prioridad sobre las permitidas</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={saveAgent} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Conversations Tab */}
        <TabsContent value="conversations">
          <div className="grid grid-cols-3 gap-6">
            {/* Conversations List */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Conversaciones</CardTitle>
                <CardDescription>
                  {conversations.length} conversaciones
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {conversations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay conversaciones aún
                    </p>
                  ) : (
                    conversations.map(conv => (
                      <div
                        key={conv.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedConversation === conv.id
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => setSelectedConversation(conv.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{conv.contactName || conv.phoneNumber}</span>
                          <Badge
                            variant={conv.status === 'ACTIVE' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {conv.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {conv._count?.messages || 0} mensajes
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Messages */}
            <Card className="col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Mensajes</CardTitle>
                  {selectedConversation && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => takeOverConversation(selectedConversation)}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Tomar Control
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!selectedConversation ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Selecciona una conversación para ver los mensajes
                  </p>
                ) : (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto">
                    {messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === 'INCOMING' ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            msg.direction === 'INCOMING'
                              ? 'bg-muted'
                              : 'bg-primary text-primary-foreground'
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(msg.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sandbox Tab */}
        <TabsContent value="sandbox">
          <Card>
            <CardHeader>
              <CardTitle>Chat con el Agente</CardTitle>
              <CardDescription>
                Prueba el agente en modo sandbox antes de activarlo en producción
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Conversation History */}
              <div className="border rounded-lg p-4 min-h-[300px] max-h-[400px] overflow-y-auto bg-muted/50">
                {sandboxHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Envía un mensaje para probar el agente
                  </p>
                ) : (
                  <div className="space-y-4">
                    {sandboxHistory.map((msg, i) => (
                      <div key={i}>
                        <div
                          className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              msg.role === 'user' ? 'bg-background' : 'bg-primary text-primary-foreground'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                        {msg.role === 'assistant' && i === sandboxHistory.length - 1 && (
                          <div className="flex justify-end gap-1 mt-1">
                            <button
                              onClick={() => {
                                const newHistory = [...sandboxHistory];
                                newHistory[i] = { ...msg, feedback: 'correct' };
                                setSandboxHistory(newHistory);
                              }}
                              className="text-xs px-2 py-1 rounded text-green-600 hover:bg-green-50"
                              title="Respuesta correcta"
                            >
                              ✓ Correcta
                            </button>
                            <button
                              onClick={() => {
                                const newHistory = [...sandboxHistory];
                                newHistory[i] = { ...msg, feedback: 'incorrect' };
                                setSandboxHistory(newHistory);
                              }}
                              className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50"
                              title="Respuesta incorrecta"
                            >
                              ✗ Incorrecta
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <Input
                  value={sandboxMessage}
                  onChange={e => setSandboxMessage(e.target.value)}
                  placeholder="Escribe un mensaje de prueba..."
                  onKeyDown={e => e.key === 'Enter' && testSandbox()}
                />
                <Button onClick={testSandbox} disabled={isTesting}>
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Nota:</strong> En modo sandbox, el agente no envía mensajes reales por WhatsApp.
                  Usa este modo para ajustar su comportamiento antes de activarlo.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <div className="grid gap-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Conversaciones</span>
                  </div>
                  <p className="text-3xl font-bold mt-2">
                    {stats?.totalConversations || 0}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Activas</span>
                  </div>
                  <p className="text-3xl font-bold mt-2">
                    {stats?.activeConversations || 0}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Tiempo Resp.</span>
                  </div>
                  <p className="text-3xl font-bold mt-2">
                    {stats?.avgResponseTime ? `${stats.avgResponseTime}s` : '-'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Mensajes</span>
                  </div>
                  <p className="text-3xl font-bold mt-2">
                    {stats?.totalMessages || 0}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Top Queries */}
            <Card>
              <CardHeader>
                <CardTitle>Consultas Frecuentes</CardTitle>
              </CardHeader>
              <CardContent>
                {!stats?.topQueries?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay datos suficientes aún
                  </p>
                ) : (
                  <div className="space-y-2">
                    {stats.topQueries.map((q, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-muted rounded">
                        <span>{q.query}</span>
                        <Badge>{q.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
