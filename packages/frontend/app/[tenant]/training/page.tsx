'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Play,
  TrendingUp,
  TrendingDown,
  Clock,
  MessageSquare,
  Award,
  Target,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

interface TrainingMetrics {
  totalSessions: number;
  completedSessions: number;
  avgMessagesPerSession: number;
  avgResponseTime: number;
  overallSentiment: number;
  resolutionRate: number;
}

interface TrainingSession {
  id: string;
  scenario: string;
  status: 'active' | 'completed' | 'abandoned';
  startedAt: string;
  endedAt?: string;
  messageCount: number;
  metrics: {
    totalMessages: number;
    avgResponseTime: number;
    sentimentScore: number;
    resolutionRate: number;
  };
  duration?: number;
}

interface TrainingScenario {
  id: string;
  title: string;
  description: string;
  category: 'sales' | 'support' | 'complaints' | 'general';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number;
  objectives: string[];
}

export default function TrainingPage() {
  const params = useParams();
  const tenantSlug = params?.tenant as string;

  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<TrainingMetrics | null>(null);
  const [recentSessions, setRecentSessions] = useState<TrainingSession[]>([]);
  const [scenarios, setScenarios] = useState<TrainingScenario[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrainingData() {
      setIsLoading(true);
      setError(null);

      try {
        const token = storage.getItem<string>('token');
        if (!token) {
          setError('No authentication token found');
          setIsLoading(false);
          return;
        }

        const [metricsData, sessionsData, scenariosData] = await Promise.all([
          api.get<{ metrics: TrainingMetrics }>('/sandbox/metrics', token).catch(() => null),
          api.get<{ sessions: TrainingSession[] }>('/sandbox/sessions', token).catch(() => null),
          api.get<{ scenarios: TrainingScenario[] }>('/sandbox/scenarios', token).catch(() => null),
        ]);

        if (metricsData) setMetrics(metricsData.metrics);
        if (sessionsData) setRecentSessions(sessionsData.sessions.slice(0, 5));
        if (scenariosData) setScenarios(scenariosData.scenarios.slice(0, 4));

      } catch (err: any) {
        console.error('Error fetching training data:', err);
        setError(err.message || 'Failed to load training data');
      } finally {
        setIsLoading(false);
      }
    }

    if (tenantSlug) {
      fetchTrainingData();
    }
  }, [tenantSlug]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-700';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-700';
      case 'advanced':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'Principiante';
      case 'intermediate':
        return 'Intermedio';
      case 'advanced':
        return 'Avanzado';
      default:
        return difficulty;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'sales':
        return 'Ventas';
      case 'support':
        return 'Soporte';
      case 'complaints':
        return 'Quejas';
      case 'general':
        return 'General';
      default:
        return category;
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const getSentimentTrend = () => {
    if (!metrics || !recentSessions.length) return null;
    const completed = recentSessions.filter((s) => s.status === 'completed');
    if (completed.length < 2) return null;

    const recent = completed.slice(0, 3).reduce((sum, s) => sum + s.metrics.sentimentScore, 0) / Math.min(3, completed.length);
    const older = completed.slice(3).reduce((sum, s) => sum + s.metrics.sentimentScore, 0) / Math.max(1, completed.length - 3);

    if (recent > older + 5) return 'up';
    if (recent < older - 5) return 'down';
    return 'stable';
  };

  const sentimentTrend = getSentimentTrend();

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

  const isRecommended = !metrics || metrics.completedSessions < 3 || metrics.overallSentiment < 70;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Modo Entrenamiento</h1>
            {isRecommended && (
              <Badge variant="outline" className="text-orange-600 border-orange-600">
                <Target className="h-3 w-3 mr-1" />
                Recomendado
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Entrena y mejora tu agente con simulaciones realistas antes de llevarlo a producción
          </p>
        </div>
        <Button asChild>
          <Link href={`/${tenantSlug}/training/simulate`}>
            <Play className="mr-2 h-4 w-4" />
            Iniciar Simulación
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sesiones Totales</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalSessions || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.completedSessions || 0} completadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Puntaje Promedio</CardTitle>
            <div className="flex items-center">
              {sentimentTrend === 'up' ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : sentimentTrend === 'down' ? (
                <TrendingDown className="h-4 w-4 text-red-500" />
              ) : (
                <Award className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics ? Math.round(metrics.overallSentiment) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Sentimiento general</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Resolución</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics ? Math.round(metrics.resolutionRate) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Promedio de sesiones</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tiempo de Respuesta</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics ? Math.round(metrics.avgResponseTime) : 0}ms
            </div>
            <p className="text-xs text-muted-foreground">Promedio de respuesta</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Sessions */}
        <Card className="col-span-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Sesiones Recientes</CardTitle>
                <CardDescription>Historial de entrenamiento</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/${tenantSlug}/training/sessions`}>Ver todas</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentSessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No hay sesiones de entrenamiento</p>
                <p className="text-sm">Inicia tu primera simulación para ver el progreso</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          session.status === 'active'
                            ? 'bg-green-500'
                            : session.status === 'completed'
                            ? 'bg-blue-500'
                            : 'bg-gray-400'
                        }`}
                      />
                      <div>
                        <div className="font-medium text-sm capitalize">{session.scenario}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(session.startedAt).toLocaleDateString()} • {session.messageCount} mensajes
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-sm font-medium">{Math.round(session.metrics.sentimentScore)}%</div>
                        {session.duration && (
                          <div className="text-xs text-muted-foreground">{formatDuration(session.duration)}</div>
                        )}
                      </div>
                      <Badge
                        variant={
                          session.status === 'active' ? 'default' : session.status === 'completed' ? 'secondary' : 'outline'
                        }
                      >
                        {session.status === 'active' ? 'Activa' : session.status === 'completed' ? 'Completada' : 'Abandonada'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recommended Scenarios */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Escenarios Recomendados</CardTitle>
            <CardDescription>Mejora las habilidades de tu agente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {scenarios.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No hay escenarios disponibles
              </div>
            ) : (
              scenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => (window.location.href = `/${tenantSlug}/training/simulate?scenario=${scenario.id}`)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-medium text-sm">{scenario.title}</h4>
                    <Badge className={getDifficultyColor(scenario.difficulty)} variant="outline">
                      {getDifficultyLabel(scenario.difficulty)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{scenario.description}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{getCategoryLabel(scenario.category)}</Badge>
                    <span>•</span>
                    <span>{scenario.estimatedDuration} min</span>
                  </div>
                </div>
              ))
            )}
            <Button variant="outline" className="w-full" asChild>
              <Link href={`/${tenantSlug}/training/simulate`}>Ver todos los escenarios</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance Summary */}
      {metrics && metrics.completedSessions > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Rendimiento</CardTitle>
            <CardDescription>Análisis del desempeño del agente en entrenamiento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fortalezas</span>
                  <span className="font-medium text-green-600">
                    {metrics.overallSentiment > 70 ? 'Excelente' : metrics.overallSentiment > 50 ? 'Bueno' : 'Mejorable'}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${Math.min(metrics.overallSentiment, 100)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Resolución</span>
                  <span className="font-medium text-blue-600">
                    {metrics.resolutionRate > 80 ? 'Alta' : metrics.resolutionRate > 60 ? 'Media' : 'Baja'}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.min(metrics.resolutionRate, 100)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Velocidad</span>
                  <span className="font-medium text-purple-600">
                    {metrics.avgResponseTime < 1000
                      ? 'Muy rápida'
                      : metrics.avgResponseTime < 2000
                      ? 'Rápida'
                      : 'Normal'}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all"
                    style={{ width: `${Math.max(0, 100 - (metrics.avgResponseTime / 3000) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
