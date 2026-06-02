# Guía de Implementación - Agento SaaS Node.js 100%

**Fecha:** 7 de marzo de 2026
**Versión:** 1.0.0
**Estado:** Estructura base completada

---

## Índice

1. [Visión del Producto](#visión-del-producto)
2. [Arquitectura](#arquitectura)
3. [Estructura de Archivos](#estructura-de-archivos)
4. [Instalación](#instalación)
5. [Configuración](#configuración)
6. [Ejecución](#ejecución)
7. [Multi-Tenancy](#multi-tenancy)
8. [Modos de Ejecución](#modos-de-ejecución)
9. [Integración con OpenCode](#integración-con-opencode)
10. [Testing](#testing)

---

## Visión del Producto

**UN SOLO PRODUCTO con DOS MODOS de uso:**

### MODO 1: Chat con Accomplish (MODO FULL)
- El usuario chatea directamente con Accomplish/OpenCode
- Puede hacer TODO como en Accomplish desktop:
  - Investigar en internet
  - Acceder a Google Sheets, Docs, Drive
  - Subir y procesar archivos (Excel, PDF, etc.)
  - Manejar su correo
  - Ejecutar código
  - Automatizar tareas
- Multi-usuario: Cada tenant tiene su espacio aislado
- Desde aquí: Configura el agente WhatsApp, sube bases de conocimiento

### MODO 2: Agente WhatsApp (MODO LIMITADO)
- Atiende clientes automáticamente
- Usa IA de OpenCode PERO con LIMITACIONES:
  - ✅ PUEDE: Consultar bases de conocimiento, integraciones configuradas
  - ❌ NO PUEDE: Ejecutar código, modificar sistema, navegar libremente
- Se configura DESDE el chat de Accomplish
- Sigue reglas definidas por el usuario

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                   NEXT.JS FRONTEND                            │
│  ┌────────────────────┐  ┌────────────────────┐              │
│  │ Chat Accomplish    │  │   Admin Panel      │              │
│  │ (MODO FULL)         │  │                     │              │
│  └────────────────────┘  └────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                          │ HTTP/WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   EXPRESS API (TypeScript)                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              SECURITY LAYER                              │  │
│  │  Valida: Modo, Comandos, Paths, Cuotas                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│  /api/v1/chat           → ChatController                     │
│  /api/v1/workspace       → WorkspaceController               │
│  /api/v1/whatsapp         → WhatsAppController                │
└─────────────────────────────────────────────────────────────────┘
                          │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────┐
│  POSTGRESQL       │ │  REDIS       │ │  OPENCODE     │
│  (Prisma)         │ │  (BullMQ)    │ │  (node-pty)   │
│  Multi-Tenant     │ │  Colas       │ │  Procesos     │
│  Isolation        │ │  Cache       │ │  Aislados     │
└──────────────────┘ └──────────────┘ └──────────────┘
```

---

## Estructura de Archivos

```
D:\laragon\www\agento-saas-nodejs\
├── README.md                              # Este archivo
├── ARCHITECTURE.md                        # Diagramas técnicos
├── package.json                           # Root workspace
├── turbo.json                             # Turborepo config
├── .gitignore
│
├── packages/
│   ├── backend/                          # Express API
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── .env.example
│   │   ├── prisma/
│   │   │   └── schema.prisma           # Schema multi-tenant
│   │   └── src/
│   │       ├── index.ts                 # Entry point
│   │       ├── app.ts                   # Express app
│   │       ├── server.ts                # Server
│   │       └── modules/
│   │           ├── security/
│   │           │   └── services/
│   │           │       └── security-layer.service.ts
│   │           ├── chat/
│   │           ├── workspace/
│   │           └── whatsapp/
│   │               ├── controllers/
│   │               └── services/
│   │                   ├── webhook.service.ts
│   │                   ├── agent.service.ts
│   │                   └── whatsapp-cloud-api.service.ts
│   │
│   ├── frontend/                         # Next.js 14
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── app/
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       └── workspace/
│   │           └── [tenant]/
│   │               ├── chat/
│   │               ├── files/
│   │               └── integrations/
│   │
│   └── ai-worker/                        # OpenCode wrapper
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           └── executor/
│               └── opencode-executor.service.ts
│
└── tests/
    └── e2e/
        ├── auth.spec.ts
        ├── chat.spec.ts
        └── workspace.spec.ts
```

---

## Instalación

### Requisitos Previos

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- Git

### Pasos de Instalación

```bash
# 1. Clonar/Copiar proyecto
cd D:\laragon\www\agento-saas-nodejs

# 2. Instalar dependencias root
npm install

# 3. Instalar dependencias de cada paquete
cd packages/backend && npm install
cd ../frontend && npm install
cd ../ai-worker && npm install

# 4. Configurar variables de entorno
cd packages/backend
cp .env.example .env
# Editar .env con tus credenciales

# 5. Crear base de datos
npx prisma migrate dev --name init

# 6. Generar Prisma Client
npx prisma generate

# 7. (Opcional) Copiar binarios de OpenCode
# Desde: E:\accomplish\node_modules\opencode-*
# Hacia: packages/ai-worker/binaries/
```

---

## Configuración

### Variables de Entorno (.env)

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/agento_saas"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-secret-key-min-32-chars"

# Server
NODE_ENV="development"
PORT=3000

# OpenCode
OPENCODE_BINARY_PATH="./binaries"

# WhatsApp (Meta Cloud API)
WHATSAPP_VERIFY_TOKEN="your-verify-token"
WHATSAPP_APP_ID="your-app-id"
WHATSAPP_APP_SECRET="your-app-secret"

# Frontend
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

### Configuración de PostgreSQL

```sql
-- Crear base de datos
CREATE DATABASE agento_saas;

-- Crear usuario (opcional)
CREATE USER agento_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE agento_saas TO agento_user;
```

---

## Ejecución

### Modo Desarrollo

```bash
# Terminal 1: Backend
cd packages/backend
npm run dev
# → Escucha en http://localhost:3000

# Terminal 2: Frontend
cd packages/frontend
npm run dev
# → Escucha en http://localhost:3001

# Terminal 3: AI Worker
cd packages/ai-worker
npm run dev
# → Worker processes
```

### Modo Producción

```bash
# Build all packages
npm run build

# Start backend
cd packages/backend && npm start

# Start frontend
cd packages/frontend && npm start

# Start AI Worker
cd packages/ai-worker && npm start
```

---

## Multi-Tenancy

### Aislamiento de Datos

```
Cada tenant tiene su ESPACIO AISLADO:

/storage/tenants/
├── tenant_a/
│   ├── workspace/          # Working directory del OpenCode
│   ├── files/              # Archivos subidos por el usuario
│   └── context/            # Contexto de conversación
│
├── tenant_b/
│   ├── workspace/          # COMPLETAMENTE AISLADO de tenant_a
│   ├── files/
│   └── context/
│
└── tenant_c/
    └── workspace/
```

### Security Layer

```typescript
// Valida qué puede hacer CADA tenant según su MODO

enum ExecutionMode {
  FULL    // Chat con Accomplish - TODO el poder
  LIMITED // Agente WhatsApp - Solo consultar datos
}

// Comandos permitidos por MODO
const ALLOWED_COMMANDS = {
  FULL: ['execute_code', 'browse_web', 'file_read', 'file_write', 'api_call'],
  LIMITED: ['knowledge_query', 'integration_read', 'data_lookup']
};
```

---

## Modos de Ejecución

### Tabla Comparativa

| Feature | MODO FULL | MODO LIMITADO |
|---------|-----------|---------------|
| **Uso** | Chat con Accomplish | Agente WhatsApp |
| **Usuario** | Humano | Cliente WhatsApp |
| **Ejecutar código** | ✅ Sí | ❌ No |
| **Navegar internet** | ✅ Sí | ❌ No |
| **Leer archivos** | ✅ Sí | ⚠️ Solo permitidos |
| **Escribir archivos** | ✅ Sí | ❌ No |
| **Llamar APIs** | ✅ Sí | ⚠️ Solo configuradas |
| **Base de conocimiento** | ✅ Sí | ✅ Sí |
| **Workspace aislado** | ✅ Sí | ⚠️ Solo lectura |

---

## Integración con OpenCode

### OpenCode Executor

```typescript
// Cada tenant tiene su PROPIO proceso OpenCode

class OpenCodeExecutor {
  async executeForTenant(
    tenantId: string,
    mode: 'FULL' | 'LIMITED',
    input: OpenCodeInput
  ): Promise<OpenCodeOutput> {

    // Crear PTY AISLADO para este tenant
    const ptyProcess = pty.spawn('node', [], {
      cwd: `/storage/tenants/${tenantId}/workspace`,  // PATH AISLADO
      env: {
        TENANT_ID: tenantId,
        EXECUTION_MODE: mode,
        HOME: `/storage/tenants/${tenantId}/workspace`
      }
    });

    // Ejecutar OpenCode
    const result = await this.executeCommand(ptyProcess, input);

    return result;
  }
}
```

### Binarios de OpenCode

Los binarios deben copiarse desde Accomplish:

```bash
# Copiar todos los binarios
cp E:\accomplish\node_modules\opencode-windows-x64* \
   packages/ai-worker/binaries/

cp E:\accomplish\node_modules\opencode-darwin-arm64* \
   packages/ai-worker/binaries/

cp E:\accomplish\node_modules\opencode-darwin-x64* \
   packages/ai-worker/binaries/
```

---

## Testing

### Tests E2E

```bash
# Ejecutar todos los tests
cd tests
npm run test

# Tests específicos
npm run test -- auth
npm run test -- chat
npm run test -- workspace
```

### Tests Unitarios

```bash
# Backend tests
cd packages/backend
npm test

# Con coverage
npm test -- --coverage
```

---

## Troubleshooting

### Error: "OpenCode binary not found"

**Solución:** Copiar los binarios desde Accomplish:
```bash
cp E:\accomplish\node_modules\opencode-* packages/ai-worker/binaries/
```

### Error: "Database connection failed"

**Solución:** Verificar que PostgreSQL esté corriendo:
```bash
# Windows
sc query postgresql-x64-16

# Linux/Mac
sudo service postgresql status
```

### Error: "Redis connection refused"

**Solución:** Iniciar Redis:
```bash
# Windows
redis-server

# Linux/Mac
sudo service redis start
```

---

## Roadmap

### Fase 1: ✅ Completado
- ✅ Estructura monorepo
- ✅ Prisma schema multi-tenant
- ✅ Security Layer
- ✅ OpenCode Executor
- ✅ Express API básica
- ✅ Next.js frontend básico

### Fase 2: 🔄 En Progreso
- 🔄 Testing suite
- 🔄 WebSocket server
- 🔄 WhatsApp Cloud API integration
- 🔄 Admin panel

### Fase 3: ⏳ Pendiente
- ⏳ Google Sheets integration
- ⏳ Google Drive integration
- ⏳ Billing (Stripe + MercadoPago)
- ⏳ Deploy a producción

---

**Última actualización:** 7 de marzo de 2026
