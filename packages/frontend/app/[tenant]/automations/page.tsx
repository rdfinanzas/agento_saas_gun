'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Play,
  Pause,
  Trash2,
  Clock,
  Loader2,
  Zap,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Brain,
  Sparkles,
  Heart,
} from 'lucide-react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

interface ScheduledTask {
  id: string;
  name: string;
  cronExpression: string;
  taskType: string;
  taskConfig: Record<string, any>;
  agentId?: string;
  enabled: boolean;
  timezone: string;
  lastRunAt?: string;
  nextRunAt?: string;
  runCount: number;
  createdAt: string;
  category?: string;
}

interface TaskExecution {
  id: string;
  taskId: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  result?: Record<string, any>;
  error?: string;
}

const TASK_TYPES: Array<{
  value: string;
  label: string;
  icon: any;
  category?: string;
}> = [
  { value: 'stock_check', label: 'Verificación de Stock', icon: RefreshCw },
  { value: 'alert', label: 'Envío de Alertas', icon: AlertTriangle },
  { value: 'follow_up', label: 'Seguimiento a Clientes', icon: Calendar },
  { value: 'report', label: 'Generación de Reportes', icon: CheckCircle },
  { value: 'custom', label: 'Personalizado', icon: Zap },
  // AI-powered automations
  { value: 'ai_daily_summary', label: 'Resumen Diario con IA', icon: Brain, category: 'ai' },
  { value: 'ai_proactive_followup', label: 'Seguimiento Proactivo con IA', icon: Sparkles, category: 'ai' },
  { value: 'ai_sentiment_alert', label: 'Alertas de Sentimiento con IA', icon: Heart, category: 'ai' },
];

const CRON_PRESETS = [
  { label: 'Cada hora', value: '0 * * * *' },
  { label: 'Cada 6 horas', value: '0 */6 * * *' },
  { label: 'Diario (9 AM)', value: '0 9 * * *' },
  { label: 'Diario (6 PM)', value: '0 18 * * *' },
  { label: 'Semanal (Lunes 9 AM)', value: '0 9 * * 1' },
  { label: 'Mensual (1ro del mes)', value: '0 9 1 * *' },
];

export default function AutomationsPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenant as string;

  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [executions, setExecutions] = useState<TaskExecution[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // New task form
  const [taskName, setTaskName] = useState('');
  const [taskType, setTaskType] = useState('custom');
  const [cronExpression, setCronExpression] = useState('0 9 * * *');
  const [taskConfig, setTaskConfig] = useState('{}');
  const [timezone, setTimezone] = useState('America/Mexico_City');

  // AI automation specific states
  const [aiSummaryTime, setAiSummaryTime] = useState('09:00');
  const [aiSummaryFormat, setAiSummaryFormat] = useState<'brief' | 'detailed' | 'executive'>('brief');
  const [aiSummaryRecipients, setAiSummaryRecipients] = useState('[]');
  const [aiSummaryCustomPrompt, setAiSummaryCustomPrompt] = useState('');

  const [aiProactiveTrigger, setAiProactiveTrigger] = useState('inactive_customers');
  const [aiProactiveInactiveDays, setAiProactiveInactiveDays] = useState(7);
  const [aiProactiveTone, setAiProactiveTone] = useState<'friendly' | 'professional' | 'casual' | 'empathetic'>('friendly');
  const [aiProactiveCustomPrompt, setAiProactiveCustomPrompt] = useState('');

  const [aiSentimentLookback, setAiSentimentLookback] = useState(24);
  const [aiSentimentMinSeverity, setAiSentimentMinSeverity] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [aiSentimentRecipients, setAiSentimentRecipients] = useState('[]');

  useEffect(() => {
    loadTasks();
    loadExecutions();
  }, []);

  const loadTasks = async () => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      const data = await api.get<ScheduledTask[]>('/ai/schedules', token);
      setTasks(data || []);
    } catch (err) {
      console.error('Error loading tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadExecutions = async () => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      const data = await api.get<TaskExecution[]>('/ai/schedules/executions', token);
      setExecutions(data || []);
    } catch (err) {
      console.error('Error loading executions:', err);
    }
  };

  const openNewTaskDialog = () => {
    setEditingTask(null);
    setTaskName('');
    setTaskType('custom');
    setCronExpression('0 9 * * *');
    setTaskConfig('{}');
    setTimezone('America/Mexico_City');
    setIsDialogOpen(true);
  };

  const openEditTaskDialog = (task: ScheduledTask) => {
    setEditingTask(task);
    setTaskName(task.name);
    setTaskType(task.taskType);
    setCronExpression(task.cronExpression);
    setTaskConfig(JSON.stringify(task.taskConfig, null, 2));
    setTimezone(task.timezone);
    setIsDialogOpen(true);
  };

  const saveTask = async () => {
    if (!taskName.trim()) {
      alert('El nombre es requerido');
      return;
    }

    setIsSaving(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      // Build task config based on type
      let builtTaskConfig: Record<string, any>;

      switch (taskType) {
        case 'ai_daily_summary':
          builtTaskConfig = {
            timeOfDay: aiSummaryTime,
            recipients: JSON.parse(aiSummaryRecipients || '[]'),
            format: aiSummaryFormat,
            includeMetrics: true,
            includeIssues: true,
            includePositiveFeedback: true,
            customPrompt: aiSummaryCustomPrompt || undefined,
          };
          // Auto-generate cron from time
          const [hours, minutes] = aiSummaryTime.split(':');
          setCronExpression(`${minutes} ${hours} * * *`);
          break;

        case 'ai_proactive_followup':
          builtTaskConfig = {
            trigger: aiProactiveTrigger,
            triggerConfig: {
              inactiveDays: aiProactiveInactiveDays,
              maxContacts: 20,
            },
            messageConfig: {
              useTemplate: false,
              customPrompt: aiProactiveCustomPrompt || undefined,
              tone: aiProactiveTone,
              includeCallToAction: true,
            },
            deliveryConfig: {
              channel: 'whatsapp',
              scheduleImmediately: true,
            },
            rateLimit: {
              maxMessagesPerHour: 50,
              maxMessagesPerDay: 500,
            },
          };
          break;

        case 'ai_sentiment_alert':
          builtTaskConfig = {
            lookbackHours: aiSentimentLookback,
            minSeverity: aiSentimentMinSeverity,
            recipients: JSON.parse(aiSentimentRecipients || '[]'),
          };
          break;

        default:
          builtTaskConfig = JSON.parse(taskConfig);
      }

      const payload = {
        name: taskName,
        taskType,
        cronExpression,
        taskConfig: builtTaskConfig,
        timezone,
        enabled: true,
      };

      if (editingTask) {
        await api.put(`/ai/schedules/${editingTask.id}`, payload, token);
      } else {
        await api.post('/ai/schedules', payload, token);
      }

      setIsDialogOpen(false);
      loadTasks();
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

      await api.patch(
        `/opencode/automation/tasks/${task.id}/toggle`,
        {},
        token
      );

      loadTasks();
    } catch (err) {
      console.error('Error toggling task:', err);
      alert('Error al cambiar estado');
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta automatización?')) return;

    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.delete(`/opencode/automation/tasks/${taskId}`, token);
      loadTasks();
    } catch (err) {
      console.error('Error deleting task:', err);
      alert('Error al eliminar');
    }
  };

  const runTaskNow = async (taskId: string) => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.post(`/opencode/automation/tasks/${taskId}/run`, {}, token);
      alert('Tarea ejecutada');
      loadExecutions();
    } catch (err) {
      console.error('Error running task:', err);
      alert('Error al ejecutar');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: 'secondary', label: 'Pendiente' },
      running: { variant: 'default', label: 'Ejecutando' },
      completed: { variant: 'default', label: 'Completado' },
      failed: { variant: 'destructive', label: 'Fallido' },
    };

    const config = variants[status] || { variant: 'secondary', label: status };

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTaskTypeInfo = (type: string) => {
    return TASK_TYPES.find(t => t.value === type) || TASK_TYPES[TASK_TYPES.length - 1];
  };

  const getCronDescription = (cron: string) => {
    const preset = CRON_PRESETS.find(p => p.value === cron);
    if (preset) return preset.label;

    // Basic cron description
    const parts = cron.split(' ');
    if (parts.length === 5) {
      const [min, hour, day, month, weekday] = parts;
      if (hour === '*' && min !== '*') return `Cada hora en minuto ${min}`;
      if (day === '*' && month === '*' && weekday === '*') {
        if (hour.includes('/')) return `Cada ${hour.split('/')[1]} horas`;
        return `Diario a las ${hour}:${min}`;
      }
    }

    return cron;
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
          <h1 className="text-3xl font-bold tracking-tight">Automatizaciones</h1>
          <p className="text-muted-foreground">
            Tareas programadas y automatizaciones autónomas
          </p>
        </div>
        <Button onClick={openNewTaskDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Automatización
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <p className="text-3xl font-bold mt-2">{tasks.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Play className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Activas</span>
            </div>
            <p className="text-3xl font-bold mt-2">{tasks.filter(t => t.enabled).length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Ejecuciones</span>
            </div>
            <p className="text-3xl font-bold mt-2">
              {executions.filter(e => e.status === 'completed').length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Fallidas</span>
            </div>
            <p className="text-3xl font-bold mt-2">
              {executions.filter(e => e.status === 'failed').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tareas Programadas</CardTitle>
          <CardDescription>
            {tasks.length} automatización{tasks.length !== 1 ? 'es' : ''} configurada{tasks.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <Zap className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No hay automatizaciones</h3>
              <p className="mt-2 text-muted-foreground">
                Crea tu primera automatización para ejecutar tareas automáticamente
              </p>
              <Button className="mt-4" onClick={openNewTaskDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Crear Automatización
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Frecuencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Última Ejecución</TableHead>
                  <TableHead>Ejecuciones</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map(task => {
                  const typeInfo = getTaskTypeInfo(task.taskType);
                  const Icon = typeInfo.icon;

                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{task.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{typeInfo.label}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {getCronDescription(task.cronExpression)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={task.enabled ? 'default' : 'secondary'}>
                          {task.enabled ? 'Activa' : 'Pausada'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {task.lastRunAt
                          ? new Date(task.lastRunAt).toLocaleString()
                          : 'Nunca'}
                      </TableCell>
                      <TableCell>{task.runCount}</TableCell>
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
                            title={task.enabled ? 'Pausar' : 'Activar'}
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
                            <Clock className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteTask(task.id)}
                            className="text-destructive"
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

      {/* Recent Executions */}
      <Card>
        <CardHeader>
          <CardTitle>Ejecuciones Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {executions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay ejecuciones registradas
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarea</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Iniciado</TableHead>
                  <TableHead>Completado</TableHead>
                  <TableHead>Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.slice(0, 10).map(exec => {
                  const task = tasks.find(t => t.id === exec.taskId);

                  return (
                    <TableRow key={exec.id}>
                      <TableCell>{task?.name || 'Desconocida'}</TableCell>
                      <TableCell>{getStatusBadge(exec.status)}</TableCell>
                      <TableCell>{new Date(exec.startedAt).toLocaleString()}</TableCell>
                      <TableCell>
                        {exec.completedAt
                          ? new Date(exec.completedAt).toLocaleString()
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {exec.error ? (
                          <span className="text-destructive text-sm">{exec.error}</span>
                        ) : exec.result ? (
                          <span className="text-sm text-muted-foreground">
                            {JSON.stringify(exec.result).slice(0, 50)}...
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTask ? 'Editar Automatización' : 'Nueva Automatización'}
            </DialogTitle>
            <DialogDescription>
              Configura una tarea para ejecutarse automáticamente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={taskName}
                onChange={e => setTaskName(e.target.value)}
                placeholder="Ej: Verificar stock bajo"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Tarea</Label>
              <Select value={taskType} onValueChange={setTaskType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Frecuencia</Label>
              <Select value={cronExpression} onValueChange={setCronExpression} disabled={taskType.startsWith('ai_')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRON_PRESETS.map(preset => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Personalizado (cron)</SelectItem>
                </SelectContent>
              </Select>
              {taskType.startsWith('ai_') && (
                <p className="text-xs text-muted-foreground">
                  La frecuencia se configura automáticamente según las opciones de IA
                </p>
              )}
            </div>

            {/* AI Daily Summary Configuration */}
            {taskType === 'ai_daily_summary' && (
              <div className="space-y-4 p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Configuración de Resumen con IA
                </h4>

                <div className="space-y-2">
                  <Label>Hora del resumen</Label>
                  <Input
                    type="time"
                    value={aiSummaryTime}
                    onChange={e => setAiSummaryTime(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Formato</Label>
                  <Select value={aiSummaryFormat} onValueChange={(v: any) => setAiSummaryFormat(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brief">Breve</SelectItem>
                      <SelectItem value="detailed">Detallado</SelectItem>
                      <SelectItem value="executive">Ejecutivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Destinatarios (JSON)</Label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={aiSummaryRecipients}
                    onChange={e => setAiSummaryRecipients(e.target.value)}
                    placeholder='[{"type": "whatsapp", "address": "+521234567890", "enabled": true}]'
                  />
                  <p className="text-xs text-muted-foreground">
                    Tipos: whatsapp, email, dashboard
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Prompt personalizado (opcional)</Label>
                  <textarea
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={aiSummaryCustomPrompt}
                    onChange={e => setAiSummaryCustomPrompt(e.target.value)}
                    placeholder="Instrucciones adicionales para la IA..."
                  />
                </div>
              </div>
            )}

            {/* AI Proactive Follow-up Configuration */}
            {taskType === 'ai_proactive_followup' && (
              <div className="space-y-4 p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Configuración de Seguimiento Proactivo con IA
                </h4>

                <div className="space-y-2">
                  <Label>Trigger</Label>
                  <Select value={aiProactiveTrigger} onValueChange={setAiProactiveTrigger}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inactive_customers">Clientes inactivos</SelectItem>
                      <SelectItem value="sentiment_drop">Caída de sentimiento</SelectItem>
                      <SelectItem value="unresolved_issue">Problemas no resueltos</SelectItem>
                      <SelectItem value="after_purchase">Después de compra</SelectItem>
                      <SelectItem value="birthday">Cumpleaños</SelectItem>
                      <SelectItem value="milestone">Hitos/Milestones</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {aiProactiveTrigger === 'inactive_customers' && (
                  <div className="space-y-2">
                    <Label>Días de inactividad</Label>
                    <Input
                      type="number"
                      value={aiProactiveInactiveDays}
                      onChange={e => setAiProactiveInactiveDays(parseInt(e.target.value))}
                      min={1}
                      max={90}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Tono del mensaje</Label>
                  <Select value={aiProactiveTone} onValueChange={(v: any) => setAiProactiveTone(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="friendly">Amigable</SelectItem>
                      <SelectItem value="professional">Profesional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="empathetic">Empático</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Prompt personalizado (opcional)</Label>
                  <textarea
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={aiProactiveCustomPrompt}
                    onChange={e => setAiProactiveCustomPrompt(e.target.value)}
                    placeholder="Instrucciones adicionales para la IA..."
                  />
                </div>
              </div>
            )}

            {/* AI Sentiment Alert Configuration */}
            {taskType === 'ai_sentiment_alert' && (
              <div className="space-y-4 p-4 rounded-lg bg-muted/50">
                <h4 className="font-medium flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Configuración de Alertas de Sentimiento con IA
                </h4>

                <div className="space-y-2">
                  <Label>Horas a analizar</Label>
                  <Input
                    type="number"
                    value={aiSentimentLookback}
                    onChange={e => setAiSentimentLookback(parseInt(e.target.value))}
                    min={1}
                    max={168}
                  />
                  <p className="text-xs text-muted-foreground">
                    Período de tiempo a analizar (1-168 horas)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Severidad mínima</Label>
                  <Select value={aiSentimentMinSeverity} onValueChange={(v: any) => setAiSentimentMinSeverity(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Crítica</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="low">Baja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Destinatarios de alerta (JSON)</Label>
                  <textarea
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={aiSentimentRecipients}
                    onChange={e => setAiSentimentRecipients(e.target.value)}
                    placeholder='["+521234567890", "admin@example.com"]'
                  />
                </div>
              </div>
            )}

            {/* Default JSON config for non-AI tasks */}
            {!taskType.startsWith('ai_') && (
              <div className="space-y-2">
                <Label>Configuración (JSON)</Label>
                <textarea
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={taskConfig}
                  onChange={e => setTaskConfig(e.target.value)}
                  placeholder='{"threshold": 10, "notifyEmail": "admin@example.com"}'
                />
              </div>
            )}
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
