'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Play,
  ShoppingBag,
  HeadphonesIcon,
  AlertTriangle,
  MessageSquare,
  Clock,
  Target,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScenarioObjective {
  text: string;
  achieved?: boolean;
}

export interface TrainingScenario {
  id: string;
  title: string;
  description: string;
  category: 'sales' | 'support' | 'complaints' | 'general';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number;
  objectives: string[];
  customerPersona: {
    name: string;
    tone: 'friendly' | 'formal' | 'casual' | 'angry';
    language?: string;
    interests?: string[];
  };
}

interface ScenarioSelectorProps {
  scenarios: TrainingScenario[];
  onSelectScenario: (scenario: TrainingScenario) => void;
  selectedScenario?: TrainingScenario;
  isLoading?: boolean;
}

export function ScenarioSelector({
  scenarios,
  onSelectScenario,
  selectedScenario,
  isLoading,
}: ScenarioSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [previewScenario, setPreviewScenario] = useState<TrainingScenario | null>(null);

  const categories = [
    { value: 'all', label: 'Todos', icon: MessageSquare },
    { value: 'sales', label: 'Ventas', icon: ShoppingBag },
    { value: 'support', label: 'Soporte', icon: HeadphonesIcon },
    { value: 'complaints', label: 'Quejas', icon: AlertTriangle },
    { value: 'general', label: 'General', icon: MessageSquare },
  ];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'advanced':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'Principiante';
      case 'intermediate':
        return 'Intermedio';
      case 'advanced':
        return 'Avanzado';
      default:
        return difficulty;
    }
  };

  const getToneColor = (tone: string) => {
    switch (tone) {
      case 'friendly':
        return 'bg-blue-100 text-blue-700';
      case 'formal':
        return 'bg-purple-100 text-purple-700';
      case 'casual':
        return 'bg-green-100 text-green-700';
      case 'angry':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getToneLabel = (tone: string) => {
    switch (tone) {
      case 'friendly':
        return 'Amigable';
      case 'formal':
        return 'Formal';
      case 'casual':
        return 'Casual';
      case 'angry':
        return 'Enojado';
      default:
        return tone;
    }
  };

  const filteredScenarios =
    selectedCategory === 'all'
      ? scenarios
      : scenarios.filter((s) => s.category === selectedCategory);

  const CategoryIcon = categories.find((c) => c.value === selectedCategory)?.icon || MessageSquare;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={selectedScenario ? 'default' : 'outline'} className="w-full justify-start">
          {selectedScenario ? (
            <>
              <Play className="mr-2 h-4 w-4" />
              <div className="flex-1 text-left truncate">
                {selectedScenario.title}
                <span className="text-xs text-muted-foreground ml-2">
                  ({getDifficultyLabel(selectedScenario.difficulty)})
                </span>
              </div>
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Seleccionar Escenario
            </>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Seleccionar Escenario de Entrenamiento</DialogTitle>
          <DialogDescription>
            Elige un escenario para practicar con tu agente. Cada escenario simula una situación real con diferentes
            tipos de clientes.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-5 w-full">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <TabsTrigger key={category.value} value={category.value} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{category.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            {filteredScenarios.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay escenarios en esta categoría</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredScenarios.map((scenario) => (
                  <Card
                    key={scenario.id}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md',
                      previewScenario?.id === scenario.id && 'ring-2 ring-primary'
                    )}
                    onClick={() => setPreviewScenario(scenario)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{scenario.title}</CardTitle>
                          <CardDescription className="mt-1">{scenario.description}</CardDescription>
                        </div>
                        <Badge className={getDifficultyColor(scenario.difficulty)} variant="outline">
                          {getDifficultyLabel(scenario.difficulty)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{scenario.estimatedDuration} min</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          <span>{scenario.objectives.length} objetivos</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Cliente Simulado:</p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{scenario.customerPersona.name}</span>
                          <Badge className={getToneColor(scenario.customerPersona.tone)} variant="outline">
                            {getToneLabel(scenario.customerPersona.tone)}
                          </Badge>
                        </div>
                      </div>

                      {previewScenario?.id === scenario.id && (
                        <div className="pt-2 border-t space-y-2">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Objetivos:</p>
                            <ul className="text-sm space-y-1">
                              {scenario.objectives.map((objective, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <Sparkles className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                                  <span>{objective}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {scenario.customerPersona.interests && scenario.customerPersona.interests.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Intereses:</p>
                              <div className="flex flex-wrap gap-1">
                                {scenario.customerPersona.interests.map((interest, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {interest}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          <Button
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectScenario(scenario);
                              setIsOpen(false);
                            }}
                            disabled={isLoading}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            Iniciar Este Escenario
                            <ChevronRight className="ml-auto h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Tabs>

        {previewScenario && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{previewScenario.title}</p>
                <p className="text-sm text-muted-foreground">
                  {previewScenario.category} • {getDifficultyLabel(previewScenario.difficulty)}
                </p>
              </div>
              <Button
                onClick={() => {
                  onSelectScenario(previewScenario);
                  setIsOpen(false);
                }}
                disabled={isLoading}
              >
                <Play className="mr-2 h-4 w-4" />
                Iniciar Escenario
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
