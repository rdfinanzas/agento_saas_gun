'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import * as socketIo from 'socket.io-client';

// Use 'any' for Socket type to avoid version conflicts
type Socket = any;
const io = (socketIo as any).default || socketIo;

interface WebSocketOptions {
  token?: string;
  tenantId?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessageReceived?: (data: MessageReceivedData) => void;
  onMessageSent?: (data: MessageSentData) => void;
  onTypingStart?: (data: TypingData) => void;
  onTypingStop?: (data: TypingData) => void;
  onConversationUpdated?: (data: ConversationUpdatedData) => void;
  onPendingApproval?: (data: PendingApprovalData) => void;
  onResponseApproved?: (data: ResponseApprovalData) => void;
  onResponseRejected?: (data: ResponseRejectionData) => void;
}

interface MessageReceivedData {
  conversationId: string;
  message: {
    id: string;
    content: string;
    direction: 'INCOMING' | 'OUTGOING';
    createdAt: string;
  };
}

interface MessageSentData {
  conversationId: string;
  messageId: string;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
}

interface TypingData {
  conversationId: string;
  userId: string;
  userName: string;
}

interface ConversationUpdatedData {
  conversationId: string;
  status?: string;
  updatedAt: string;
}

interface PendingApprovalData {
  responseId: string;
  conversationId: string;
  proposedResponse: string;
  confidence?: number;
  expiresAt: string;
}

interface ResponseApprovalData {
  responseId: string;
  conversationId: string;
  reviewedBy: string;
}

interface ResponseRejectionData {
  responseId: string;
  conversationId: string;
  reviewedBy: string;
  notes: string;
}

export function useWebSocket({
  token,
  tenantId,
  onConnect,
  onDisconnect,
  onMessageReceived,
  onMessageSent,
  onTypingStart,
  onTypingStop,
  onConversationUpdated,
  onPendingApproval,
  onResponseApproved,
  onResponseRejected,
}: WebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const socketRef = useRef<Socket | null>(null as Socket | null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  const connect = useCallback(() => {
    if (!token || !tenantId || socketRef.current?.connected) return;

    setConnectionStatus('connecting');

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

    const socket = io(wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: RECONNECT_DELAY,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    });

    socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      setIsConnected(true);
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;
      socket.emit('join:tenant', { tenantId });
      onConnect?.();
    });

    socket.on('disconnect', (reason: string) => {
      console.log('[WebSocket] Disconnected:', reason);
      setIsConnected(false);
      setConnectionStatus('disconnected');
      onDisconnect?.();
    });

    socket.on('connect_error', (error: Error) => {
      console.error('[WebSocket] Connection error:', error);
      reconnectAttemptsRef.current++;

      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[WebSocket] Max reconnection attempts reached');
        setConnectionStatus('disconnected');
      }
    });

    // Message events
    socket.on('message:received', (data: MessageReceivedData) => {
      onMessageReceived?.(data);
    });

    socket.on('message:sent', (data: MessageSentData) => {
      onMessageSent?.(data);
    });

    // Typing events
    socket.on('typing:start', (data: TypingData) => {
      onTypingStart?.(data);
    });

    socket.on('typing:stop', (data: TypingData) => {
      onTypingStop?.(data);
    });

    // Conversation events
    socket.on('conversation:updated', (data: ConversationUpdatedData) => {
      onConversationUpdated?.(data);
    });

    // Approval events
    socket.on('pending_approval', (data: PendingApprovalData) => {
      onPendingApproval?.(data);
    });

    socket.on('response_approved', (data: ResponseApprovalData) => {
      onResponseApproved?.(data);
    });

    socket.on('response_rejected', (data: ResponseRejectionData) => {
      onResponseRejected?.(data);
    });

    socketRef.current = socket;
  }, [token, tenantId, onConnect, onDisconnect, onMessageReceived, onMessageSent, onTypingStart, onTypingStop, onConversationUpdated, onPendingApproval, onResponseApproved, onResponseRejected]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    socketRef.current?.disconnect();
    socketRef.current = null;
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('[WebSocket] Cannot emit event: not connected');
    }
  }, []);

  // Join conversation room
  const joinConversation = useCallback((conversationId: string) => {
    emit('join:conversation', { conversationId });
  }, [emit]);

  // Leave conversation room
  const leaveConversation = useCallback((conversationId: string) => {
    emit('leave:conversation', { conversationId });
  }, [emit]);

  // Send typing indicator
  const startTyping = useCallback((conversationId: string) => {
    emit('typing:start', { conversationId });
  }, [emit]);

  const stopTyping = useCallback((conversationId: string) => {
    emit('typing:stop', { conversationId });
  }, [emit]);

  useEffect(() => {
    if (token && tenantId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [token, tenantId, connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected,
    connectionStatus,
    emit,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping,
  };
}
