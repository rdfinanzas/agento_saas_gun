'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Plus,
  Clock,
  Loader2,
  Trash2,
  Play,
  Pause,
  Edit,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  cronExpression: string;
  enabled: boolean;
  timezone: string;
  lastRunAt?: string;
  nextRunAt?: string;
  runCount: number;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

const TIMEZONES = [
  'America/Mexico_City',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Madrid',
  'Europe/London',
  'Asia/Tokyo',
  'UTC',
];

const CRON_PRESETS = [
  { label: 'Cada 5 minutos', value: '*/5 * * * *' },
  { label: 'Cada 15 minutos', value: '*/15 * * * *' },
  { label: 'Cada hora', value: '0 * * * *' },
  { label: 'Cada 6 horas', value: '0 */6 * * *' },
  { label: 'Diario (9 AM)', value: '0 9 * * *' },
  { label: 'Diario (6 PM)', value: '0 18 * * *' },
  { label: 'Semanal (Lunes 9 AM)', value: '0 9 * * 1' },
  { label: 'Mensual (1ro del mes)', value: '0 9 1 * *' },
  { label: 'Personalizado', value: 'custom' },
];

export default function SchedulesPage() {
  const params = useParams();
  const tenantSlug = params?.tenant as string;

  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [cronExpression, setCronExpression] = useState('0 9 * * *');
  const [timezone, setTimezone] = useState('America/Mexico_City');
  const [enabled, setEnabled] = useState(true);
  const [customCron, setCustomCron] = useState('');

  useEffect(() => {
    async function fetchTasks() {
      setIsLoading(true);
      setError(null);

      try {
        const token = storage.getItem<string>('token');
        if (!token) {
          setError('No authentication token found');
          setIsLoading(false);
          return;
        }

        const data = await api.get<ScheduledTask[]>('/ai/scheduler/tasks', token);
        setTasks(data || []);

      } catch (err: any) {
        console.error('Error fetching scheduled tasks:', err);
        setError(err.message || 'Error al cargar tareas programadas');
      } finally {
        setIsLoading(false);
      }
    }

    if (tenantSlug) {
      fetchTasks();
    }
  }, [tenantSlug]);

  const openNewTaskDialog = () => {
    setEditingTask(null);
    setTaskName('');
    setTaskDescription('');
    setCronExpression('0 9 * * *');
    setTimezone('America/Mexico_City');
    setEnabled(true);
    setCustomCron('');
    setIsDialogOpen(true);
  };

  const openEditTaskDialog = (task: ScheduledTask) => {
    setEditingTask(task);
    setTaskName(task.name);
    setTaskDescription(task.description || '');
    setCronExpression(task.cronExpression);
    setTimezone(task.timezone);
    setEnabled(task.enabled);
    setCustomCron('');
    setIsDialogOpen(true);
  };

  const saveTask = async () => {
    if (!taskName.trim()) {
      alert('El nombre es requerido');
      return;
    }

    const finalCron = cronExpression === 'custom' ? customCron : cronExpression;
    if (!finalCron.trim()) {
      alert('La expresión cron es requerida');
      return;
    }

    setIsSaving(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      const payload = {
        name: taskName,
        description: taskDescription,
        cronExpression: finalCron,
        timezone,
        enabled,
      };

      if (editingTask) {
        await api.put(`/ai/scheduler/tasks/${editingTask.id}`, payload, token);
      } else {
        await api.post('/ai/scheduler/tasks', payload, token);
      }

      setIsDialogOpen(false);

      // Reload tasks
      const data = await api.get<ScheduledTask[]>('/ai/scheduler/tasks', token);
      setTasks(data || []);

    } catch (err: any) {
      console.error('Error saving task:', err);
      alert('Error al guardar: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTask = async (task: ScheduledTask) => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.patch(`/ai/scheduler/tasks/${task.id}/toggle`, {}, token);

      // Update local state
      setTasks(tasks.map(t =>
        t.id === task.id ? { ...t, enabled: !t.enabled } : t
      ));

    } catch (err: any) {
      console.error('Error toggling task:', err);
      alert('Error al cambiar estado');
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta tarea programada?')) return;

    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.delete(`/ai/scheduler/tasks/${taskId}`, token);
      setTasks(tasks.filter(t => t.id !== taskId));

    } catch (err: any) {
      console.error('Error deleting task:', err);
      alert('Error al eliminar tarea');
    }
  };

  const runTaskNow = async (taskId: string) => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.post(`/ai/scheduler/tasks/${taskId}/run`, {}, token);
      alert('Tarea ejecutada correctamente');

      // Reload tasks
      const data = await api.get<ScheduledTask[]>('/ai/scheduler/tasks', token);
      setTasks(data || []);

    } catch (err: any) {
      console.error('Error running task:', err);
      alert('Error al ejecutar tarea');
    }
  };

  const getCronDescription = (cron: string) => {
    const preset = CRON_PRESETS.find(p => p.value === cron);
    if (preset) return preset.label;

    // Basic description
    const parts = cron.split(' ');
    if (parts.length === 5) {
      const [min, hour, day, month, weekday] = parts;
      if (hour === '*' && min !== '*') return `Cada hora en minuto ${min}`;
      if (day === '*' && month === '*' && weekday === '*') {
        if (hour.includes('/')) return `Cada ${hour.split('/')[1]} horas`;
        return `Diario a las ${hour}:${min.padStart(2, '0')}`;
      }
    }

    return cron;
  };

  const getNextRunDisplay = (task: ScheduledTask) => {
    if (!task.nextRunAt) return '-';
    const date = new Date(task.nextRunAt);
    return date.toLocaleString('es-ES', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTaskStatus = (task: ScheduledTask) => {
    if (!task.enabled) return { label: 'Deshabilitado', variant: 'secondary' as const, icon: Pause };
    if (task.failureCount > 0) return { label: 'Con Errores', variant: 'destructive' as const, icon: AlertCircle };
    return { label: 'Activo', variant: 'default' as const, icon: CheckCircle };
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
          <h1 className="text-3xl font-bold tracking-tight">Tareas Programadas</h1>
          <p className="text-muted-foreground">
            Gestiona las tareas automatizadas con expresiones cron
          </p>
        </div>
        <Button onClick={openNewTaskDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Tarea
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Play className="h-4 w-4 text-green-500" />
              Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {tasks.filter(t => t.enabled).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Con Errores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {tasks.filter(t => t.failureCount > 0).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-500" />
              Ejecuciones Totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {tasks.reduce((sum, t) => sum + t.runCount, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          Error: {error}
        </div>
      )}

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Tareas</CardTitle>
          <CardDescription>
            {tasks.length} tarea{tasks.length !== 1 ? 's' : ''} programada{tasks.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No hay tareas programadas</h3>
              <p className="mt-2 text-muted-foreground">
                Crea tu primera tarea programada para automatizar procesos
              </p>
              <Button className="mt-4" onClick={openNewTaskDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Crear Tarea
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Frecuencia</TableHead>
                  <TableHead>Zona Horaria</TableHead>
                  <TableHead>Próxima Ejecución</TableHead>
                  <TableHead>Ejecuciones</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => {
                  const status = getTaskStatus(task);
                  const StatusIcon = status.icon;

                  return (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {task.description || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {getCronDescription(task.cronExpression)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{task.timezone}</TableCell>
                      <TableCell className="text-sm">
                        {getNextRunDisplay(task)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-sm">{task.runCount}</span>
                          {task.failureCount > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {task.failureCount} errores
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="flex items-center gap-1 w-fit">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => runTaskNow(task.id)}
                            title="Ejecutar ahora"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleTask(task)}
                            title={task.enabled ? 'Deshabilitar' : 'Habilitar'}
                          >
                            {task.enabled ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditTaskDialog(task)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteTask(task.id)}
                            className="text-destructive hover:text-destructive"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? 'Editar Tarea Programada' : 'Nueva Tarea Programada'}
            </DialogTitle>
            <DialogDescription>
              Configura una tarea para ejecutarse automáticamente según una programación
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="Ej: Resumen diario de conversaciones"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Descripción opcional de la tarea"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cron">Frecuencia (Expresión Cron) *</Label>
              <Select value={cronExpression} onValueChange={setCronExpression}>
                <SelectTrigger id="cron">
                  <SelectValue placeholder="Selecciona una frecuencia" />
                </SelectTrigger>
                <SelectContent>
                  {CRON_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cronExpression === 'custom' && (
                <Input
                  className="mt-2"
                  value={customCron}
                  onChange={(e) => setCustomCron(e.target.value)}
                  placeholder="0 * * * *"
                />
              )}
              <p className="text-xs text-muted-foreground">
                Formato: minuto hora día mes día_semana
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Zona Horaria *</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Habilitar</Label>
                <p className="text-xs text-muted-foreground">
                  La tarea se ejecutará automáticamente
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveTask} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
