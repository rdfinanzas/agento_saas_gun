'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Search,
  MoreVertical,
  Settings,
  Trash2,
  Power,
  PowerOff,
  Download,
  AlertCircle,
  Package,
  Zap,
  Globe,
  Database,
  MessageSquare,
  BarChart3,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

interface InstalledSkill {
  id: string;
  marketplaceSkillId: string;
  localSkillId: string;
  installedVersion: string;
  installedAt: string;
  isEnabled: boolean;
  hasUpdate: boolean;
  latestVersion?: string;
  skill: {
    name: string;
    description: string;
    category: string;
    author: string;
    version: string;
    tags: string[];
  };
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

type SortOption = 'name' | 'category' | 'installed' | 'status';
type FilterCategory = string | 'all';
type FilterStatus = 'all' | 'enabled' | 'disabled';

export default function InstalledSkillsPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenant as string;

  const [skills, setSkills] = useState<InstalledSkill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedSkill, setSelectedSkill] = useState<InstalledSkill | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showUninstallDialog, setShowUninstallDialog] = useState(false);
  const [isToggling, setIsToggling] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [configValues, setConfigValues] = useState<Record<string, any>>({});

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

      const data = await api.get<{ success: boolean; skills: InstalledSkill[] }>(
        '/marketplace/installed',
        token
      );

      if (data?.skills) {
        setSkills(data.skills.map(s => ({
          ...s,
          isEnabled: s.isEnabled !== undefined ? s.isEnabled : true,
          hasUpdate: s.installedVersion !== s.skill.version,
          latestVersion: s.skill.version,
        })));
      }
    } catch (err: any) {
      console.error('Error loading installed skills:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSkill = async (skillId: string, currentStatus: boolean) => {
    setIsToggling(skillId);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.patch(
        `/opencode/skills-marketplace/installed/${skillId}/toggle`,
        { enabled: !currentStatus },
        token
      );

      setSkills(skills.map(s =>
        s.id === skillId ? { ...s, isEnabled: !currentStatus } : s
      ));
    } catch (err: any) {
      console.error('Error toggling skill:', err);
      alert('Error al cambiar el estado del skill');
    } finally {
      setIsToggling(null);
    }
  };

  const updateSkill = async (skill: InstalledSkill) => {
    setIsUpdating(skill.id);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.post(
        `/opencode/skills-marketplace/skills/${skill.marketplaceSkillId}/update`,
        {},
        token
      );

      loadData();
    } catch (err: any) {
      console.error('Error updating skill:', err);
      alert('Error al actualizar el skill');
    } finally {
      setIsUpdating(null);
    }
  };

  const openConfig = async (skill: InstalledSkill) => {
    setSelectedSkill(skill);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      const configData = await api.get<{ success: boolean; config: Record<string, any> }>(
        `/opencode/skills-marketplace/installed/${skill.id}/config`,
        token
      );

      if (configData?.config) {
        setConfigValues(configData.config);
      }

      setShowConfigDialog(true);
    } catch (err: any) {
      console.error('Error loading config:', err);
      setConfigValues({});
      setShowConfigDialog(true);
    }
  };

  const saveConfiguration = async () => {
    if (!selectedSkill) return;

    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.patch(
        `/opencode/skills-marketplace/installed/${selectedSkill.id}/config`,
        { config: configValues },
        token
      );

      setShowConfigDialog(false);
      setSelectedSkill(null);
      alert('Configuración guardada correctamente');
    } catch (err: any) {
      console.error('Error saving config:', err);
      alert('Error al guardar la configuración');
    }
  };

  const confirmUninstall = (skill: InstalledSkill) => {
    setSelectedSkill(skill);
    setShowUninstallDialog(true);
  };

  const uninstallSkill = async () => {
    if (!selectedSkill) return;

    setIsUninstalling(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.delete(
        `/opencode/skills-marketplace/skills/${selectedSkill.marketplaceSkillId}/install`,
        token
      );

      setShowUninstallDialog(false);
      setSelectedSkill(null);
      loadData();
    } catch (err: any) {
      console.error('Error uninstalling skill:', err);
      alert('Error al desinstalar el skill');
    } finally {
      setIsUninstalling(false);
    }
  };

  const filteredAndSortedSkills = skills
    .filter(skill => {
      const matchesSearch = skill.skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.skill.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = filterCategory === 'all' || skill.skill.category === filterCategory;
      const matchesStatus = filterStatus === 'all' ||
        (filterStatus === 'enabled' && skill.isEnabled) ||
        (filterStatus === 'disabled' && !skill.isEnabled);

      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.skill.name.localeCompare(b.skill.name);
        case 'category':
          return a.skill.category.localeCompare(b.skill.category);
        case 'installed':
          return new Date(b.installedAt).getTime() - new Date(a.installedAt).getTime();
        case 'status':
          return Number(b.isEnabled) - Number(a.isEnabled);
        default:
          return 0;
      }
    });

  const categories = [...new Set(skills.map(s => s.skill.category))];
  const updateCount = skills.filter(s => s.hasUpdate).length;

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
          <h1 className="text-3xl font-bold tracking-tight">Skills Instalados</h1>
          <p className="text-muted-foreground">
            Gestiona los skills que tienes instalados en tu workspace
          </p>
        </div>
        {updateCount > 0 && (
          <Button onClick={() => {
            skills.filter(s => s.hasUpdate).forEach(s => updateSkill(s));
          }}>
            <Download className="mr-2 h-4 w-4" />
            Actualizar todos ({updateCount})
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Instalados</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{skills.length}</div>
            <p className="text-xs text-muted-foreground">
              Skills en tu workspace
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Activos</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {skills.filter(s => s.isEnabled).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Skills habilitados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Actualizaciones</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{updateCount}</div>
            <p className="text-xs text-muted-foreground">
              Actualizaciones disponibles
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar skills instalados..."
            className="pl-10"
          />
        </div>
        <Select value={filterCategory} onValueChange={(v: any) => setFilterCategory(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_LABELS[cat] || cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="enabled">Habilitados</SelectItem>
            <SelectItem value="disabled">Deshabilitados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Nombre</SelectItem>
            <SelectItem value="category">Categoría</SelectItem>
            <SelectItem value="installed">Fecha de instalación</SelectItem>
            <SelectItem value="status">Estado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Skills Table */}
      <Card>
        <CardHeader>
          <CardTitle>Skills Instalados</CardTitle>
          <CardDescription>
            {filteredAndSortedSkills.length} de {skills.length} skills
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredAndSortedSkills.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No hay skills instalados</h3>
              <p className="mt-2 text-muted-foreground">
                {skills.length === 0
                  ? 'Visita el marketplace para instalar tus primeros skills'
                  : 'No hay skills que coincidan con los filtros'}
              </p>
              {skills.length === 0 && (
                <Button
                  className="mt-4"
                  onClick={() => router.push(`/${tenantSlug}/marketplace`)}
                >
                  Ir al Marketplace
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Skill</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Versión</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Instalado</TableHead>
                  <TableHead></TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedSkills.map(skill => {
                  const Icon = CATEGORY_ICONS[skill.skill.category] || Package;

                  return (
                    <TableRow key={skill.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{skill.skill.name}</p>
                              {skill.hasUpdate && (
                                <Badge variant="secondary" className="text-xs">
                                  <Download className="mr-1 h-3 w-3" />
                                  Actualización
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {skill.skill.description}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {CATEGORY_LABELS[skill.skill.category] || skill.skill.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">v{skill.installedVersion}</span>
                          {skill.hasUpdate && (
                            <span className="text-xs text-muted-foreground">
                              → v{skill.latestVersion}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={skill.isEnabled}
                            onCheckedChange={() => toggleSkill(skill.id, skill.isEnabled)}
                            disabled={isToggling === skill.id}
                          />
                          {skill.isEnabled ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <PowerOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(skill.installedAt).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          Por {skill.skill.author}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {skill.hasUpdate && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateSkill(skill)}
                              disabled={isUpdating === skill.id}
                            >
                              {isUpdating === skill.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Download className="mr-1 h-3 w-3" />
                                  Actualizar
                                </>
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openConfig(skill)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openConfig(skill)}>
                                <Settings className="h-4 w-4 mr-2" />
                                Configurar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => router.push(`/${tenantSlug}/marketplace/${skill.marketplaceSkillId}`)}
                              >
                                <Package className="h-4 w-4 mr-2" />
                                Ver detalles
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => confirmUninstall(skill)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Desinstalar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar {selectedSkill?.skill.name}</DialogTitle>
            <DialogDescription>
              Ajusta los parámetros de configuración del skill
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Estado del skill</label>
              <div className="flex items-center gap-2 mt-2">
                <Switch
                  checked={selectedSkill?.isEnabled || false}
                  onCheckedChange={(checked) => {
                    if (selectedSkill) {
                      setSelectedSkill({ ...selectedSkill, isEnabled: checked });
                    }
                  }}
                />
                <span className="text-sm">
                  {selectedSkill?.isEnabled ? 'Habilitado' : 'Deshabilitado'}
                </span>
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Configuración adicional del skill. Esta sección se expande dinámicamente
                según las opciones de configuración del skill.
              </p>
              {selectedSkill && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium">ID del skill</label>
                    <Input
                      value={selectedSkill.localSkillId}
                      disabled
                      className="mt-1 bg-muted"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={saveConfiguration}>
              Guardar cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Uninstall Confirmation Dialog */}
      <Dialog open={showUninstallDialog} onOpenChange={setShowUninstallDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desinstalar Skill</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas desinstalar &quot;{selectedSkill?.skill.name}&quot;?
              Esta acción eliminará el skill de tu workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowUninstallDialog(false);
                setSelectedSkill(null);
              }}
              disabled={isUninstalling}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={uninstallSkill}
              disabled={isUninstalling}
            >
              {isUninstalling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Desinstalando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Desinstalar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
