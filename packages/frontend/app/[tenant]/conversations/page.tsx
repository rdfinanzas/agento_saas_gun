'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Loader2, Eye, UserCheck, Search, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Conversation {
  id: string;
  phoneNumber: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages?: {
    id: string;
    content: string;
    direction: string;
    createdAt: string;
  }[];
  config?: {
    agentMode: string;
  };
}

interface ConversationStats {
  active: number;
  humanTakeover: number;
  closed: number;
  total: number;
  pendingApprovals?: number;
}

export default function ConversationsPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenant as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'HUMAN_TAKEOVER' | 'CLOSED'>('ACTIVE');
  const [activeConversations, setActiveConversations] = useState<Conversation[]>([]);
  const [takeoverConversations, setTakeoverConversations] = useState<Conversation[]>([]);
  const [closedConversations, setClosedConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<ConversationStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const token = storage.getItem<string>('token') ?? undefined;

  const fetchConversations = useCallback(async () => {
    if (!tenantSlug || !token) return;

    setIsLoading(true);
    setError(null);

    try {
      const [active, takeover, closed, statsData] = await Promise.all([
        api.get<Conversation[]>('/whatsapp/conversations/active', token).catch(() => []),
        api.get<Conversation[]>('/whatsapp/conversations/takeover', token).catch(() => []),
        api.get<Conversation[]>('/whatsapp/conversations/closed', token).catch(() => []),
        api.get<ConversationStats>('/whatsapp/conversations/stats', token).catch(() => null),
      ]);

      setActiveConversations(active || []);
      setTakeoverConversations(takeover || []);
      setClosedConversations(closed || []);
      setStats(statsData);

    } catch (err: any) {
      console.error('Error fetching conversations:', err);
      setError(err.message || 'Failed to load conversations');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [tenantSlug, token]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // WebSocket for real-time updates
  useWebSocket({
    token,
    tenantId: tenantSlug,
    onMessageReceived: (data) => {
      // Refresh conversations when new message arrives
      fetchConversations();
    },
    onConversationUpdated: (data) => {
      // Refresh when conversation status changes
      fetchConversations();
    },
  });

  const takeOver = async (conversationId: string) => {
    if (!token) return;

    try {
      await api.post(`/whatsapp/conversations/${conversationId}/takeover`, {}, token);
      await fetchConversations();
    } catch (err: any) {
      console.error('Error taking over conversation:', err);
      setError(err.message || 'Error al tomar control de la conversación');
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchConversations();
  };

  const filterConversations = (conversations: Conversation[]) => {
    return conversations.filter((conv) => {
      const matchesStatus = statusFilter === 'all' || conv.status === statusFilter;
      const matchesSearch = !searchQuery ||
        conv.phoneNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  };

  const renderConversationTable = (conversations: Conversation[], showTakeover: boolean = false) => {
    const filtered = filterConversations(conversations);

    if (filtered.length === 0) {
      return (
        <div className="text-center py-12">
          <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">
            {searchQuery || statusFilter !== 'all' ? 'No hay resultados' : 'No hay conversaciones'}
          </h3>
          <p className="mt-2 text-muted-foreground">
            {searchQuery || statusFilter !== 'all'
              ? 'Intenta ajustar los filtros de búsqueda'
              : 'Las conversaciones aparecerán aquí cuando los usuarios envíen mensajes'
            }
          </p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Teléfono</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Modo Agente</TableHead>
            <TableHead>Mensajes</TableHead>
            <TableHead>Última Actividad</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((conv) => (
            <TableRow key={conv.id}>
              <TableCell className="font-medium">{conv.phoneNumber}</TableCell>
              <TableCell>
                <Badge variant={
                  conv.status === 'ACTIVE' ? 'default' :
                  conv.status === 'HUMAN_TAKEOVER' ? 'default' :
                  'secondary'
                }>
                  {conv.status === 'ACTIVE' ? 'Activa' :
                   conv.status === 'HUMAN_TAKEOVER' ? 'Control Manual' :
                   conv.status}
                </Badge>
              </TableCell>
              <TableCell>{conv.config?.agentMode || 'N/A'}</TableCell>
              <TableCell>{conv.messages?.length || 0}</TableCell>
              <TableCell>
                {new Date(conv.updatedAt).toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                  >
                    <a href={`/${tenantSlug}/conversations/${conv.id}`}>
                      <Eye className="h-4 w-4" />
                    </a>
                  </Button>
                  {showTakeover && conv.status === 'ACTIVE' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => takeOver(conv.id)}
                      title="Tomar control"
                    >
                      <UserCheck className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
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
          <h1 className="text-3xl font-bold tracking-tight">Conversaciones</h1>
          <p className="text-muted-foreground">
            Monitorea y gestiona las conversaciones de WhatsApp
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats?.active || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Human Takeover</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats?.humanTakeover || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cerradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">{stats?.closed || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Aprobaciones Pendientes</CardTitle>
            {stats?.pendingApprovals ? (
              <Badge variant="outline" className="ml-2">
                {stats.pendingApprovals}
              </Badge>
            ) : null}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats?.pendingApprovals || 0}</div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          Error: {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Conversaciones</CardTitle>
              <CardDescription>Gestiona y monitorea todas las conversaciones</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por teléfono o ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ACTIVE">Activas</SelectItem>
                <SelectItem value="HUMAN_TAKEOVER">Control Manual</SelectItem>
                <SelectItem value="CLOSED">Cerradas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="active">
                Activas ({activeConversations.length})
              </TabsTrigger>
              <TabsTrigger value="takeover">
                Control Manual ({takeoverConversations.length})
              </TabsTrigger>
              <TabsTrigger value="closed">
                Cerradas ({closedConversations.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-4">
              {renderConversationTable(activeConversations, true)}
            </TabsContent>
            <TabsContent value="takeover" className="mt-4">
              {renderConversationTable(takeoverConversations, false)}
            </TabsContent>
            <TabsContent value="closed" className="mt-4">
              {renderConversationTable(closedConversations, false)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
