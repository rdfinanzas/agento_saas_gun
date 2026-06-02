/**
 * PlusMenu - Menú de acciones adicionales
 *
 * Dropdown para skills instalados, connectors y settings
 */

'use client';

import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Code,
  Database,
  Sparkles,
  Settings,
  FileCode,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PlusMenuProps {
  onSkillsClick?: () => void;
  onConnectorsClick?: () => void;
  onSettingsClick?: () => void;
  disabled?: boolean;
  skillsCount?: number;
}

interface InstalledSkill {
  id: string;
  name: string;
  category: string;
  description?: string;
}

interface Connector {
  id: string;
  name: string;
  type: 'api' | 'database' | 'other';
  status: 'active' | 'inactive';
}

export function PlusMenu({
  onSkillsClick,
  onConnectorsClick,
  onSettingsClick,
  disabled = false,
  skillsCount = 0,
}: PlusMenuProps) {
  // Mock data - en producción esto vendría de una API
  const [skills] = useState<InstalledSkill[]>([
    { id: '1', name: 'Salesforce CRM', category: 'integration', description: 'Conector para Salesforce' },
    { id: '2', name: 'Excel Analyzer', category: 'productivity', description: 'Analiza archivos Excel' },
    { id: '3', name: 'Email Sender', category: 'automation', description: 'Envía emails automáticos' },
  ]);

  const [connectors] = useState<Connector[]>([
    { id: '1', name: 'PostgreSQL DB', type: 'database', status: 'active' },
    { id: '2', name: 'Stripe API', type: 'api', status: 'active' },
  ]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-9 px-2"
        >
          <Plus className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Agregar</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* Skills Section */}
        <div className="px-2 py-1.5">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Skills</p>
          <DropdownMenuItem onClick={onSkillsClick} className="cursor-pointer">
            <Sparkles className="h-4 w-4 mr-2" />
            <span className="flex-1">Marketplace</span>
            <ChevronRight className="h-4 w-4" />
          </DropdownMenuItem>

          {skills.slice(0, 3).map((skill) => (
            <DropdownMenuItem key={skill.id} className="cursor-pointer">
              <Code className="h-4 w-4 mr-2" />
              <div className="flex-1">
                <div className="text-sm font-medium">{skill.name}</div>
                <div className="text-xs text-muted-foreground truncate">{skill.description}</div>
              </div>
            </DropdownMenuItem>
          ))}

          {skillsCount > 0 && (
            <DropdownMenuItem onClick={onSkillsClick} className="cursor-pointer">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{skillsCount}</Badge>
                <span>Mis Skills</span>
              </div>
            </DropdownMenuItem>
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Connectors Section */}
        <div className="px-2 py-1.5">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Conectores</p>

          {connectors.map((connector) => (
            <DropdownMenuItem key={connector.id} className="cursor-pointer">
              {connector.type === 'database' ? (
                <Database className="h-4 w-4 mr-2" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              <div className="flex-1">
                <div className="text-sm font-medium flex items-center gap-2">
                  {connector.name}
                  {connector.status === 'active' && (
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{connector.type}</div>
              </div>
            </DropdownMenuItem>
          ))}

          <DropdownMenuItem onClick={onConnectorsClick} className="cursor-pointer">
            <FileCode className="h-4 w-4 mr-2" />
            <span className="flex-1">Gestionar Conectores</span>
            <ChevronRight className="h-4 w-4" />
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator />

        {/* Settings */}
        <DropdownMenuItem onClick={onSettingsClick} className="cursor-pointer">
          <Settings className="h-4 w-4 mr-2" />
          <span>Configuración</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface SkillActionMenuProps {
  skill: InstalledSkill;
  onConfigure?: () => void;
  onDisable?: () => void;
  onRemove?: () => void;
}

export function SkillActionMenu({ skill, onConfigure, onDisable, onRemove }: SkillActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Más opciones</span>
          <span className="text-xs">•••</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onConfigure}>
          <FileCode className="h-4 w-4 mr-2" />
          Configurar
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onDisable}>
          Deshabilitar
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onRemove} className="text-destructive">
          Eliminar Skill
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
