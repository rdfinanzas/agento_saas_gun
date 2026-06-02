'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Building2,
  MessageSquare,
  TrendingUp,
  Loader2,
  Bot,
  CreditCard,
  Shield,
} from 'lucide-react';
import Link from 'next/link';

interface Stats {
  tenants: number;
  users: number;
  activeSubscriptions: number;
  totalPayments: number;
  aiProviders: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      const data = await api.get<Stats>('/admin/stats', token);

      // Restar 1 al total de tenants para no contar al super admin
      setStats({
        ...data,
        tenants: Math.max(0, data.tenants - 1),
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
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
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Panel de administración del SaaS
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empresas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.tenants || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeSubscriptions || 0} activas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.users || 0}</div>
            <p className="text-xs text-muted-foreground">usuarios registrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalPayments || 0}</div>
            <p className="text-xs text-muted-foreground">pagos procesados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proveedores IA</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.aiProviders || 0}</div>
            <p className="text-xs text-muted-foreground">proveedores activos</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <Link href="/admin/tenants">
          <Button variant="outline">
            <Building2 className="mr-2 h-4 w-4" />
            Ver Empresas
          </Button>
        </Link>
        <Link href="/admin/users">
          <Button variant="outline">
            <Users className="mr-2 h-4 w-4" />
            Ver Usuarios
          </Button>
        </Link>
        <Link href="/admin/metrics">
          <Button variant="outline">
            <TrendingUp className="mr-2 h-4 w-4" />
            Métricas
          </Button>
        </Link>
        <Link href="/admin/ai-models">
          <Button variant="outline">
            <Bot className="mr-2 h-4 w-4" />
            Modelos IA
          </Button>
        </Link>
        <Link href="/admin/plans">
          <Button variant="outline">
            <CreditCard className="mr-2 h-4 w-4" />
            Planes de Pago
          </Button>
        </Link>
        <Link href="/admin/ai-models/permissions">
          <Button variant="outline">
            <Shield className="mr-2 h-4 w-4" />
            Permisos IA Tenants
          </Button>
        </Link>
      </div>
    </div>
  );
}
