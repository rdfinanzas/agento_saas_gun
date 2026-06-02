'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Rocket, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import { cn } from '@/lib/utils';

interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidationResponse {
  valid: boolean;
  issues: ValidationIssue[];
}

interface PromotionButtonProps {
  tenant: string;
  onPromoted?: () => void;
  disabled?: boolean;
}

export function PromotionButton({ tenant, onPromoted, disabled }: PromotionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && !validation) {
      validateForPromotion();
    }
  }, [isOpen]);

  const validateForPromotion = async () => {
    setIsValidating(true);
    setError(null);

    try {
      const token = storage.getItem<string>('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await api.get<ValidationResponse>('/sandbox/validate-promotion', token);
      setValidation(response);
    } catch (err: any) {
      console.error('Error validating for promotion:', err);
      setError(err.message || 'Failed to validate agent');
    } finally {
      setIsValidating(false);
    }
  };

  const handlePromote = async () => {
    setIsPromoting(true);
    setError(null);

    try {
      const token = storage.getItem<string>('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await api.post<{ success: boolean; message: string }>('/sandbox/promote', {}, token);

      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          setIsOpen(false);
          onPromoted?.();
        }, 2000);
      } else {
        setError(response.message || 'Failed to promote agent');
      }
    } catch (err: any) {
      console.error('Error promoting agent:', err);
      setError(err.message || 'Failed to promote agent');
    } finally {
      setIsPromoting(false);
    }
  };

  const canPromote = validation?.valid && (validation?.issues.filter((i) => i.severity === 'error').length === 0);

  const getIssueIcon = (severity: 'error' | 'warning') => {
    return severity === 'error' ? <XCircle className="h-4 w-4 text-destructive" /> : <AlertCircle className="h-4 w-4 text-yellow-600" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
          <Rocket className="mr-2 h-4 w-4" />
          Promover a Producción
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Promover Agente a Producción</DialogTitle>
          <DialogDescription>
            Verifica que tu agente cumpla con todos los requisitos antes de activarlo en producción
          </DialogDescription>
        </DialogHeader>

        {isValidating ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Validando requisitos...</span>
          </div>
        ) : error && !validation ? (
          <div className="py-4">
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
              Error: {error}
            </div>
          </div>
        ) : success ? (
          <div className="py-4">
            <div className="bg-green-100 text-green-900 px-4 py-3 rounded-md flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-medium">¡Agente promovido exitosamente!</p>
                <p className="text-sm text-green-800">Tu agente ahora está activo en producción</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {validation && (
              <>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium">Estado de Validación</span>
                      {canPromote ? (
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Listo para producción
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Requiere atención
                        </Badge>
                      )}
                    </div>

                    {validation.issues.length === 0 ? (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        <p>¡Todos los requisitos están cumplidos!</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Requisitos:</p>
                        {validation.issues.map((issue, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm">
                            {getIssueIcon(issue.severity)}
                            <div className="flex-1">
                              <span
                                className={cn(
                                  issue.severity === 'error' ? 'text-destructive' : 'text-yellow-700'
                                )}
                              >
                                {issue.message}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {!canPromote && (
                  <div className="bg-yellow-100 text-yellow-900 px-4 py-3 rounded-md text-sm">
                    <AlertCircle className="h-4 w-4 inline-block mr-2" />
                    Completa más sesiones de entrenamiento para cumplir con los requisitos
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isPromoting || success}>
            {success ? 'Cerrar' : 'Cancelar'}
          </Button>
          <Button
            onClick={handlePromote}
            disabled={!canPromote || isPromoting || success || isValidating}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {isPromoting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Promoviendo...
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-4 w-4" />
                Promover a Producción
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
