# Quick Start - Frontend Authentication

## Setup Rapidísimo (5 minutos)

### 1. Instalar Dependencias
```bash
cd E:\agento-saas-nodejs\packages\frontend
npm install
```

### 2. Configurar Variables de Entorno
```bash
# El archivo .env.local ya está creado con:
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Iniciar Frontend
```bash
npm run dev
```

### 4. Abrir en Navegador
```
http://localhost:3000/login
```

## Pruebas Rápidas

### Test 1: Interfaz de Login
1. Ve a http://localhost:3000/login
2. Verifica que ves:
   - Logo "A" de Accomplish
   - Tabs "Login" y "Register"
   - Campos de email, password, tenant
   - Botón "Sign In"

### Test 2: Interfaz de Registro
1. Clic en tab "Register"
2. Verifica que ves:
   - Campo "Tenant Name"
   - Campo "Full Name"
   - Campo "Email"
   - Campo "Password"
   - Botón "Create Account"

### Test 3: Manejo de Errores (Sin Backend)
1. Intenta hacer login con: test@test.com / password123
2. Deberías ver:
   - Loading state en el botón
   - Mensaje de error: "Error desconocido" o "Failed to fetch"
   - Esto es NORMAL sin el backend corriendo

## Con Backend Corriendo

### Iniciar Backend (Agente A)
```bash
cd E:\agento-saas-nodejs\packages\backend
npm run dev
```

### Flujo Completo de Prueba

#### 1. Registrar Nuevo Usuario
```
URL: http://localhost:3000/login
Tab: Register

Form:
- Tenant Name: mi-empresa
- Full Name: Juan Pérez
- Email: juan@empresa.com
- Password: password123

→ Clic "Create Account"
→ Redirección a: /mi-empresa/dashboard
```

#### 2. Login con Usuario Existente
```
URL: http://localhost:3000/login
Tab: Login

Form:
- Email: juan@empresa.com
- Password: password123
- Tenant: (opcional) mi-empresa

→ Clic "Sign In"
→ Redirección a: /mi-empresa/dashboard
```

#### 3. Verificar Dashboard
```
URL: http://localhost:3000/mi-empresa/dashboard

Verificar:
- Header muestra "Mi-empresa" (nombre del tenant)
- Avatar muestra iniciales "JP"
- Dropdown muestra "Juan Pérez" y "juan@empresa.com"
- Botón "Log out" funciona
```

#### 4. Probar Logout
```
1. Clic en avatar (esquina superior derecha)
2. Clic en "Log out"
3. Verificar:
   - Redirección a /login
   - localStorage limpio (inspeccionar DevTools)
```

#### 5. Probar Protección de Rutas
```
1. Hacer logout
2. Intentar acceso directo: http://localhost:3000/mi-empresa/dashboard
3. Verificar:
   - Redirección automática a /login
```

#### 6. Probar Persistencia
```
1. Hacer login
2. Recargar página (F5)
3. Verificar:
   - Sigue autenticado
   - Usuario visible en header
   - Sin redirección a login
```

## Troubleshooting

### Error: "Failed to fetch"
**Causa:** Backend no está corriendo
**Solución:**
```bash
cd packages/backend
npm run dev
```

### Error: "useAuth debe usarse dentro de AuthProvider"
**Causa:** Componente fuera del provider
**Solución:** Verificar que `app/layout.tsx` envuelve con `<AuthProvider>`

### Error: "Cannot read property 'slug' of null"
**Causa:** Intentando acceder a tenant sin autenticación
**Solución:** Usar `ProtectedRoute` o verificar `isAuthenticated` primero

### Redirección Infinita
**Causa:** `ProtectedRoute` en login page
**Solución:** Login page NO debe usar `ProtectedRoute`

## Verificación de Componentes

### Estructura de Archivos
```bash
cd E:\agento-saas-nodejs\packages\frontend

# Verificar archivos creados
ls -la lib/api.ts lib/storage.ts lib/middleware.ts
ls -la contexts/AuthContext.tsx
ls -la hooks/useAuth.ts hooks/useApi.ts
ls -la components/auth/ProtectedRoute.tsx
ls -la types/auth.ts
```

### Verificación de Imports
```typescript
// En cualquier componente, deberías poder:
import { useAuth } from '@/hooks/useAuth';
import { useApi } from '@/hooks/useApi';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
```

## DevTools Útiles

### React DevTools
1. Instalar extensión React DevTools
2. Abrir Console → React
3. Buscar "AuthContext" en el árbol
4. Verificar estado: user, tenant, token

### localStorage Inspector
1. Abrir DevTools (F12)
2. Ir a tab "Application"
3. Sección "Local Storage"
4. Verificar keys:
   - `token`: JWT string
   - `user`: JSON con user data
   - `tenant`: JSON con tenant data

### Network Tab
1. Abrir DevTools (F12)
2. Ir a tab "Network"
3. Hacer login
4. Verificar request a `/api/v1/auth/login`
5. Verificar headers:
   - `Authorization: Bearer <token>`

## Checklist de Validación

### Frontend Only (Sin Backend)
- [ ] Página de login carga sin errores
- [ ] Tabs de Login/Register funcionan
- [ ] Inputs aceptan texto
- [ ] Botones muestran loading state
- [ ] Errores de red se muestran
- [ ] Redirecciones funcionan (con mock)

### Frontend + Backend (Integración)
- [ ] Login funcional
- [ ] Registro funcional
- [ ] Dashboard accesible solo con auth
- [ ] Logout funciona
- [ ] Sesión persiste (F5)
- [ ] Headers de Authorization presentes
- [ ] Datos de usuario correctos en header

## URLs Importantes

```
Frontend:     http://localhost:3000
Login:        http://localhost:3000/login
Dashboard:    http://localhost:3000/{tenant}/dashboard
Backend API:  http://localhost:3001/api/v1
Health:       http://localhost:3001/health
```

## Comandos Útiles

```bash
# Frontend
cd packages/frontend
npm run dev          # Iniciar dev server
npm run build        # Build para producción
npm run start        # Iniciar producción
npm run lint         # Verificar ESLint

# Backend (para pruebas)
cd packages/backend
npm run dev          # Iniciar backend
npm run migrate      # Correr migraciones Prisma
```

## Siguiente Nivel

Una vez verificado el frontend básico:

1. **Implementar Agents Dashboard**
   - Listado de agentes
   - Crear/Editar/Eliminar agentes

2. **Implementar WhatsApp Config**
   - Configurar webhook
   - Probar conexión

3. **Implementar Analytics**
   - Métricas de uso
   - Gráficos de actividad

---

**Tiempo estimado de setup:** 5 minutos
**Tiempo estimado de pruebas:** 15 minutos
**Total:** 20 minutos para tener todo funcionando

¡Listo para codear! 🚀
