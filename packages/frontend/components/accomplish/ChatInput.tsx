/**
 * ChatInput - Input de texto con toolbar
 *
 * Campo de entrada para mensajes con botones adicionales
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Send,
  Square,
  Plus,
  Upload,
  Code,
  FileText,
  Image as ImageIcon,
  Settings,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

interface AIProvider {
  id: string;
  provider: string;
  displayName: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  apiKeyName: string;
  configSchema: any;
  models: AIModel[];
}

interface AIModel {
  id: string;
  modelId: string;
  displayName: string;
  description?: string;
  isActive: boolean;
  maxTokens?: number;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsStreaming: boolean;
  costPer1kTokens?: number;
}

interface ChatInputProps {
  onSend: (message: string) => void;
  onFileUpload?: (file: File) => void;
  onCodeSnippet?: (code: string, language: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  isProcessing?: boolean;
  placeholder?: string;
  className?: string;
  showToolbar?: boolean;
}

export function ChatInput({
  onSend,
  onFileUpload,
  onCodeSnippet,
  onCancel,
  disabled = false,
  isLoading = false,
  isProcessing = false,
  placeholder = 'Escribe tu tarea aquí... (ej: "Crea un script de Python que analice datos de ventas")',
  className,
  showToolbar = true
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // AI Providers loaded from API
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);

  // Settings dialog states
  const [provider, setProvider] = useState('anthropic');
  const [model, setModel] = useState('claude-sonnet-4-20250514');
  const [maxTokens, setMaxTokens] = useState('4096');
  const [temperature, setTemperature] = useState('0.7');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Code dialog states
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('javascript');

  // Prevent hydration mismatch
  const [mounted, setMounted] = useState(false);

  // Load AI Providers from API
  useEffect(() => {
    setMounted(true);
    loadAIProviders();
  }, []);

  const loadAIProviders = async () => {
    try {
      const token = storage.getItem<string>('token');
      console.log('[ChatInput] Token exists:', !!token);

      if (!token) {
        console.log('[ChatInput] No token found, skipping provider load');
        setLoadingProviders(false);
        return;
      }

      console.log('[ChatInput] Fetching AI providers...');
      const response = await api.get<{ success: boolean; data: AIProvider[] }>('/admin/ai-providers/public', token);
      console.log('[ChatInput] Response received:', response);

      const providers = response.data || [];
      console.log('[ChatInput] Providers received:', providers.length);

      setProviders(providers);

      // Set default provider if available
      const activeProviders = providers.filter(p => p.isActive);
      if (activeProviders.length > 0) {
        const defaultProvider = activeProviders.find((p: AIProvider) => p.isDefault) || activeProviders[0];
        if (defaultProvider) {
          setProvider(defaultProvider.provider);
          console.log('[ChatInput] Default provider set:', defaultProvider.provider);
          // Set default model if available
          if (defaultProvider.models.length > 0) {
            const defaultModel = defaultProvider.models.find(m => m.isActive) || defaultProvider.models[0];
            if (defaultModel) {
              setModel(defaultModel.modelId);
              console.log('[ChatInput] Default model set:', defaultModel.modelId);
            }
          }
        }
      }
    } catch (err) {
      console.error('[ChatInput] Error loading AI providers:', err);
    } finally {
      setLoadingProviders(false);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (trimmed && !disabled && !isLoading) {
      onSend(trimmed);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
  };

  const handleCodeSubmit = () => {
    if (code.trim() && onCodeSnippet) {
      onCodeSnippet(code, codeLanguage);
      setCode('');
      setCodeOpen(false);
    } else if (code.trim()) {
      // Si no hay handler, enviar como mensaje normal
      const codeBlock = '```' + codeLanguage + '\n' + code + '\n```\n\nAnaliza este código.';
      onSend(codeBlock);
      setCode('');
      setCodeOpen(false);
    }
  };

  const handleSaveSettings = () => {
    // Guardar configuración en localStorage
    localStorage.setItem('accomplish-provider', provider);
    localStorage.setItem('accomplish-model', model);
    localStorage.setItem('accomplish-maxTokens', maxTokens);
    localStorage.setItem('accomplish-temperature', temperature);
    setSettingsOpen(false);
    // Recargar página para aplicar cambios
    window.location.reload();
  };

  // Load settings from localStorage
  useEffect(() => {
    const savedProvider = localStorage.getItem('accomplish-provider');
    const savedModel = localStorage.getItem('accomplish-model');
    const savedMaxTokens = localStorage.getItem('accomplish-maxTokens');
    const savedTemperature = localStorage.getItem('accomplish-temperature');

    if (savedProvider) setProvider(savedProvider);
    if (savedModel) setModel(savedModel);
    if (savedMaxTokens) setMaxTokens(savedMaxTokens);
    if (savedTemperature) setTemperature(savedTemperature);
  }, []);

  // Auto-select first available model when provider changes
  useEffect(() => {
    if (providers.length > 0) {
      const selectedProvider = providers.find(p => p.provider === provider);
      if (selectedProvider && selectedProvider.models.length > 0) {
        const activeModels = selectedProvider.models.filter(m => m.isActive);
        if (activeModels.length > 0) {
          // Only auto-select if current model is not in the new provider's models
          const currentModelValid = activeModels.some(m => m.modelId === model);
          if (!currentModelValid) {
            setModel(activeModels[0].modelId);
          }
        }
      }
    }
  }, [provider, providers]);

  return (
    <Card className={cn('border-t rounded-none', className)}>
      <CardContent className="p-4">
        {showToolbar && (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b">
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  disabled={disabled}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Configurar Modelo</DialogTitle>
                  <DialogDescription>
                    Selecciona el proveedor de IA y el modelo a utilizar.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {loadingProviders ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label>Proveedor</Label>
                        <Select value={provider} onValueChange={setProvider}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {providers.map(p => (
                              <SelectItem key={p.provider} value={p.provider}>
                                {p.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Modelo</Label>
                        <Select value={model} onValueChange={setModel}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {providers
                              .find(p => p.provider === provider)
                              ?.models
                              .filter(m => m.isActive)
                              .map(m => (
                                <SelectItem key={m.modelId} value={m.modelId}>
                                  {m.displayName}
                                </SelectItem>
                              )) || []}

                            {(!providers.find(p => p.provider === provider)?.models.length ||
                              !providers.find(p => p.provider === provider)?.models.filter(m => m.isActive).length) && (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground text-center">
                                No hay modelos disponibles
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Max Tokens</Label>
                          <Input
                            type="number"
                            value={maxTokens}
                            onChange={(e) => setMaxTokens(e.target.value)}
                            min="128"
                            max="128000"
                          />
                        </div>
                        <div>
                          <Label>Temperature</Label>
                          <Input
                            type="number"
                            value={temperature}
                            onChange={(e) => setTemperature(e.target.value)}
                            min="0"
                            max="1"
                            step="0.1"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleSaveSettings}>
                          Guardar
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isLoading}
              rows={1}
              className="min-h-[44px] max-h-[200px] resize-none pr-12"
            />

            {input.length > 0 && (
              <div className="absolute right-3 bottom-3 text-xs text-muted-foreground">
                {input.length} caracteres
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {isProcessing && onCancel && (
              <Button
                variant="destructive"
                size="icon"
                className="h-11 w-11 flex-shrink-0"
                onClick={onCancel}
                disabled={disabled}
              >
                <Square className="h-5 w-5" />
              </Button>
            )}

            <Button
              variant={input.trim() ? 'default' : 'secondary'}
              size="icon"
              className="h-11 w-11 flex-shrink-0"
              onClick={handleSend}
              disabled={!input.trim() || disabled || isLoading}
            >
              {isLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            {isProcessing ? (
              <span className="text-orange-600 dark:text-orange-400">
                Procesando tarea... Presiona Cancel para detener
              </span>
            ) : (
              <span>Preciona Enter para enviar, Shift+Enter para nueva línea</span>
            )}
          </span>

          <div className="flex items-center gap-4">
            {mounted && (
              <span>
                Modelo: <strong className="text-primary">
                  {providers.find(p => p.provider === provider)?.displayName || provider} / {model.split('-')[0]}
                </strong>
              </span>
            )}
            <span>Agente Maestro Workspace</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
