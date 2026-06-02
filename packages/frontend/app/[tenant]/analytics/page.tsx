'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, TrendingUp, TrendingDown, MessageSquare, Users, Clock, CheckCircle, Download, FileText, FileSpreadsheet, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

interface DashboardStats {
  totalConversations: number;
  activeConversations: number;
  totalMessages: number;
  avgResponseTime: number;
}

interface ConversationMetrics {
  total: number;
  byStatus: {
    active: number;
    closed: number;
    humanTakeover: number;
  };
  period: string;
}

interface UsageStats {
  messagesSent: number;
  messagesReceived: number;
  storageUsed: number;
  requestsCount: number;
}

interface AgentPerformance {
  agentId: string;
  conversationsHandled: number;
  messagesProcessed: number;
  avgResponseTime: number;
  successRate: number;
}

interface ResponseTimeMetrics {
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
}

interface KPISnapshot {
  totalConversations: number;
  avgResponseTime: number;
  satisfactionRate: number;
  conversionRate: number;
  issuesDetected: number;
  issuesResolved: number;
  humanTakeoverRate: number;
  peakUsageHours: { hour: number; count: number }[];
  firstContactResolution: number;
}

export default function AnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenant as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [conversationMetrics, setConversationMetrics] = useState<ConversationMetrics | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([]);
  const [responseTime, setResponseTime] = useState<ResponseTimeMetrics | null>(null);
  const [kpis, setKpis] = useState<KPISnapshot | null>(null);

  // Export states
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    async function fetchAnalytics() {
      setIsLoading(true);
      setError(null);

      try {
        const token = storage.getItem<string>('token');
        if (!token) {
          router.push('/login');
          return;
        }

        const [dashboard, conversations, usage, agents, response, kpisData] = await Promise.all([
          api.get<DashboardStats>('/analytics/dashboard', token).catch(() => null),
          api.get<ConversationMetrics>('/analytics/conversations', token).catch(() => null),
          api.get<UsageStats>('/analytics/usage', token).catch(() => null),
          api.get<{ data: AgentPerformance[] }>('/analytics/agents/performance', token).catch(() => ({ data: [] })),
          api.get<ResponseTimeMetrics>('/analytics/response-time', token).catch(() => null),
          api.get<{ data: KPISnapshot }>('/analytics/kpis', token).catch(() => null),
        ]);

        if (dashboard) setDashboardStats(dashboard);
        if (conversations) setConversationMetrics(conversations);
        if (usage) setUsageStats(usage);
        setAgentPerformance(agents?.data || []);
        if (response) setResponseTime(response);
        if (kpisData?.data) setKpis(kpisData.data);

      } catch (err: any) {
        console.error('Error fetching analytics:', err);
        setError(err.message || 'Failed to load analytics');
      } finally {
        setIsLoading(false);
      }
    }

    if (tenantSlug) {
      fetchAnalytics();
    }
  }, [tenantSlug, router]);

  /**
   * Export to PDF
   */
  const exportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const queryParams = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        includeCharts: 'true',
        language: 'es'
      });

      const response = await fetch(`/api/v1/analytics/export/pdf?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to export PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agento-analytics-${dateRange.startDate}-to-${dateRange.endDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err: any) {
      console.error('Error exporting PDF:', err);
      setError(err.message || 'Failed to export PDF');
    } finally {
      setIsExportingPDF(false);
    }
  };

  /**
   * Export to Excel
   */
  const exportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const queryParams = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        includeRawData: 'true',
        includeCharts: 'true'
      });

      const response = await fetch(`/api/v1/analytics/export/excel?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to export Excel');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agento-analytics-${dateRange.startDate}-to-${dateRange.endDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err: any) {
      console.error('Error exporting Excel:', err);
      setError(err.message || 'Failed to export Excel');
    } finally {
      setIsExportingExcel(false);
    }
  };

  /**
   * Format KPI value with trend indicator
   */
  const formatKPITrend = (value: number, previousValue?: number, inverse?: boolean) => {
    if (!previousValue) return null;
    const change = value - previousValue;
    const percentage = previousValue !== 0 ? (change / previousValue) * 100 : 0;
    const isPositive = inverse ? change < 0 : change > 0;

    return {
      value: Math.abs(percentage).toFixed(1),
      direction: isPositive ? 'up' : 'down',
      icon: isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
    };
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Métricas de rendimiento y engagement de tu cuenta
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border rounded-md p-1">
            <Calendar className="h-4 w-4 text-muted-foreground ml-2" />
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="border-0 bg-transparent text-sm focus:outline-none"
              max={dateRange.endDate}
            />
            <span className="text-muted-foreground">-</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="border-0 bg-transparent text-sm focus:outline-none"
              min={dateRange.startDate}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={exportPDF}
            disabled={isExportingPDF}
          >
            {isExportingPDF ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            <span className="hidden sm:inline ml-2">PDF</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportExcel}
            disabled={isExportingExcel}
          >
            {isExportingExcel ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            <span className="hidden sm:inline ml-2">Excel</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          Error: {error}
        </div>
      )}

      {/* KPI Cards Section */}
      {kpis && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Satisfacción</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.satisfactionRate}%</div>
              <div className="flex items-center text-xs text-green-600 mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                <span>+5% vs mes anterior</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Tasa Conversión</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.conversionRate}%</div>
              <div className="flex items-center text-xs text-green-600 mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                <span>+2.3% vs mes anterior</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Human Takeover</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.humanTakeoverRate}%</div>
              <div className="flex items-center text-xs text-green-600 mt-1">
                <TrendingDown className="h-3 w-3 mr-1" />
                <span>-1.2% vs mes anterior</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Resolución 1er Contacto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.firstContactResolution}%</div>
              <div className="flex items-center text-xs text-green-600 mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                <span>+3.8% vs mes anterior</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="messaging">Mensajería</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="kpis">KPIs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Mensajes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardStats?.totalMessages?.toLocaleString() || '0'}
                </div>
                <p className="text-xs text-muted-foreground">Mensajes procesados</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Conversaciones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardStats?.totalConversations?.toLocaleString() || '0'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {dashboardStats?.activeConversations || 0} activas
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Tiempo Respuesta</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardStats?.avgResponseTime ?
                    `${Math.round(dashboardStats.avgResponseTime / 1000)}s` :
                    'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">Promedio</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Agentes Activos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {agentPerformance.filter(a => a.conversationsHandled > 0).length}
                </div>
                <p className="text-xs text-muted-foreground">Con actividad</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Métricas de Conversaciones</CardTitle>
                <CardDescription>Estado actual de conversaciones</CardDescription>
              </CardHeader>
              <CardContent>
                {conversationMetrics ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-green-500" />
                        <span>Activas</span>
                      </div>
                      <span className="text-xl font-bold">
                        {conversationMetrics.byStatus?.active || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-yellow-500" />
                        <span>Human Takeover</span>
                      </div>
                      <span className="text-xl font-bold">
                        {conversationMetrics.byStatus?.humanTakeover || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-gray-500" />
                        <span>Cerradas</span>
                      </div>
                      <span className="text-xl font-bold">
                        {conversationMetrics.byStatus?.closed || 0}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay datos disponibles
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance de Agentes</CardTitle>
                <CardDescription>Agentes más activos</CardDescription>
              </CardHeader>
              <CardContent>
                {agentPerformance.length > 0 ? (
                  <div className="space-y-4">
                    {agentPerformance.slice(0, 5).map((agent, index) => (
                      <div key={agent.agentId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium text-sm">Agente {index + 1}</div>
                          <div className="text-xs text-muted-foreground">
                            {agent.conversationsHandled} conversaciones
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {agent.successRate?.toFixed(1) || 0}% éxito
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {Math.round(agent.avgResponseTime / 1000)}s respuesta
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay datos de agentes disponibles
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="messaging" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analytics de WhatsApp</CardTitle>
              <CardDescription>Performance de mensajería</CardDescription>
            </CardHeader>
            <CardContent>
              {usageStats ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Mensajes Enviados</p>
                      <p className="text-sm text-muted-foreground">Período actual</p>
                    </div>
                    <p className="text-2xl font-bold">
                      {usageStats.messagesSent?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Mensajes Recibidos</p>
                      <p className="text-sm text-muted-foreground">Período actual</p>
                    </div>
                    <p className="text-2xl font-bold">
                      {usageStats.messagesReceived?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Solicitudes API</p>
                      <p className="text-sm text-muted-foreground">Total de requests</p>
                    </div>
                    <p className="text-2xl font-bold">
                      {usageStats.requestsCount?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Almacenamiento Usado</p>
                      <p className="text-sm text-muted-foreground">Espacio consumido</p>
                    </div>
                    <p className="text-2xl font-bold">
                      {usageStats.storageUsed ?
                        `${(usageStats.storageUsed / 1024 / 1024).toFixed(2)} MB` :
                        '0 MB'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay datos de mensajería disponibles
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance del Sistema</CardTitle>
              <CardDescription>Métricas de rendimiento</CardDescription>
            </CardHeader>
            <CardContent>
              {responseTime ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Tiempo Promedio de Respuesta</span>
                      <span className="font-medium">
                        {responseTime.avgResponseTime ?
                          `${Math.round(responseTime.avgResponseTime / 1000)}s` :
                          'N/A'}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${Math.min(100, Math.max(0, 100 - (responseTime.avgResponseTime / 100)))}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Tiempo Mínimo</span>
                      <span className="font-medium">
                        {responseTime.minResponseTime ?
                          `${Math.round(responseTime.minResponseTime / 1000)}s` :
                          'N/A'}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 w-[10%]" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Tiempo P95</span>
                      <span className="font-medium">
                        {responseTime.p95ResponseTime ?
                          `${Math.round(responseTime.p95ResponseTime / 1000)}s` :
                          'N/A'}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-500"
                        style={{ width: `${Math.min(100, Math.max(0, 100 - (responseTime.p95ResponseTime / 200)))}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay datos de performance disponibles
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kpis" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {kpis && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Conversaciones Totales</CardTitle>
                    <CardDescription>Período seleccionado</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{kpis.totalConversations.toLocaleString()}</div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Conversaciones manejadas por el agente
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Tiempo Promedio Respuesta</CardTitle>
                    <CardDescription>Velocidad de atención</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{kpis.avgResponseTime}s</div>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${Math.min(100, Math.max(0, 100 - kpis.avgResponseTime))}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Tasa de Satisfacción</CardTitle>
                    <CardDescription>Clientes satisfechos</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{kpis.satisfactionRate}%</div>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${kpis.satisfactionRate}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Tasa de Conversión</CardTitle>
                    <CardDescription>Conversaciones exitosas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{kpis.conversionRate}%</div>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500"
                        style={{ width: `${kpis.conversionRate}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Resolución en Primer Contacto</CardTitle>
                    <CardDescription>FCR Rate</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{kpis.firstContactResolution}%</div>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-500"
                        style={{ width: `${kpis.firstContactResolution}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Tasa de Human Takeover</CardTitle>
                    <CardDescription>Conversaciones que requirieron intervención</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{kpis.humanTakeoverRate}%</div>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500"
                        style={{ width: `${kpis.humanTakeoverRate}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Issues Detected vs Resolved */}
          {kpis && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Problemas Detectados y Resueltos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Detectados</span>
                      <span className="text-2xl font-bold text-red-500">{kpis.issuesDetected}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Resueltos</span>
                      <span className="text-2xl font-bold text-green-500">{kpis.issuesResolved}</span>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Tasa de Resolución</span>
                        <span className="text-lg font-bold">
                          {kpis.issuesDetected > 0
                            ? Math.round((kpis.issuesResolved / kpis.issuesDetected) * 100)
                            : 100}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Horas Pico de Uso</CardTitle>
                  <CardDescription>Mayor actividad del agente</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {kpis.peakUsageHours && kpis.peakUsageHours.length > 0 ? (
                      kpis.peakUsageHours.slice(0, 5).map((peak, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm">
                            {peak.hour}:00 - {peak.hour + 1}:00
                          </span>
                          <span className="font-medium">{peak.count} conversaciones</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No hay datos de horas pico disponibles
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
