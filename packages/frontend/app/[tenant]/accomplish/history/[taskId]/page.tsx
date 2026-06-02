/**
 * Task Detail Page - Detalle de una tarea del historial
 *
 * Muestra el detalle completo de una tarea con opciones para re-ejecutar, eliminar y descargar
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccomplishStore } from '@/stores/taskStore';
import { createAccomplishClient, Task } from '@/lib/accomplish-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from '@/components/accomplish/MessageBubble';
import {
  ArrowLeft,
  RefreshCw,
  Download,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const taskId = params?.taskId as string;

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [reExecuting, setReExecuting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const client = useAccomplishStore((state) => state.client);

  useEffect(() => {
    if (!client || !taskId) return;

    const loadTask = async () => {
      setLoading(true);
      try {
        const data = await client.getTask(taskId);
        setTask(data);
      } catch (error) {
        console.error('Error loading task:', error);
        toast({
          title: 'Error',
          description: 'No se pudo cargar la tarea',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadTask();
  }, [client, taskId]);

  const handleReExecute = async () => {
    if (!client) return;

    setReExecuting(true);
    try {
      const newTask = await client.reExecuteTask(taskId);
      toast({
        title: 'Tarea re-ejecutada',
        description: 'La nueva tarea se ha creado',
      });
      // Redirigir a la nueva tarea
      router.push(`/accomplish?taskId=${newTask.id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo re-ejecutar la tarea',
        variant: 'destructive',
      });
    } finally {
      setReExecuting(false);
    }
  };

  const handleDelete = async () => {
    if (!client) return;

    setDeleting(true);
    try {
      await client.deleteTask(taskId);
      toast({
        title: 'Tarea eliminada',
        description: 'La tarea ha sido eliminada correctamente',
      });
      router.push('/accomplish/history');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar la tarea',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async () => {
    if (!client) return;

    setDownloading(true);
    try {
      await client.exportTaskResults(taskId);
      toast({
        title: 'Descarga iniciada',
        description: 'Los resultados se descargarán en breve',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo descargar los resultados',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'RUNNING':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'QUEUED':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'CANCELLED':
        return <XCircle className="h-5 w-5 text-gray-500" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      COMPLETED: 'default',
      FAILED: 'destructive',
      RUNNING: 'secondary',
      QUEUED: 'outline',
      CANCELLED: 'outline',
    };

    return (
      <Badge variant={variants[status] || 'outline'} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Tarea no encontrada</h2>
            <Button variant="outline" onClick={() => router.push('/accomplish/history')}>
              Volver al historial
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/accomplish/history')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Detalle de Tarea</h1>
            <p className="text-muted-foreground text-sm">
              ID: {task.id}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReExecute}
            disabled={reExecuting || task.status === 'RUNNING'}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${reExecuting ? 'animate-spin' : ''}`} />
            Re-ejecutar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={downloading || task.status === 'RUNNING'}
          >
            <Download className={`h-4 w-4 mr-2 ${downloading ? 'animate-bounce' : ''}`} />
            Descargar
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={deleting || task.status === 'RUNNING'}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar esta tarea?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Se eliminarán todos los archivos asociados a esta tarea.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Task Info Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {getStatusBadge(task.status)}
                <Badge variant="outline">
                  <FileText className="h-3 w-3 mr-1" />
                  {task.messages.length} mensajes
                </Badge>
              </div>
              <CardTitle className="text-lg">{task.prompt}</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Creada</p>
              <p className="font-medium">
                {formatDistanceToNow(new Date(task.createdAt), {
                  addSuffix: true,
                  locale: es,
                })}
              </p>
            </div>
            {task.startedAt && (
              <div>
                <p className="text-muted-foreground">Inicio</p>
                <p className="font-medium">
                  {formatDistanceToNow(new Date(task.startedAt), {
                    addSuffix: true,
                    locale: es,
                  })}
                </p>
              </div>
            )}
            {task.completedAt && (
              <div>
                <p className="text-muted-foreground">Finalizada</p>
                <p className="font-medium">
                  {formatDistanceToNow(new Date(task.completedAt), {
                    addSuffix: true,
                    locale: es,
                  })}
                </p>
              </div>
            )}
            {task.startedAt && task.completedAt && (
              <div>
                <p className="text-muted-foreground">Duración</p>
                <p className="font-medium">
                  {Math.round(
                    (new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()) / 1000 / 60
                  )}{' '}
                  min
                </p>
              </div>
            )}
          </div>

          {task.error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm font-medium text-destructive mb-1">Error</p>
              <p className="text-sm text-destructive/80">{task.error}</p>
            </div>
          )}

          {task.result && typeof task.result === 'object' && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Resultado</p>
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                {JSON.stringify(task.result, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Messages */}
      <Card>
        <CardHeader>
          <CardTitle>Conversación</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {task.messages.map((message, index) => (
                <MessageBubble
                  key={message.id || index}
                  message={message}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
