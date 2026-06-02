'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Check, CheckCheck, Clock, AlertCircle, Bot, User as UserIcon, Image as ImageIcon, FileText } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import React from 'react';

export interface ChatMessage {
  id: string;
  content: string;
  direction: 'INCOMING' | 'OUTGOING';
  type: string;
  status?: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  createdAt: string;
  sender?: 'customer' | 'agent' | 'system';
}

interface MessageBubbleProps {
  message: ChatMessage;
  senderName?: string;
  isOwn: boolean;
  showAvatar?: boolean;
  onClick?: () => void;
}

export function MessageBubble({
  message,
  senderName = 'Agente',
  isOwn,
  showAvatar = true,
  onClick,
}: MessageBubbleProps) {
  const getStatusIcon = () => {
    switch (message.status) {
      case 'SENT':
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case 'DELIVERED':
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case 'READ':
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case 'FAILED':
        return <AlertCircle className="h-3 w-3 text-destructive" />;
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getTypeIcon = () => {
    switch (message.type) {
      case 'image':
        return <ImageIcon className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const isSystem = message.sender === 'system';

  const getAvatarIcon = () => {
    if (isSystem) return Bot;
    if (message.direction === 'INCOMING') return UserIcon;
    return Bot;
  };

  const getAvatarColor = () => {
    if (isSystem) return 'bg-gray-500';
    if (message.direction === 'INCOMING') return 'bg-blue-500';
    return 'bg-green-500';
  };

  const AvatarIcon = getAvatarIcon();

  return (
    <div
      className={cn(
        'flex gap-2 max-w-[85%] group',
        isOwn ? 'ml-auto flex-row-reverse' : 'mr-auto',
        isSystem && 'mx-auto max-w-full'
      )}
    >
      {/* Avatar */}
      {showAvatar && !isSystem && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className={getAvatarColor()}>
            <AvatarIcon className="h-4 w-4 text-white" />
          </AvatarFallback>
        </Avatar>
      )}

      {/* Message Content */}
      <div
        className={cn(
          'rounded-lg px-3 py-2',
          isSystem
            ? 'bg-muted text-center text-sm text-muted-foreground mx-auto'
            : isOwn
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}
        onClick={onClick}
      >
        {/* Sender Name */}
        {!isOwn && !isSystem && senderName && (
          <p className="text-xs font-medium mb-1 opacity-70">
            {senderName}
          </p>
        )}

        {/* Type Icon */}
        {getTypeIcon() && (
          <div className="flex items-center gap-1 mb-1 opacity-70">
            {getTypeIcon()}
            <span className="text-xs capitalize">{message.type}</span>
          </div>
        )}

        {/* Message Content */}
        <p className={cn(
          'text-sm break-words whitespace-pre-wrap',
          isOwn ? 'text-primary-foreground' : 'text-foreground'
        )}>
          {message.content}
        </p>

        {/* Footer: Time and Status */}
        <div
          className={cn(
            'flex items-center gap-1 mt-1',
            isOwn ? 'justify-end' : 'justify-start',
            isSystem && 'justify-center'
          )}
        >
          <span className={cn(
            'text-xs',
            isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}>
            {formatRelativeTime(new Date(message.createdAt))}
          </span>
          {isOwn && !isSystem && getStatusIcon()}
        </div>
      </div>

      {/* Action Menu (on hover) */}
      {!isSystem && (
        <button
          className={cn(
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'self-center p-1 hover:bg-muted rounded'
          )}
        >
          {/* Add more actions here if needed */}
        </button>
      )}
    </div>
  );
}
