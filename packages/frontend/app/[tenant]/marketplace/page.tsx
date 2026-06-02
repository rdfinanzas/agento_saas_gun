'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SkillCard } from '@/components/marketplace/SkillCard';
import {
  Search,
  TrendingUp,
  Star,
  Loader2,
  Package,
  Sparkles,
  Flame,
  Zap,
  Globe,
  Database,
  MessageSquare,
  BarChart3,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  version: string;
  tags: string[];
  downloads: number;
  rating: number;
  ratingsCount: number;
  isVerified: boolean;
  isOfficial: boolean;
  compatibility: string[];
  createdAt: string;
}

interface InstalledSkill {
  id: string;
  marketplaceSkillId: string;
  installedVersion: string;
}

type TabType = 'featured' | 'trending' | 'popular' | 'recent';
type SortOption = 'downloads' | 'rating' | 'recent';

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

// Simple debounce hook implementation
function useDebounceHook<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function MarketplacePage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenant as string;

  const [isLoading, setIsLoading] = useState(true);
  const [skills, setSkills] = useState<MarketplaceSkill[]>([]);
  const [featuredSkills, setFeaturedSkills] = useState<MarketplaceSkill[]>([]);
  const [installedSkills, setInstalledSkills] = useState<InstalledSkill[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<TabType>('featured');
  const [sortBy, setSortBy] = useState<SortOption>('downloads');
  const [installing, setInstalling] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const debouncedSearch = useDebounceHook(searchQuery, 300);

  useEffect(() => {
    loadData(true);
  }, [selectedCategory, sortBy, activeTab]);

  useEffect(() => {
    if (debouncedSearch !== undefined) {
      setPage(1);
      loadData(true);
    }
  }, [debouncedSearch]);

  const loadData = async (reset: boolean = false) => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const currentPage = reset ? 1 : page;

      // Build query params
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }
      if (sortBy) {
        params.append('sortBy', sortBy);
      }
      params.append('page', currentPage.toString());
      params.append('limit', '12');

      const [skillsData, featuredData, installedData] = await Promise.all([
        api.get<{ success: boolean; skills: MarketplaceSkill[]; count: number }>(
          `/opencode/skills-marketplace/skills?${params.toString()}`,
          token
        ),
        api.get<{ success: boolean; skills: MarketplaceSkill[] }>(
          '/opencode/skills-marketplace/skills?sortBy=downloads&limit=6',
          token
        ),
        api.get<InstalledSkill[]>('/opencode/skills-marketplace/installed', token),
      ]);

      if (skillsData?.skills) {
        const newSkills = skillsData.skills;
        if (reset) {
          setSkills(newSkills);
        } else {
          setSkills(prev => [...prev, ...newSkills]);
        }
        setHasMore(newSkills.length === 12);
      }

      if (featuredData?.skills && reset) {
        setFeaturedSkills(featuredData.skills.slice(0, 3));
      }

      if (installedData) {
        setInstalledSkills(installedData);
      }
    } catch (err) {
      console.error('Error loading marketplace:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    setPage(prev => prev + 1);
    loadData(false);
  };

  const isInstalled = useCallback((skillId: string) => {
    return installedSkills.some(s => s.marketplaceSkillId === skillId);
  }, [installedSkills]);

  const installSkill = async (skillId: string) => {
    setInstalling(skillId);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.post(`/opencode/skills-marketplace/skills/${skillId}/install`, {}, token);

      // Refresh installed skills
      const installedData = await api.get<InstalledSkill[]>('/opencode/skills-marketplace/installed', token);
      setInstalledSkills(installedData || []);

      // Reload skills to update download counts
      loadData(true);
    } catch (err: any) {
      console.error('Error installing skill:', err);
      alert('Error al instalar el skill: ' + (err.message || 'Error desconocido'));
    } finally {
      setInstalling(null);
    }
  };

  const uninstallSkill = async (skillId: string) => {
    if (!confirm('¿Estás seguro de desinstalar este skill?')) return;

    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.delete(`/opencode/skills-marketplace/skills/${skillId}/install`, token);

      // Refresh installed skills
      const installedData = await api.get<InstalledSkill[]>('/opencode/skills-marketplace/installed', token);
      setInstalledSkills(installedData || []);
    } catch (err: any) {
      console.error('Error uninstalling skill:', err);
      alert('Error al desinstalar');
    }
  };

  const handleViewDetails = (skill: MarketplaceSkill) => {
    router.push(`/${tenantSlug}/marketplace/${skill.id}`);
  };

  const categories = [
    { value: 'all', label: 'Todas', icon: Package },
    { value: 'integration', label: 'Integraciones', icon: Globe },
    { value: 'automation', label: 'Automatización', icon: Zap },
    { value: 'communication', label: 'Comunicación', icon: MessageSquare },
    { value: 'data', label: 'Datos', icon: Database },
    { value: 'analytics', label: 'Analytics', icon: BarChart3 },
    { value: 'productivity', label: 'Productividad', icon: Package },
  ];

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Marketplace de Skills</h1>
        <p className="text-muted-foreground">
          Explora e instala skills preconstruidos para potenciar tus agentes
        </p>
      </div>

      {/* Featured Section */}
      {activeTab === 'featured' && featuredSkills.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Skills Destacados</h2>
            </div>
            <Button variant="ghost" size="sm">
              Ver todos
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {featuredSkills.map(skill => {
              const Icon = CATEGORY_ICONS[skill.category] || Package;
              return (
                <Card
                  key={skill.id}
                  className="relative overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleViewDetails(skill)}
                >
                  <div className="absolute top-0 right-0 p-3">
                    <Badge variant="default" className="gap-1">
                      <Sparkles className="h-3 w-3" />
                      Destacado
                    </Badge>
                  </div>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{skill.name}</h3>
                        <p className="text-sm text-muted-foreground">Por {skill.author}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {skill.description}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{skill.rating.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Package className="h-4 w-4" />
                        <span>{skill.downloads}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b">
        <Button
          variant={activeTab === 'featured' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('featured')}
          className="rounded-none border-b-2"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Destacados
        </Button>
        <Button
          variant={activeTab === 'trending' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('trending')}
          className="rounded-none border-b-2"
        >
          <Flame className="mr-2 h-4 w-4" />
          Tendencias
        </Button>
        <Button
          variant={activeTab === 'popular' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('popular')}
          className="rounded-none border-b-2"
        >
          <TrendingUp className="mr-2 h-4 w-4" />
          Populares
        </Button>
        <Button
          variant={activeTab === 'recent' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('recent')}
          className="rounded-none border-b-2"
        >
          Recientes
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar skills por nombre, descripción o etiquetas..."
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {categories.map(cat => {
            const Icon = cat.icon;
            return (
              <Button
                key={cat.value}
                variant={selectedCategory === cat.value ? 'default' : 'outline'}
                onClick={() => {
                  setSelectedCategory(cat.value);
                  setPage(1);
                }}
                className="hidden md:flex"
              >
                <Icon className="mr-2 h-4 w-4" />
                {cat.label}
              </Button>
            );
          })}
          <Select value={selectedCategory} onValueChange={(v) => {
            setSelectedCategory(v);
            setPage(1);
          }}>
            <SelectTrigger className="w-[140px] md:hidden">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Select value={sortBy} onValueChange={(v: any) => {
          setSortBy(v);
          setPage(1);
        }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="downloads">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Descargas
              </div>
            </SelectItem>
            <SelectItem value="rating">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Valoración
              </div>
            </SelectItem>
            <SelectItem value="recent">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Recientes
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {skills.length} {skills.length === 1 ? 'skill' : 'skills'} encontrado{skills.length !== 1 ? 's' : ''}
        </p>
        {(selectedCategory !== 'all' || searchQuery) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedCategory('all');
              setSearchQuery('');
              setPage(1);
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Skills Grid */}
      {skills.length === 0 ? (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No hay skills disponibles</h3>
          <p className="mt-2 text-muted-foreground">
            {searchQuery || selectedCategory !== 'all'
              ? 'No se encontraron skills con esos filtros. Prueba con otros criterios.'
              : 'El marketplace está vacío por ahora'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {skills.map(skill => (
              <SkillCard
                key={skill.id}
                skill={skill}
                isInstalled={isInstalled(skill.id)}
                isInstalling={installing === skill.id}
                onInstall={installSkill}
                onUninstall={uninstallSkill}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  <>
                    Cargar más
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
