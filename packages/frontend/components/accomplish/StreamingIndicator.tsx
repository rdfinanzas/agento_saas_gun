/**
 * StreamingIndicator - Indicador de actividad de streaming
 *
 * Muestra el estado de la conexión SSE y actividad en tiempo real
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Wifi, WifiOff, Loader2, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreamingIndicatorProps {
  isConnected: boolean;
  isStreaming: boolean;
  progress?: number;
  currentActivity?: string;
  className?: string;
}

export function StreamingIndicator({
  isConnected,
  isStreaming,
  progress,
  currentActivity,
  className
}: StreamingIndicatorProps) {
  return (
    <Card className={cn('border-l-4', className, {
      'border-l-green-500': isConnected && !isStreaming,
      'border-l-blue-500': isConnected && isStreaming,
      'border-l-red-500': !isConnected,
    })}>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {/* Estado de conexión */}
          <div className={cn(
            'rounded-full p-2',
            isConnected ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
          )}>
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-600 dark:text-red-400" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">
                {isConnected ? 'Conectado' : 'Desconectado'}
              </span>

              {isStreaming && (
                <Badge variant="secondary" className="gap-1">
                  <Activity className="h-3 w-3 animate-pulse" />
                  Activo
                </Badge>
              )}
            </div>

            {currentActivity && (
              <p className="text-xs text-muted-foreground truncate">{currentActivity}</p>
            )}

            {/* Barra de progreso */}
            {progress !== undefined && (
              <Progress value={progress} className="h-1 mt-2" />
            )}
          </div>

          {/* Loading spinner */}
          {isStreaming && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ConnectionStatusProps {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  error?: string;
  className?: string;
}

export function ConnectionStatus({ status, error, className }: ConnectionStatusProps) {
  const getStatusInfo = () => {
    switch (status) {
      case 'connecting':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          text: 'Conectando...',
          color: 'text-yellow-600 dark:text-yellow-400',
        };
      case 'connected':
        return {
          icon: <Wifi className="h-4 w-4" />,
          text: 'Conectado',
          color: 'text-green-600 dark:text-green-400',
        };
      case 'disconnected':
        return {
          icon: <WifiOff className="h-4 w-4" />,
          text: 'Desconectado',
          color: 'text-gray-600 dark:text-gray-400',
        };
      case 'error':
        return {
          icon: <WifiOff className="h-4 w-4" />,
          text: 'Error de conexión',
          color: 'text-red-600 dark:text-red-400',
        };
    }
  };

  const info = getStatusInfo();

  return (
    <div className={cn('flex items-center gap-2 text-sm', className, info.color)}>
      {info.icon}
      <span>{info.text}</span>
      {error && <span className="text-xs text-muted-foreground ml-2">({error})</span>}
    </div>
  );
}

interface TypingIndicatorProps {
  isTyping: boolean;
  className?: string;
}

export function TypingIndicator({ isTyping, className }: TypingIndicatorProps) {
  if (!isTyping) return null;

  return (
    <div className={cn('flex items-center gap-2 text-muted-foreground', className)}>
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-xs">Escribiendo...</span>
    </div>
  );
}
