# Plan de Migración: Backend Node → Bun (PostgreSQL Unificado)

## Resumen Ejecutivo

Este documento detalla el plan de migración del backend actual (Node.js/Express/Prisma/PostgreSQL) hacia la nueva plataforma unificada (Bun/Hono/Drizzle/PostgreSQL). El objetivo es unificar el stack tecnológico en un solo runtime, un solo repositorio y **una sola base de datos PostgreSQL**.

### Decisión de Arquitectura

| Aspecto | Decisión | Justificación |
|---------|----------|---------------|
| **Base de datos** | PostgreSQL | Arrays nativos, JSONB, pgvector para embeddings |
| **Runtime** | Bun | Performance, compatibilidad con TypeScript |
| **Framework** | Hono | Ligero, multi-plataforma, typesafe |
| **ORM** | Drizzle | Type-safe, SQL-like, sin magic |

---

## 1. Situación Actual

### 1.1 Estructura de Repositorios

#### Estructura Actual (DESPÚES de migración)

```
E:\agento-saas-nodejs\
├── packages/
│   ├── server/           # Backend unificado (COMPLETADO)
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── agent-ai/      # Agente AI integrado ✅
│   │       │   ├── agents/        # CRUD de agentes ✅
│   │       │   ├── auth/          # Auth ✅
│   │       │   ├── whatsapp/      # WhatsApp ✅
│   │       │   ├── billing/       # Billing ✅
│   │       │   └── ...
│   │       ├── workers/           # Workers ✅
│   │       └── websocket/         # WebSocket ✅
│   ├── agent-core/        # INTEGRADO en server/agent-ai (puede eliminarse)
│   ├── backend/           # LEGACY (puede eliminarse)
│   ├── ai-worker/         # INTEGRADO en server/workers (puede eliminarse)
│   ├── opencode-fork/     # OpenCode CLI (herramienta externa)
│   └── frontend/          # Frontend Next.js
```

#### Estructura Objetivo (COMPLETADO)

```
E:\agento-saas-nodejs\
├── packages/
│   ├── server/            # Backend unificado (Bun + Hono + Drizzle + PostgreSQL)
│   │   └── src/
│   │       ├── db/
│   │       │   ├── schema/        # Schema Drizzle unificado (~45 modelos)
│   │       │   └── index.ts
│   │       ├── modules/            # Módulos de negocio
│   │       │   ├── auth/          # Autenticación
│   │       │   ├── agents/        # CRUD de agentes
│   │       │   ├── agent-ai/      # Agente AI (integrado de agent-core)
│   │       │   │   ├── adapter/    # OpenCode adapters
│   │       │   │   ├── security/   # Capa de seguridad
│   │       │   │   ├── tenant/     # Gestión de tenants
│   │       │   │   ├── routes/     # Rutas AI
│   │       │   │   ├── controllers/
│   │       │   │   └── services/
│   │       │   ├── whatsapp/      # Integración WhatsApp
│   │       │   ├── billing/       # Suscripciones y pagos
│   │       │   ├── knowledge/     # Base de conocimiento
│   │       │   ├── chat/         # Chat interno
│   │       │   ├── integrations/ # Integraciones externas
│   │       │   ├── marketplace/   # Marketplace de skills
│   │       │   ├── analytics/    # Analíticas
│   │       │   ├── admin/        # Panel de administración
│   │       │   ├── tenant/       # Gestión de tenants
│   │       │   └── users/        # Gestión de usuarios
│   │       ├── workers/          # Bun Workers
│   │       │   ├── whatsapp.worker.ts
│   │       │   ├── billing.worker.ts
│   │       │   └── automation.worker.ts
│   │       ├── websocket/        # WebSocket server
│   │       ├── middleware/        # Middlewares
│   │       ├── config/           # Configuraciones
│   │       └── index.ts
│   ├── opencode-fork/     # OpenCode CLI (herramienta externa)
│   └── frontend/          # Frontend Next.js
```

### 1.2 Tecnologías: Actual vs Nuevo

| Aspecto        | Actual (Node.js)      | Nuevo (Bun)           |
| -------------- | --------------------- | --------------------- |
| Runtime        | Node.js 20.x          | Bun 1.x               |
| Framework HTTP | Express.js            | Hono                  |
| ORM            | Prisma                | Drizzle ORM           |
| Base de Datos  | PostgreSQL            | **PostgreSQL** (igual)|
| WebSocket      | Socket.io             | WS + Bun.serve        |
| Queue/Workers  | BullMQ                | Bun Workers + ioredis |
| Tests          | Jest                  | Bun test              |
| TypeScript     | 5.3                   | 5.8                   |
| PTY            | node-pty              | bun-pty               |

---

## 2. Conteo Real de Modelos

### 2.1 Backend Actual (Prisma) - ~40 modelos

| Categoría | Modelos | Cantidad |
|-----------|---------|----------|
| **Multi-tenant** | Tenant, User, TenantUser | 3 |
| **Agentes** | Agent, AgentIntegration | 2 |
| **WhatsApp** | WhatsAppConfig, Conversation, Message | 3 |
| **Billing** | Subscription, Payment, Invoice, Coupon, Plan, DunningAttempt | 6 |
| **Knowledge** | KnowledgeEntry, KnowledgeEmbedding, MemoryEntry | 3 |
| **Workspace** | TenantFile, ConversationContext, WorkspaceFile | 3 |
| **Automation** | ScheduledTask, TaskExecution, SimulationSession, SimulationLog | 4 |
| **Integrations** | Integration, ApiConnector, PendingResponse, ApprovalFeedback | 4 |
| **Marketplace** | MarketplaceSkill, SkillReview, InstalledSkill | 3 |
| **AI** | AIProvider, AIModel, AccomplishTask | 3 |
| **Enums** | ~15 enums | 15 |

**Total: ~45 entidades (modelos + enums)**

### 2.2 OpenCode Fork (MySQL) - ~10 modelos

| Modelo | Uso | Migración |
|--------|-----|-----------|
| WorkspaceTable | Workspaces CLI | → workspaces.sql.ts |
| UserTable | Usuarios CLI | → opencode_users.sql.ts |
| AccountTable | Auth externa | → accounts.sql.ts |
| BillingTable | Billing CLI | → opencode_billing.sql.ts |
| SubscriptionTable | Subs CLI | → opencode_subscriptions.sql.ts |
| UsageTable | Token tracking | → token_usage.sql.ts |
| KeyTable | API Keys | → api_keys.sql.ts |
| ProviderTable | AI Providers | → ai_providers_opencode.sql.ts |
| ModelTable | AI Models | → ai_models_opencode.sql.ts |

**Total: ~10 modelos adicionales**

---

## 3. Migración de Datos MySQL → PostgreSQL

### 3.1 Estrategia

**Decisión: No migrar datos de MySQL**

Según el contexto:
- Backend PostgreSQL: datos de prueba → **clean slate**
- OpenCode MySQL: datos de desarrollo → **clean slate**

**Si hay datos importantes en MySQL:**

```bash
# 1. Exportar datos de MySQL
mysqldump -u user -p opencode_db > mysql_backup.sql

# 2. Convertir a formato PostgreSQL
# Usar pgloader o conversión manual
pgloader mysql://user:pass@localhost/opencode_db \
         postgresql://user:pass@localhost/opencode_pg

# 3. O conversión manual con scripts
bun run scripts/migrate-mysql-to-pg.ts
```

### 3.2 Script de Migración (si es necesario)

```typescript
// scripts/migrate-mysql-to-pg.ts
import { mysqlPool } from "./mysql-client"
import { db } from "../packages/server/src/db"
import { workspaces, users, tokenUsage } from "../packages/server/src/db/schema"

async function migrateMySQLtoPG() {
  console.log("Iniciando migración MySQL → PostgreSQL...")

  // Migrar workspaces
  const mysqlWorkspaces = await mysqlPool.query("SELECT * FROM workspace")
  for (const ws of mysqlWorkspaces.rows) {
    await db.insert(workspaces).values({
      id: ws.id,
      slug: ws.slug,
      name: ws.name,
      createdAt: ws.time_created,
      updatedAt: ws.time_updated,
    })
  }
  console.log(`✅ Migrados ${mysqlWorkspaces.rows.length} workspaces`)

  // Migrar users
  const mysqlUsers = await mysqlPool.query("SELECT * FROM user")
  for (const u of mysqlUsers.rows) {
    await db.insert(users).values({
      id: u.id,
      workspaceId: u.workspace_id,
      email: u.email,
      name: u.name,
      role: u.role,
    })
  }
  console.log(`✅ Migrados ${mysqlUsers.rows.length} users`)

  // ... más tablas

  console.log("🎉 Migración completada")
}

migrateMySQLtoPG()
```

---

## 4. Integración de Paquetes

### 4.1 agent-core: Node.js → Bun

**Dependencias actuales:**
- `node-pty` → `bun-pty`
- `eventemitter3` → compatible
- `axios` → compatible o fetch nativo

**Cambios necesarios:**

```typescript
// ANTES: node-pty
import * as pty from "node-pty"

const ptyProcess = pty.spawn("bash", [], {
  name: "xterm-256color",
  cols: 80,
  rows: 24,
})

// DESPUÉS: bun-pty (o Bun.spawn)
import { spawn } from "bun"

const ptyProcess = spawn({
  cmd: ["bash"],
  stdin: "pipe",
  stdout: "pipe",
  stderr: "pipe",
})
```

### 4.2 ai-worker: BullMQ → Bun Workers

**Comparación de features:**

| Feature | BullMQ | Bun Workers | Alternativa |
|---------|--------|-------------|-------------|
| Colas persistentes | ✅ | ❌ | Usar Redis directamente |
| Jobs con delay | ✅ | ❌ | Usar `setTimeout` + Redis |
| Retries con backoff | ✅ | Manual | Implementar con ioredis |
| Prioridades | ✅ | ❌ | Múltiples colas Redis |
| Progress tracking | ✅ | Manual | Redis pub/sub |
| UI de monitoreo | ✅ Bull Board | ❌ | Custom dashboard |

**Recomendación: Híbrido**

```typescript
// src/workers/queue.ts
import Redis from "ioredis"

const redis = new Redis(process.env.REDIS_URL!)

// Queue simple con Redis
export async function enqueue(type: string, data: any, delay = 0) {
  const job = {
    id: crypto.randomUUID(),
    type,
    data,
    createdAt: Date.now(),
    processAt: Date.now() + delay,
  }

  await redis.zadd("jobs:pending", job.processAt, JSON.stringify(job))
}

export async function processQueue() {
  const now = Date.now()
  const jobs = await redis.zrangebyscore("jobs:pending", 0, now)

  for (const jobStr of jobs) {
    const job = JSON.parse(jobStr)
    await processJob(job)
    await redis.zrem("jobs:pending", jobStr)
  }
}

async function processJob(job: any) {
  switch (job.type) {
    case "whatsapp_send":
      await sendWhatsAppMessage(job.data)
      break
    case "billing_retry":
      await retryBilling(job.data)
      break
    case "scheduled_task":
      await runScheduledTask(job.data)
      break
  }
}
```

### 4.3 Comunicación entre paquetes

```
┌─────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA COMUNICACIÓN                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    HTTP/REST     ┌─────────────┐          │
│  │  Frontend   │ ───────────────→ │   server    │          │
│  │  (Next.js)  │                  │   (Hono)    │          │
│  └─────────────┘                  └──────┬──────┘          │
│                                          │                  │
│                     ┌────────────────────┼────────────────┐ │
│                     │                    │                │ │
│                     ▼                    ▼                ▼ │
│              ┌─────────────┐     ┌─────────────┐  ┌────────┤
│              │ agent-core  │     │ ai-worker   │  │ Redis  │
│              │ (Bun)       │     │ (Bun)       │  │        │
│              └─────────────┘     └─────────────┘  └────────┤
│                     │                    │                │ │
│                     └────────────────────┴────────────────┘ │
│                                │                            │
│                                ▼                            │
│                        ┌─────────────┐                      │
│                        │ PostgreSQL  │                      │
│                        └─────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

**Métodos de comunicación:**
- `server` → `agent-core`: Import directo (mismo proceso)
- `server` → `ai-worker`: Redis queue + HTTP callback
- `agent-core` → `server`: Callback HTTP o eventos

---

## 5. Estrategia de Migración de Código

### 5.1 Enfoque: Híbrido (Reescribir Estructura + Copiar Lógica)

```
┌─────────────────────────────────────────────────────────────────┐
│                     QUÉ HACER CON CADA PARTE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  REESCRIBIR (estructura)          COPIAR + ADAPTAR (lógica)    │
│  ═══════════════════════          ═════════════════════════    │
│                                                                 │
│  • Routes / Controllers           • Services (business logic)  │
│  • Middleware                     • Validaciones (Zod)         │
│  • Config (DB, Redis, etc)        • Tipos TypeScript          │
│  • Workers                        • Utilidades puras           │
│  • Schemas Drizzle                • Constantes                 │
│  • Tests E2E                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Por Tipo de Archivo

| Tipo de Archivo | Estrategia | Razón |
|-----------------|------------|-------|
| **routes/*.ts** | REESCRIBIR | Express Router ≠ Hono routes |
| **controllers/*.ts** | REESCRIBIR | req/res ≠ Context de Hono |
| **services/*.ts** | COPIAR + ADAPTAR | Lógica igual, solo cambiar DB queries |
| **middleware/*.ts** | REESCRIBIR | Firma diferente en Hono |
| **prisma/schema.prisma** | CONVERTIR | Prisma → Drizzle schema |
| **utils/*.ts** | COPIAR TAL CUAL | Código puro, sin dependencias |
| **validations/*.ts** | COPIAR TAL CUAL | Zod es igual en ambos |
| **types/*.ts** | COPIAR + LIMPIAR | Tipos reutilizables |

### 5.3 Ejemplo: Migración de un Módulo (Auth)

#### ANTES: Express + Prisma

```typescript
// packages/backend/src/modules/auth/auth.routes.ts
import { Router } from "express"
import { body, validationResult } from "express-validator"
import { authController } from "./auth.controller"
import { authMiddleware } from "../../middleware/auth"

const router = Router()

router.post(
  "/login",
  [
    body("email").isEmail(),
    body("password").isLength({ min: 8 }),
  ],
  (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }
    next()
  },
  authController.login
)

router.get("/me", authMiddleware, authController.me)

export { router as authRoutes }
```

```typescript
// packages/backend/src/modules/auth/auth.controller.ts
import { Request, Response, NextFunction } from "express"
import { authService } from "./auth.service"

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body
      const result = await authService.login(email, password)
      res.json(result)
    } catch (error) {
      next(error)
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.getById(req.user.id)
      res.json(user)
    } catch (error) {
      next(error)
    }
  },
}
```

```typescript
// packages/backend/src/modules/auth/auth.service.ts
import { prisma } from "../../db"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

export const authService = {
  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) throw new Error("Invalid credentials")

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) throw new Error("Invalid credentials")

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!)

    return { token, user: { id: user.id, email: user.email, name: user.name } }
  },

  async getById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true },
    })
  },
}
```

#### DESPUÉS: Hono + Drizzle

```typescript
// packages/server/src/routes/auth.routes.ts
import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { authService } from "../services/auth.service"
import { authMiddleware } from "../middleware/auth.middleware"

const app = new Hono()

// Validaciones (COPIADAS de express-validator → Zod)
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

// Routes (REESCRITAS para Hono)
app.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json")
  const result = await authService.login(email, password)
  return c.json(result)
})

app.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId")
  const user = await authService.getById(userId)
  return c.json(user)
})

export { app as authRoutes }
```

```typescript
// packages/server/src/services/auth.service.ts
import { db } from "../db"
import { users } from "../db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

// COPIAR lógica, ADAPTAR queries
export const authService = {
  async login(email: string, password: string) {
    // ANTES: prisma.user.findUnique({ where: { email } })
    // DESPUÉS: db.select().from(users).where(eq(users.email, email))
    const [user] = await db.select().from(users).where(eq(users.email, email))

    if (!user) throw new Error("Invalid credentials")

    // COPIAR: misma lógica de validación
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) throw new Error("Invalid credentials")

    // COPIAR: misma lógica de token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!)

    return { token, user: { id: user.id, email: user.email, name: user.name } }
  },

  async getById(id: string) {
    // ANTES: prisma.user.findUnique({ where: { id }, select: {...} })
    // DESPUÉS: db.select({...}).from(users).where(eq(users.id, id))
    const [user] = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, id))

    return user
  },
}
```

```typescript
// packages/server/src/middleware/auth.middleware.ts
import { Context, Next } from "hono"
import jwt from "jsonwebtoken"

// REESCRIBIR: firma diferente
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const token = authHeader.replace("Bearer ", "")

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
    c.set("userId", payload.userId)
    await next()
  } catch {
    return c.json({ error: "Invalid token" }, 401)
  }
}
```

### 5.4 Proceso de Migración por Módulo

```
Para cada módulo (auth, agents, whatsapp, etc.):

1. CREAR estructura vacía
   ├── routes/[modulo].routes.ts
   ├── services/[modulo].service.ts
   ├── db/schema/[modulo].sql.ts

2. MIGRAR schema primero
   - Leer prisma/schema.prisma
   - Convertir a Drizzle (pg-table)
   - Generar migración
   - Aplicar a DB

3. COPIAR service (lógica de negocio)
   - Copiar archivo completo
   - Buscar: prisma.xxx.findUnique → db.select().from().where()
   - Buscar: prisma.xxx.create → db.insert().values()
   - Buscar: prisma.xxx.update → db.update().set().where()
   - Buscar: prisma.xxx.delete → db.delete().where()
   - Buscar: prisma.xxx.findMany → db.select().from()

4. REESCRIBIR routes/controller
   - Express Router → Hono app
   - req.body → c.req.valid("json")
   - req.params → c.req.param("id")
   - req.headers → c.req.header()
   - res.json() → c.json()
   - res.status(404).json() → c.json({...}, 404)
   - express-validator → @hono/zod-validator

5. REESCRIBIR middleware
   - (req, res, next) → (c, next)
   - req.user = x → c.set("user", x)
   - next() → await next()

6. TESTEAR
   - Ejecutar tests E2E del módulo
   - Comparar respuestas con backend original

7. REPETIR con siguiente módulo
```

### 5.5 Tabla de Conversión Express → Hono

| Express | Hono | Notas |
|---------|------|-------|
| `Router()` | `new Hono()` | Crear router |
| `router.get("/path", fn)` | `app.get("/path", fn)` | Igual |
| `req.body` | `c.req.valid("json")` | Requiere validator |
| `req.params.id` | `c.req.param("id")` | Params de URL |
| `req.query.page` | `c.req.query("page")` | Query params |
| `req.headers["x-token"]` | `c.req.header("x-token")` | Headers |
| `req.user` | `c.get("user")` | Datos del middleware |
| `res.json(data)` | `c.json(data)` | Respuesta JSON |
| `res.status(404).json(e)` | `c.json(e, 404)` | Con status |
| `res.send("text")` | `c.text("text")` | Texto plano |
| `res.redirect(url)` | `c.redirect(url)` | Redirect |
| `next()` | `await next()` | Async en Hono |
| `express.json()` | No necesario | Hono lo hace automático |
| `express.urlencoded()` | No necesario | Hono lo hace automático |
| `cors()` | `import { cors } from "hono/cors"` | Middleware |

### 5.6 Tabla de Conversión Prisma → Drizzle

| Prisma | Drizzle | Notas |
|--------|---------|-------|
| `prisma.user.findUnique({ where: { id } })` | `db.select().from(users).where(eq(users.id, id))` | Select |
| `prisma.user.findFirst({ where: { email } })` | `db.select().from(users).where(eq(users.email, email)).limit(1)` | First |
| `prisma.user.findMany({ where: { active: true } })` | `db.select().from(users).where(eq(users.active, true))` | Many |
| `prisma.user.findMany()` | `db.select().from(users)` | All |
| `prisma.user.create({ data: {...} })` | `db.insert(users).values({...}).returning()` | Create |
| `prisma.user.update({ where: { id }, data: {...} })` | `db.update(users).set({...}).where(eq(users.id, id)).returning()` | Update |
| `prisma.user.delete({ where: { id } })` | `db.delete(users).where(eq(users.id, id)).returning()` | Delete |
| `prisma.user.count({ where: {...} })` | `db.select({ count: sql\`count(*)\` }).from(users).where(...)` | Count |
| `include: { posts: true }` | `db.query.users.findMany({ with: { posts: true } })` | Relations |
| `select: { id: true, name: true }` | `db.select({ id: users.id, name: users.name }).from(users)` | Select fields |
| `orderBy: { createdAt: "desc" }` | `db.select().from(users).orderBy(desc(users.createdAt))` | Order |
| `skip: 10, take: 5` | `db.select().from(users).limit(5).offset(10)` | Pagination |
| `@default(uuid())` | `.defaultRandom()` o `.$defaultFn(() => crypto.randomUUID())` | UUID |
| `@default(now())` | `.defaultNow()` | Timestamp |
| `String[]` | `text("field").array()` | Arrays PG |
| `Json` | `jsonb("field")` | JSON PG |
| `@relation(...)` | `relations()` function | Relations |

### 5.7 Validaciones: express-validator → Zod

```typescript
// ANTES: express-validator
import { body, validationResult } from "express-validator"

router.post(
  "/users",
  [
    body("email").isEmail().withMessage("Email inválido"),
    body("password").isLength({ min: 8 }).withMessage("Min 8 caracteres"),
    body("name").optional().isString(),
  ],
  (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }
    // ...
  }
)

// DESPUÉS: Zod + @hono/zod-validator
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"

const createUserSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Min 8 caracteres"),
  name: z.string().optional(),
})

app.post("/users", zValidator("json", createUserSchema), async (c) => {
  const data = c.req.valid("json") // Ya validado
  // ...
})
```

---

## 6. Plan de Migración por Fases (Actualizado)

### FASE 0: Preparación (Días 1-2)

#### 0.1 Auditoría de Código

- [ ] Contar endpoints exactos en `packages/backend/`
- [ ] Listar todas las dependencias de cada módulo
- [ ] Identificar código legacy/deprecated
- [ ] Documentar integraciones externas (MercadoPago, Meta, Google)

#### 0.2 Setup de Testing E2E

```typescript
// tests/e2e/auth.e2e.test.ts
import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { spawn } from "bun"

let oldServer: Bun.Subprocess
let newServer: Bun.Subprocess

beforeAll(async () => {
  // Levantar ambos servers en puertos diferentes
  oldServer = spawn({ cmd: ["npm", "run", "dev"], cwd: "./packages/backend" })
  newServer = spawn({ cmd: ["bun", "run", "dev"], cwd: "./packages/server" })

  await sleep(5000) // Esperar a que inicien
})

afterAll(() => {
  oldServer.kill()
  newServer.kill()
})

test("POST /api/v1/auth/login - mismo response", async () => {
  const oldRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "test@test.com", password: "123" }),
  })

  const newRes = await fetch("http://localhost:3001/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "test@test.com", password: "123" }),
  })

  const oldJson = await oldRes.json()
  const newJson = await newRes.json()

  expect(newRes.status).toBe(oldRes.status)
  expect(newJson).toEqual(oldJson) // Mismo formato de respuesta
})
```

#### 0.3 Baseline de Performance

```bash
# Medir performance actual (Node.js)
wrk -t12 -c400 -d30s http://localhost:3000/api/v1/health

# Guardar resultados para comparar después
```

**Entregables FASE 0:**

- [ ] Auditoría completa de código
- [ ] Tests E2E base funcionando
- [ ] Baseline de performance documentado

---

### FASE 1: Setup y Estructura (Días 3-4)

#### 1.1 Crear estructura del paquete

```
packages/server/
├── src/
│   ├── index.ts              # Entry point
│   ├── app.ts                # Configuración Hono
│   ├── config/
│   │   ├── database.ts       # Conexión Drizzle
│   │   ├── redis.ts          # Conexión Redis
│   │   └── env.ts            # Variables de entorno
│   ├── db/
│   │   ├── schema/           # Schemas Drizzle
│   │   │   ├── tenant.sql.ts
│   │   │   ├── user.sql.ts
│   │   │   ├── agent.sql.ts
│   │   │   ├── whatsapp.sql.ts
│   │   │   ├── billing.sql.ts
│   │   │   ├── knowledge.sql.ts
│   │   │   ├── workspace.sql.ts
│   │   │   ├── automation.sql.ts
│   │   │   ├── integration.sql.ts
│   │   │   ├── marketplace.sql.ts
│   │   │   ├── ai.sql.ts
│   │   │   ├── opencode.sql.ts
│   │   │   └── index.ts
│   │   ├── migrations/
│   │   └── index.ts
│   ├── routes/
│   │   ├── index.ts
│   │   ├── auth.routes.ts
│   │   ├── agents.routes.ts
│   │   ├── chat.routes.ts
│   │   ├── whatsapp.routes.ts
│   │   ├── billing.routes.ts
│   │   └── ...
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── agents.service.ts
│   │   └── ...
│   ├── workers/
│   │   ├── index.ts
│   │   ├── queue.ts
│   │   ├── whatsapp.worker.ts
│   │   ├── billing.worker.ts
│   │   └── automation.worker.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── tenant.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── rate-limit.middleware.ts
│   ├── utils/
│   │   ├── jwt.ts
│   │   ├── crypto.ts
│   │   └── logger.ts
│   └── types/
│       └── index.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── .env.example
```

#### 1.2 Migrar Schemas Prisma → Drizzle

**Conteo por fase:**

| Fase | Schemas | Modelos |
|------|---------|---------|
| 1a | tenant.sql.ts, user.sql.ts | Tenant, User, TenantUser |
| 1b | auth.sql.ts | (auth related) |
| 1c | agent.sql.ts | Agent, AgentIntegration |
| 2a | whatsapp.sql.ts | WhatsAppConfig, Conversation, Message |
| 2b | billing.sql.ts | Subscription, Payment, Invoice, Coupon, Plan, DunningAttempt |
| 2c | knowledge.sql.ts | KnowledgeEntry, KnowledgeEmbedding, MemoryEntry |
| 3a | workspace.sql.ts | TenantFile, ConversationContext, WorkspaceFile |
| 3b | automation.sql.ts | ScheduledTask, TaskExecution, SimulationSession, SimulationLog |
| 3c | integration.sql.ts | Integration, ApiConnector, PendingResponse, ApprovalFeedback |
| 4a | marketplace.sql.ts | MarketplaceSkill, SkillReview, InstalledSkill |
| 4b | ai.sql.ts | AIProvider, AIModel, AccomplishTask |
| 4c | opencode.sql.ts | Workspace, User, Account, Billing, Subscription, Usage, Key, Provider, Model |

**Total: ~45 archivos de schema**

**Entregables FASE 1:**

- [ ] Estructura creada
- [ ] package.json configurado
- [ ] Schemas Drizzle creados (fase 1a, 1b, 1c)
- [ ] Conexión PostgreSQL funcionando
- [ ] Migración inicial generada

---

### FASE 2: Core API (Días 5-8)

#### 2.1 Auth (Día 5-6)

- [ ] POST /api/v1/auth/register
- [ ] POST /api/v1/auth/login
- [ ] POST /api/v1/auth/refresh
- [ ] POST /api/v1/auth/logout
- [ ] GET /api/v1/auth/me
- [ ] Tests E2E de auth

#### 2.2 Tenant & Users (Día 7)

- [ ] GET /api/v1/tenant
- [ ] PUT /api/v1/tenant
- [ ] GET /api/v1/users
- [ ] POST /api/v1/users
- [ ] Tests E2E de tenant

#### 2.3 Agents (Día 8)

- [ ] GET /api/v1/agents
- [ ] POST /api/v1/agents
- [ ] GET /api/v1/agents/:id
- [ ] PUT /api/v1/agents/:id
- [ ] DELETE /api/v1/agents/:id
- [ ] Tests E2E de agents

**Entregables FASE 2:**

- [ ] Auth 100% funcional
- [ ] Tenant CRUD funcional
- [ ] Agents CRUD funcional
- [ ] Tests E2E pasando

---

### FASE 3: Módulos de Negocio (Días 9-14)

#### 3.1 WhatsApp (Días 9-11)

- [ ] GET /api/v1/whatsapp
- [ ] POST /api/v1/whatsapp
- [ ] GET /api/v1/whatsapp/:id
- [ ] PUT /api/v1/whatsapp/:id
- [ ] POST /api/v1/whatsapp/:id/webhook
- [ ] GET /api/v1/whatsapp/:id/conversations
- [ ] GET /api/v1/whatsapp/:id/conversations/:phone
- [ ] Tests E2E de WhatsApp

#### 3.2 Chat Interno (Día 12)

- [ ] POST /api/v1/chat
- [ ] GET /api/v1/chat/:sessionId
- [ ] POST /api/v1/chat/:sessionId/message
- [ ] GET /api/v1/chat/:sessionId/stream (SSE)
- [ ] Tests E2E de chat

#### 3.3 Billing (Días 13-14)

- [ ] GET /api/v1/billing
- [ ] POST /api/v1/billing/subscribe
- [ ] POST /api/v1/billing/cancel
- [ ] GET /api/v1/billing/invoices
- [ ] POST /api/v1/billing/webhook/mercadopago
- [ ] Tests E2E de billing

**Entregables FASE 3:**

- [ ] WhatsApp 100% funcional
- [ ] Chat interno 100% funcional
- [ ] Billing 100% funcional
- [ ] Tests E2E pasando

---

### FASE 4: Módulos Avanzados (Días 15-18)

#### 4.1 Knowledge & Embeddings (Día 15)

- [ ] GET /api/v1/knowledge
- [ ] POST /api/v1/knowledge
- [ ] POST /api/v1/knowledge/search (búsqueda semántica)
- [ ] Tests E2E

#### 4.2 Integrations (Día 16)

- [ ] GET /api/v1/integrations
- [ ] POST /api/v1/integrations
- [ ] POST /api/v1/integrations/:id/sync
- [ ] Google Sheets integration
- [ ] Tests E2E

#### 4.3 Marketplace & Skills (Día 17)

- [ ] GET /api/v1/marketplace
- [ ] POST /api/v1/marketplace
- [ ] POST /api/v1/marketplace/:id/install
- [ ] Tests E2E

#### 4.4 Analytics & Admin (Día 18)

- [ ] GET /api/v1/analytics/overview
- [ ] GET /api/v1/analytics/conversations
- [ ] GET /api/v1/admin/users
- [ ] GET /api/v1/admin/tenants
- [ ] Tests E2E

**Entregables FASE 4:**

- [ ] Knowledge 100% funcional
- [ ] Integrations 100% funcional
- [ ] Marketplace 100% funcional
- [ ] Analytics 100% funcional

---

### FASE 5: Workers y Background (Días 19-21)

#### 5.1 Queue System (Día 19)

```typescript
// src/workers/queue.ts
import Redis from "ioredis"

const redis = new Redis(process.env.REDIS_URL!)

export const queues = {
  whatsapp: "queue:whatsapp",
  billing: "queue:billing",
  automation: "queue:automation",
}

export async function enqueue(
  queue: keyof typeof queues,
  job: { type: string; data: any; delay?: number }
) {
  const score = Date.now() + (job.delay || 0)
  await redis.zadd(queues[queue], score, JSON.stringify(job))
}

export async function processQueue(queue: string, handler: (job: any) => Promise<void>) {
  setInterval(async () => {
    const now = Date.now()
    const jobs = await redis.zrangebyscore(queue, 0, now, "LIMIT", 0, 10)

    for (const jobStr of jobs) {
      try {
        const job = JSON.parse(jobStr)
        await handler(job)
        await redis.zrem(queue, jobStr)
      } catch (error) {
        console.error(`Job failed:`, error)
        // Re-encolar con delay (retry)
        await redis.zrem(queue, jobStr)
        const job = JSON.parse(jobStr)
        await redis.zadd(queue, Date.now() + 60000, jobStr) // Retry en 1min
      }
    }
  }, 1000) // Poll cada segundo
}
```

#### 5.2 Workers (Día 20)

```typescript
// src/workers/whatsapp.worker.ts
import { processQueue, enqueue } from "./queue"
import { sendWhatsAppMessage } from "../services/whatsapp.service"

processQueue("queue:whatsapp", async (job) => {
  switch (job.type) {
    case "send_message":
      await sendWhatsAppMessage(job.data)
      break
    case "retry_message":
      await sendWhatsAppMessage(job.data)
      break
  }
})
```

#### 5.3 WebSocket (Día 21)

```typescript
// src/websocket/index.ts
import { serve } from "bun"
import { redis } from "../config/redis"

const clients = new Set<WebSocket>()

serve({
  port: 3002,
  fetch(req, server) {
    const url = new URL(req.url)
    if (url.pathname === "/ws") {
      server.upgrade(req)
      return
    }
    return new Response("Not found", { status: 404 })
  },
  websocket: {
    open(ws) {
      clients.add(ws)
    },
    close(ws) {
      clients.delete(ws)
    },
    message(ws, message) {
      // Broadcast a todos
      for (const client of clients) {
        client.send(message)
      }
    },
  },
})

// Pub/Sub para eventos de Redis
redis.subscribe("events", (message) => {
  for (const client of clients) {
    client.send(message)
  }
})
```

**Entregables FASE 5:**

- [ ] Queue system funcionando
- [ ] WhatsApp worker funcionando
- [ ] Billing worker funcionando
- [ ] Automation worker funcionando
- [ ] WebSocket funcionando

---

### FASE 6: Migración de Paquetes (Días 22-25)

#### 6.1 agent-core → Bun (Días 22-23)

```typescript
// packages/agent-core/src/process.ts
// ANTES: node-pty
import * as pty from "node-pty"

// DESPUÉS: Bun.spawn
import { spawn } from "bun"

export async function executeInSandbox(command: string, cwd: string) {
  const proc = spawn({
    cmd: ["bash", "-c", command],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  })

  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  return { stdout, stderr, exitCode }
}
```

#### 6.2 ai-worker → Bun Workers (Días 24-25)

- [ ] Migrar lógica de workers
- [ ] Adaptar colas BullMQ → Redis + Bun
- [ ] Tests de workers

**Entregables FASE 6:**

- [ ] agent-core funcionando con Bun
- [ ] ai-worker funcionando con Bun

---

### FASE 7: Testing y Regresión E2E (Días 26-30)

> **IMPORTANTE:** Esta fase es CRÍTICA para asegurar que el nuevo backend es 100% compatible.

#### 7.0 Setup de Infraestructura de Testing

```
packages/server/
├── tests/
│   ├── e2e/
│   │   ├── auth.e2e.test.ts
│   │   ├── agents.e2e.test.ts
│   │   ├── whatsapp.e2e.test.ts
│   │   └── ...
│   ├── regression/
│   │   ├── recorder/           # Grabador de tráfico
│   │   ├── fixtures/           # Requests grabados
│   │   ├── player/             # Reproductor
│   │   └── comparator/         # Comparador de respuestas
│   └── load/
│       └── benchmark.ts
└── playwright.config.ts
```

#### 7.1 Grabación de Tráfico (Traffic Recording)

**Objetivo:** Capturar requests reales del frontend contra el backend Node.js actual.

```typescript
// tests/regression/recorder/traffic-recorder.ts
import { chromium, Browser, Page, Request } from "playwright"
import { writeFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"

interface RecordedRequest {
  id: string
  timestamp: string
  method: string
  url: string
  path: string
  headers: Record<string, string>
  body?: string
  response: {
    status: number
    headers: Record<string, string>
    body: string
  }
}

export class TrafficRecorder {
  private requests: RecordedRequest[] = []
  private outputPath: string

  constructor(outputDir: string = "./tests/regression/fixtures") {
    this.outputPath = outputDir
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true })
    }
  }

  async recordFlow(flowName: string, flowFn: (page: Page) => Promise<void>) {
    const browser = await chromium.launch()
    const context = await browser.newContext({
      baseURL: process.env.NODE_BACKEND_URL || "http://localhost:3000",
    })

    // Interceptar todas las requests
    await context.route("**/api/**", async (route, request) => {
      const requestData: RecordedRequest = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        method: request.method(),
        url: request.url(),
        path: new URL(request.url()).pathname,
        headers: request.headers(),
        body: request.postData() || undefined,
        response: null as any,
      }

      // Continuar con la request real
      const response = await route.fetch()

      requestData.response = {
        status: response.status(),
        headers: response.headers(),
        body: await response.text(),
      }

      this.requests.push(requestData)

      // Continuar con la respuesta original
      await route.fulfill({ response })
    })

    const page = await context.newPage()

    try {
      // Ejecutar el flujo de usuario
      await flowFn(page)
    } finally {
      await browser.close()
    }

    // Guardar requests grabadas
    const filename = join(this.outputPath, `${flowName}.json`)
    writeFileSync(filename, JSON.stringify(this.requests, null, 2))
    console.log(`✅ Grabados ${this.requests.length} requests en ${filename}`)

    return this.requests
  }
}
```

**Flujos a grabar:**

```typescript
// tests/regression/recorder/record-flows.ts
import { TrafficRecorder } from "./traffic-recorder"
import { Page } from "playwright"

const recorder = new TrafficRecorder()

// Flujo 1: Autenticación completa
async function authFlow(page: Page) {
  await page.goto("/login")
  await page.fill('input[name="email"]', "test@example.com")
  await page.fill('input[name="password"]', "password123")
  await page.click('button[type="submit"]')
  await page.waitForURL("**/dashboard")
}

// Flujo 2: CRUD de agentes
async function agentsFlow(page: Page) {
  await page.goto("/dashboard/agents")
  await page.click('button:has-text("Nuevo Agente")')
  await page.fill('input[name="name"]', "Agente Test")
  await page.fill('textarea[name="description"]', "Descripción test")
  await page.click('button[type="submit"]')
  await page.waitForSelector(".agent-created")
}

// Flujo 3: Chat con agente
async function chatFlow(page: Page) {
  await page.goto("/dashboard/agents/123/chat")
  await page.fill('input[name="message"]', "Hola, ¿cómo estás?")
  await page.click('button[type="submit"]')
  await page.waitForSelector(".message-response")
}

// Flujo 4: Configuración WhatsApp
async function whatsappFlow(page: Page) {
  await page.goto("/dashboard/whatsapp")
  await page.click('button:has-text("Nueva Configuración")')
  await page.fill('input[name="phoneNumberId"]', "123456789")
  await page.fill('input[name="accessToken"]', "test-token")
  await page.click('button[type="submit"]')
}

// Flujo 5: Billing
async function billingFlow(page: Page) {
  await page.goto("/dashboard/billing")
  await page.click('button:has-text("Cambiar Plan")')
  await page.click('button:has-text("PRO")')
  await page.waitForSelector(".subscription-updated")
}

// Ejecutar todas las grabaciones
async function recordAllFlows() {
  console.log("🎬 Iniciando grabación de tráfico...\n")

  await recorder.recordFlow("auth", authFlow)
  await recorder.recordFlow("agents", agentsFlow)
  await recorder.recordFlow("chat", chatFlow)
  await recorder.recordFlow("whatsapp", whatsappFlow)
  await recorder.recordFlow("billing", billingFlow)

  console.log("\n✅ Grabación completada")
}

recordAllFlows()
```

**Ejecutar grabación:**

```bash
# Asegurar que el backend Node.js está corriendo
cd packages/backend && npm run dev

# En otra terminal, grabar tráfico
cd packages/server
bun run tests/regression/recorder/record-flows.ts
```

#### 7.2 Reproducción contra Nuevo Backend (Traffic Replay)

```typescript
// tests/regression/player/traffic-player.ts
import { readFileSync, readdirSync } from "fs"
import { join } from "path"

interface ReplayResult {
  requestId: string
  path: string
  method: string
  nodeStatus: number
  bunStatus: number
  nodeBody: any
  bunBody: any
  match: boolean
  differences: string[]
}

export class TrafficPlayer {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async replayRequest(request: RecordedRequest): Promise<ReplayResult> {
    const differences: string[] = []

    // Hacer la request al nuevo backend
    const bunResponse = await fetch(`${this.baseUrl}${request.path}`, {
      method: request.method,
      headers: {
        ...request.headers,
        // Ajustar headers si es necesario
        host: new URL(this.baseUrl).host,
      },
      body: request.body,
    })

    const bunBody = await bunResponse.text()
    const nodeBody = request.response.body

    // Comparar status
    if (bunResponse.status !== request.response.status) {
      differences.push(`Status: Node=${request.response.status}, Bun=${bunResponse.status}`)
    }

    // Comparar body (normalizado)
    const nodeJson = this.tryParseJson(nodeBody)
    const bunJson = this.tryParseJson(bunBody)

    if (nodeJson && bunJson) {
      const bodyDiff = this.compareJson(nodeJson, bunJson)
      differences.push(...bodyDiff)
    } else if (nodeBody !== bunBody) {
      differences.push("Body content differs")
    }

    return {
      requestId: request.id,
      path: request.path,
      method: request.method,
      nodeStatus: request.response.status,
      bunStatus: bunResponse.status,
      nodeBody: nodeJson || nodeBody,
      bunBody: bunJson || bunBody,
      match: differences.length === 0,
      differences,
    }
  }

  private tryParseJson(body: string): any | null {
    try {
      return JSON.parse(body)
    } catch {
      return null
    }
  }

  private compareJson(expected: any, actual: any, path = ""): string[] {
    const differences: string[] = []

    // Ignorar campos dinámicos
    const ignoreFields = ["createdAt", "updatedAt", "id", "token", "sessionId"]

    if (typeof expected !== typeof actual) {
      differences.push(`${path}: type mismatch (${typeof expected} vs ${typeof actual})`)
      return differences
    }

    if (typeof expected === "object" && expected !== null) {
      const allKeys = new Set([...Object.keys(expected), ...Object.keys(actual)])

      for (const key of allKeys) {
        if (ignoreFields.includes(key)) continue

        const expectedValue = expected[key]
        const actualValue = actual[key]

        if (!(key in expected)) {
          differences.push(`${path}.${key}: missing in expected`)
        } else if (!(key in actual)) {
          differences.push(`${path}.${key}: missing in actual`)
        } else if (typeof expectedValue === "object") {
          differences.push(...this.compareJson(expectedValue, actualValue, `${path}.${key}`))
        } else if (expectedValue !== actualValue) {
          differences.push(`${path}.${key}: ${expectedValue} vs ${actualValue}`)
        }
      }
    }

    return differences
  }

  async replayAllFixtures(fixtureDir: string): Promise<ReplayResult[]> {
    const results: ReplayResult[] = []
    const files = readdirSync(fixtureDir).filter((f) => f.endsWith(".json"))

    console.log(`🔄 Reproduciendo ${files.length} fixtures contra ${this.baseUrl}\n`)

    for (const file of files) {
      const requests: RecordedRequest[] = JSON.parse(
        readFileSync(join(fixtureDir, file), "utf-8")
      )

      console.log(`📋 Procesando ${file} (${requests.length} requests)...`)

      for (const request of requests) {
        const result = await this.replayRequest(request)
        results.push(result)

        const icon = result.match ? "✅" : "❌"
        console.log(`  ${icon} ${result.method} ${result.path}`)
        if (!result.match) {
          result.differences.forEach((d) => console.log(`     - ${d}`))
        }
      }
    }

    return results
  }
}
```

**Ejecutar reproducción:**

```typescript
// tests/regression/run-regression.ts
import { TrafficPlayer } from "./player/traffic-player"

async function runRegression() {
  const bunBackendUrl = process.env.BUN_BACKEND_URL || "http://localhost:3001"

  const player = new TrafficPlayer(bunBackendUrl)
  const results = await player.replayAllFixtures("./tests/regression/fixtures")

  // Generar reporte
  const passed = results.filter((r) => r.match).length
  const failed = results.filter((r) => !r.match).length
  const total = results.length

  console.log("\n" + "=".repeat(50))
  console.log("📊 REPORTE DE REGRESIÓN")
  console.log("=".repeat(50))
  console.log(`Total:    ${total}`)
  console.log(`✅ Pasó:   ${passed} (${((passed / total) * 100).toFixed(1)}%)`)
  console.log(`❌ Falló:  ${failed} (${((failed / total) * 100).toFixed(1)}%)`)

  if (failed > 0) {
    console.log("\n❌ Requests fallidas:")
    results
      .filter((r) => !r.match)
      .forEach((r) => {
        console.log(`\n${r.method} ${r.path}`)
        r.differences.forEach((d) => console.log(`  - ${d}`))
      })

    process.exit(1)
  }

  console.log("\n✅ Todas las requests son compatibles")
  process.exit(0)
}

runRegression()
```

**Scripts en package.json:**

```json
{
  "scripts": {
    "test:record": "bun run tests/regression/recorder/record-flows.ts",
    "test:replay": "bun run tests/regression/run-regression.ts",
    "test:regression": "bun run test:record && bun run test:replay"
  }
}
```

#### 7.3 Comparación Automática de Respuestas

```typescript
// tests/regression/comparator/response-comparator.ts
export interface ComparisonReport {
  timestamp: string
  summary: {
    total: number
    passed: number
    failed: number
    warnings: number
  }
  details: {
    endpoint: string
    method: string
    status: "PASS" | "FAIL" | "WARN"
    nodeStatus: number
    bunStatus: number
    responseTimeNode: number
    responseTimeBun: number
    differences: string[]
  }[]
}

export function generateReport(results: ReplayResult[]): ComparisonReport {
  const details = results.map((r) => ({
    endpoint: r.path,
    method: r.method,
    status: r.match ? ("PASS" as const) : ("FAIL" as const),
    nodeStatus: r.nodeStatus,
    bunStatus: r.bunStatus,
    responseTimeNode: 0, // TODO: medir
    responseTimeBun: 0,
    differences: r.differences,
  }))

  return {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: results.filter((r) => r.match).length,
      failed: results.filter((r) => !r.match).length,
      warnings: 0,
    },
    details,
  }
}
```

#### 7.4 Tests E2E con Playwright

```typescript
// tests/e2e/auth.e2e.test.ts
import { test, expect } from "@playwright/test"

test.describe("Auth E2E", () => {
  test("login should return valid token", async ({ request }) => {
    const response = await request.post("/api/v1/auth/login", {
      data: {
        email: "test@example.com",
        password: "password123",
      },
    })

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty("token")
    expect(body).toHaveProperty("user")
  })

  test("protected route should require auth", async ({ request }) => {
    const response = await request.get("/api/v1/agents")
    expect(response.status()).toBe(401)
  })

  test("protected route should work with token", async ({ request }) => {
    // Login first
    const loginResponse = await request.post("/api/v1/auth/login", {
      data: {
        email: "test@example.com",
        password: "password123",
      },
    })
    const { token } = await loginResponse.json()

    // Access protected route
    const response = await request.get("/api/v1/agents", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    expect(response.status()).toBe(200)
  })
})
```

#### 7.5 Load Testing Comparativo

```typescript
// tests/load/benchmark.ts
import { spawn } from "bun"

interface BenchmarkResult {
  backend: string
  requestsPerSecond: number
  latencyP50: number
  latencyP95: number
  latencyP99: number
  errors: number
}

async function runBenchmark(
  url: string,
  duration: number = 30,
  connections: number = 100
): Promise<BenchmarkResult> {
  // Usar wrk o autocannon
  const proc = spawn({
    cmd: [
      "wrk",
      `-d${duration}s`,
      `-c${connections}`,
      "-t4",
      "--latency",
      `${url}/api/v1/health`,
    ],
    stdout: "pipe",
    stderr: "pipe",
  })

  const output = await new Response(proc.stdout).text()
  await proc.exited

  // Parsear output de wrk
  const rpsMatch = output.match(/Requests\/sec:\s*([\d.]+)/)
  const p50Match = output.match(/50%\s*([\d.]+)ms/)
  const p95Match = output.match(/95%\s*([\d.]+)ms/)
  const p99Match = output.match(/99%\s*([\d.]+)ms/)

  return {
    backend: url.includes("3000") ? "Node.js" : "Bun",
    requestsPerSecond: parseFloat(rpsMatch?.[1] || "0"),
    latencyP50: parseFloat(p50Match?.[1] || "0"),
    latencyP95: parseFloat(p95Match?.[1] || "0"),
    latencyP99: parseFloat(p99Match?.[1] || "0"),
    errors: 0,
  }
}

async function compareBackends() {
  console.log("🏃 Iniciando benchmark comparativo...\n")

  const nodeResult = await runBenchmark("http://localhost:3000")
  const bunResult = await runBenchmark("http://localhost:3001")

  console.log("📊 Resultados:\n")
  console.log("| Métrica           | Node.js    | Bun        | Mejora   |")
  console.log("|-------------------|------------|------------|----------|")

  const rpsImprovement = (
    ((bunResult.requestsPerSecond - nodeResult.requestsPerSecond) /
      nodeResult.requestsPerSecond) *
    100
  ).toFixed(1)

  console.log(
    `| Req/sec           | ${nodeResult.requestsPerSecond.toFixed(0).padEnd(10)} | ${bunResult.requestsPerSecond.toFixed(0).padEnd(10)} | ${rpsImprovement}%   |`
  )
  console.log(
    `| Latencia P50 (ms) | ${nodeResult.latencyP50.toString().padEnd(10)} | ${bunResult.latencyP50.toString().padEnd(10)} |          |`
  )
  console.log(
    `| Latencia P95 (ms) | ${nodeResult.latencyP95.toString().padEnd(10)} | ${bunResult.latencyP95.toString().padEnd(10)} |          |`
  )
}

compareBackends()
```

#### 7.6 Validación de Datos

```typescript
// tests/regression/validate-data.ts
import { db } from "../src/db"
import { tenants, users, agents } from "../src/db/schema"

async function validateDataIntegrity() {
  console.log("🔍 Validando integridad de datos...\n")

  const errors: string[] = []

  // 1. Verificar tenants
  const tenantsList = await db.select().from(tenants)
  console.log(`✅ Tenants: ${tenantsList.length}`)

  // 2. Verificar usuarios
  const usersList = await db.select().from(users)
  console.log(`✅ Users: ${usersList.length}`)

  // 3. Verificar que cada tenant tiene usuarios
  for (const tenant of tenantsList) {
    const tenantUsers = usersList.filter((u) => u.tenantId === tenant.id)
    if (tenantUsers.length === 0) {
      errors.push(`Tenant ${tenant.id} no tiene usuarios`)
    }
  }

  // 4. Verificar agentes
  const agentsList = await db.select().from(agents)
  console.log(`✅ Agents: ${agentsList.length}`)

  // 5. Verificar referencias
  for (const agent of agentsList) {
    const tenant = tenantsList.find((t) => t.id === agent.tenantId)
    if (!tenant) {
      errors.push(`Agent ${agent.id} referencia tenant inexistente ${agent.tenantId}`)
    }
  }

  if (errors.length > 0) {
    console.log("\n❌ Errores encontrados:")
    errors.forEach((e) => console.log(`  - ${e}`))
    process.exit(1)
  }

  console.log("\n✅ Validación completada sin errores")
}

validateDataIntegrity()
```

**Entregables FASE 7:**

- [ ] Traffic recorder funcionando
- [ ] Flujos principales grabados (auth, agents, chat, whatsapp, billing)
- [ ] Traffic player funcionando
- [ ] 100% requests compatibles (regresión pasa)
- [ ] Tests E2E con Playwright pasando
- [ ] Benchmark comparativo (Bun >= Node.js)
- [ ] Validación de datos pasando

---

### FASE 8: Cleanup y Deploy (Días 29-30)

#### 8.1 Limpieza

```bash
# Eliminar paquetes antiguos
rm -rf packages/backend/
rm -rf packages/ai-worker/
rm -rf packages/opencode-fork/packages/console/core/
```

#### 8.2 Deploy

```bash
# Build de producción
bun run build

# Deploy
bun run deploy
```

#### 8.3 Monitoring

```typescript
// src/monitoring/index.ts
import { logger } from "../utils/logger"

export function setupMonitoring() {
  // Health checks
  setInterval(async () => {
    const health = await checkHealth()
    logger.info("health", health)
  }, 30000)

  // Metrics
  setInterval(async () => {
    const metrics = await collectMetrics()
    logger.info("metrics", metrics)
  }, 60000)
}
```

**Entregables FASE 8:**

- [ ] Código antiguo eliminado
- [ ] Deploy en producción
- [ ] Monitoring funcionando

---

## 7. Timeline Realista (Actualizado)

| Fase | Descripción                                    | Días   | Acumulado |
| ---- | ---------------------------------------------- | ------ | --------- |
| 0    | Preparación + Auditoría + Testing setup        | 1-2    | 2         |
| 1    | Setup + Schemas Drizzle (~45 modelos)          | 3-5    | 5         |
| 2    | Core API (Auth, Tenant, Agents)                | 6-10   | 10        |
| 3    | Módulos de Negocio (WA, Chat, Billing)         | 11-17  | 17        |
| 4    | Módulos Avanzados (Knowledge, Marketplace)     | 18-22  | 22        |
| 5    | Workers + WebSocket + Queue System             | 23-26  | 26        |
| 6    | Migración agent-core + ai-worker               | 27-30  | 30        |
| 7    | Testing Regresión E2E + Validación             | 31-36  | 36        |
| 8    | Cleanup + Deploy + Monitoring                  | 37-40  | 40        |

**Total: ~40 días (8 semanas)**

### Hitos Clave

| Hito | Día | Entregable |
|------|-----|------------|
| 🎯 Hito 1 | 5 | Schemas Drizzle completos |
| 🎯 Hito 2 | 10 | Auth + CRUD básico funcionando |
| 🎯 Hito 3 | 17 | WhatsApp + Chat funcionando |
| 🎯 Hito 4 | 26 | 100% funcionalidad migrada |
| 🎯 Hito 5 | 36 | 100% tests regresión pasando |
| 🎯 Hito 6 | 40 | Deploy en producción |

---

## 7. Fallout Plan Detallado

### 7.1 Estrategia de Rollback por Fase

| Fase | Rollback | Acción |
|------|----------|--------|
| 1-2 | Simple | Mantener Node.js en puerto 3000 |
| 3-4 | Medio | Feature flags para redirigir tráfico |
| 5-6 | Complejo | Blue-green deployment |
| 7-8 | Crítico | Rollback completo a Node.js |

### 7.2 Monitoring y Alertas

```yaml
# monitoring/alerts.yml
alerts:
  - name: high_error_rate
    condition: error_rate > 5%
    action: notify + auto_rollback

  - name: slow_response
    condition: p95_latency > 2000ms
    action: notify

  - name: db_connection_failed
    condition: db_health == false
    action: notify + scale_replicas
```

### 7.3 Checklist de Go/No-Go

**Antes de cada fase:**
- [ ] Tests E2E de fase anterior pasando
- [ ] Performance baseline documentado
- [ ] Rollback plan probado
- [ ] Team notificado

**Antes de deploy final:**
- [ ] 100% tests E2E pasando
- [ ] Load testing satisfactorio
- [ ] Monitoring configurado
- [ ] Rollback plan probado
- [ ] Stakeholders aprobados

---

## 8. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| BullMQ features faltantes | Alta | Medio | Implementar con Redis + ioredis |
| bun-pty incompatibilidad | Media | Alto | Mantener node-pty como fallback |
| Performance menor a Node | Baja | Alto | Benchmark temprano, optimizar |
| Datos perdidos en migración | Baja | Crítico | Backups, clean slate |
| Timeline excedido | Alta | Medio | Fases modulares, priorizar core |

---

## 9. Próximos Pasos Inmediatos

1. **Confirmar este plan actualizado**
2. **Ejecutar FASE 0**: Auditoría y setup de testing
3. **Responder**: ¿Hay datos importantes en MySQL del opencode-fork?
4. **Iniciar FASE 1**: Crear `packages/server/`

---

_Documento actualizado v2 - Migración Node → Bun con PostgreSQL_
_Incluye: Migración de datos, Testing E2E, Timeline realista, Fallout plan_
_Fecha: Marzo 2026_
