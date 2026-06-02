/**
 * DebugPanel - Panel de depuración para Accomplish
 *
 * Muestra logs, eventos del sistema, herramientas utilizadas y métricas de ejecución
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  ChevronUp,
  Bug,
  Zap,
  Clock,
  Cpu,
  FileCode,
  X,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DebugLog {
  id: string;
  timestamp: Date;
  type: 'info' | 'warning' | 'error' | 'success';
  source: string;
  message: string;
  data?: any;
}

interface ToolExecution {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed';
  input?: any;
  output?: any;
  error?: string;
}

interface SystemMetrics {
  memoryUsed: number;
  memoryPeak: number;
  executionTime: number;
  toolsExecuted: number;
  tokensUsed?: number;
}

interface DebugPanelProps {
  logs?: DebugLog[];
  tools?: ToolExecution[];
  metrics?: SystemMetrics;
  onClose?: () => void;
  className?: string;
}

export function DebugPanel({
  logs = [],
  tools = [],
  metrics,
  onClose,
  className = '',
}: DebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'logs' | 'tools' | 'metrics'>('logs');
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al final cuando se agregan nuevos logs
  useEffect(() => {
    if (isExpanded && activeTab === 'logs') {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isExpanded, activeTab]);

  const getLogIcon = (type: DebugLog['type']) => {
    switch (type) {
      case 'error':
        return <Badge variant="destructive">ERROR</Badge>;
      case 'warning':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">WARN</Badge>;
      case 'success':
        return <Badge variant="outline" className="border-green-500 text-green-500">OK</Badge>;
      default:
        return <Badge variant="secondary">INFO</Badge>;
    }
  };

  const getToolStatusBadge = (status: ToolExecution['status']) => {
    switch (status) {
      case 'running':
        return <Badge variant="outline" className="animate-pulse">Running</Badge>;
      case 'completed':
        return <Badge variant="outline" className="border-green-500 text-green-500">Done</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
    }
  };

  const formatDuration = (start: Date, end?: Date) => {
    const endTime = end || new Date();
    const ms = endTime.getTime() - start.getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <Card className={`fixed bottom-4 right-4 w-96 shadow-xl z-50 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4" />
            <CardTitle className="text-sm">Debug Panel</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {isExpanded && (
          <CardDescription className="text-xs">
            Logs del sistema y métricas de ejecución
          </CardDescription>
        )}
      </CardHeader>

      {isExpanded && (
        <>
          {/* Tabs */}
          <div className="flex border-b px-6">
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'logs'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Logs ({logs.length})
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'tools'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Tools ({tools.length})
            </button>
            <button
              onClick={() => setActiveTab('metrics')}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'metrics'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Metrics
            </button>
          </div>

          <CardContent className="p-0">
            {/* Logs Tab */}
            {activeTab === 'logs' && (
              <ScrollArea className="h-64 px-6 py-4">
                <div className="space-y-2">
                  {logs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No hay logs disponibles
                    </p>
                  ) : (
                    logs.map((log) => (
                      <div key={log.id} className="text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {log.timestamp.toLocaleTimeString()}
                          </span>
                          {getLogIcon(log.type)}
                          <span className="font-mono text-muted-foreground">
                            {log.source}
                          </span>
                        </div>
                        <p className="text-foreground pl-14">{log.message}</p>
                        {log.data && (
                          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </ScrollArea>
            )}

            {/* Tools Tab */}
            {activeTab === 'tools' && (
              <ScrollArea className="h-64 px-6 py-4">
                <div className="space-y-3">
                  {tools.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No hay herramientas ejecutadas
                    </p>
                  ) : (
                    tools.map((tool) => (
                      <div key={tool.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileCode className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono text-sm font-medium">
                              {tool.name}
                            </span>
                            {getToolStatusBadge(tool.status)}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDuration(tool.startTime, tool.endTime)}
                          </div>
                        </div>

                        {tool.input && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              Input
                            </summary>
                            <pre className="mt-1 bg-muted p-2 rounded overflow-x-auto">
                              {JSON.stringify(tool.input, null, 2)}
                            </pre>
                          </details>
                        )}

                        {tool.output && tool.status === 'completed' && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              Output
                            </summary>
                            <pre className="mt-1 bg-muted p-2 rounded overflow-x-auto max-h-32">
                              {typeof tool.output === 'string'
                                ? tool.output
                                : JSON.stringify(tool.output, null, 2)}
                            </pre>
                          </details>
                        )}

                        {tool.error && tool.status === 'failed' && (
                          <div className="text-xs bg-destructive/10 text-destructive p-2 rounded">
                            {tool.error}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            )}

            {/* Metrics Tab */}
            {activeTab === 'metrics' && (
              <div className="p-6 space-y-4">
                {!metrics ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No hay métricas disponibles
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <MetricCard
                        icon={<Cpu className="h-4 w-4" />}
                        label="Memoria Usada"
                        value={`${(metrics.memoryUsed / 1024 / 1024).toFixed(2)} MB`}
                      />
                      <MetricCard
                        icon={<Cpu className="h-4 w-4" />}
                        label="Pico Memoria"
                        value={`${(metrics.memoryPeak / 1024 / 1024).toFixed(2)} MB`}
                      />
                      <MetricCard
                        icon={<Clock className="h-4 w-4" />}
                        label="Tiempo Ejecución"
                        value={`${(metrics.executionTime / 1000).toFixed(2)}s`}
                      />
                      <MetricCard
                        icon={<Zap className="h-4 w-4" />}
                        label="Tools Ejecutados"
                        value={metrics.toolsExecuted.toString()}
                      />
                    </div>

                    {metrics.tokensUsed && (
                      <MetricCard
                        icon={<FileCode className="h-4 w-4" />}
                        label="Tokens Utilizados"
                        value={metrics.tokensUsed.toLocaleString()}
                      />
                    )}

                    {/* Barra de progreso de memoria */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Uso de memoria</span>
                        <span>
                          {((metrics.memoryUsed / metrics.memoryPeak) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{
                            width: `${(metrics.memoryUsed / metrics.memoryPeak) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </>
      )}
    </Card>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

function MetricCard({ icon, label, value }: MetricCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

/**
 * Hook para gestionar logs de debugging
 */
export function useDebugLogs() {
  const [logs, setLogs] = useState<DebugLog[]>([]);

  const addLog = (
    type: DebugLog['type'],
    source: string,
    message: string,
    data?: any
  ) => {
    const newLog: DebugLog = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
      type,
      source,
      message,
      data,
    };
    setLogs((prev) => [...prev, newLog]);
  };

  const clearLogs = () => setLogs([]);

  return { logs, addLog, clearLogs };
}

/**
 * Hook para gestionar métricas del sistema
 */
export function useSystemMetrics() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    memoryUsed: 0,
    memoryPeak: 0,
    executionTime: 0,
    toolsExecuted: 0,
  });

  const updateMetric = <K extends keyof SystemMetrics>(
    key: K,
    value: SystemMetrics[K]
  ) => {
    setMetrics((prev) => ({ ...prev, [key]: value }));
  };

  const resetMetrics = () => {
    setMetrics({
      memoryUsed: 0,
      memoryPeak: 0,
      executionTime: 0,
      toolsExecuted: 0,
    });
  };

  return { metrics, updateMetric, resetMetrics };
}
