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
  Building2,
  Users,
  MessageSquare,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  subscriptionTier: string;
  createdAt: string;
  usersCount: number;
  conversationsCount: number;
  agentsCount: number;
  subscriptionStatus: string | null;
}

interface TenantsResponse {
  tenants: Tenant[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function AdminTenantsPage() {
  const [data, setData] = useState<TenantsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadTenants();
  }, [page]);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      const result = await api.get<TenantsResponse>(
        `/admin/tenants?page=${page}&limit=20`,
        token
      );

      // Filtrar el tenant especial de super admin
      const filteredTenants = result.tenants.filter(t => t.slug !== 'agento-superadmin');
      const filteredTotal = result.pagination.total - (result.tenants.length - filteredTenants.length);

      setData({
        tenants: filteredTenants,
        pagination: {
          ...result.pagination,
          total: filteredTotal,
        },
      });
    } catch (err) {
      console.error('Error loading tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTierBadge = (tier: string) => {
    const colors: Record<string, string> = {
      FREE: 'secondary',
      PRO: 'default',
      ENTERPRISE: 'default',
    };
    return <Badge variant={colors[tier] as any}>{tier}</Badge>;
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="secondary">Sin plan</Badge>;
    const colors: Record<string, string> = {
      ACTIVE: 'default',
      PAST_DUE: 'destructive',
      CANCELLED: 'secondary',
    };
    return <Badge variant={colors[status] as any}>{status}</Badge>;
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
          <h1 className="text-3xl font-bold">Empresas</h1>
          <p className="text-muted-foreground">
            Lista de todas las empresas en el sistema
          </p>
        </div>
        <Link href="/admin">
          <Button variant="outline" size="sm">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tenants ({data?.pagination.total || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Usuarios</TableHead>
                <TableHead>Conversaciones</TableHead>
                <TableHead>Agentes</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {tenant.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tenant.slug}
                    </div>
                  </TableCell>
                  <TableCell>{tenant.email || '-'}</TableCell>
                  <TableCell>{getTierBadge(tenant.subscriptionTier)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {tenant.usersCount}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {tenant.conversationsCount}
                    </div>
                  </TableCell>
                  <TableCell>{tenant.agentsCount}</TableCell>
                  <TableCell>{getStatusBadge(tenant.subscriptionStatus)}</TableCell>
                  <TableCell>
                    {new Date(tenant.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Página {data?.pagination.page} de {data?.pagination.pages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data?.pagination.pages || 1, p + 1))}
                disabled={page >= (data?.pagination.pages || 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
