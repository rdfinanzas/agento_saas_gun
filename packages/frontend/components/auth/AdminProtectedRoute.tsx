'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldAlert } from 'lucide-react';

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Protege rutas que requieren rol de administrador (OWNER o ADMIN)
 * Redirige al dashboard si el usuario no tiene permisos
 */
export function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/admin-login');
      } else if (user && user.role !== 'OWNER' && user.role !== 'ADMIN') {
        // Usuario autenticado pero no es admin - redirigir a su dashboard
        const tenantSlug = 'default'; // O obtener del tenant actual
        router.push(`/${tenantSlug}/dashboard`);
      }
    }
  }, [isAuthenticated, user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Verificar rol de admin
  if (user && user.role !== 'OWNER' && user.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h1>
          <p className="text-gray-600 mb-6">
            No tienes permisos para acceder a esta sección.
            <br />
            Esta área es exclusiva para administradores.
          </p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
