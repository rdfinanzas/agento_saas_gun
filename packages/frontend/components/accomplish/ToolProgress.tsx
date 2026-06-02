/**
 * ToolProgress - Indicador de tool en ejecución
 *
 * Muestra el progreso de ejecución de herramientas
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, XCircle, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolProgressProps {
  toolName: string;
  status: 'running' | 'completed' | 'failed';
  progress?: number;
  details?: string;
  className?: string;
}

export function ToolProgress({
  toolName,
  status,
  progress = 0,
  details,
  className
}: ToolProgressProps) {
  const getIcon = () => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Wrench className="h-4 w-4" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'running':
        return 'Ejecutando...';
      case 'completed':
        return 'Completado';
      case 'failed':
        return 'Falló';
      default:
        return '';
    }
  };

  return (
    <Card className={cn('mb-2', className)}>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium truncate">{toolName}</span>
              <span className="text-xs text-muted-foreground">{getStatusText()}</span>
            </div>

            {status === 'running' && (
              <Progress value={progress} className="h-1" />
            )}

            {details && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{details}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ActiveToolsProps {
  tools: Array<{
    name: string;
    status: 'running' | 'completed' | 'failed';
    progress?: number;
    details?: string;
  }>;
  className?: string;
}

export function ActiveTools({ tools, className }: ActiveToolsProps) {
  if (tools.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Herramientas Activas
      </div>

      {tools.map((tool, index) => (
        <ToolProgress
          key={`${tool.name}-${index}`}
          toolName={tool.name}
          status={tool.status}
          progress={tool.progress}
          details={tool.details}
        />
      ))}
    </div>
  );
}
