'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import {
  LayoutDashboard,
  Settings,
  BarChart3,
  MessageSquare,
  Users,
  FolderKanban,
  FileText,
  Zap,
  Bot,
  Package,
  Sparkles,
  CheckCircle,
  GraduationCap,
  Target,
  History,
  Download,
  Plus,
  BadgeCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SidebarProps {
  tenant: string;
}

const navigation = [
  { name: 'Dashboard', href: 'dashboard', icon: LayoutDashboard },
  { name: 'Workspace', href: 'workspace', icon: Target },
  { name: 'Agentes', href: 'agents', icon: Bot },
  { name: 'Herramientas', href: 'tools', icon: Zap },
  // { name: 'Plantillas', href: 'templates', icon: Sparkles, badge: 'nuevo' },
  { name: 'Conversaciones', href: 'conversations', icon: MessageSquare },
  { name: 'Aprobaciones', href: 'approvals', icon: CheckCircle, showBadge: true },
  { name: 'Tareas Programadas', href: 'schedules', icon: History },
  { name: 'Logs de Ejecución', href: 'logs', icon: FileText },
  { name: 'Entrenamiento', href: 'training', icon: GraduationCap, children: [
    { name: 'Dashboard', href: 'training', icon: Target },
    { name: 'Simular', href: 'training/simulate', icon: Sparkles },
    { name: 'Historial', href: 'training/sessions', icon: History },
  ]},
  { name: 'Automatizaciones', href: 'automations', icon: Zap },
  { name: 'Analytics', href: 'analytics', icon: BarChart3 },
  { name: 'Marketplace', href: 'marketplace', icon: Package, children: [
    { name: 'Explorar', href: 'marketplace', icon: Package },
    { name: 'Mis Skills', href: 'marketplace/my-skills', icon: Plus },
    { name: 'Instalados', href: 'marketplace/installed', icon: Download, badge: 'updates' },
  ]},
  { name: 'Integraciones', href: 'integrations', icon: Zap },
  { name: 'Configuración', href: 'settings', icon: Settings },
];

export function Sidebar({ tenant }: SidebarProps) {
  const pathname = usePathname();
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [updatesCount, setUpdatesCount] = useState(0);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['marketplace']));

  useEffect(() => {
    // Fetch pending approvals count
    const fetchPendingApprovals = async () => {
      try {
        const token = storage.getItem<string>('token');
        if (!token) return;

        const stats = await api.get<{ stats: { totalPending: number } }>('/ai/approvals/stats', token);
        setPendingApprovals(stats.stats?.totalPending || 0);
      } catch (error) {
        // Silently fail
      }
    };

    // Fetch updates count for marketplace
    const fetchUpdatesCount = async () => {
      try {
        const token = storage.getItem<string>('token');
        if (!token) return;

        const data = await api.get<{ success: boolean; skills: any[] }>(
          '/marketplace/installed',
          token
        );

        if (data?.skills) {
          const count = data.skills.filter((s: any) => s.hasUpdate).length;
          setUpdatesCount(count);
        }
      } catch (error) {
        // Silently fail
      }
    };

    fetchPendingApprovals();
    fetchUpdatesCount();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchPendingApprovals();
      fetchUpdatesCount();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleExpanded = (itemName: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemName)) {
        newSet.delete(itemName);
      } else {
        newSet.add(itemName);
      }
      return newSet;
    });
  };

  return (
    <aside className="w-64 border-r bg-muted/30 min-h-[calc(100vh-4rem)] flex flex-col">
      <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
        {navigation.map((item) => {
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = expandedItems.has(item.name);
          const isActive = hasChildren
            ? item.children?.some((child) => pathname?.includes(child.href))
            : pathname?.includes(item.href) || false;
          const Icon = item.icon;
          const showBadge = item.showBadge && pendingApprovals > 0;

          if (hasChildren) {
            return (
              <div key={item.name}>
                <button
                  onClick={() => toggleExpanded(item.name)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </div>
                  <svg
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isExpanded ? 'rotate-90' : ''
                    )}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="ml-6 mt-1 space-y-1">
                    {item.children!.map((child) => {
                      const ChildIcon = child.icon;
                      const isChildActive = pathname?.includes(child.href) || false;
                      const showChildBadge = child.badge === 'updates' && updatesCount > 0;
                      return (
                        <Link
                          key={child.name}
                          href={`/${tenant}/${child.href}`}
                          className={cn(
                            'flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
                            isChildActive
                              ? 'bg-primary/20 text-primary'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <ChildIcon className="h-3.5 w-3.5" />
                            <span>{child.name}</span>
                          </div>
                          {showChildBadge && (
                            <BadgeCheck className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.name}
              href={`/${tenant}/${item.href}`}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </div>
              {showBadge && (
                <Badge
                  variant={isActive ? 'secondary' : 'destructive'}
                  className="h-5 min-w-[20px] px-1.5 text-xs flex items-center justify-center"
                >
                  {pendingApprovals > 9 ? '9+' : pendingApprovals}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Updates indicator */}
      {updatesCount > 0 && (
        <div className="mx-4 mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <BadgeCheck className="h-4 w-4 text-yellow-600" />
            <span className="font-medium text-yellow-700">
              {updatesCount} actualización{updatesCount !== 1 ? 'es' : ''} disponible{updatesCount !== 1 ? 's' : ''}
            </span>
          </div>
          <Link
            href={`/${tenant}/marketplace/installed`}
            className="text-xs text-yellow-600 hover:underline mt-1 block"
          >
            Ver skills instalados →
          </Link>
        </div>
      )}
    </aside>
  );
}
