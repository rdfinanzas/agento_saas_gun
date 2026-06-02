'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Download,
  Star,
  CheckCircle,
  Loader2,
  Package,
  Zap,
  Globe,
  Database,
  MessageSquare,
  BarChart3,
  Settings,
  MoreVertical,
  Heart,
  Share2,
  Flag,
  Clock,
  User,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  category: string;
  author: string;
  authorId: string;
  version: string;
  tags: string[];
  downloads: number;
  rating: number;
  ratingsCount: number;
  isVerified: boolean;
  isOfficial: boolean;
  compatibility: string[];
  createdAt: string;
  updatedAt: string;
  content?: string;
  command?: string;
  documentation?: string;
  configurationSchema?: any;
}

interface SkillReview {
  id: string;
  skillId: string;
  userId: string;
  userName: string;
  rating: number;
  comment?: string;
  createdAt: string;
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

export default function SkillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params?.tenant as string;
  const skillId = params?.skillId as string;

  const [skill, setSkill] = useState<MarketplaceSkill | null>(null);
  const [reviews, setReviews] = useState<SkillReview[]>([]);
  const [relatedSkills, setRelatedSkills] = useState<MarketplaceSkill[]>([]);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [hasReviewed, setHasReviewed] = useState(false);
  const [userReview, setUserReview] = useState<SkillReview | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [skillId]);

  const loadData = async () => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const [skillData, reviewsData, installedData] = await Promise.all([
        api.get<{ success: boolean; skill: MarketplaceSkill }>(`/opencode/skills-marketplace/skills/${skillId}`, token),
        api.get<{ success: boolean; reviews: SkillReview[] }>(`/opencode/skills-marketplace/skills/${skillId}/reviews`, token),
        api.get<any[]>('/opencode/skills-marketplace/installed', token),
      ]);

      if (skillData?.success && skillData.skill) {
        setSkill(skillData.skill);

        // Load related skills by category
        const relatedData = await api.get<{ success: boolean; skills: MarketplaceSkill[] }>(
          `/opencode/skills-marketplace/skills?category=${skillData.skill.category}&limit=4`,
          token
        );
        if (relatedData?.skills) {
          setRelatedSkills(relatedData.skills.filter((s: MarketplaceSkill) => s.id !== skillId).slice(0, 3));
        }

        // Initialize config values from schema
        if (skillData.skill.configurationSchema) {
          const initialValues: Record<string, any> = {};
          Object.keys(skillData.skill.configurationSchema).forEach(key => {
            initialValues[key] = skillData.skill.configurationSchema[key].default || '';
          });
          setConfigValues(initialValues);
        }
      }

      if (reviewsData?.reviews) {
        setReviews(reviewsData.reviews);

        // Check if current user has reviewed
        const currentUser = storage.getItem<any>('user');
        if (currentUser) {
          const myReview = reviewsData.reviews.find(r => r.userId === currentUser.id);
          if (myReview) {
            setHasReviewed(true);
            setUserReview(myReview);
          }
        }
      }

      if (installedData) {
        setIsInstalled(installedData.some((s: any) => s.marketplaceSkillId === skillId));
      }
    } catch (err: any) {
      console.error('Error loading skill:', err);
      setError(err.message || 'Error al cargar el skill');
    } finally {
      setIsLoading(false);
    }
  };

  const installSkill = async () => {
    setIsInstalling(true);
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.post(`/opencode/skills-marketplace/skills/${skillId}/install`, {}, token);
      setIsInstalled(true);

      // Show config dialog if skill has configuration
      if (skill?.configurationSchema && Object.keys(skill.configurationSchema).length > 0) {
        setShowConfigDialog(true);
      }

      loadData();
    } catch (err: any) {
      console.error('Error installing skill:', err);
      alert('Error al instalar el skill: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsInstalling(false);
    }
  };

  const uninstallSkill = async () => {
    if (!confirm('¿Estás seguro de desinstalar este skill?')) return;

    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.delete(`/opencode/skills-marketplace/skills/${skillId}/install`, token);
      setIsInstalled(false);
      loadData();
    } catch (err: any) {
      console.error('Error uninstalling skill:', err);
      alert('Error al desinstalar');
    }
  };

  const submitReview = async () => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.post(
        `/opencode/skills-marketplace/skills/${skillId}/reviews`,
        { rating: reviewRating, comment: reviewComment },
        token
      );

      setShowReviewDialog(false);
      setReviewComment('');
      setReviewRating(5);
      loadData();
    } catch (err: any) {
      console.error('Error submitting review:', err);
      alert('Error al enviar la reseña');
    }
  };

  const saveConfiguration = async () => {
    try {
      const token = storage.getItem<string>('token');
      if (!token) return;

      await api.patch(
        `/opencode/skills-marketplace/installed/${skillId}/config`,
        { config: configValues },
        token
      );

      setShowConfigDialog(false);
      alert('Configuración guardada correctamente');
    } catch (err: any) {
      console.error('Error saving config:', err);
      alert('Error al guardar la configuración');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !skill) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
        <h3 className="mt-4 text-lg font-semibold">Error</h3>
        <p className="mt-2 text-muted-foreground">
          {error || 'Skill no encontrado'}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      </div>
    );
  }

  const Icon = CATEGORY_ICONS[skill.category] || Package;
  const categoryLabel = CATEGORY_LABELS[skill.category] || skill.category;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver al Marketplace
      </Button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-4 bg-primary/10 rounded-xl">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-bold tracking-tight">{skill.name}</h1>
              {skill.isOfficial && (
                <Badge variant="default">Oficial</Badge>
              )}
              {skill.isVerified && (
                <Badge variant="secondary">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Verificado
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Por {skill.author} • v{skill.version} • {categoryLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <Heart className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Share2 className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>
                <Flag className="mr-2 h-4 w-4" />
                Reportar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isInstalled ? (
            <>
              <Button
                variant="outline"
                onClick={() => setShowConfigDialog(true)}
              >
                <Settings className="mr-2 h-4 w-4" />
                Configurar
              </Button>
              <Button
                variant="destructive"
                onClick={uninstallSkill}
              >
                <Download className="mr-2 h-4 w-4 rotate-180" />
                Desinstalar
              </Button>
            </>
          ) : (
            <Button
              onClick={installSkill}
              disabled={isInstalling}
              size="lg"
            >
              {isInstalling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Instalar
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
              <div>
                <p className="text-2xl font-bold">{skill.rating.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">
                  {skill.ratingsCount} reseñas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{skill.downloads}</p>
                <p className="text-xs text-muted-foreground">Instalaciones</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{skill.author}</p>
                <p className="text-xs text-muted-foreground">Autor</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-bold">
                  {new Date(skill.createdAt).toLocaleDateString()}
                </p>
                <p className="text-xs text-muted-foreground">Publicado</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content grid */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Descripción</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                {skill.longDescription || skill.description}
              </p>
            </CardContent>
          </Card>

          {/* Documentation */}
          {skill.documentation && (
            <Card>
              <CardHeader>
                <CardTitle>Documentación</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
                    {skill.documentation}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Compatibility */}
          <Card>
            <CardHeader>
              <CardTitle>Compatibilidad</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {skill.compatibility.map(comp => (
                  <Badge key={comp} variant="outline">{comp}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Reviews */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Reseñas</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReviewDialog(true)}
                  disabled={hasReviewed}
                >
                  {hasReviewed ? 'Ya reseñaste' : 'Escribir reseña'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay reseñas aún. ¡Sé el primero!
                </p>
              ) : (
                <div className="space-y-4">
                  {reviews.map(review => (
                    <div key={review.id} className="border-b pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{review.userName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-muted-foreground'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground">{review.comment}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle>Etiquetas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {skill.tags.map(tag => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Related Skills */}
          {relatedSkills.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Skills Relacionados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {relatedSkills.map(related => {
                    const RelatedIcon = CATEGORY_ICONS[related.category] || Package;
                    return (
                      <div
                        key={related.id}
                        className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => router.push(`/${tenantSlug}/marketplace/${related.id}`)}
                      >
                        <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                          <RelatedIcon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{related.name}</p>
                          <p className="text-xs text-muted-foreground">
                            <Star className="h-3 w-3 inline fill-yellow-400 text-yellow-400" />
                            {' '}{related.rating.toFixed(1)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar {skill.name}</DialogTitle>
            <DialogDescription>
              Configura los parámetros del skill instalado
            </DialogDescription>
          </DialogHeader>
          {skill.configurationSchema && (
            <div className="space-y-4">
              {Object.entries(skill.configurationSchema).map(([key, schema]: [string, any]) => (
                <div key={key}>
                  <label className="text-sm font-medium">{schema.label || key}</label>
                  {schema.type === 'textarea' ? (
                    <Textarea
                      value={configValues[key] || ''}
                      onChange={e => setConfigValues({ ...configValues, [key]: e.target.value })}
                      placeholder={schema.placeholder}
                      className="mt-1"
                    />
                  ) : (
                    <Input
                      type={schema.type || 'text'}
                      value={configValues[key] || ''}
                      onChange={e => setConfigValues({ ...configValues, [key]: e.target.value })}
                      placeholder={schema.placeholder}
                      className="mt-1"
                    />
                  )}
                  {schema.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {schema.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={saveConfiguration}>
              Guardar configuración
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Escribir una reseña</DialogTitle>
            <DialogDescription>
              Comparte tu experiencia con {skill.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Puntuación</label>
              <div className="flex gap-2 mt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setReviewRating(i + 1)}
                  >
                    <Star
                      className={`h-6 w-6 ${
                        i < reviewRating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Comentario</label>
              <Textarea
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                placeholder="Cuéntanos tu experiencia..."
                className="mt-1"
                rows={4}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={submitReview}>
              Enviar reseña
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
