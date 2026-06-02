'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';

export interface MarketplaceSkill {
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

interface SkillCardProps {
  skill: MarketplaceSkill;
  isInstalled: boolean;
  isInstalling?: boolean;
  onInstall: (skillId: string) => void;
  onUninstall: (skillId: string) => void;
  onViewDetails: (skill: MarketplaceSkill) => void;
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

export function SkillCard({
  skill,
  isInstalled,
  isInstalling = false,
  onInstall,
  onUninstall,
  onViewDetails,
}: SkillCardProps) {
  const Icon = CATEGORY_ICONS[skill.category] || Package;
  const categoryLabel = CATEGORY_LABELS[skill.category] || skill.category;

  return (
    <Card className="flex flex-col hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg line-clamp-1">{skill.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {categoryLabel}
                </Badge>
                {skill.isOfficial && (
                  <Badge variant="default" className="text-xs">Oficial</Badge>
                )}
                {skill.isVerified && (
                  <Badge variant="secondary" className="text-xs">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Verificado
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <CardDescription className="line-clamp-2 mb-4 flex-1">
          {skill.description}
        </CardDescription>

        <div className="flex flex-wrap gap-1 mb-4">
          {skill.tags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {skill.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{skill.tags.length - 3}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
          <span className="truncate">Por {skill.author}</span>
          <span className="shrink-0">v{skill.version}</span>
        </div>

        <div className="flex items-center justify-between text-sm mb-4">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="font-medium">{skill.rating.toFixed(1)}</span>
            <span className="text-muted-foreground">({skill.ratingsCount})</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Download className="h-4 w-4" />
            <span>{skill.downloads}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-auto">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onViewDetails(skill)}
          >
            Ver detalles
          </Button>
          {isInstalled ? (
            <Button
              variant="destructive"
              onClick={() => onUninstall(skill.id)}
            >
              <Download className="mr-2 h-4 w-4 rotate-180" />
              Desinstalar
            </Button>
          ) : (
            <Button
              onClick={() => onInstall(skill.id)}
              disabled={isInstalling}
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
      </CardContent>
    </Card>
  );
}
