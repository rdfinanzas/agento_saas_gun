'use client';

import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, Bot, User as UserIcon, MoreVertical } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { cn } from '@/lib/utils';

export interface ChatMessage {
  id: string;
  content: string;
  direction: 'INCOMING' | 'OUTGOING';
  type: string;
  status?: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  createdAt: string;
  sender?: 'customer' | 'agent' | 'system';
}

export interface TypingUser {
  userId: string;
  userName: string;
  isTyping: boolean;
}

interface ChatWindowProps {
  mode: 'view' | 'approve' | 'takeover';
  conversationId: string;
  messages: ChatMessage[];
  onMessageSend?: (content: string) => void;
  isSending?: boolean;
  canSend?: boolean;
  typingUsers?: TypingUser[];
  className?: string;
}

export function ChatWindow({
  mode,
  conversationId,
  messages,
  onMessageSend,
  isSending = false,
  canSend = false,
  typingUsers = [],
  className,
}: ChatWindowProps) {
  const [messageInput, setMessageInput] = React.useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const handleSend = () => {
    if (messageInput.trim() && onMessageSend && canSend) {
      onMessageSend(messageInput);
      setMessageInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getSenderInfo = (message: ChatMessage) => {
    if (message.sender === 'system') {
      return { name: 'Sistema', icon: Bot, avatarColor: 'bg-gray-500' };
    }
    if (message.direction === 'INCOMING') {
      return { name: 'Cliente', icon: UserIcon, avatarColor: 'bg-blue-500' };
    }
    return { name: 'Agente', icon: Bot, avatarColor: 'bg-green-500' };
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Messages Area */}
      <ScrollArea className="flex-1 px-4 py-2">
        <div className="space-y-4">
          {messages.map((message) => {
            const sender = getSenderInfo(message);
            return (
              <MessageBubble
                key={message.id}
                message={message}
                senderName={sender.name}
                isOwn={message.direction === 'OUTGOING'}
                showAvatar={mode === 'takeover'}
              />
            );
          })}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {typingUsers.map((u) => u.userName).join(', ')}{' '}
              {typingUsers.length === 1 ? 'está' : 'están'} escribiendo...
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      {canSend && mode === 'takeover' && (
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escribe un mensaje..."
              disabled={isSending}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!messageInput.trim() || isSending}
              size="icon"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* View Mode Notice */}
      {mode === 'view' && (
        <div className="border-t p-4 bg-muted/30">
          <p className="text-sm text-center text-muted-foreground">
            <Bot className="h-4 w-4 inline mr-2" />
            Modo visualización - Toma el control para interactuar
          </p>
        </div>
      )}

      {/* Approve Mode Notice */}
      {mode === 'approve' && (
        <div className="border-t p-4 bg-muted/30">
          <p className="text-sm text-center text-muted-foreground">
            Revisa y aprueba las respuestas pendientes
          </p>
        </div>
      )}
    </div>
  );
}

// Add React import
import React from 'react';
