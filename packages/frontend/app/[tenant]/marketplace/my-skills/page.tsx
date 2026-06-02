'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2,
  Plus,
  MoreVertical,
  Star,
  Download,
  Eye,
  Edit,
  Trash2,
  FileText,
  Package,
  Zap,
  Globe,
  Database,
  MessageSquare,
  BarChart3,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

interface PublishedSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  tags: string[];
  downloads: number;
  rating: number;
  ratingsCount: number;
  isVerified: boolean;
  isOfficial: boolean;
  status: 'DRAFT' | 'PUBLISHED' | 'REMOVED' | 'UNPUBLISHED';
  createdAt: string;
  updatedAt: string;
  activeInstalls?: number;
}

interface SkillStats {
  totalDownloads: number;
  activeInstalls: number;
  averageRating: number;
  totalReviews: number;
}

const CATEGORY_ICONS: Record<string, any> = {
  integration: Globe,
  automation: Zap,
  communication: MessageSquare,
  data: Database,
  analytics: BarChart3,
  productivity: Package,
};

const CATEGORY_LABELS: Record<string, string> = {
  integration: 'Integraciones',
  automation: 'Automatización',
  communication: 'Comunicación',
  data: 'Datos',
  analytics: 'Análisis',
  productivity: 'Productividad',
  custom: 'Personalizado',
};

const STATUS_LABELS: Record<string, { label: string; variant: any; icon: any }> = {
  DRAFT: { label: 'Borrador', variant: 'secondary', icon: FileText },
  PUBLISHED: { label: 'Publicado', variant: 'default', icon: CheckCircle },
  UNPUBLISHED: { label: 'No publicado', variant: 'outline', icon: AlertCircle },
  REMOVED: { label: 'Eliminado', variant: 'destructive', icon: Trash2 },
};

export default function MySkillsPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenant as string;

  const [skills, setSkills] = useState<PublishedSkill[]>([]);
  const [stats, setStats] = useState<SkillStats>({
    totalDownloads: 0,
    activeInstalls: 0,
    averageRating: 0,
    totalReviews: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<PublishedSkill | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const data = await api.get<{ success: boolean; skills: PublishedSkill[] }>(
        '/marketplace/my-skills',
        token
      );

      if (data?.skills) {
        setSkills(data.skills);

        // Calculate stats
        const publishedSkills = data.skills.filter(s => s.status === 'PUBLISHED');
        setStats({
          totalDownloads: publishedSkills.reduce((sum, s) => sum + s.downloads, 0),
          activeInstalls: publishedSkills.reduce((sum, s) => sum + (s.activeInstalls || 0), 0),
          averageRating: publishedSkills.length > 0
            ? publishedSkills.reduce((sum, s) => sum + s.rating, 0) / publishedSkills.length
            : 0,
          totalReviews: publishedSkills.reduce((sum, s) => sum + s.ratingsCount, 0),
        });
      }
    } catch (err: any) {
      console.error('Error loading my skills:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async (skillId: string) => {
    router.push(`/${tenantSlug}/marketplace/publish/${skillId}`);
  };

  const handleEdit = async (skillId: string) => {
    router.push(`/${tenantSlug}/marketplace/edit/${skillId}`);
  };

  const handleDelete = async () => {
    if (!selectedSkill) return;

    setIsDeleting(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.delete(`/opencode/skills-marketplace/skills/${selectedSkill.id}`, token);

      setDeleteDialogOpen(false);
      setSelectedSkill(null);
      loadData();
    } catch (err: any) {
      console.error('Error deleting skill:', err);
      alert('Error al eliminar el skill');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUnpublish = async (skillId: string) => {
    if (!confirm('¿Estás seguro de despublicar este skill? Ya no estará visible en el marketplace.')) return;

    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.patch(`/opencode/skills-marketplace/skills/${skillId}`, { status: 'UNPUBLISHED' }, token);
      loadData();
    } catch (err: any) {
      console.error('Error unpublishing skill:', err);
      alert('Error al despublicar el skill');
    }
  };

  const handleRepublish = async (skillId: string) => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.patch(`/opencode/skills-marketplace/skills/${skillId}`, { status: 'PUBLISHED' }, token);
      loadData();
    } catch (err: any) {
      console.error('Error republishing skill:', err);
      alert('Error al republicar el skill');
    }
  };

  const getSkillActions = (skill: PublishedSkill) => {
    const actions = [];

    if (skill.status === 'DRAFT' || skill.status === 'UNPUBLISHED') {
      actions.push({
        icon: <CheckCircle className="h-4 w-4" />,
        label: 'Publicar',
        onClick: () => handlePublish(skill.id),
      });
    }

    if (skill.status === 'PUBLISHED') {
      actions.push({
        icon: <Eye className="h-4 w-4" />,
        label: 'Ver en marketplace',
        onClick: () => router.push(`/${tenantSlug}/marketplace/${skill.id}`),
      });
      actions.push({
        icon: <AlertCircle className="h-4 w-4" />,
        label: 'Despublicar',
        onClick: () => handleUnpublish(skill.id),
      });
    }

    actions.push({
      icon: <Edit className="h-4 w-4" />,
      label: 'Editar',
      onClick: () => handleEdit(skill.id),
    });

    actions.push({
      icon: <Trash2 className="h-4 w-4" />,
      label: 'Eliminar',
      onClick: () => {
        setSelectedSkill(skill);
        setDeleteDialogOpen(true);
      },
      variant: 'destructive' as const,
    });

    return actions;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mis Skills</h1>
          <p className="text-muted-foreground">
            Gestiona los skills que has publicado en el marketplace
          </p>
        </div>
        <Button onClick={() => router.push(`/${tenantSlug}/marketplace/create`)}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Skill
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Publicados</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {skills.filter(s => s.status === 'PUBLISHED').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Skills activos en marketplace
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Descargas Totales</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDownloads}</div>
            <p className="text-xs text-muted-foreground">
              Acumulado de todos tus skills
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Instalaciones Activas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeInstalls}</div>
            <p className="text-xs text-muted-foreground">
              Usuarios con tus skills instalados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Valoración Media</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalReviews} reseñas recibidas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Skills Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tus Skills</CardTitle>
          <CardDescription>
            {skills.length} {skills.length === 1 ? 'skill' : 'skills'} en total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {skills.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No tienes skills publicados</h3>
              <p className="mt-2 text-muted-foreground">
                Comienza creando tu primer skill para compartir con la comunidad
              </p>
              <Button
                className="mt-4"
                onClick={() => router.push(`/${tenantSlug}/marketplace/create`)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Crear mi primer Skill
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Skill</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead className="text-right">Descargas</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skills.map(skill => {
                  const Icon = CATEGORY_ICONS[skill.category] || Package;
                  const statusInfo = STATUS_LABELS[skill.status] || STATUS_LABELS.DRAFT;
                  const StatusIcon = statusInfo.icon;

                  return (
                    <TableRow key={skill.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{skill.name}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {skill.description}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {CATEGORY_LABELS[skill.category] || skill.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">v{skill.version}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Download className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{skill.downloads}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{skill.rating.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">
                            ({skill.ratingsCount})
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {getSkillActions(skill).map((action, i) => (
                              <DropdownMenuItem
                                key={i}
                                onClick={action.onClick}
                                className={action.variant === 'destructive' ? 'text-destructive' : ''}
                              >
                                {action.icon}
                                <span className="ml-2">{action.label}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Skill</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar &quot;{selectedSkill?.name}&quot;? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setSelectedSkill(null);
              }}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
