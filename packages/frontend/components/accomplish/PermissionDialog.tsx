/**
 * PermissionDialog - Diálogo de permisos
 *
 * Muestra una solicitud de permiso al usuario
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Shield } from 'lucide-react';
import { PermissionRequest } from '@/lib/accomplish-client';

interface PermissionDialogProps {
  request: PermissionRequest;
  onRespond: (decision: 'allow' | 'deny', options?: string[], customResponse?: string) => void;
  open?: boolean;
}

export function PermissionDialog({ request, onRespond, open = true }: PermissionDialogProps) {
  const [decision, setDecision] = useState<'allow' | 'deny'>('allow');
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [customResponse, setCustomResponse] = useState('');
  const [timeLeft, setTimeLeft] = useState(request.timeout);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1000) {
          clearInterval(interval);
          // Auto-deny on timeout
          onRespond('deny');
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [request.timeout, onRespond]);

  const handleRespond = () => {
    const options = selectedOption ? [selectedOption] : undefined;
    onRespond(decision, options, customResponse || undefined);
  };

  const progress = (timeLeft / request.timeout) * 100;

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-500" />
            <DialogTitle>Solicitud de Permiso</DialogTitle>
          </div>
          <DialogDescription>
            El agente necesita permiso para ejecutar una acción
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Alert icon */}
          <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
            <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                {request.toolName ? `Herramienta: ${request.toolName}` : 'Acción requerida'}
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                {request.description}
              </p>
            </div>
          </div>

          {/* Countdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tiempo restante</span>
              <span className="font-medium">{Math.ceil(timeLeft / 1000)}s</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Opciones predefinidas */}
          {request.options && request.options.length > 0 && (
            <div className="space-y-2">
              <Label>Opciones</Label>
              <RadioGroup value={selectedOption} onValueChange={setSelectedOption}>
                {request.options.map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={option} />
                    <Label htmlFor={option} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Respuesta custom */}
          {request.type === 'question' && (
            <div className="space-y-2">
              <Label htmlFor="custom-response">Tu respuesta</Label>
              <Input
                id="custom-response"
                placeholder="Escribe tu respuesta..."
                value={customResponse}
                onChange={(e) => setCustomResponse(e.target.value)}
              />
            </div>
          )}

          {/* Decisión */}
          <div className="space-y-2">
            <Label>Decisión</Label>
            <RadioGroup value={decision} onValueChange={(v: string) => setDecision(v as 'allow' | 'deny')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="allow" id="allow" />
                <Label htmlFor="allow" className="flex-1 cursor-pointer">
                  <span className="font-medium text-green-600 dark:text-green-400">Permitir</span>
                  <span className="ml-2 text-muted-foreground">Autorizar esta acción</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="deny" id="deny" />
                <Label htmlFor="deny" className="flex-1 cursor-pointer">
                  <span className="font-medium text-red-600 dark:text-red-400">Denegar</span>
                  <span className="ml-2 text-muted-foreground">Rechazar esta acción</span>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onRespond('deny')}
            className="flex-1"
          >
            Denegar
          </Button>
          <Button
            onClick={handleRespond}
            className="flex-1"
            variant={decision === 'allow' ? 'default' : 'destructive'}
          >
            {decision === 'allow' ? 'Permitir' : 'Denegar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
