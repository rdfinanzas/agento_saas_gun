# Frontend Authentication Implementation

## Overview

Esta implementación proporciona autenticación completa para el frontend de Agento SaaS, incluyendo:

- Cliente API con manejo de errores
- Contexto de autenticación con persistencia en localStorage
- Login/Register page conectados al backend
- Protección de rutas
- Header con información de usuario y logout

## Archivos Creados

### Core
- `lib/api.ts` - Cliente HTTP con manejo de tokens y errores
- `contexts/AuthContext.tsx` - Contexto de React para gestión de autenticación
- `hooks/useAuth.ts` - Hook personalizado para acceder al contexto
- `hooks/useApi.ts` - Hook para llamadas a la API con manejo de errores

### Componentes
- `components/auth/ProtectedRoute.tsx` - Componente para proteger rutas

### Actualizaciones
- `app/layout.tsx` - Agregado AuthProvider
- `app/login/page.tsx` - Conectado al backend
- `app/[tenant]/layout.tsx` - Protegido con Auth
- `components/layout/header.tsx` - Agregada info de usuario y logout

### Configuración
- `.env.local` - Variables de entorno
- `types/auth.ts` - Tipos TypeScript

## Uso

### Login

```tsx
import { useAuth } from '@/hooks/useAuth';

function LoginPage() {
  const { login } = useAuth();

  const handleLogin = async () => {
    try {
      await login(email, password, tenantSlug);
      // Redirección automática al dashboard
    } catch (error) {
      // Manejar error
    }
  };
}
```

### Registro

```tsx
import { useAuth } from '@/hooks/useAuth';

function RegisterPage() {
  const { register } = useAuth();

  const handleRegister = async () => {
    try {
      await register(email, password, name, tenantSlug);
      // Redirección automática al dashboard
    } catch (error) {
      // Manejar error
    }
  };
}
```

### Proteger Rutas

```tsx
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function DashboardPage() {
  return (
    <ProtectedRoute requireAuth={true}>
      <YourDashboardContent />
    </ProtectedRoute>
  );
}
```

### Llamadas a la API

```tsx
import { useApi } from '@/hooks/useApi';

function DashboardPage() {
  const { get, post, isLoading, error } = useApi();

  const fetchData = async () => {
    const data = await get('/your-endpoint');
    // Usar data
  };
}
```

### Acceder al Usuario

```tsx
import { useAuth } from '@/hooks/useAuth';

function UserProfile() {
  const { user, tenant, logout } = useAuth();

  return (
    <div>
      <p>Name: {user?.name}</p>
      <p>Email: {user?.email}</p>
      <p>Tenant: {tenant?.name}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

## Configuración del Backend

Asegúrate de que el backend esté corriendo en el puerto configurado (por defecto 3001):

```bash
cd packages/backend
npm run dev
```

El backend debe exponer los siguientes endpoints:

- `POST /api/v1/auth/login` - Login de usuario
- `POST /api/v1/auth/register` - Registro de usuario

## Variables de Entorno

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Flujo de Autenticación

1. **Login/Register**: Usuario ingresa credenciales
2. **Backend Response**: Retorna token, user y tenant
3. **LocalStorage**: Se guarda token, user y tenant
4. **AuthProvider**: Actualiza el estado global
5. **Protected Routes**: Verifica autenticación
6. **API Calls**: Incluye token en headers Authorization

## Próximos Pasos

- [ ] Implementar refresh token
- [ ] Agregar sistema de notificaciones (toasts)
- [ ] Implementar recovery de contraseña
- [ ] Agregar validación de formulario
- [ ] Implementar loading states globales
- [ ] Agregar tests para auth context
