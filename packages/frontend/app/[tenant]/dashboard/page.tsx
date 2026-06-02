'use client';

import { useEffect, useState, use } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Activity, Users, MessageSquare, CheckCircle, Loader2, Bot, TrendingUp, Shield, Terminal, Wrench, Clock, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import { useAuth } from '@/contexts/AuthContext';

// API Response interfaces
interface DashboardStats {
  conversations: number;
  messages: number;
  agents: number;
  activeAgents: number;
}

interface AgentCoderStats {
  activeSessions: number;
  totalSessions: number;
  messagesThisMonth: number;
  toolsCreated: number;
  scheduledTasksCount: number;
  toolExecutionsToday: number;
  avgMessagesPerSession: number;
  tokensEstimate: number;
}

interface Agent {
  id: string;
  name: string;
  agentMode: string;
  isActive: boolean;
  createdAt: string;
}

interface ConversationStats {
  active: number;
  humanTakeover: number;
  closed: number;
  total: number;
}

interface RecentConversation {
  id: string;
  phoneNumber: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    messages: number;
  };
}

export default function DashboardPage({
  params
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tenantSlug } = use(params);
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [conversationStats, setConversationStats] = useState<ConversationStats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([]);
  const [coderStats, setCoderStats] = useState<AgentCoderStats | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      setIsLoading(true);
      setError(null);

      try {
        const token = storage.getItem<string>('token');
        if (!token) {
          setError('No authentication token found');
          setIsLoading(false);
          return;
        }

        // Fetch all data in parallel
        const [agentsData, conversationsData, coderStatsData] = await Promise.all([
          // TODO: Fix /whatsapp/conversations/stats endpoint
          // api.get<ConversationStats>(`/whatsapp/conversations/stats`, token).catch(() => null),
          api.get<Agent[]>(`/whatsapp/agents`, token).catch(() => []),
          api.get<RecentConversation[]>(`/whatsapp/conversations/active`, token).catch(() => []),
          api.get<{ stats: AgentCoderStats }>(`/ai/dashboard/stats`, token).catch(() => null),
        ]);

        // Set default conversation stats for now
        setConversationStats({
          active: 0,
          humanTakeover: 0,
          closed: 0,
          total: 0
        });
        setAgents(agentsData || []);
        setRecentConversations((conversationsData || []).slice(0, 5));
        setCoderStats(coderStatsData?.stats || null);

      } catch (err: any) {
        console.error('Error fetching dashboard data:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    }

    if (tenantSlug) {
      fetchDashboardData();
    }
  }, [tenantSlug]);

  // Calculate stats for display
  const stats = [
    {
      name: 'Conversaciones Activas',
      value: conversationStats?.active?.toString() || '0',
      icon: MessageSquare,
      color: 'text-blue-500'
    },
    {
      name: 'Agentes Configurados',
      value: agents.length.toString(),
      icon: Bot,
      color: 'text-green-500'
    },
    {
      name: 'Agentes Activos',
      value: agents.filter(a => a.isActive).length.toString(),
      icon: Activity,
      color: 'text-purple-500'
    },
    {
      name: 'Total Conversaciones',
      value: conversationStats?.total?.toString() || '0',
      icon: TrendingUp,
      color: 'text-orange-500'
    },
  ];

  // Stats del Agente Codificador
  const coderStatsCards = coderStats ? [
    {
      name: 'Sesiones del Agente',
      value: coderStats.activeSessions.toString(),
      subtext: `${coderStats.totalSessions} total`,
      icon: Terminal,
      color: 'text-indigo-500'
    },
    {
      name: 'Herramientas Creadas',
      value: coderStats.toolsCreated.toString(),
      icon: Wrench,
      color: 'text-cyan-500'
    },
    {
      name: 'Tareas Programadas',
      value: coderStats.scheduledTasksCount.toString(),
      icon: Clock,
      color: 'text-amber-500'
    },
    {
      name: 'Tokens Usados (mes)',
      value: coderStats.tokensEstimate > 1000 
        ? `${(coderStats.tokensEstimate / 1000).toFixed(1)}K` 
        : coderStats.tokensEstimate.toString(),
      subtext: `${coderStats.messagesThisMonth} mensajes`,
      icon: Zap,
      color: 'text-rose-500'
    },
  ] : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Bienvenido a {tenantSlug}. Aquí está el resumen de tu cuenta.
          </p>
        </div>
        {/* Admin Panel Button - Solo para OWNER y ADMIN */}
        {(user?.role === 'OWNER' || user?.role === 'ADMIN') && (
          <Button asChild variant="default">
            <a href="/admin">
              <Shield className="mr-2 h-4 w-4" />
              Admin Panel
            </a>
          </Button>
        )}
      </div>

      {/* WhatsApp Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.name}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{stat.name}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Agente Codificador Stats */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Agente Codificador</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {coderStatsCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.name}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{stat.name}</CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  {stat.subtext && (
                    <div className="text-xs text-muted-foreground">{stat.subtext}</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {!coderStats && (
            <Card className="col-span-4">
              <CardContent className="py-8 text-center text-muted-foreground">
                Cargando estadísticas del agente codificador...
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Conversations */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Conversaciones Recientes</CardTitle>
            <CardDescription>Últimas conversaciones activas</CardDescription>
          </CardHeader>
          <CardContent>
            {recentConversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay conversaciones activas
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Mensajes</TableHead>
                    <TableHead>Actualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentConversations.map((conv) => (
                    <TableRow key={conv.id}>
                      <TableCell className="font-medium">{conv.phoneNumber}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          conv.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                          conv.status === 'HUMAN_TAKEOVER' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {conv.status}
                        </span>
                      </TableCell>
                      <TableCell>{conv._count?.messages || 0}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(conv.updatedAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Agents */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Agentes WhatsApp</CardTitle>
            <CardDescription>Configuración de agentes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {agents.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No hay agentes configurados
              </div>
            ) : (
              agents.slice(0, 5).map((agent) => (
                <div key={agent.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-sm">{agent.id.slice(0, 8)}...</div>
                      <div className="text-xs text-muted-foreground">{agent.agentMode}</div>
                    </div>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                    agent.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {agent.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              ))
            )}
            <Button variant="outline" className="w-full" asChild>
              <a href={`/${tenantSlug}/agents`}>Ver todos los agentes</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions - Agente Codificador */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas - Agente Codificador</CardTitle>
          <CardDescription>Tareas comunes del agente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-4">
            <Button variant="outline" className="justify-start" asChild>
              <a href={`/${tenantSlug}/accomplish`}>
                <Terminal className="mr-2 h-4 w-4" />
                Chat con Agente
              </a>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <a href={`/${tenantSlug}/tools`}>
                <Wrench className="mr-2 h-4 w-4" />
                Mis Herramientas
              </a>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <a href={`/${tenantSlug}/schedules`}>
                <Clock className="mr-2 h-4 w-4" />
                Tareas Programadas
              </a>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <a href={`/${tenantSlug}/templates`}>
                <Bot className="mr-2 h-4 w-4" />
                Templates de Agentes
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions - WhatsApp */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas - WhatsApp</CardTitle>
          <CardDescription>Tareas comunes de WhatsApp</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-4">
            <Button variant="outline" className="justify-start" asChild>
              <a href={`/${tenantSlug}/agents/new`}>
                <Bot className="mr-2 h-4 w-4" />
                Crear Agente WhatsApp
              </a>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <a href={`/${tenantSlug}/conversations`}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Ver Conversaciones
              </a>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <a href={`/${tenantSlug}/analytics`}>
                <Activity className="mr-2 h-4 w-4" />
                Analíticas
              </a>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <a href={`/${tenantSlug}/integrations`}>
                <TrendingUp className="mr-2 h-4 w-4" />
                Integraciones
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
