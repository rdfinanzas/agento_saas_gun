'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Check,
  X,
  Edit,
  RefreshCw,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Bell,
} from 'lucide-react';
import { ApprovalCard } from '@/components/chat/ApprovalCard';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import { useWebSocket, wsClient } from '@/lib/websocket';

export interface PendingResponse {
  id: string;
  tenantId: string;
  conversationId: string;
  agentId: string;
  proposedResponse: string;
  reason?: string;
  confidence?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  expiresAt: string;
  conversation?: {
    phoneNumber: string;
    customerMessage?: string;
  };
}

export interface ApprovalStats {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  totalExpired: number;
  avgResponseTime: number;
}

export default function ApprovalsPage() {
  const params = useParams();
  const tenantSlug = params?.tenant as string;

  const [pendingResponses, setPendingResponses] = useState<PendingResponse[]>([]);
  const [historyResponses, setHistoryResponses] = useState<PendingResponse[]>([]);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedResponses, setSelectedResponses] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  const token = storage.getItem<string>('token');

  const fetchApprovals = useCallback(async () => {
    if (!token) return;

    try {
      const [responsesData, statsData] = await Promise.all([
        api.get<{ responses: PendingResponse[]; count: number }>('/approvals', token).catch(() => ({ responses: [], count: 0 })),
        api.get<{ stats: ApprovalStats }>('/approvals/stats', token).catch(() => ({ stats: null })),
      ]);

      // Filter responses based on status
      const pending = responsesData.responses.filter((r: PendingResponse) => r.status === 'PENDING');
      const history = responsesData.responses.filter((r: PendingResponse) => r.status !== 'PENDING');

      setPendingResponses(pending);
      setHistoryResponses(history);
      setStats(statsData.stats);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching approvals:', err);
      setError(err.message || 'Failed to load approvals');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // PLAN #7: Conexión WebSocket para notificaciones en tiempo real
  const { isConnected } = useWebSocket(token);

  useEffect(() => {
    if (!token || !isConnected) return;

    // Escuchar nuevas aprobaciones pendientes
    const unsubscribe = wsClient.onPendingApproval((data) => {
      console.log('[Approvals] Nueva aprobación pendiente:', data);

      // Refrescar la lista para mostrar la nueva aprobación
      fetchApprovals();
    });

    // Escuchar respuestas aprobadas
    const unsubscribeApproved = wsClient.onResponseApproved((data) => {
      console.log('[Approvals] Respuesta aprobada:', data);
      fetchApprovals();
    });

    return () => {
      unsubscribe();
      unsubscribeApproved();
    };
  }, [token, isConnected, fetchApprovals]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchApprovals();
  };

  const handleApprove = async (responseId: string) => {
    if (!token) return;

    try {
      await api.post(`/approvals/${responseId}/approve`, {}, token);
      await fetchApprovals();
      setSelectedResponses((prev) => {
        const next = new Set(prev);
        next.delete(responseId);
        return next;
      });
    } catch (err: any) {
      console.error('Error approving response:', err);
      setError(err.message || 'Failed to approve response');
    }
  };

  const handleReject = async (responseId: string, notes?: string) => {
    if (!token) return;

    try {
      await api.post(`/approvals/${responseId}/reject`, { notes }, token);
      await fetchApprovals();
      setSelectedResponses((prev) => {
        const next = new Set(prev);
        next.delete(responseId);
        return next;
      });
    } catch (err: any) {
      console.error('Error rejecting response:', err);
      setError(err.message || 'Failed to reject response');
    }
  };

  const handleEdit = async (responseId: string, editedResponse: string) => {
    if (!token) return;

    try {
      await api.put(`/approvals/${responseId}`, { proposedResponse: editedResponse }, token);
      await fetchApprovals();
    } catch (err: any) {
      console.error('Error editing response:', err);
      setError(err.message || 'Failed to edit response');
    }
  };

  const handleBulkApprove = async () => {
    if (!token || selectedResponses.size === 0) return;

    try {
      await Promise.all(
        Array.from(selectedResponses).map((id) =>
          api.post(`/approvals/${id}/approve`, {}, token)
        )
      );
      await fetchApprovals();
      setSelectedResponses(new Set());
    } catch (err: any) {
      console.error('Error bulk approving:', err);
      setError(err.message || 'Failed to bulk approve');
    }
  };

  const handleBulkReject = async () => {
    if (!token || selectedResponses.size === 0) return;

    const notes = prompt('Notas de rechazo (requerido):');
    if (!notes) return;

    try {
      await Promise.all(
        Array.from(selectedResponses).map((id) =>
          api.post(`/approvals/${id}/reject`, { notes }, token)
        )
      );
      await fetchApprovals();
      setSelectedResponses(new Set());
    } catch (err: any) {
      console.error('Error bulk rejecting:', err);
      setError(err.message || 'Failed to bulk reject');
    }
  };

  const toggleSelectResponse = (responseId: string) => {
    setSelectedResponses((prev) => {
      const next = new Set(prev);
      if (next.has(responseId)) {
        next.delete(responseId);
      } else {
        next.add(responseId);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    const filtered = filterResponses(pendingResponses);
    setSelectedResponses(new Set(filtered.map((r) => r.id)));
  };

  const clearSelection = () => {
    setSelectedResponses(new Set());
  };

  const filterResponses = (responses: PendingResponse[]) => {
    return responses.filter((r) => {
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesSearch = !searchQuery ||
        r.proposedResponse.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.conversation?.phoneNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.conversationId.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  };

  const filteredPending = filterResponses(pendingResponses);
  const filteredHistory = filterResponses(historyResponses);

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-muted-foreground';
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Aprobaciones</h1>
          <p className="text-muted-foreground">
            Revisa y aprueba las respuestas del agente de IA
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats?.totalPending || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Aprobadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats?.totalApproved || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Rechazadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats?.totalRejected || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-gray-500" />
              Expiradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">{stats?.totalExpired || 0}</div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          Error: {error}
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedResponses.size > 0 && (
        <Card className="border-primary">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">
                {selectedResponses.size} {selectedResponses.size === 1 ? 'seleccionada' : 'seleccionadas'}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                >
                  Limpiar selección
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkReject}
                >
                  <X className="h-4 w-4 mr-1" />
                  Rechazar ({selectedResponses.size})
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBulkApprove}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Aprobar ({selectedResponses.size})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cola de Aprobación</CardTitle>
              <CardDescription>
                Respuestas que requieren aprobación antes de enviarse
              </CardDescription>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por teléfono, conversación o respuesta..."
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
                <SelectItem value="PENDING">Pendientes</SelectItem>
                <SelectItem value="APPROVED">Aprobadas</SelectItem>
                <SelectItem value="REJECTED">Rechazadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pending">
                Pendientes ({filteredPending.length})
              </TabsTrigger>
              <TabsTrigger value="history">
                Historial ({filteredHistory.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              {filteredPending.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No hay aprobaciones pendientes</h3>
                  <p className="mt-2 text-muted-foreground">
                    Todas las respuestas han sido procesadas
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPending.length > 1 && (
                    <div className="flex justify-end mb-4">
                      <Button variant="ghost" size="sm" onClick={selectAllVisible}>
                        Seleccionar todos ({filteredPending.length})
                      </Button>
                    </div>
                  )}
                  {filteredPending.map((response) => (
                    <ApprovalCard
                      key={response.id}
                      response={response}
                      onApprove={() => handleApprove(response.id)}
                      onReject={(notes) => handleReject(response.id, notes)}
                      onEdit={(edited) => handleEdit(response.id, edited)}
                      isSelected={selectedResponses.has(response.id)}
                      onSelect={() => toggleSelectResponse(response.id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              {filteredHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No hay historial</h3>
                  <p className="mt-2 text-muted-foreground">
                    Las respuestas procesadas aparecerán aquí
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredHistory.map((response) => (
                    <Card key={response.id} className={response.status === 'REJECTED' ? 'border-red-200' : 'border-green-200'}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={response.status === 'APPROVED' ? 'default' : 'destructive'}>
                                {response.status === 'APPROVED' ? 'Aprobada' : 'Rechazada'}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {new Date(response.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm mb-3">{response.proposedResponse}</p>
                            {response.reviewNotes && (
                              <p className="text-sm text-muted-foreground italic">
                                Notas: {response.reviewNotes}
                              </p>
                            )}
                          </div>
                          <div className="ml-4">
                            {response.status === 'APPROVED' ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
