// Ejemplos de uso del sistema de autenticación

import { useAuth } from '@/hooks/useAuth';
import { useApi } from '@/hooks/useApi';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// ============================================
// EJEMPLO 1: Login básico
// ============================================

function LoginExample() {
  const { login } = useAuth();

  const handleLogin = async () => {
    try {
      await login('user@example.com', 'password123', 'tenant-slug');
      // Redirección automática al dashboard
    } catch (error: any) {
      console.error('Error de login:', error.message);
    }
  };

  return <button onClick={handleLogin}>Login</button>;
}

// ============================================
// EJEMPLO 2: Registro de nuevo usuario
// ============================================

function RegisterExample() {
  const { register } = useAuth();

  const handleRegister = async () => {
    try {
      await register(
        'newuser@example.com',
        'password123',
        'John Doe',
        'new-tenant'
      );
      // Redirección automática al dashboard
    } catch (error: any) {
      console.error('Error de registro:', error.message);
    }
  };

  return <button onClick={handleRegister}>Registrarse</button>;
}

// ============================================
// EJEMPLO 3: Protección de rutas
// ============================================

function ProtectedPage() {
  return (
    <ProtectedRoute requireAuth={true}>
      <div>
        <h1>Solo usuarios autenticados pueden ver esto</h1>
        <YourPrivateContent />
      </div>
    </ProtectedRoute>
  );
}

// ============================================
// EJEMPLO 4: Mostrar información del usuario
// ============================================

function UserProfile() {
  const { user, tenant, logout } = useAuth();

  if (!user) {
    return <div>No hay usuario autenticado</div>;
  }

  return (
    <div>
      <h1>Perfil de Usuario</h1>
      <p>Nombre: {user.name}</p>
      <p>Email: {user.email}</p>
      {tenant && (
        <p>Tenant: {tenant.name} ({tenant.slug})</p>
      )}
      <button onClick={logout}>Cerrar Sesión</button>
    </div>
  );
}

// ============================================
// EJEMPLO 5: Llamadas a la API autenticadas
// ============================================

function DashboardData() {
  const { get, isLoading, error } = useApi();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const result = await get('/dashboard/stats');
      if (result) {
        setData(result);
      }
    };

    fetchData();
  }, [get]);

  if (isLoading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!data) return <div>Sin datos</div>;

  return (
    <div>
      <h1>Estadísticas</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

// ============================================
// EJEMPLO 6: Crear recursos con POST
// ============================================

function CreateAgentForm() {
  const { post, isLoading } = useApi();

  const handleSubmit = async (formData: any) => {
    const result = await post('/agents', formData);
    if (result) {
      console.log('Agente creado:', result);
      // Manejar éxito
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      // Obtener datos del form y llamar a handleSubmit
    }}>
      <button disabled={isLoading}>
        {isLoading ? 'Creando...' : 'Crear Agente'}
      </button>
    </form>
  );
}

// ============================================
// EJEMPLO 7: Verificar estado de autenticación
// ============================================

function AuthStatus() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <div>Verificando autenticación...</div>;
  }

  return (
    <div>
      {isAuthenticated ? (
        <p>Bienvenido, {user?.name}</p>
      ) : (
        <p>No estás autenticado</p>
      )}
    </div>
  );
}

// ============================================
// EJEMPLO 8: Logout con confirmación
// ============================================

function LogoutButton() {
  const { logout } = useAuth();

  const handleLogout = () => {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
      logout();
      // Redirección automática a /login
    }
  };

  return <button onClick={handleLogout}>Cerrar Sesión</button>;
}

// ============================================
// EJEMPLO 9: Actualizar recursos con PUT
// ============================================

function UpdateAgentForm({ agentId }: { agentId: string }) {
  const { put, isLoading } = useApi();

  const handleUpdate = async (formData: any) => {
    const result = await put(`/agents/${agentId}`, formData);
    if (result) {
      console.log('Agente actualizado:', result);
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      // Obtener datos del form y llamar a handleUpdate
    }}>
      <button disabled={isLoading}>
        {isLoading ? 'Actualizando...' : 'Actualizar'}
      </button>
    </form>
  );
}

// ============================================
// EJEMPLO 10: Eliminar recursos con DELETE
// ============================================

function DeleteAgentButton({ agentId }: { agentId: string }) {
  const { delete: deleteFn } = useApi();

  const handleDelete = async () => {
    if (confirm('¿Estás seguro de eliminar este agente?')) {
      const result = await deleteFn(`/agents/${agentId}`);
      if (result) {
        console.log('Agente eliminado');
        // Manejar éxito (ej: redirigir o actualizar lista)
      }
    }
  };

  return (
    <button onClick={handleDelete} className="text-red-600">
      Eliminar
    </button>
  );
}
