'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2,
  Bot,
  Sparkles,
  Search,
  CheckCircle,
  ShoppingCart,
  Pill,
  Shirt,
  Briefcase,
} from 'lucide-react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

interface Template {
  id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  isOfficial: boolean;
  config: {
    systemPrompt: string;
    tools: string[];
    category?: string;
    tags?: string[];
    welcomeMessage?: string;
    variables?: Array<{
      name: string;
      key: string;
      type: string;
      label: string;
      required: boolean;
      default?: any;
    }>;
  };
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  food: { label: 'Alimentos', icon: ShoppingCart, color: 'text-orange-500' },
  health: { label: 'Salud', icon: Pill, color: 'text-green-500' },
  retail: { label: 'Retail', icon: Shirt, color: 'text-pink-500' },
  services: { label: 'Servicios', icon: Briefcase, color: 'text-blue-500' },
};

function getCategoryConfig(category?: string) {
  if (!category) return { label: 'General', icon: Bot, color: 'text-gray-500' };
  return CATEGORY_CONFIG[category] || { label: category, icon: Bot, color: 'text-gray-500' };
}

interface TemplateQuickCreateProps {
  onSelect: (templateName: string) => void;
}

export function TemplateQuickCreate({ onSelect }: TemplateQuickCreateProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    async function fetchTemplates() {
      setIsLoading(true);
      try {
        const token = storage.getItem<string>('token');
        if (!token) return;
        const response = await api.get<{ success: boolean; data: Template[] }>('/agents/templates', token);
        const list = response.data || response || [];
        setTemplates(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Error fetching templates:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchTemplates();
  }, [isOpen]);

  const filteredTemplates = templates.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.config?.tags || []).some(tag => tag.toLowerCase().includes(q))
    );
  });

  const handleSelect = (template: Template) => {
    onSelect(template.name);
    setIsOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        Crear desde Template
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Crear Agente desde Template
            </DialogTitle>
            <DialogDescription>
              Selecciona un template pre-configurado y el Workspace se encargara de crear el agente
            </DialogDescription>
          </DialogHeader>

          {/* Search */}
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Templates List */}
          <div className="space-y-2 mt-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron templates
              </div>
            ) : (
              filteredTemplates.map((template) => {
                const catConfig = getCategoryConfig(template.config?.category);
                const CategoryIcon = catConfig.icon;
                return (
                  <button
                    key={template.id}
                    onClick={() => handleSelect(template)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 hover:border-primary/50 transition-colors flex items-start gap-3"
                  >
                    <CategoryIcon className={`h-5 w-5 mt-0.5 ${catConfig.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{template.name}</span>
                        {template.isOfficial && (
                          <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0">
                            <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                            Oficial
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {template.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        <span>{template.config?.tools?.length || 0} herramientas</span>
                        {template.config?.category && (
                          <>
                            <span>·</span>
                            <span>{catConfig.label}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
