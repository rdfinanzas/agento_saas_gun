'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useParams, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, TrendingUp, TrendingDown, Minus, ArrowLeft, RotateCcw } from 'lucide-react';
import { SimulationChat } from '@/components/training/SimulationChat';
import { ScenarioSelector, TrainingScenario } from '@/components/training/ScenarioSelector';
import { PromotionButton } from '@/components/training/PromotionButton';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import Link from 'next/link';

interface SimulationMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    sentiment?: 'positive' | 'negative' | 'neutral';
    responseTime?: number;
  };
}

interface SessionMetrics {
  totalMessages: number;
  avgResponseTime: number;
  sentimentScore: number;
  resolutionRate: number;
  escalatedCount: number;
}

export default function SimulatePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantSlug = (params?.tenant as string) || '';
  const scenarioParam = searchParams?.get('scenario');

  const [scenarios, setScenarios] = useState<TrainingScenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<TrainingScenario | undefined>(undefined);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SimulationMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [finalEvaluation, setFinalEvaluation] = useState<any>(null);

  useEffect(() => {
    async function fetchScenarios() {
      setIsLoading(true);
      setError(null);

      try {
        const token = storage.getItem<string>('token') ?? undefined;
        if (!token) {
          setError('No authentication token found');
          setIsLoading(false);
          return;
        }

        const response = await api.get<{ scenarios: TrainingScenario[] }>('/sandbox/scenarios', token);
        setScenarios(response.scenarios);

        // Pre-select scenario if provided in URL
        if (scenarioParam) {
          const scenario = response.scenarios.find((s) => s.id === scenarioParam);
          if (scenario) {
            setSelectedScenario(scenario);
          }
        }
      } catch (err: any) {
        console.error('Error fetching scenarios:', err);
        setError(err.message || 'Failed to load scenarios');
      } finally {
        setIsLoading(false);
      }
    }

    fetchScenarios();
  }, [scenarioParam]);

  // Timer for session duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (sessionId && !sessionEnded) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [sessionId, sessionEnded]);

  // Calculate score based on metrics
  useEffect(() => {
    if (messages.length > 0 && sessionId) {
      const agentMessages = messages.filter((m) => m.role === 'agent');
      if (agentMessages.length > 0) {
        const positiveCount = agentMessages.filter(
          (m) => m.metadata?.sentiment === 'positive'
        ).length;
        const totalSentiment = (positiveCount / agentMessages.length) * 100;
        const avgResponseTime =
          agentMessages.reduce((sum, m) => sum + (m.metadata?.responseTime || 0), 0) /
          agentMessages.length;
        const responseScore = Math.max(0, 100 - avgResponseTime / 50);
        const newScore = Math.round(totalSentiment * 0.7 + responseScore * 0.3);

        setPreviousScore(currentScore);
        setCurrentScore(newScore);
      }
    }
  }, [messages]);

  const handleSelectScenario = async (scenario: TrainingScenario) => {
    setSelectedScenario(scenario);
    await startSession(scenario);
  };

  const startSession = async (scenario: TrainingScenario) => {
    setIsStarting(true);
    setError(null);

    try {
      const token = storage.getItem<string>('token') ?? undefined;
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await api.post<{ session: any }>(
        '/sandbox/sessions',
        {
          scenarioId: scenario.id,
          customerProfile: scenario.customerPersona,
        },
        token
      );

      setSessionId(response.session.id);
      setMessages([]);
      setElapsedSeconds(0);
      setCurrentScore(0);
      setPreviousScore(null);
      setSessionEnded(false);
      setFinalEvaluation(null);

      // Add initial system message
      const initialMessage: SimulationMessage = {
        id: 'initial',
        role: 'system',
        content: `SIMULACIÓN INICIADA\n\nEscenario: ${scenario.title}\nCliente: ${scenario.customerPersona.name}\nTono: ${scenario.customerPersona.tone}\n\nEl cliente comenzará la conversación pronto. ¡Prepárate!`,
        timestamp: new Date().toISOString(),
      };
      setMessages([initialMessage]);

      // Simulate first customer message after a short delay
      setTimeout(async () => {
        try {
          setIsTyping(true);
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const customerResponse = await api.post<{ message: SimulationMessage }>(
            `/sandbox/${response.session.id}/simulate-customer`,
            { scenario: scenario.id },
            token
          );

          setMessages((prev) => [...prev, customerResponse.message]);
          setIsTyping(false);
        } catch (err) {
          console.error('Error simulating customer:', err);
          setIsTyping(false);
        }
      }, 1000);
    } catch (err: any) {
      console.error('Error starting session:', err);
      setError(err.message || 'Failed to start session');
    } finally {
      setIsStarting(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!sessionId) return;

    try {
      const token = storage.getItem<string>('token') ?? undefined;

      // Add user message immediately
      const userMessage: SimulationMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      setIsTyping(true);

      // Send message and get agent response
      const response = await api.post<{ message: SimulationMessage }>(
        `/sandbox/${sessionId}/message`,
        { message, role: 'user' },
        token
      );

      setMessages((prev) => [...prev, response.message]);
      setIsTyping(false);

      // Optionally simulate another customer response
      if (Math.random() > 0.5) {
        setTimeout(async () => {
          try {
            setIsTyping(true);
            await new Promise((resolve) => setTimeout(resolve, 1500));

            const customerResponse = await api.post<{ message: SimulationMessage }>(
              `/sandbox/${sessionId}/simulate-customer`,
              {},
              token
            );

            setMessages((prev) => [...prev, customerResponse.message]);
            setIsTyping(false);
          } catch (err) {
            console.error('Error simulating follow-up:', err);
            setIsTyping(false);
          }
        }, 1000);
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to send message');
      setIsTyping(false);
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) return;

    setIsEnding(true);

    try {
      const token = storage.getItem<string>('token') ?? undefined;

      const response = await api.post<{ session: any; evaluation: any }>(
        `/sandbox/${sessionId}/end`,
        {},
        token
      );

      setSessionEnded(true);
      setFinalEvaluation(response.evaluation);

      // Add final system message
      const finalMessage: SimulationMessage = {
        id: 'final',
        role: 'system',
        content: `SESIÓN FINALIZADA\n\nPuntaje Final: ${response.evaluation.overallScore}%\n\nResumen:\n${response.evaluation.strengths.map((s: string) => `✓ ${s}`).join('\n')}\n\n${response.evaluation.recommendations.join('\n')}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, finalMessage]);
    } catch (err: any) {
      console.error('Error ending session:', err);
      setError(err.message || 'Failed to end session');
    } finally {
      setIsEnding(false);
    }
  };

  const handleNewSession = () => {
    setSessionId(null);
    setMessages([]);
    setSelectedScenario(undefined);
    setElapsedSeconds(0);
    setCurrentScore(0);
    setSessionEnded(false);
    setFinalEvaluation(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreTrendIcon = () => {
    if (previousScore === null) return <Minus className="h-3 w-3" />;
    if (currentScore > previousScore) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (currentScore < previousScore) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !sessionId) {
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/${tenantSlug}/training`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Simulación de Entrenamiento</h1>
            <p className="text-muted-foreground">Practica con tu agente en un entorno controlado</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sessionEnded && finalEvaluation && (
            <>
              <Button variant="outline" onClick={handleNewSession}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Nueva Sesión
              </Button>
              <PromotionButton tenant={tenantSlug} />
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chat Area */}
        <div className="lg:col-span-2">
          <SimulationChat
            sessionId={sessionId}
            messages={messages}
            onSendMessage={handleSendMessage}
            onEndSession={handleEndSession}
            isTyping={isTyping}
            customerProfile={selectedScenario?.customerPersona}
            isLoading={isStarting}
            currentScore={sessionId ? currentScore : undefined}
            elapsedSeconds={elapsedSeconds}
          />
        </div>

        {/* Controls Panel */}
        <div className="space-y-4">
          {/* Scenario Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Escenario</CardTitle>
              <CardDescription>
                {selectedScenario
                  ? `${selectedScenario.title} (${selectedScenario.category})`
                  : 'Selecciona un escenario'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScenarioSelector
                scenarios={scenarios}
                onSelectScenario={handleSelectScenario}
                selectedScenario={selectedScenario}
                isLoading={isStarting}
              />
            </CardContent>
          </Card>

          {/* Session Stats */}
          {sessionId && (
            <Card>
              <CardHeader>
                <CardTitle>Estadísticas en Vivo</CardTitle>
                <CardDescription>Métricas de la sesión actual</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Puntaje</span>
                    <div className="flex items-center gap-2">
                      {getScoreTrendIcon()}
                      <Badge className={cn('font-semibold', getScoreBgColor(currentScore), getScoreColor(currentScore))}>
                        {currentScore}%
                      </Badge>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${currentScore}%` }}
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Duración</div>
                    <div className="text-lg font-semibold">{formatTime(elapsedSeconds)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Mensajes</div>
                    <div className="text-lg font-semibold">{messages.filter((m) => m.role !== 'system').length}</div>
                  </div>
                </div>

                {selectedScenario && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">Objetivos del Escenario:</div>
                      {selectedScenario.objectives.map((objective, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                          <span>{objective}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tips Card */}
          {!sessionId && !selectedScenario && (
            <Card>
              <CardHeader>
                <CardTitle>Consejos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Selecciona un escenario para comenzar</p>
                <p>• Actúa como el cliente descrito en el escenario</p>
                <p>• Observa cómo responde tu agente</p>
                <p>• Finaliza la sesión para ver evaluación</p>
              </CardContent>
            </Card>
          )}

          {/* Final Evaluation */}
          {sessionEnded && finalEvaluation && (
            <Card>
              <CardHeader>
                <CardTitle>Evaluación Final</CardTitle>
                <CardDescription>Resumen del desempeño</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-bold">{finalEvaluation.overallScore}%</div>
                  <div className="text-sm text-muted-foreground">Puntaje General</div>
                </div>

                {finalEvaluation.strengths.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-green-700 mb-2">Fortalezas:</div>
                    <ul className="space-y-1">
                      {finalEvaluation.strengths.map((strength: string, idx: number) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <span className="text-green-500">✓</span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {finalEvaluation.improvements.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-yellow-700 mb-2">Áreas de Mejora:</div>
                    <ul className="space-y-1">
                      {finalEvaluation.improvements.map((improvement: string, idx: number) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <span className="text-yellow-500">→</span>
                          <span>{improvement}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
