/**
 * MessageList - Lista de mensajes con scrolling
 *
 * Muestra todos los mensajes de la conversación actual
 */

import React, { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './MessageBubble';
import { TaskMessage } from '@/lib/accomplish-client';
import { Loader2, Code, FileText, Wrench, Table } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAccomplishStore } from '@/stores/taskStore';

interface MessageListProps {
  messages: TaskMessage[];
  isLoading?: boolean;
  isStreaming?: boolean;
  className?: string;
}

export function MessageList({
  messages,
  isLoading = false,
  isStreaming = false,
  className
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { createTask } = useAccomplishStore();

  // Auto-scroll al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSuggestionClick = (prompt: string) => {
    createTask({ prompt });
  };

  return (
    <ScrollArea className={className}>
      <div ref={scrollRef} className="p-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L11 5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">¿En qué puedo ayudarte?</h3>
            <p className="text-muted-foreground max-w-md">
              Puedo crear agentes para tu negocio, conectarlos con WhatsApp, integrarlos con tu ERP, y más.
              Decime qué necesitás y lo configuro.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-6 max-w-md mx-auto w-full">
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => handleSuggestionClick('Creame un agente de ventas para WhatsApp')}
              >
                <Code className="mr-2 h-4 w-4" />
                Crear agente WhatsApp
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => handleSuggestionClick('Creame un agente de marketing')}
              >
                <FileText className="mr-2 h-4 w-4" />
                Crear agente interno
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => handleSuggestionClick('Que agentes tengo creados?')}
              >
                <Wrench className="mr-2 h-4 w-4" />
                Ver mis agentes
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => handleSuggestionClick('Conecta mi agente de ventas con Dolibarr')}
              >
                <Table className="mr-2 h-4 w-4" />
                Integrar ERP
              </Button>
            </div>
          </div>
        )}

        {messages.filter(m => m.role !== 'tool').map((message, index) => (
          <MessageBubble
            key={message.id || index}
            message={message}
            isStreaming={isStreaming && index === messages.length - 1 && message.role === 'assistant'}
          />
        ))}

        {isLoading && (
          <div className="flex gap-3 mb-4">
            <div className="flex-shrink-0">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
            <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground">
              Iniciando tarea...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
