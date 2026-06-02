'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Bot, Loader2, Trash2, Settings, Smartphone, Wifi, WifiOff, RefreshCw, Pause, Play } from 'lucide-react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

interface Agent {
  id: string;
  name: string;
  description?: string;
  type: 'INTERNAL' | 'EXTERNAL' | 'MASTER';
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  systemPrompt?: string;
  allowedTools?: string[];
  createdAt: string;
  updatedAt: string;
}

interface WhatsAppConfig {
  id: string;
  agentId: string;
  evolutionInstanceName: string;
  connectionStatus: string;
  isActive: boolean;
  phoneNumber: string;
}

export default function AgentsPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenant as string;

  const [isLoading, setIsLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [whatsappConfigs, setWhatsappConfigs] = useState<Record<string, WhatsAppConfig>>({});
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // WhatsApp linking state
  const [linkingAgent, setLinkingAgent] = useState<Agent | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [linkStatus, setLinkStatus] = useState<string>('');
  const [linkedNumber, setLinkedNumber] = useState<string>('');
  const [pollTimer, setPollTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function fetchAgents() {
      setIsLoading(true);
      setError(null);

      try {
        const token = storage.getItem<string>('token');
        if (!token) {
          router.push('/login');
          return;
        }

        const data = await api.get<{ success: boolean; data: Agent[] }>('/agents', token);
        setAgents(data?.data || data || []);

        // Load WhatsApp configs
        try {
          const configs = await api.get<WhatsAppConfig[]>('/whatsapp/agents', token);
          const configMap: Record<string, WhatsAppConfig> = {};
          if (Array.isArray(configs)) {
            configs.forEach((c) => { configMap[c.agentId] = c; });
          }
          setWhatsappConfigs(configMap);
        } catch {
          // No configs yet, that's fine
        }

      } catch (err: any) {
        console.error('Error fetching agents:', err);
        setError(err.message || 'Error al cargar agentes');
      } finally {
        setIsLoading(false);
      }
    }

    if (tenantSlug) {
      fetchAgents();
    }
  }, [tenantSlug, router]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [pollTimer]);

  const refreshConfigs = async () => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;
      const configs = await api.get<WhatsAppConfig[]>('/whatsapp/agents', token);
      const configMap: Record<string, WhatsAppConfig> = {};
      if (Array.isArray(configs)) {
        configs.forEach((c) => { configMap[c.agentId] = c; });
      }
      setWhatsappConfigs(configMap);
    } catch {}
  };

  const startWhatsAppLink = async (agent: Agent) => {
    setLinkingAgent(agent);
    setQrCode(null);
    setIsLinking(true);
    setLinkStatus('Creando instancia...');
    setLinkedNumber('');

    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      const instanceName = `agent-${agent.id.substring(0, 8)}`;
      const result = await api.post<{
        success: boolean;
        instanceName: string;
        qrCode?: string;
        status: string;
      }>('/whatsapp/evolution/create-instance', { instanceName, agentId: agent.id }, token);

      if (result?.qrCode) {
        setQrCode(result.qrCode);
        setLinkStatus('Escanea el codigo QR con tu WhatsApp');
        startPolling(result.instanceName);
      } else {
        setLinkStatus('Obteniendo codigo QR...');
        try {
          const qrResult = await api.get<{
            success: boolean;
            qrCode?: string;
            code?: string;
          }>(`/whatsapp/evolution/qr/${instanceName}`, token);

          if (qrResult?.qrCode) {
            setQrCode(qrResult.qrCode);
            setLinkStatus('Escanea el codigo QR con tu WhatsApp');
            startPolling(instanceName);
          } else {
            setLinkStatus('No se pudo obtener el QR. Intenta de nuevo.');
          }
        } catch {
          setLinkStatus('Error al obtener QR. Intenta de nuevo.');
        }
      }
    } catch (err: any) {
      console.error('Error linking WhatsApp:', err);
      setLinkStatus('Error: ' + (err.message || 'No se pudo crear la instancia'));
    } finally {
      setIsLinking(false);
    }
  };

  const startPolling = (instanceName: string) => {
    const timer = setInterval(async () => {
      try {
        const token = storage.getItem<string>('token');
        if (!token) return;

        const status = await api.get<{
          success: boolean;
          status: string;
          phoneNumber?: string;
          profileName?: string;
        }>(`/whatsapp/evolution/status/${instanceName}`, token);

        if (status?.status === 'open') {
          setLinkStatus('Conectado');
          setLinkedNumber(status.phoneNumber || '');
          clearInterval(timer);
          setPollTimer(null);
          // Auto-close dialog after 2 seconds and refresh configs
          setTimeout(() => {
            closeLinkDialog();
            refreshConfigs();
          }, 2000);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);

    setPollTimer(timer);
  };

  const refreshQR = async () => {
    if (!linkingAgent) return;
    const token = storage.getItem<string>('token');
    if (!token) return;

    const instanceName = `agent-${linkingAgent.id.substring(0, 8)}`;
    setLinkStatus('Actualizando QR...');

    try {
      const qrResult = await api.get<{
        success: boolean;
        qrCode?: string;
      }>(`/whatsapp/evolution/qr/${instanceName}`, token);

      if (qrResult?.qrCode) {
        setQrCode(qrResult.qrCode);
        setLinkStatus('Escanea el nuevo codigo QR');
      }
    } catch {
      setLinkStatus('Error al refrescar QR');
    }
  };

  const closeLinkDialog = () => {
    if (pollTimer) clearInterval(pollTimer);
    setPollTimer(null);
    setLinkingAgent(null);
    setQrCode(null);
    setLinkStatus('');
    setLinkedNumber('');
  };

  const toggleBotActive = async (agentId: string) => {
    setTogglingId(agentId);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;
      await api.patch(`/whatsapp/agents/${agentId}/toggle`, {}, token);
      await refreshConfigs();
    } catch (err) {
      console.error('Error toggling bot:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const deleteAgent = async (agentId: string) => {
    if (!confirm('Eliminar este agente?')) return;

    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.delete(`/agents/${agentId}`, token);
      setAgents(agents.filter(a => a.id !== agentId));
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'EXTERNAL': return 'WhatsApp';
      case 'INTERNAL': return 'Interno';
      case 'MASTER': return 'Maestro';
      default: return type;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'EXTERNAL': return 'default';
      case 'INTERNAL': return 'secondary';
      case 'MASTER': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'default';
      case 'DRAFT': return 'secondary';
      case 'PAUSED': return 'outline';
      default: return 'secondary';
    }
  };

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
          <h1 className="text-3xl font-bold tracking-tight">Agentes</h1>
          <p className="text-muted-foreground">
            Gestiona tus agentes de IA
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          Error: {error}
        </div>
      )}

      {agents.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No hay agentes</h3>
            <p className="mt-2 text-muted-foreground">
              Usa el Workspace para crear tu primer agente
            </p>
            <Button className="mt-4" onClick={() => router.push(`/${tenantSlug}/workspace`)}>
              Ir al Workspace
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Mis Agentes</CardTitle>
            <CardDescription>
              {agents.length} agente{agents.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => {
                  const config = whatsappConfigs[agent.id];
                  const isConnected = config?.connectionStatus === 'CONNECTED';
                  const isDisconnected = !config || config?.connectionStatus === 'DISCONNECTED';
                  const isPaused = config?.isActive === false;

                  return (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{agent.name}</div>
                          {agent.description && (
                            <div className="text-sm text-muted-foreground">{agent.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getTypeBadge(agent.type) as any}>
                          {getTypeLabel(agent.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadge(agent.status) as any}>
                          {agent.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {agent.type === 'EXTERNAL' ? (
                          <div className="flex items-center gap-2">
                            {config ? (
                              <>
                                <Badge
                                  variant={isConnected ? 'default' : 'secondary'}
                                  className={isConnected ? 'bg-green-600 hover:bg-green-700' : ''}
                                >
                                  {isConnected ? (
                                    <><Wifi className="mr-1 h-3 w-3" /> Conectado</>
                                  ) : isDisconnected ? (
                                    <><WifiOff className="mr-1 h-3 w-3" /> Desconectado</>
                                  ) : (
                                    <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Conectando</>
                                  )}
                                </Badge>
                                <Button
                                  variant={isPaused ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => toggleBotActive(agent.id)}
                                  disabled={togglingId === agent.id}
                                  title={isPaused ? 'Activar bot' : 'Pausar bot (no responde mensajes)'}
                                >
                                  {togglingId === agent.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : isPaused ? (
                                    <><Play className="mr-1 h-3 w-3" /> Activar</>
                                  ) : (
                                    <><Pause className="mr-1 h-3 w-3" /> Pausar</>
                                  )}
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startWhatsAppLink(agent)}
                              >
                                <Smartphone className="mr-2 h-4 w-4" />
                                Vincular
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(agent.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                          >
                            <a href={`/${tenantSlug}/agents/${agent.id}`}>
                              <Settings className="h-4 w-4" />
                            </a>
                          </Button>
                          {agent.type !== 'MASTER' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteAgent(agent.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* WhatsApp Linking Dialog */}
      <Dialog open={!!linkingAgent} onOpenChange={(open) => !open && closeLinkDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {linkStatus === 'Conectado' ? 'WhatsApp Conectado' : 'Vincular WhatsApp'}
            </DialogTitle>
            <DialogDescription>
              {linkingAgent?.name && `Agente: ${linkingAgent.name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center py-4">
            {isLinking && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{linkStatus}</p>
              </div>
            )}

            {!isLinking && linkStatus === 'Conectado' && (
              <div className="flex flex-col items-center gap-3">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <Wifi className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-sm font-medium text-green-600">Conectado exitosamente</p>
                {linkedNumber && (
                  <p className="text-sm text-muted-foreground">Numero: {linkedNumber}</p>
                )}
                <p className="text-xs text-muted-foreground">Cerrando automaticamente...</p>
              </div>
            )}

            {!isLinking && linkStatus !== 'Conectado' && qrCode && (
              <div className="flex flex-col items-center gap-4">
                <p className="text-sm text-muted-foreground text-center">{linkStatus}</p>
                <div className="bg-white p-4 rounded-lg border">
                  <img
                    src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                    alt="QR Code"
                    className="w-64 h-64"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  Abri WhatsApp en tu celular &rarr; Menu &rarr; Dispositivos vinculados &rarr; Vincular dispositivo
                </p>
                <Button variant="outline" size="sm" onClick={refreshQR}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refrescar QR
                </Button>
              </div>
            )}

            {!isLinking && linkStatus !== 'Conectado' && !qrCode && (
              <div className="flex flex-col items-center gap-3">
                <WifiOff className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{linkStatus}</p>
                <Button variant="outline" onClick={() => linkingAgent && startWhatsAppLink(linkingAgent)}>
                  Reintentar
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
