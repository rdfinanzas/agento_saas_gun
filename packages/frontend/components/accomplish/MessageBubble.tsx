/**
 * MessageBubble - Burbuja individual de mensaje
 *
 * Muestra un mensaje con formato según su rol
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Bot, User, Wrench, AlertCircle } from 'lucide-react';
import { TaskMessage } from '@/lib/accomplish-client';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: TaskMessage;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const getAvatar = () => {
    switch (message.role) {
      case 'user':
        return (
          <Avatar className="h-8 w-8">
            <User className="h-5 w-5" />
          </Avatar>
        );
      case 'assistant':
        return (
          <Avatar className="h-8 w-8 bg-primary">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </Avatar>
        );
      case 'tool':
        return (
          <Avatar className="h-8 w-8 bg-orange-500">
            <Wrench className="h-5 w-5 text-white" />
          </Avatar>
        );
      case 'system':
        return (
          <Avatar className="h-8 w-8 bg-gray-500">
            <AlertCircle className="h-5 w-5 text-white" />
          </Avatar>
        );
      default:
        return null;
    }
  };

  const getBubbleStyle = () => {
    switch (message.role) {
      case 'user':
        return 'bg-primary text-primary-foreground ml-auto';
      case 'assistant':
        return 'bg-muted';
      case 'tool':
        return 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800';
      case 'system':
        return 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
      default:
        return 'bg-muted';
    }
  };

  const formatContent = (content: string) => {
    // Formatear código markdown si está disponible
    // Por ahora, solo retornar el contenido tal cual
    return content;
  };

  return (
    <div className={cn('flex gap-3 mb-4', message.role === 'user' && 'flex-row-reverse')}>
      <div className="flex-shrink-0">
        {getAvatar()}
      </div>

      <Card className={cn(
        'max-w-[80%] shadow-sm',
        getBubbleStyle(),
        message.role === 'user' && 'border-primary'
      )}>
        <CardContent className="p-3">
          {message.metadata?.toolName && (
            <div className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-1">
              🛠 {message.metadata.toolName}
            </div>
          )}

          <div className="text-sm whitespace-pre-wrap break-words">
            {formatContent(message.content)}
            {isStreaming && <span className="animate-pulse">▊</span>}
          </div>

          {message.timestamp && (
            <div className="text-xs opacity-60 mt-2">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
