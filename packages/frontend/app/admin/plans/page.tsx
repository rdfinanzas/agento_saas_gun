'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CreditCard,
  Loader2,
  ChevronLeft,
  Plus,
  Edit,
  Trash2,
  Check,
  Building2,
} from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

interface Plan {
  id: string;
  tier: string;
  name: string;
  description?: string;
  priceMonthly: number;
  priceYearly?: number;
  currency: string;
  isActive: boolean;
  features: any[];
  limits: any;
  tenantsCount: number;
  createdAt: string;
  updatedAt: string;
}

interface PlansResponse {
  plans: Plan[];
}

export default function AdminPlansPage() {
  const [data, setData] = useState<PlansResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [editPlan, setEditPlan] = useState<Partial<Plan>>({});

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      const result = await api.get<PlansResponse>('/admin/plans', token);
      setData(result);
    } catch (err) {
      console.error('Error loading plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async () => {
    setSaving(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      const isEdit = !!editPlan.id;
      const endpoint = isEdit
        ? `/admin/plans/${editPlan.id}`
        : '/admin/plans';

      await (isEdit ? api.put : api.post)(
        endpoint,
        editPlan,
        token
      );

      setDialog(false);
      setEditPlan({});
      loadPlans();
    } catch (err) {
      console.error('Error saving plan:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async () => {
    setSaving(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token || !selectedPlan?.id) return;

      await api.delete(`/admin/plans/${selectedPlan.id}`, token);

      setDeleteDialog(false);
      setSelectedPlan(null);
      loadPlans();
    } catch (err) {
      console.error('Error deleting plan:', err);
    } finally {
      setSaving(false);
    }
  };

  const openPlanDialog = (plan?: Plan) => {
    if (plan) {
      setEditPlan({
        ...plan,
        features: plan.features || [],
        limits: plan.limits || {},
      });
    } else {
      setEditPlan({
        tier: 'FREE',
        name: '',
        priceMonthly: 0,
        currency: 'USD',
        isActive: true,
        features: [],
        limits: {},
      });
    }
    setDialog(true);
  };

  const getTierBadge = (tier: string) => {
    const colors: Record<string, string> = {
      FREE: 'secondary',
      PRO: 'default',
      ENTERPRISE: 'default',
    };
    return <Badge variant={colors[tier] as any}>{tier}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Planes de Pago</h1>
          <p className="text-muted-foreground">
            Configura los planes de suscripción y sus características
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openPlanDialog()} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Plan
          </Button>
          <Link href="/admin">
            <Button variant="outline" size="sm">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planes ({data?.plans.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Precio Mensual</TableHead>
                <TableHead>Precio Anual</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Tenants</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div className="font-semibold">{plan.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {plan.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getTierBadge(plan.tier)}</TableCell>
                  <TableCell>
                    {plan.priceMonthly > 0
                      ? `${plan.currency} ${plan.priceMonthly}/mes`
                      : 'Gratis'}
                  </TableCell>
                  <TableCell>
                    {plan.priceYearly
                      ? `${plan.currency} ${plan.priceYearly}/año`
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {plan.isActive ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <span className="text-gray-400">Inactivo</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {plan.tenantsCount}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openPlanDialog(plan)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedPlan(plan);
                          setDeleteDialog(true);
                        }}
                        disabled={plan.tenantsCount > 0}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Plan Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editPlan.id ? 'Editar' : 'Nuevo'} Plan
            </DialogTitle>
            <DialogDescription>
              Configura un plan de suscripción con sus características y límites
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tier</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={editPlan.tier || 'FREE'}
                  onChange={(e) =>
                    setEditPlan({ ...editPlan!, tier: e.target.value })
                  }
                >
                  <option value="FREE">FREE</option>
                  <option value="PRO">PRO</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                </select>
              </div>
              <div>
                <Label>Nombre del plan</Label>
                <Input
                  value={editPlan.name || ''}
                  onChange={(e) =>
                    setEditPlan({ ...editPlan!, name: e.target.value })
                  }
                  placeholder="Plan Gratuito"
                />
              </div>
            </div>

            <div>
              <Label>Descripción</Label>
              <Textarea
                value={editPlan.description || ''}
                onChange={(e) =>
                  setEditPlan({ ...editPlan!, description: e.target.value })
                }
                rows={2}
                placeholder="Ideal para comenzar..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Precio Mensual</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editPlan.priceMonthly || ''}
                  onChange={(e) =>
                    setEditPlan({
                      ...editPlan!,
                      priceMonthly: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Precio Anual</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editPlan.priceYearly || ''}
                  onChange={(e) =>
                    setEditPlan({
                      ...editPlan!,
                      priceYearly: parseFloat(e.target.value) || undefined,
                    })
                  }
                  placeholder="Opcional"
                />
              </div>
              <div>
                <Label>Moneda</Label>
                <Input
                  value={editPlan.currency || 'USD'}
                  onChange={(e) =>
                    setEditPlan({ ...editPlan!, currency: e.target.value })
                  }
                  placeholder="USD"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={editPlan.isActive ?? true}
                onCheckedChange={(checked) =>
                  setEditPlan({ ...editPlan!, isActive: checked })
                }
              />
              <Label>Plan activo</Label>
            </div>

            <div className="border-t pt-4">
              <Label className="text-base font-semibold">Características</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Una característica por línea (formato texto)
              </p>
              <Textarea
                value={Array.isArray(editPlan.features)
                  ? editPlan.features.join('\n')
                  : ''}
                onChange={(e) =>
                  setEditPlan({
                    ...editPlan!,
                    features: e.target.value.split('\n').filter(Boolean),
                  })
                }
                rows={6}
                placeholder={`• 1000 solicitudes/mes
• 1 agente de WhatsApp
• Almacenamiento 1GB
• Soporte por email`}
              />
            </div>

            <div className="border-t pt-4">
              <Label className="text-base font-semibold">Límites (JSON)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Configuración de límites en formato JSON
              </p>
              <Textarea
                value={
                  typeof editPlan.limits === 'string'
                    ? editPlan.limits
                    : JSON.stringify(editPlan.limits || {}, null, 2)
                }
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setEditPlan({ ...editPlan!, limits: parsed });
                  } catch {
                    setEditPlan({ ...editPlan!, limits: e.target.value });
                  }
                }}
                rows={6}
                className="font-mono text-sm"
                placeholder={`{
  "maxRequests": 1000,
  "maxAgents": 1,
  "maxStorageGB": 1,
  "maxUsers": 1
}`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePlan} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Plan</DialogTitle>
            <DialogDescription>
              {selectedPlan && (selectedPlan.tenantsCount ?? 0) > 0 ? (
                <>
                  No se puede eliminar el plan <strong>{selectedPlan.name}</strong>
                  porque hay <strong>{selectedPlan.tenantsCount ?? 0}</strong>{' '}
                  tenant(s) usándolo.
                </>
              ) : (
                <>
                  ¿Estás seguro de que quieres eliminar el plan{' '}
                  <strong>{selectedPlan?.name}</strong>? Esta acción no se puede
                  deshacer.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePlan}
              disabled={saving || (selectedPlan?.tenantsCount ?? 0) > 0}
            >
              {saving ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
