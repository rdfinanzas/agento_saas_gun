/**
 * HistoryModal - Modal con historial de conversaciones de Accomplish
 */

'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Clock, CheckCircle, XCircle, Loader2, MessageSquare, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Task, TaskStatus } from '@/lib/accomplish-client';
import { useAccomplishStore } from '@/stores/taskStore';

interface HistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadTask?: (taskId: string) => Promise<void>;
}

export function HistoryModal({ open, onOpenChange, onLoadTask }: HistoryModalProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);

  const client = useAccomplishStore((state) => state.client);

  useEffect(() => {
    if (!client || !open) return;

    const loadHistory = async () => {
      setLoading(true);
      try {
        const response = await client.getHistory({
          page,
          pageSize: 20,
          status: statusFilter === 'all' ? undefined : statusFilter,
        });

        setTasks(response.tasks);
        setTotal(response.total);
      } catch (error) {
        console.error('Error loading history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [client, page, statusFilter, open]);

  const handleLoadTask = async (taskId: string) => {
    if (!onLoadTask) return;

    setLoadingTaskId(taskId);
    try {
      await onLoadTask(taskId);
      onOpenChange(false); // Cerrar el modal después de cargar
    } catch (error) {
      console.error('Error loading task:', error);
    } finally {
      setLoadingTaskId(null);
    }
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      case 'RUNNING':
        return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
      case 'QUEUED':
        return <Clock className="h-3.5 w-3.5 text-yellow-500" />;
      case 'CANCELLED':
        return <XCircle className="h-3.5 w-3.5 text-gray-500" />;
      default:
        return null;
    }
  };

  const filteredTasks = tasks.filter((task) =>
    task.prompt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Historial de Conversaciones</DialogTitle>
          <DialogDescription>
            Selecciona una conversación anterior para continuar donde la dejaste
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search and Filter */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversación..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => {
              setStatusFilter(v as TaskStatus | 'all');
              setPage(1);
            }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="COMPLETED">Completadas</SelectItem>
                <SelectItem value="FAILED">Fallidas</SelectItem>
                <SelectItem value="RUNNING">En ejecución</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results count */}
          <div className="text-sm text-muted-foreground">
            {total} conversación{total !== 1 ? 'es' : ''} encontrada{total !== 1 ? 's' : ''}
          </div>

          {/* Tasks List */}
          <ScrollArea className="h-[400px] pr-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No se encontraron conversaciones</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate mb-1">{task.prompt}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(task.createdAt), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {task.messages.length} mensajes
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="flex items-center gap-1">
                        {getStatusIcon(task.status)}
                        {task.status}
                      </Badge>

                      <Button
                        size="sm"
                        onClick={() => handleLoadTask(task.id)}
                        disabled={loadingTaskId === task.id}
                      >
                        {loadingTaskId === task.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Abrir'
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Mostrando {(page - 1) * 20 + 1} - {Math.min(page * 20, total)} de {total}
              </p>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * 20 >= total}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
