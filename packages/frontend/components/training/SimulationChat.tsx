'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Send,
  Bot,
  User,
  Clock,
  StopCircle,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface SimulationChatProps {
  sessionId: string | null;
  messages: SimulationMessage[];
  onSendMessage: (message: string) => Promise<void>;
  onEndSession: () => void;
  isTyping: boolean;
  customerProfile?: {
    name: string;
    tone: string;
  };
  isLoading?: boolean;
  currentScore?: number;
  elapsedSeconds?: number;
}

export function SimulationChat({
  sessionId,
  messages,
  onSendMessage,
  onEndSession,
  isTyping,
  customerProfile,
  isLoading,
  currentScore,
  elapsedSeconds = 0,
}: SimulationChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isSending || !sessionId) return;

    setIsSending(true);
    try {
      await onSendMessage(inputValue.trim());
      setInputValue('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!isSending && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isSending]);

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

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base">{customerProfile?.name || 'Cliente Simulado'}</CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="capitalize">{customerProfile?.tone || 'amigable'}</span>
                {sessionId && <span>• Sesión activa</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentScore !== undefined && (
              <Badge className={cn('font-semibold', getScoreBgColor(currentScore), getScoreColor(currentScore))}>
                {currentScore}%
              </Badge>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatTime(elapsedSeconds)}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!sessionId && (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Selecciona un escenario para comenzar</p>
              <p className="text-sm">El chat se iniciará cuando inicies la simulación</p>
            </div>
          )}

          {sessionId && messages.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Esperando primer mensaje</p>
              <p className="text-sm">Envía un mensaje para iniciar la conversación</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'agent' ? 'justify-start' : 'justify-end'
              )}
            >
              {message.role === 'agent' && (
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="bg-primary/10">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}

              <div
                className={cn(
                  'rounded-lg px-4 py-2 max-w-[75%]',
                  message.role === 'agent'
                    ? 'bg-muted'
                    : message.role === 'system'
                    ? 'bg-yellow-100 text-yellow-900 text-xs font-mono'
                    : 'bg-primary text-primary-foreground'
                )}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                <div
                  className={cn(
                    'flex items-center gap-2 mt-1',
                    message.role === 'agent'
                      ? 'text-muted-foreground'
                      : message.role === 'system'
                      ? 'text-yellow-700'
                      : 'text-primary-foreground/70'
                  )}
                >
                  <span className="text-xs">{formatTimestamp(message.timestamp)}</span>
                  {message.metadata?.responseTime && (
                    <span className="text-xs">{message.metadata.responseTime}ms</span>
                  )}
                  {message.metadata?.sentiment && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs h-5',
                        message.metadata.sentiment === 'positive'
                          ? 'border-green-500 text-green-700'
                          : message.metadata.sentiment === 'negative'
                          ? 'border-red-500 text-red-700'
                          : 'border-gray-500 text-gray-700'
                      )}
                    >
                      {message.metadata.sentiment}
                    </Badge>
                  )}
                </div>
              </div>

              {message.role === 'user' && (
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="bg-primary/10">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="bg-primary/10">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-lg px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t p-4 space-y-3">
          {sessionId && (
            <>
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu mensaje como si fueras el cliente..."
                  className="min-h-[60px] max-h-[200px] resize-none"
                  disabled={!sessionId || isSending}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!inputValue.trim() || isSending || !sessionId}
                  className="h-[60px] w-[60px] flex-shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onEndSession}
                    disabled={!sessionId}
                    className="text-destructive hover:text-destructive"
                  >
                    <StopCircle className="h-4 w-4 mr-1" />
                    Finalizar Sesión
                  </Button>
                </div>

                {sessionId && (
                  <div className="text-xs text-muted-foreground">
                    {messages.length} mensajes • Enter para enviar
                  </div>
                )}
              </div>
            </>
          )}

          {!sessionId && (
            <div className="text-center text-sm text-muted-foreground">
              Selecciona un escenario arriba para comenzar la simulación
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
