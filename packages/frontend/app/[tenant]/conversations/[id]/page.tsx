'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Loader2,
  ArrowLeft,
  Send,
  UserCheck,
  UserMinus,
  Bot,
  User as UserIcon,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Message {
  id: string;
  content: string;
  direction: 'INCOMING' | 'OUTGOING';
  type: string;
  status?: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  createdAt: string;
  sender?: 'customer' | 'agent' | 'system';
}

interface Conversation {
  id: string;
  phoneNumber: string;
  status: 'ACTIVE' | 'HUMAN_TAKEOVER' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  config?: {
    agentMode: string;
  };
  agent?: {
    id: string;
    name: string;
  };
}

interface TypingUser {
  userId: string;
  userName: string;
  isTyping: boolean;
}

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenant as string;
  const conversationId = params?.id as string;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const token = storage.getItem<string>('token');

  // WebSocket connection
  const { socket, emit } = useWebSocket({
    token: token ?? undefined,
    tenantId: tenantSlug,
    onConnect: () => setConnectionStatus('connected'),
    onDisconnect: () => setConnectionStatus('disconnected'),
    onMessageReceived: (data) => {
      if (data.conversationId === conversationId) {
        fetchConversation();
      }
    },
    onTypingStart: (data) => {
      if (data.conversationId === conversationId) {
        setTypingUsers((prev) => [
          ...prev.filter((u) => u.userId !== data.userId),
          { userId: data.userId, userName: data.userName, isTyping: true },
        ]);
        setTimeout(() => {
          setTypingUsers((prev) =>
            prev.filter((u) => u.userId !== data.userId)
          );
        }, 3000);
      }
    },
    onConversationUpdated: (data) => {
      if (data.conversationId === conversationId) {
        fetchConversation();
      }
    },
  });

  const fetchConversation = useCallback(async () => {
    if (!conversationId || !token) return;

    try {
      const data = await api.get<Conversation>(`/whatsapp/conversations/${conversationId}`, token);
      setConversation(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching conversation:', err);
      setError(err.message || 'Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, token]);

  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !token || isSending) return;

    setIsSending(true);
    const content = messageInput;
    setMessageInput('');

    try {
      // Emit typing stop
      emit('typing:stop', { conversationId });

      await api.post(`/whatsapp/conversations/${conversationId}/message`, { content }, token);
      await fetchConversation();
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to send message');
      setMessageInput(content);
    } finally {
      setIsSending(false);
    }
  };

  const handleTakeOver = async () => {
    if (!token) return;

    try {
      await api.post(`/whatsapp/conversations/${conversationId}/takeover`, {}, token);
      await fetchConversation();
    } catch (err: any) {
      console.error('Error taking over:', err);
      setError(err.message || 'Failed to take over');
    }
  };

  const handleReleaseControl = async () => {
    if (!token) return;

    try {
      await api.post(`/whatsapp/conversations/${conversationId}/release`, {}, token);
      await fetchConversation();
    } catch (err: any) {
      console.error('Error releasing control:', err);
      setError(err.message || 'Failed to release control');
    }
  };

  const handleCloseConversation = async () => {
    if (!token) return;

    try {
      await api.post(`/whatsapp/conversations/${conversationId}/close`, {}, token);
      await fetchConversation();
    } catch (err: any) {
      console.error('Error closing conversation:', err);
      setError(err.message || 'Failed to close conversation');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (value: string) => {
    setMessageInput(value);
    // Emit typing event
    emit('typing:start', { conversationId });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="default">Activa</Badge>;
      case 'HUMAN_TAKEOVER':
        return <Badge variant="secondary">Control Manual</Badge>;
      case 'CLOSED':
        return <Badge variant="secondary">Cerrada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getConnectionStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Badge variant="default" className="gap-1"><Check className="h-3 w-3" /> Conectado</Badge>;
      case 'connecting':
        return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Conectando...</Badge>;
      case 'disconnected':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Desconectado</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Conversación no encontrada</h2>
        <Button onClick={() => router.back()}>Volver</Button>
      </div>
    );
  }

  const isHumanTakeover = conversation.status === 'HUMAN_TAKEOVER';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{conversation.phoneNumber}</h1>
              {getStatusBadge(conversation.status)}
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Última actividad: {new Date(conversation.updatedAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getConnectionStatusBadge()}
          <div className="flex gap-2">
            {isHumanTakeover ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleReleaseControl}
                  disabled={conversation.status === 'CLOSED'}
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  Liberar Control
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCloseConversation}
                  disabled={conversation.status === 'CLOSED'}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Cerrar
                </Button>
              </>
            ) : (
              <Button
                onClick={handleTakeOver}
                disabled={conversation.status === 'CLOSED'}
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Tomar Control
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Chat Area */}
        <div className="lg:col-span-3">
          <Card className="h-[calc(100vh-250px)] flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      <UserIcon className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">Cliente</CardTitle>
                    <CardDescription className="text-xs">
                      {conversation.phoneNumber}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {conversation.config?.agentMode && (
                    <Badge variant="outline" className="gap-1">
                      <Bot className="h-3 w-3" />
                      {conversation.config.agentMode}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col p-0">
              <ChatWindow
                mode={isHumanTakeover ? 'takeover' : 'view'}
                conversationId={conversationId}
                messages={conversation.messages}
                onMessageSend={handleSendMessage}
                isSending={isSending}
                canSend={isHumanTakeover}
                typingUsers={typingUsers}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Agent Info */}
        <div className="space-y-4">
          {/* Conversation Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Información</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estado:</span>
                {getStatusBadge(conversation.status)}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mensajes:</span>
                <span className="font-medium">{conversation.messages.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modo Agente:</span>
                <span className="font-medium">{conversation.config?.agentMode || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Iniciada:</span>
                <span className="font-medium">{new Date(conversation.createdAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Agent Info Card */}
          {conversation.agent && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Agente Asignado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{conversation.agent.name}</div>
                    <div className="text-xs text-muted-foreground">ID: {conversation.agent.id}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Manual Input (when in takeover mode) */}
          {isHumanTakeover && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Mensaje Rápido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Escribe un mensaje..."
                  value={messageInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyPress}
                  rows={4}
                  disabled={isSending}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || isSending}
                  className="w-full"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Enviar Mensaje
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Connection Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Estado de Conexión</CardTitle>
            </CardHeader>
            <CardContent>
              {getConnectionStatusBadge()}
            </CardContent>
          </Card>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
}
