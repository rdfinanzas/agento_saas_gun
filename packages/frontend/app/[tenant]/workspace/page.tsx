/**
 * Workspace Page - Página principal del Agente IA
 *
 * Interfaz de chat interactiva para ejecutar tareas agenticas
 */

'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAccomplishStore } from '@/stores/taskStore';
import { MessageList } from '@/components/accomplish/MessageList';
import { ChatInput } from '@/components/accomplish/ChatInput';
import { PermissionDialog } from '@/components/accomplish/PermissionDialog';
import { ActiveTools } from '@/components/accomplish/ToolProgress';
import { HistoryModal } from '@/components/accomplish/HistoryModal';
import { TemplateQuickCreate } from '@/components/accomplish/TemplateQuickCreate';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, History, Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { storage } from '@/lib/storage';

export default function WorkspacePage() {
  const params = useParams();
  const tenantSlug = params?.tenant as string;

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const hasInitializedRef = useRef(false);

  const {
    messages,
    isLoading,
    isProcessing,
    permissionRequest,
    activeTools,
    error,
    initClient,
    createTask,
    loadTask,
    followUp,
    cancelTask,
    respondToPermission,
    clearError,
    clearPermissionRequest,
    clearCurrentTask,
  } = useAccomplishStore();

  const { toast } = useToast();

  // Inicializar cliente y limpiar tarea anterior al montar
  useEffect(() => {
    if (!tenantSlug) return;

    const token = storage.getItem<string>('token');
    if (token) {
      initClient(tenantSlug, () => ({
        'Authorization': `Bearer ${token}`,
      }));
    }

    // Limpiar tarea anterior para empezar con una sesión nueva
    // Solo ejecutar una vez
    if (!hasInitializedRef.current) {
      console.log('[WorkspacePage] Iniciando nueva sesión - limpiando tarea anterior');
      clearCurrentTask();
      hasInitializedRef.current = true;
    }

    // Resetear el ref cuando se desmonta para permitir nueva limpieza
    return () => {
      hasInitializedRef.current = false;
    };
  }, [tenantSlug]); // Solo se ejecuta cuando cambia el tenant

  // Mostrar errores como toasts
  useEffect(() => {
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error,
      });
    }
  }, [error, toast]);

  const handleTemplateSelect = async (templateName: string) => {
    const message = `Creame un agente usando el template "${templateName}"`;
    await handleSend(message);
  };

  const handleSend = async (message: string) => {
    // Agregar mensaje del usuario INMEDIATAMENTE para feedback instantáneo
    const userMessage = {
      id: `user-local-${Date.now()}`, // ID único para este mensaje local
      role: 'user' as const,
      content: message,
      timestamp: new Date().toISOString(),
    };

    // Mostrar el mensaje de inmediato en la UI
    // Esto NO afecta el backend, solo da feedback visual
    // Los mensajes del backend se agregarán después vía SSE
    if (messages.length === 0) {
      // Primera tarea - crear tarea
      await createTask({ prompt: message });
    } else {
      // Follow-up a una tarea existente
      await followUp(message);
    }
  };

  const handleCancel = async () => {
    await cancelTask();
    toast({
      title: 'Tarea cancelada',
      description: 'La ejecución ha sido detenida',
    });
  };

  const handlePermissionResponse = async (
    decision: 'allow' | 'deny',
    options?: string[],
    customResponse?: string
  ) => {
    await respondToPermission(decision, options, customResponse);
    clearPermissionRequest();

    toast({
      title: 'Permiso enviado',
      description: decision === 'allow' ? 'Acción permitida' : 'Acción denegada',
    });
  };

  const handleLoadTask = async (taskId: string) => {
    try {
      await loadTask(taskId);
      toast({
        title: 'Conversación cargada',
        description: 'Puedes continuar donde la dejaste',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al cargar conversación',
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b bg-card">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Workspace
          </h1>
          <p className="text-sm text-muted-foreground">
            Soy tu asistente virtual. Puedo crear agentes de IA, conectarlos con WhatsApp, vincularlos a tu sistema ERP, y mucho más. Decime qué necesitás.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Estado:</span>{' '}
            <span className={cn(
              'font-medium',
              isProcessing ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'
            )}>
              {isProcessing ? 'Procesando' : 'Listo'}
            </span>
          </div>

          <div className="h-4 w-px bg-border" />

          <div className="text-sm">
            <span className="text-muted-foreground">Mensajes:</span>{' '}
            <span className="font-medium">{messages.length}</span>
          </div>

          <div className="h-4 w-px bg-border" />

          <TemplateQuickCreate onSelect={handleTemplateSelect} />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setHistoryModalOpen(true)}
            className="gap-2"
          >
            <History className="h-4 w-4" />
            Historial
          </Button>
        </div>
      </header>

      {/* Error Alert */}
      {error && (
        <div className="px-6 py-2">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          isStreaming={isProcessing}
          className="h-full"
        />
      </div>

      {/* Active Tools */}
      {(isProcessing || activeTools.length > 0) && (
        <div className="px-6 py-2 border-t bg-muted/20">
          <ActiveTools tools={activeTools} />
        </div>
      )}

      {/* Input Area */}
      <div className="flex-shrink-0">
        <ChatInput
          onSend={handleSend}
          onCancel={handleCancel}
          disabled={isLoading}
          isLoading={isLoading}
          isProcessing={isProcessing}
        />
      </div>

      {/* Permission Dialog */}
      {permissionRequest && (
        <PermissionDialog
          request={permissionRequest}
          onRespond={handlePermissionResponse}
          open={!!permissionRequest}
        />
      )}

      {/* History Modal */}
      <HistoryModal
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
        onLoadTask={handleLoadTask}
      />
    </div>
  );
}

// Helper function for className
function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
