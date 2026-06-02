'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Check,
  X,
  Edit,
  Bot,
  User as UserIcon,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { PendingResponse } from '@/app/[tenant]/approvals/page';
import React from 'react';

interface ApprovalCardProps {
  response: PendingResponse;
  onApprove: () => void;
  onReject: (notes?: string) => void;
  onEdit: (editedResponse: string) => void;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function ApprovalCard({
  response,
  onApprove,
  onReject,
  onEdit,
  isSelected = false,
  onSelect,
}: ApprovalCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(response.proposedResponse);
  const [showDetails, setShowDetails] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-muted-foreground';
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getConfidenceBadge = (confidence?: number) => {
    if (!confidence) return null;
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'destructive';
  };

  const getTimeRemaining = () => {
    const now = new Date();
    const expires = new Date(response.expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins <= 0) return 'Expirada';
    if (diffMins < 2) return `${diffMins} min`;
    return `${diffMins} mins`;
  };

  const isUrgent = () => {
    const now = new Date();
    const expires = new Date(response.expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    return diffMs < 120000; // Less than 2 minutes
  };

  const handleEditSave = () => {
    onEdit(editedContent);
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setEditedContent(response.proposedResponse);
    setIsEditing(false);
  };

  const handleRejectConfirm = () => {
    if (rejectNotes.trim()) {
      onReject(rejectNotes);
      setShowRejectDialog(false);
      setRejectNotes('');
    }
  };

  return (
    <Card className={cn(
      'transition-all',
      isSelected && 'ring-2 ring-primary',
      isUrgent() && 'border-orange-300 bg-orange-50/30 dark:bg-orange-950/20'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Selection Checkbox */}
          <div className="pt-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
            />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {response.conversation?.phoneNumber || response.conversationId}
                  </span>
                </div>
                {response.confidence && (
                  <Badge variant={getConfidenceBadge(response.confidence) as any} className="gap-1">
                    {Math.round(response.confidence * 100)}% confianza
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isUrgent() && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Urgente
                  </Badge>
                )}
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {getTimeRemaining()}
                </Badge>
              </div>
            </div>

            {/* Original Message (if available) */}
            {response.conversation?.customerMessage && (
              <div className="mb-3 p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">
                  Mensaje del cliente:
                </p>
                <p className="text-sm">{response.conversation.customerMessage}</p>
              </div>
            )}

            {/* Proposed Response */}
            <div className={cn(
              'p-3 rounded-lg border-2',
              isEditing ? 'border-primary bg-primary/5' : 'border-muted'
            )}>
              <div className="flex items-center gap-2 mb-2">
                <Bot className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Respuesta propuesta:</span>
              </div>

              {isEditing ? (
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{response.proposedResponse}</p>
              )}
            </div>

            {/* Reason/Context */}
            {response.reason && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1 text-xs text-muted-foreground mt-2 hover:text-foreground transition-colors"
              >
                {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Contexto de la respuesta
              </button>
            )}

            {showDetails && response.reason && (
              <div className="mt-2 p-2 bg-muted/50 rounded text-sm text-muted-foreground">
                {response.reason}
              </div>
            )}

            {/* Edit Actions */}
            {isEditing && (
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={handleEditSave}>
                  <Check className="h-4 w-4 mr-1" />
                  Guardar y Aprobar
                </Button>
                <Button size="sm" variant="outline" onClick={handleEditCancel}>
                  Cancelar
                </Button>
              </div>
            )}

            {/* Reject Dialog */}
            {showRejectDialog && (
              <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm font-medium mb-2">Notas de rechazo (requerido):</p>
                <Textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Explica por qué se rechaza esta respuesta..."
                  rows={3}
                  className="mb-2"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={handleRejectConfirm} disabled={!rejectNotes.trim()}>
                    <X className="h-4 w-4 mr-1" />
                    Confirmar Rechazo
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowRejectDialog(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {!isEditing && !showRejectDialog && (
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                onClick={onApprove}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRejectDialog(true)}
                className="hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
          Creado: {formatRelativeTime(new Date(response.createdAt))}
        </div>
      </CardContent>
    </Card>
  );
}
