# PLAN MAESTRO: Agente Codificador para AgenTo SaaS

**Fecha:** 2026-03-19
**Versión:** 5.0 (Completo)
**Estado:** EN PROGRESO

---

## ESTADO DE SUB-PLANES

| SP | Descripción | Estado |
|----|-------------|--------|
| **SP-1** | Infraestructura Core | ✅ **COMPLETADO Y FINALIZADO** |
| SP-2 | OpenCode Integration | ⏳ PENDIENTE |
| SP-3 | Tools BASE | ⏳ PENDIENTE |
| SP-4 | Tools SISTEMA | ⏳ PENDIENTE |
| SP-5 | Tools USUARIO | ⏳ PENDIENTE |
| SP-6 | Approval Workflow | ⏳ PENDIENTE |
| SP-7 | Chat con el Agente | ✅ **COMPLETADO** |
| SP-8 | Schedules y Tareas | ⏳ PENDIENTE |
| SP-9 | Logs y Auditoría | ⏳ PENDIENTE |
| SP-10 | Monitoreo de Uso | ⏳ PENDIENTE |
| SP-11 | Templates de Agentes | ⏳ PENDIENTE |
| SP-12 | Frontend - Chat | ⏳ PENDIENTE |
| SP-13 | Frontend - Tools | ⏳ PENDIENTE |
| SP-14 | Frontend - Dashboard | ⏳ PENDIENTE |
| SP-15 | Testing | ⏳ PENDIENTE |

---

## TABLA DE CONTENIDOS

1. [Contexto del Proyecto](#1-contexto-del-proyecto)
2. [Visión del Sistema](#2-visión-del-sistema)
3. [Sub-Planes Detallados](#3-sub-planes-detallados)
   - [SP-1: Infraestructura Core](#sp-1-infraestructura-core)
   - [SP-2: OpenCode Integration](#sp-2-opencode-integration)
   - [SP-3: Tools BASE](#sp-3-tools-base)
   - [SP-4: Tools SISTEMA](#sp-4-tools-sistema)
   - [SP-5: Tools USUARIO](#sp-5-tools-usuario)
   - [SP-6: Approval Workflow](#sp-6-approval-workflow)
   - [SP-7: Chat con el Agente](#sp-7-chat-con-el-agente)
   - [SP-8: Schedules y Tareas](#sp-8-schedules-y-tareas)
   - [SP-9: Logs y Auditoría](#sp-9-logs-y-auditoría)
   - [SP-10: Monitoreo de Uso](#sp-10-monitoreo-de-uso)
   - [SP-11: Templates de Agentes](#sp-11-templates-de-agentes)
   - [SP-12: Frontend - Chat del Agente](#sp-12-frontend---chat-del-agente)
   - [SP-13: Frontend - Gestión de Herramientas](#sp-13-frontend---gestión-de-herramientas)
   - [SP-14: Frontend - Dashboard de Agente](#sp-14-frontend---dashboard-de-agente)
   - [SP-15: Testing e Integración](#sp-15-testing-e-integración)
4. [Grupos de Trabajo](#4-grupos-de-trabajo)
5. [Orquestación](#5-orquestación)
6. [Archivos Completos](#6-archivos-completos)

---

## 1. CONTEXTO DEL PROYECTO

### 1.1 Qué existe ✅

| Componente | Ubicación |
|------------|-----------|
| Código OpenCode copiado | `packages/server/src/lib/opencode/` |
| Stubs básicos | `lsp/`, `server/`, `cli/` |
| API wrapper OpenCode | `lib/opencode/api.ts` |
| Adapter OpenCode | `modules/agent-ai/adapter/OpenCodeRuntimeAdapter.ts` |
| Schemas DB existentes | `agent.ts`, `tool.ts`, `skill.ts` |
| BullMQ + Scheduling | `workers/`, `scheduled-task.ts` |
| WhatsApp | `modules/whatsapp/` |
| Frontend Dashboard | `app/[tenant]/dashboard/` |
| WebSocket | `hooks/useWebSocket.ts` |

### 1.2 Qué falta ❌

| Componente | Descripción | SP |
|------------|-------------|-----|
| ~~Schemas DB~~ | ~~workspaces, db_credentials, agent_sessions, agent_messages~~ | ✅ SP-1 |
| ~~Servicios Core~~ | ~~EncryptionService, WorkspaceManager, CredentialManager~~ | ✅ SP-1 |
| Path aliases OpenCode | 248+ imports rotos | SP-2 |
| Tools BASE | read_file, write_file, bash, glob, grep | SP-3 |
| Tools SISTEMA | http_request, db_query, schedule_task, whatsapp_send, read_url | SP-4 |
| Tools USUARIO | CRUD + sandbox | SP-5 |
| Approval workflow | UI y lógica de approvals | SP-6 |
| Chat UI | Interfaz de chat con el agente | SP-7, SP-12 |
| Logs/Auditoría | Historial detallado | SP-9 |
| Monitoreo de Uso | Métricas y tracking | SP-10 |
| Templates de Agentes | Pre-configurados | SP-11 |
| Dashboard UI | Panel de control | SP-14 |

---

## 2. VISIÓN DEL SISTEMA

```
CLIENTE: "Crea un agente que todos los días a las 9am consulte mi DB
de stock y envíe WhatsApp si hay productos bajo"
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AGENTE CODIFICADOR                             │
│                                                                  │
│  El agente puede:                                                │
│  1. Leer documentación (URL) → tool: read_url                  │
│  2. Conectarse a DB del cliente → tool: db_query                │
│  3. Crear herramientas y código → tools del usuario            │
│  4. Programar tareas (cron) → tool: schedule_task               │
│  5. Enviar WhatsApp → tool: whatsapp_send                       │
│  6. Hacer requests HTTP → tool: http_request                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. SUB-PLANES DETALLADOS

---

### SP-1: Infraestructura Core

**Dependencias:** Ninguna
**Paralelo posible:** NO
**Duración estimada:** 4-6 horas

#### 1.1 Crear tabla workspaces

**Archivo:** `packages/server/src/db/schema/workspace.ts`

```typescript
import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().unique(),
  
  // Ruta del workspace en filesystem
  path: text("path").notNull(),
  
  // Estado
  isActive: boolean("is_active").default(true).notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const workspacesRelations = relations(workspaces, ({ one }) => ({
  tenant: one(tenants, {
    fields: [workspaces.tenantId],
    references: [tenants.id],
  }),
}))

export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert
```

#### 1.2 Crear tabla db_credentials

**Archivo:** `packages/server/src/db/schema/db-credential.ts`

```typescript
import { pgTable, uuid, text, timestamp, json } from "drizzle-orm/pg-core"

export const dbCredentialTypes = ["postgresql", "mysql", "mongodb"] as const
export type DbCredentialType = typeof dbCredentialTypes[number]

export const dbCredentials = pgTable("db_credentials", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  
  // Identificación
  name: text("name").notNull(), // ej: "DB Produccion", "DB Testing"
  
  // Tipo de DB
  type: text("type").notNull(), // postgresql, mysql, mongodb
  
  // Conexión (campos individuales)
  host: text("host").notNull(),
  port: text("port").notNull(),
  database: text("database").notNull(),
  username: text("username").notNull(),
  password: text("password").notNull(), // ENCRIPTADO con AES-256
  
  // Connection string (alternativa, también encriptado)
  connectionString: text("connection_string"), // ENCRIPTADO
  
  // Configuración adicional (SSL, etc.)
  config: json("config").default({}),
  
  // Estado
  isActive: boolean("is_active").default(true).notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export type DbCredential = typeof dbCredentials.$inferSelect
export type NewDbCredential = typeof dbCredentials.$inferInsert
```

#### 1.3 Crear tabla agent_sessions

**Archivo:** `packages/server/src/db/schema/agent-session.ts`

```typescript
import { pgTable, uuid, text, boolean, timestamp, json } from "drizzle-orm/pg-core"

export const agentSessions = pgTable("agent_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id"), // Quién creó la sesión
  
  // Identificación
  title: text("title"), // Título de la sesión
  directory: text("directory"), // Workspace path
  
  // Estado
  isActive: boolean("is_active").default(true).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  
  // Metadatos
  metadata: json("metadata").default({}),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  archivedAt: timestamp("archived_at"),
  
  // Índices
}, (table) => ({
  tenantIdIdx: index("agent_sessions_tenant_id_idx").on(table.tenantId),
  userIdIdx: index("agent_sessions_user_id_idx").on(table.userId),
}))

export type AgentSession = typeof agentSessions.$inferSelect
export type NewAgentSession = typeof agentSessions.$inferInsert
```

#### 1.4 Crear tabla agent_messages

**Archivo:** `packages/server/src/db/schema/agent-message.ts`

```typescript
import { pgTable, uuid, text, timestamp, json } from "drizzle-orm/pg-core"

export const messageRoles = ["user", "assistant", "system", "tool"] as const
export type MessageRole = typeof messageRoles[number]

export const agentMessages = pgTable("agent_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  
  // Contenido
  role: text("role").notNull(), // user, assistant, system, tool
  content: text("content"), // Contenido principal
  
  // Para mensajes de tool
  toolName: text("tool_name"),
  toolInput: json("tool_input"),
  toolOutput: json("tool_output"),
  
  // Parts (para mensajes estructurados)
  parts: json("parts").default([]),
  
  // Metadatos
  metadata: json("metadata").default({}),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  sessionIdIdx: index("agent_messages_session_id_idx").on(table.sessionId),
  tenantIdIdx: index("agent_messages_tenant_id_idx").on(table.tenantId),
}))

export type AgentMessage = typeof agentMessages.$inferSelect
export type NewAgentMessage = typeof agentMessages.$inferInsert
```

#### 1.5 Crear WorkspaceManager service

**Archivo:** `packages/server/src/modules/agent-ai/services/workspace.service.ts`

```typescript
import { db } from "@/db"
import { workspaces } from "@/db/schema/workspace"
import { eq } from "drizzle-orm"
import * as fs from "fs"
import * as path from "path"

export class WorkspaceManager {
  
  /**
   * Obtiene o crea el workspace de un tenant
   */
  async getWorkspace(tenantId: string): Promise<string> {
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.tenantId, tenantId),
    })
    
    if (workspace) {
      return workspace.path
    }
    
    return this.createWorkspace(tenantId)
  }
  
  /**
   * Crea un workspace para un tenant
   */
  async createWorkspace(tenantId: string): Promise<string> {
    const basePath = process.env.WORKSPACES_PATH || "/workspaces"
    const workspacePath = path.join(basePath, tenantId)
    
    // Crear estructura de directorios
    const dirs = [
      "tools",      // Código de herramientas
      "agents",     // Agentes hijos
      "code",       // Código generado
      "temp",       // Archivos temporales
      "logs",       // Logs de ejecución
    ]
    
    for (const dir of dirs) {
      const fullPath = path.join(workspacePath, dir)
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true })
      }
    }
    
    // Guardar en DB
    await db.insert(workspaces).values({
      tenantId,
      path: workspacePath,
      isActive: true,
    })
    
    return workspacePath
  }
  
  /**
   * Elimina el workspace de un tenant
   */
  async deleteWorkspace(tenantId: string): Promise<void> {
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.tenantId, tenantId),
    })
    
    if (!workspace) return
    
    // Eliminar archivos (opcional, según requisitos)
    // fs.rmSync(workspace.path, { recursive: true, force: true })
    
    await db.delete(workspaces).where(eq(workspaces.tenantId, tenantId))
  }
  
  /**
   * Obtiene la ruta de un subdirectorio específico
   */
  getSubPath(workspacePath: string, subDir: string): string {
    return path.join(workspacePath, subDir)
  }
}

export const workspaceManager = new WorkspaceManager()
```

#### 1.6 Crear Encryption service

**Archivo:** `packages/server/src/modules/agent-ai/services/encryption.service.ts`

```typescript
import * as crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex")

export class EncryptionService {
  
  /**
   * Encripta un texto con AES-256-GCM
   */
  encrypt(text: string): string {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      Buffer.from(KEY, "hex"),
      iv
    )
    
    let encrypted = cipher.update(text, "utf8", "hex")
    encrypted += cipher.final("hex")
    
    const authTag = cipher.getAuthTag()
    
    // Formato: iv:authTag:encrypted
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`
  }
  
  /**
   * Desencripta un texto encriptado
   */
  decrypt(encryptedText: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(":")
    
    const iv = Buffer.from(ivHex, "hex")
    const authTag = Buffer.from(authTagHex, "hex")
    
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(KEY, "hex"),
      iv
    )
    
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, "hex", "utf8")
    decrypted += decipher.final("utf8")
    
    return decrypted
  }
  
  /**
   * Encripta credenciales de DB
   */
  encryptCredentials(credentials: {
    host: string
    port: string
    database: string
    username: string
    password: string
    connectionString?: string
  }): {
    host: string
    port: string
    database: string
    username: string
    password: string
    connectionString?: string
  } {
    return {
      ...credentials,
      password: this.encrypt(credentials.password),
      connectionString: credentials.connectionString 
        ? this.encrypt(credentials.connectionString)
        : undefined,
    }
  }
  
  /**
   * Desencripta credenciales de DB
   */
  decryptCredentials(encrypted: {
    password: string
    connectionString?: string
  }): {
    password: string
    connectionString?: string
  } {
    return {
      password: this.decrypt(encrypted.password),
      connectionString: encrypted.connectionString
        ? this.decrypt(encrypted.connectionString)
        : undefined,
    }
  }
}

export const encryptionService = new EncryptionService()
```

#### 1.7 Crear CredentialManager service

**Archivo:** `packages/server/src/modules/agent-ai/services/credential.service.ts`

```typescript
import { db } from "@/db"
import { dbCredentials, type DbCredential, type NewDbCredential } from "@/db/schema/db-credential"
import { eq, and } from "drizzle-orm"
import { encryptionService } from "./encryption.service"

export class CredentialManager {
  
  /**
   * Crea una nueva credencial de DB
   */
  async createCredential(
    tenantId: string,
    data: Omit<NewDbCredential, "id" | "tenantId" | "createdAt" | "updatedAt">
  ): Promise<DbCredential> {
    const encrypted = encryptionService.encryptCredentials({
      host: data.host,
      port: data.port,
      database: data.database,
      username: data.username,
      password: data.password,
      connectionString: data.connectionString ?? undefined,
    })
    
    const [result] = await db.insert(dbCredentials).values({
      tenantId,
      name: data.name,
      type: data.type,
      host: encrypted.host,
      port: encrypted.port,
      database: encrypted.database,
      username: encrypted.username,
      password: encrypted.password,
      connectionString: encrypted.connectionString,
      config: data.config,
    }).returning()
    
    return result
  }
  
  /**
   * Obtiene una credencial desencriptada
   */
  async getCredential(credentialId: string, tenantId: string): Promise<{
    id: string
    name: string
    type: string
    host: string
    port: string
    database: string
    username: string
    password: string
    connectionString?: string
    config: any
  } | null> {
    const cred = await db.query.dbCredentials.findFirst({
      where: and(
        eq(dbCredentials.id, credentialId),
        eq(dbCredentials.tenantId, tenantId)
      ),
    })
    
    if (!cred) return null
    
    const decrypted = encryptionService.decryptCredentials({
      password: cred.password,
      connectionString: cred.connectionString ?? undefined,
    })
    
    return {
      id: cred.id,
      name: cred.name,
      type: cred.type,
      host: cred.host,
      port: cred.port,
      database: cred.database,
      username: cred.username,
      password: decrypted.password,
      connectionString: decrypted.connectionString,
      config: cred.config,
    }
  }
  
  /**
   * Lista todas las credenciales de un tenant
   * (NO incluye passwords desencriptadas)
   */
  async listCredentials(tenantId: string): Promise<DbCredential[]> {
    return db.query.dbCredentials.findMany({
      where: and(
        eq(dbCredentials.tenantId, tenantId),
        eq(dbCredentials.isActive, true)
      ),
    })
  }
  
  /**
   * Elimina una credencial (soft delete)
   */
  async deleteCredential(credentialId: string, tenantId: string): Promise<void> {
    await db.update(dbCredentials)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(dbCredentials.id, credentialId),
        eq(dbCredentials.tenantId, tenantId)
      ))
  }
}

export const credentialManager = new CredentialManager()
```

---

### SP-2: OpenCode Integration

**Dependencias:** Ninguna (inicia en paralelo con SP-1)
**Paralelo posible:** NO (inicia junto SP-1)
**Duración estimada:** 8-12 horas

#### 2.1 Configurar TypeScript

**Archivo:** `packages/server/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "types": ["bun-types"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": "./src",
    "paths": {
      "@/*": ["./*"],
      "@/lib/opencode/*": ["./lib/opencode/*"]
    },
    "outDir": "./dist"
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### 2.2 Copiar paquetes workspace

Desde `E:\opencode-dev\packages\*` copiar:

| Paquete | Destino |
|---------|---------|
| `util/src/*` | `lib/opencode/packages/util/src/` |
| `plugin/src/*` | `lib/opencode/packages/plugin/src/` |
| `sdk/*` | `lib/opencode/packages/sdk/` |
| `script/*` | `lib/opencode/packages/script/` |

#### 2.3 Instalar dependencias faltantes

```bash
cd packages/server
bun add remeda effect chokidar decimal.js fuzzysort ignore jsonc-parser mime-types semver strip-ansi which open turndown vscode-jsonrpc @actions/core @actions/github tree-sitter-bash
```

#### 2.4 Crear stubs

**Archivo:** `packages/server/src/lib/opencode/stubs/bun-pty.ts`

```typescript
// Stub para bun-pty - No se usa para agentes, solo para CLI interactivo
export const pty = {
  spawn: async () => {
    throw new Error("PTY not available in server environment")
  },
}

export type PtyProcess = any
```

**Archivo:** `packages/server/src/lib/opencode/stubs/watcher.ts`

```typescript
// Stub para @parcel/watcher
export const watcher = {
  watch: async () => {
    return { stop: () => {} }
  },
}
```

**Archivo:** `packages/server/src/lib/opencode/stubs/tree-sitter.ts`

```typescript
// Stub para web-tree-sitter
export const Parser = {
  Language: {
    load: async () => ({}),
  },
}
```

#### 2.5 Reescribir api.ts para PostgreSQL

**Archivo:** `packages/server/src/lib/opencode/api-pg.ts`

Este archivo reemplaza la lógica de Database de OpenCode con Drizzle.

```typescript
import { db } from "@/db"
import { agentSessions } from "@/db/schema/agent-session"
import { agentMessages } from "@/db/schema/agent-message"
import { eq } from "drizzle-orm"
import { ulid } from "ulid"

export class PostgresSessionStore {
  
  async create(data: {
    tenantId: string
    title?: string
    directory?: string
    userId?: string
  }) {
    const id = ulid()
    
    await db.insert(agentSessions).values({
      id,
      tenantId: data.tenantId,
      title: data.title,
      directory: data.directory,
      userId: data.userId,
    })
    
    return this.get(id)
  }
  
  async get(id: string) {
    const session = await db.query.agentSessions.findFirst({
      where: eq(agentSessions.id, id),
    })
    return session
  }
  
  async list(tenantId: string, options?: { limit?: number }) {
    return db.query.agentSessions.findMany({
      where: eq(agentSessions.tenantId, tenantId),
      limit: options?.limit,
    })
  }
  
  async addMessage(sessionId: string, message: {
    role: string
    content?: string
    toolName?: string
    toolInput?: any
    toolOutput?: any
    parts?: any[]
  }) {
    const id = ulid()
    
    await db.insert(agentMessages).values({
      id,
      sessionId,
      tenantId: "", // Necesita obtenerse de la sesión
      role: message.role,
      content: message.content,
      toolName: message.toolName,
      toolInput: message.toolInput,
      toolOutput: message.toolOutput,
      parts: message.parts,
    })
    
    return id
  }
  
  async getMessages(sessionId: string) {
    return db.query.agentMessages.findMany({
      where: eq(agentMessages.sessionId, sessionId),
      orderBy: (messages, { asc }) => [asc(messages.createdAt)],
    })
  }
  
  async delete(id: string) {
    await db.delete(agentMessages).where(eq(agentMessages.sessionId, id))
    await db.delete(agentSessions).where(eq(agentSessions.id, id))
  }
}

export const sessionStore = new PostgresSessionStore()
```

#### 2.6 Crear endpoint SSE

**Archivo:** `packages/server/src/modules/agent-ai/routes/event.routes.ts`

```typescript
import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { Bus } from "@/lib/opencode/bus"

export const eventRoutes = new Hono()

eventRoutes.get("/event", async (c) => {
  const sessionId = c.req.query("sessionId")
  
  return streamSSE(c, async (stream) => {
    // Enviar evento de conexión
    await stream.writeSSE({
      data: JSON.stringify({ type: "server.connected", sessionId }),
    })
    
    // Suscribirse a eventos del Bus
    const unsubscribe = Bus.subscribeAll(async (event) => {
      await stream.writeSSE({
        data: JSON.stringify(event),
      })
    })
    
    // Heartbeat cada 30 segundos
    const heartbeat = setInterval(async () => {
      await stream.writeSSE({
        data: JSON.stringify({ type: "server.heartbeat", timestamp: Date.now() }),
      })
    }, 30000)
    
    // Cleanup al cerrar conexión
    c.req.raw.signal.addEventListener("abort", () => {
      unsubscribe()
      clearInterval(heartbeat)
    })
  })
})
```

#### 2.7 Adaptar bash.ts para Bun

**Archivo:** `packages/server/src/lib/opencode/tool/bash.ts`

```typescript
// Adaptación de bash.ts para usar Bun.spawn en vez de child_process

export interface BashTool {
  name: "bash"
  description: "Ejecuta comandos en la terminal"
  
  input: z.object({
    command: z.string().describe("Comando a ejecutar"),
    cwd: z.string().optional().describe("Directorio de trabajo"),
    timeout: z.number().optional().default(30000).describe("Timeout en ms"),
  })
  
  output: z.object({
    stdout: z.string(),
    stderr: z.string(),
    exitCode: z.number(),
  })
}

export async function executeBash(params: {
  command: string
  cwd?: string
  timeout?: number
}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { command, cwd, timeout = 30000 } = params
  
  const [cmd, ...args] = command.split(" ")
  
  const proc = Bun.spawn([cmd, ...args], {
    cwd: cwd || process.cwd(),
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  })
  
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  
  const exitCode = proc.exitCode
  
  return { stdout, stderr, exitCode }
}
```

---

### SP-3: Tools BASE

**Dependencias:** SP-2
**Paralelo posible:** Con SP-4, SP-5
**Duración estimada:** 6-8 horas

#### 3.1 Tool: read_file

**Archivo:** `packages/server/src/lib/opencode/tools/read-file.ts`

```typescript
import * as fs from "fs/promises"
import * as path from "path"

export const readFileTool = {
  name: "read_file",
  description: "Lee el contenido de un archivo",
  
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Ruta del archivo" },
    },
    required: ["path"],
  },
  
  async execute(params: { path: string }, context: ToolContext) {
    const fullPath = path.join(context.workspacePath, params.path)
    
    // Validar que está dentro del workspace
    if (!fullPath.startsWith(context.workspacePath)) {
      throw new Error("Access denied: path outside workspace")
    }
    
    const content = await fs.readFile(fullPath, "utf-8")
    return { content }
  },
}
```

#### 3.2 Tool: write_file

**Archivo:** `packages/server/src/lib/opencode/tools/write-file.ts`

```typescript
import * as fs from "fs/promises"
import * as path from "path"

export const writeFileTool = {
  name: "write_file",
  description: "Crea o sobrescribe un archivo",
  
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Ruta del archivo" },
      content: { type: "string", description: "Contenido del archivo" },
    },
    required: ["path", "content"],
  },
  
  async execute(params: { path: string; content: string }, context: ToolContext) {
    const fullPath = path.join(context.workspacePath, params.path)
    
    // Validar que está dentro del workspace
    if (!fullPath.startsWith(context.workspacePath)) {
      throw new Error("Access denied: path outside workspace")
    }
    
    // Crear directorio padre si no existe
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    
    await fs.writeFile(fullPath, params.content, "utf-8")
    return { success: true, path: params.path }
  },
}
```

#### 3.3 Tool: glob

**Archivo:** `packages/server/src/lib/opencode/tools/glob.ts`

```typescript
import { glob as globFn } from "glob"
import * as path from "path"

export const globTool = {
  name: "glob",
  description: "Busca archivos por patrón",
  
  inputSchema: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Patrón glob (ej: **/*.ts)" },
      cwd: { type: "string", description: "Directorio base" },
    },
    required: ["pattern"],
  },
  
  async execute(params: { pattern: string; cwd?: string }, context: ToolContext) {
    const basePath = params.cwd || context.workspacePath
    
    const files = await globFn(params.pattern, {
      cwd: basePath,
      absolute: false,
    })
    
    return { files, count: files.length }
  },
}
```

#### 3.4 Tool: grep

**Archivo:** `packages/server/src/lib/opencode/tools/grep.ts`

```typescript
import { grep as grepFn } from "fs"
import * as path from "path"

export const grepTool = {
  name: "grep",
  description: "Busca texto en archivos",
  
  inputSchema: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Texto a buscar" },
      path: { type: "string", description: "Ruta o archivo" },
      recursive: { type: "boolean", default: true },
      caseSensitive: { type: "boolean", default: false },
    },
    required: ["pattern", "path"],
  },
  
  async execute(params: {
    pattern: string
    path: string
    recursive?: boolean
    caseSensitive?: boolean
  }, context: ToolContext) {
    // Implementación básica usando grep de sistema
    // En producción usar ripgrep o similar
    
    const results = await grepFn(params.pattern, {
      cwd: context.workspacePath,
      recursive: params.recursive,
    })
    
    return { results }
  },
}
```

#### 3.5 Tool: ToolRegistry

**Archivo:** `packages/server/src/lib/opencode/tools/registry.ts`

```typescript
import { readFileTool } from "./read-file"
import { writeFileTool } from "./write-file"
import { globTool } from "./glob"
import { grepTool } from "./grep"
import { executeBash } from "./bash"

export interface ToolContext {
  workspacePath: string
  tenantId: string
  userId?: string
}

export interface Tool {
  name: string
  description: string
  inputSchema: any
  execute: (params: any, context: ToolContext) => Promise<any>
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map()
  
  constructor() {
    this.register(readFileTool)
    this.register(writeFileTool)
    this.register(globTool)
    this.register(grepTool)
    // bash se maneja aparte por seguridad
  }
  
  register(tool: Tool) {
    this.tools.set(tool.name, tool)
  }
  
  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }
  
  list(): Tool[] {
    return Array.from(this.tools.values())
  }
  
  async execute(name: string, params: any, context: ToolContext): Promise<any> {
    const tool = this.tools.get(name)
    if (!tool) {
      throw new Error(`Tool not found: ${name}`)
    }
    return tool.execute(params, context)
  }
}

export const toolRegistry = new ToolRegistry()
```

---

### SP-4: Tools SISTEMA

**Dependencias:** SP-2
**Paralelo posible:** Con SP-3, SP-5
**Duración estimada:** 6-8 horas

#### 4.1 Tool: http_request

**Archivo:** `packages/server/src/lib/opencode/tools/http-request.ts`

```typescript
export const httpRequestTool = {
  name: "http_request",
  description: "Hace requests HTTP a APIs externas",
  requiresApproval: true,
  
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL del endpoint" },
      method: { 
        type: "string", 
        enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        default: "GET" 
      },
      headers: { type: "object", description: "Headers HTTP" },
      body: { type: "object", description: "Body de la request" },
    },
    required: ["url"],
  },
  
  async execute(params: {
    url: string
    method?: string
    headers?: Record<string, string>
    body?: any
  }) {
    const response = await fetch(params.url, {
      method: params.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...params.headers,
      },
      body: params.body ? JSON.stringify(params.body) : undefined,
    })
    
    const contentType = response.headers.get("content-type")
    let data: any
    
    if (contentType?.includes("application/json")) {
      data = await response.json()
    } else {
      data = await response.text()
    }
    
    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data,
    }
  },
}
```

#### 4.2 Tool: db_query

**Archivo:** `packages/server/src/lib/opencode/tools/db-query.ts`

```typescript
import postgres from "postgres"
import { credentialManager } from "@/modules/agent-ai/services/credential.service"

export const dbQueryTool = {
  name: "db_query",
  description: "Consulta una base de datos externa del cliente",
  requiresApproval: true,
  
  inputSchema: {
    type: "object",
    properties: {
      credentialId: { type: "string", description: "ID de la credencial" },
      query: { type: "string", description: "Query SQL" },
      params: { type: "array", description: "Parámetros del query" },
    },
    required: ["credentialId", "query"],
  },
  
  async execute(params: {
    credentialId: string
    query: string
    params?: any[]
  }, context: { tenantId: string }) {
    // Validar query (solo SELECT)
    const normalizedQuery = params.query.trim().toUpperCase()
    if (!normalizedQuery.startsWith("SELECT")) {
      throw new Error("Only SELECT queries are allowed. For modifications, use approval workflow.")
    }
    
    // Obtener credenciales
    const creds = await credentialManager.getCredential(params.credentialId, context.tenantId)
    if (!creds) {
      throw new Error("Credential not found")
    }
    
    // Conectar y ejecutar
    const sql = postgres({
      host: creds.host,
      port: parseInt(creds.port),
      database: creds.database,
      username: creds.username,
      password: creds.password,
    })
    
    const result = await sql.unsafe(params.query, params.params)
    
    return {
      rows: result,
      rowCount: Array.isArray(result) ? result.length : 0,
    }
  },
}
```

#### 4.3 Tool: schedule_task

**Archivo:** `packages/server/src/lib/opencode/tools/schedule-task.ts`

```typescript
import { Queue } from "bullmq"
import { db } from "@/db"
import { scheduledTasks } from "@/db/schema/scheduled-task"

export const scheduleTaskTool = {
  name: "schedule_task",
  description: "Programa una tarea para ejecutarse periódicamente",
  
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Nombre de la tarea" },
      cron: { type: "string", description: "Expresión cron (ej: '0 9 * * *')" },
      toolName: { type: "string", description: "Tool a ejecutar" },
      toolParams: { type: "object", description: "Parámetros de la tool" },
      timezone: { type: "string", default: "UTC" },
    },
    required: ["name", "cron", "toolName"],
  },
  
  async execute(params: {
    name: string
    cron: string
    toolName: string
    toolParams?: any
    timezone?: string
  }, context: { tenantId: string }) {
    const queue = new Queue("automation", { connection: redis })
    
    // Crear tarea programada
    const [task] = await db.insert(scheduledTasks).values({
      tenantId: context.tenantId,
      name: params.name,
      taskType: "custom",
      taskConfig: {
        toolName: params.toolName,
        toolParams: params.toolParams,
      },
      cronExpression: params.cron,
      timezone: params.timezone || "UTC",
      isActive: true,
    }).returning()
    
    return {
      taskId: task.id,
      name: task.name,
      cron: task.cronExpression,
      nextRun: task.nextRunAt,
    }
  },
}
```

#### 4.4 Tool: whatsapp_send

**Archivo:** `packages/server/src/lib/opencode/tools/whatsapp-send.ts`

```typescript
import { chatService } from "@/modules/chat/services/chat.service"

export const whatsappSendTool = {
  name: "whatsapp_send",
  description: "Envía un mensaje por WhatsApp",
  
  inputSchema: {
    type: "object",
    properties: {
      phone: { type: "string", description: "Número de teléfono" },
      message: { type: "string", description: "Mensaje a enviar" },
      mediaUrl: { type: "string", description: "URL de media (opcional)" },
    },
    required: ["phone", "message"],
  },
  
  async execute(params: {
    phone: string
    message: string
    mediaUrl?: string
  }, context: { tenantId: string }) {
    const result = await chatService.sendMessage({
      tenantId: context.tenantId,
      phoneNumber: params.phone,
      content: params.message,
      type: params.mediaUrl ? "document" : "text",
      metadata: params.mediaUrl ? { url: params.mediaUrl } : undefined,
    })
    
    return {
      success: true,
      messageId: result.id,
    }
  },
}
```

#### 4.5 Tool: read_url

**Archivo:** `packages/server/src/lib/opencode/tools/read-url.ts`

```typescript
import Turndown from "turndown"

const turndown = new Turndown()

export const readUrlTool = {
  name: "read_url",
  description: "Lee el contenido de una URL y lo convierte a markdown",
  
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL a leer" },
    },
    required: ["url"],
  },
  
  async execute(params: { url: string }) {
    const response = await fetch(params.url)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const contentType = response.headers.get("content-type") || ""
    
    if (contentType.includes("text/html")) {
      const html = await response.text()
      const markdown = turndown.turndown(html)
      return { content: markdown, url: params.url }
    }
    
    const text = await response.text()
    return { content: text, url: params.url }
  },
}
```

---

### SP-5: Tools USUARIO

**Dependencias:** SP-2
**Paralelo posible:** Con SP-3, SP-4
**Duración estimada:** 4-6 horas

#### 5.1 Crear tabla user_tools

**Archivo:** `packages/server/src/db/schema/user-tool.ts`

```typescript
import { pgTable, uuid, text, boolean, timestamp, json } from "drizzle-orm/pg-core"

export const userTools = pgTable("user_tools", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  agentId: uuid("agent_id"), // null = tool global del codificador
  
  // Identificación
  name: text("name").notNull(),
  description: text("description"),
  
  // Código ejecutable
  code: text("code").notNull(),
  parameters: json("parameters"), // Schema Zod
  
  // Estado
  isActive: boolean("is_active").default(true).notNull(),
  
  // Metadatos
  metadata: json("metadata").default({}),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdIdx: index("user_tools_tenant_id_idx").on(table.tenantId),
  nameIdx: index("user_tools_name_idx").on(table.name),
}))

export type UserTool = typeof userTools.$inferSelect
export type NewUserTool = typeof userTools.$inferInsert
```

#### 5.2 API CRUD herramientas

**Archivo:** `packages/server/src/modules/agent-ai/routes/tool.routes.ts`

```typescript
import { Hono } from "hono"
import { db } from "@/db"
import { userTools, type NewUserTool } from "@/db/schema/user-tool"
import { eq, and } from "drizzle-orm"

export const toolRoutes = new Hono()

// GET /api/v1/ai/tools - Lista herramientas
toolRoutes.get("/", async (c) => {
  const tenantId = c.get("tenantId")
  
  const tools = await db.query.userTools.findMany({
    where: and(
      eq(userTools.tenantId, tenantId),
      eq(userTools.isActive, true)
    ),
  })
  
  return c.json({ tools })
})

// POST /api/v1/ai/tools - Crear herramienta
toolRoutes.post("/", async (c) => {
  const tenantId = c.get("tenantId")
  const body = await c.req.json()
  
  const [tool] = await db.insert(userTools).values({
    tenantId,
    name: body.name,
    description: body.description,
    code: body.code,
    parameters: body.parameters,
  }).returning()
  
  return c.json({ tool }, 201)
})

// GET /api/v1/ai/tools/:id - Obtener herramienta
toolRoutes.get("/:id", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")
  
  const tool = await db.query.userTools.findFirst({
    where: and(
      eq(userTools.id, id),
      eq(userTools.tenantId, tenantId)
    ),
  })
  
  if (!tool) {
    return c.json({ error: "Tool not found" }, 404)
  }
  
  return c.json({ tool })
})

// PUT /api/v1/ai/tools/:id - Modificar herramienta
toolRoutes.put("/:id", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")
  const body = await c.req.json()
  
  const [tool] = await db.update(userTools)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(and(
      eq(userTools.id, id),
      eq(userTools.tenantId, tenantId)
    ))
    .returning()
  
  if (!tool) {
    return c.json({ error: "Tool not found" }, 404)
  }
  
  return c.json({ tool })
})

// DELETE /api/v1/ai/tools/:id - Eliminar herramienta
toolRoutes.delete("/:id", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")
  
  await db.update(userTools)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(
      eq(userTools.id, id),
      eq(userTools.tenantId, tenantId)
    ))
  
  return c.json({ success: true })
})

// POST /api/v1/ai/tools/:id/execute - Ejecutar herramienta
toolRoutes.post("/:id/execute", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")
  const params = await c.req.json()
  
  const tool = await db.query.userTools.findFirst({
    where: and(
      eq(userTools.id, id),
      eq(userTools.tenantId, tenantId),
      eq(userTools.isActive, true)
    ),
  })
  
  if (!tool) {
    return c.json({ error: "Tool not found" }, 404)
  }
  
  // Ejecutar en sandbox
  const result = await toolExecutor.execute(tool.code, params, {
    tenantId,
    workspacePath: await workspaceManager.getWorkspace(tenantId),
  })
  
  return c.json({ result })
})
```

#### 5.3 Tool Executor (sandbox)

**Archivo:** `packages/server/src/modules/agent-ai/services/tool-executor.service.ts`

```typescript
import { Context } from "vm"

export class ToolExecutor {
  
  /**
   * Ejecuta código JavaScript en un sandbox
   */
  async execute(
    code: string,
    params: any,
    context: { tenantId: string; workspacePath: string }
  ): Promise<any> {
    // Timeout de 30 segundos
    const timeout = 30000
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Execution timeout exceeded"))
      }, timeout)
      
      try {
        // Crear contexto sandbox
        const sandbox = {
          params,
          context,
          result: undefined,
          console: {
            log: (...args: any[]) => console.log("[Tool]", ...args),
            error: (...args: any[]) => console.error("[Tool]", ...args),
          },
          fetch: globalThis.fetch,
          Bun: globalThis.Bun,
        }
        
        // Ejecutar código
        const fn = new Function(
          "params", 
          "context", 
          "console", 
          "fetch", 
          "Bun",
          code
        )
        
        const result = fn(
          params,
          context,
          sandbox.console,
          sandbox.fetch,
          sandbox.Bun
        )
        
        clearTimeout(timeoutId)
        resolve(result)
        
      } catch (error) {
        clearTimeout(timeoutId)
        reject(error)
      }
    })
  }
}

export const toolExecutor = new ToolExecutor()
```

---

### SP-6: Approval Workflow

**Dependencias:** SP-3, SP-4, SP-5
**Paralelo posible:** Con SP-7, SP-8, SP-9, SP-10, SP-11
**Duración estimada:** 4-6 horas

#### 6.1 Crear tabla approval_requests

**Archivo:** `packages/server/src/db/schema/approval-request.ts`

```typescript
import { pgTable, uuid, text, timestamp, json, boolean } from "drizzle-orm/pg-core"

export const approvalStatuses = ["pending", "approved", "rejected", "expired"] as const
export type ApprovalStatus = typeof approvalStatuses[number]

export const approvalRequests = pgTable("approval_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  sessionId: uuid("session_id").notNull(),
  
  // Tool que requiere approval
  toolName: text("tool_name").notNull(),
  toolParams: json("tool_params"),
  
  // Quien lo solicita
  requestedBy: uuid("requested_by"),
  
  // Estado
  status: text("status").default("pending").notNull(),
  
  // Quien lo aprueba/rechaza
  reviewedBy: uuid("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  notes: text("notes"),
  
  // Expiración (default 1 hora)
  expiresAt: timestamp("expires_at"),
  
  // Resultado si se ejecuta
  executionResult: json("execution_result"),
  executionError: text("execution_error"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdIdx: index("approval_requests_tenant_id_idx").on(table.tenantId),
  statusIdx: index("approval_requests_status_idx").on(table.status),
}))

export type ApprovalRequest = typeof approvalRequests.$inferSelect
export type NewApprovalRequest = typeof approvalRequests.$inferInsert
```

#### 6.2 API de approvals

**Archivo:** `packages/server/src/modules/agent-ai/routes/approval.routes.ts`

```typescript
import { Hono } from "hono"
import { db } from "@/db"
import { approvalRequests } from "@/db/schema/approval-request"
import { eq, and } from "drizzle-orm"

export const approvalRoutes = new Hono()

// GET /api/v1/approvals - Lista approvals pendientes
approvalRoutes.get("/", async (c) => {
  const tenantId = c.get("tenantId")
  const status = c.req.query("status") || "pending"
  
  const approvals = await db.query.approvalRequests.findMany({
    where: and(
      eq(approvalRequests.tenantId, tenantId),
      eq(approvalRequests.status, status)
    ),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  })
  
  return c.json({ approvals })
})

// POST /api/v1/approvals/:id/approve
approvalRoutes.post("/:id/approve", async (c) => {
  const tenantId = c.get("tenantId")
  const userId = c.get("userId")
  const id = c.req.param("id")
  const body = await c.req.json()
  
  const [approval] = await db.update(approvalRequests)
    .set({
      status: "approved",
      reviewedBy: userId,
      reviewedAt: new Date(),
      notes: body.notes,
    })
    .where(and(
      eq(approvalRequests.id, id),
      eq(approvalRequests.tenantId, tenantId)
    ))
    .returning()
  
  if (!approval) {
    return c.json({ error: "Approval not found" }, 404)
  }
  
  // Ejecutar la tool
  const result = await toolExecutor.execute(
    approval.toolName,
    approval.toolParams,
    { tenantId }
  )
  
  // Actualizar con resultado
  await db.update(approvalRequests)
    .set({ executionResult: result })
    .where(eq(approvalRequests.id, id))
  
  return c.json({ approval, result })
})

// POST /api/v1/approvals/:id/reject
approvalRoutes.post("/:id/reject", async (c) => {
  const tenantId = c.get("tenantId")
  const userId = c.get("userId")
  const id = c.req.param("id")
  const body = await c.req.json()
  
  const [approval] = await db.update(approvalRequests)
    .set({
      status: "rejected",
      reviewedBy: userId,
      reviewedAt: new Date(),
      notes: body.notes,
    })
    .where(and(
      eq(approvalRequests.id, id),
      eq(approvalRequests.tenantId, tenantId)
    ))
    .returning()
  
  if (!approval) {
    return c.json({ error: "Approval not found" }, 404)
  }
  
  return c.json({ approval })
})
```

---

### SP-7: Chat con el Agente

**Dependencias:** SP-3, SP-4, SP-5
**Paralelo posible:** Con SP-6, SP-8, SP-9, SP-10, SP-11
**Duración estimada:** 6-8 horas

#### 7.1 Endpoint POST /api/v1/ai/execute

**Archivo:** `packages/server/src/modules/agent-ai/routes/ai.routes.ts`

```typescript
// Extender existente con nuevo endpoint

// POST /api/v1/ai/execute
aiRoutes.post("/execute", async (c) => {
  const tenantId = c.get("tenantId")
  const userId = c.get("userId")
  const body = await c.req.json()
  
  const { prompt, sessionId, context } = body
  
  // Obtener o crear sesión
  let session
  if (sessionId) {
    session = await sessionStore.get(sessionId)
    if (!session || session.tenantId !== tenantId) {
      return c.json({ error: "Session not found" }, 404)
    }
  } else {
    session = await sessionStore.create({
      tenantId,
      userId,
      title: prompt.slice(0, 50),
    })
  }
  
  // Guardar mensaje del usuario
  await sessionStore.addMessage(session.id, {
    role: "user",
    content: prompt,
  })
  
  // Ejecutar con OpenCode
  const result = await opencodeRuntimeAdapter.execute(prompt, {
    tenantId,
    sessionId: session.id,
    workspacePath: await workspaceManager.getWorkspace(tenantId),
  })
  
  // Guardar respuesta del asistente
  if (result.content) {
    await sessionStore.addMessage(session.id, {
      role: "assistant",
      content: result.content,
    })
  }
  
  return c.json({
    sessionId: session.id,
    content: result.content,
    toolsUsed: result.toolsUsed,
    messages: result.messages,
  })
})
```

---

### SP-8: Schedules y Tareas

**Dependencias:** SP-4
**Paralelo posible:** Con SP-6, SP-7, SP-9, SP-10, SP-11
**Duración estimada:** 4-6 horas

#### 8.1-8.4 Extender tabla schedules existente

**Archivo:** `packages/server/src/db/schema/scheduled-task.ts`

Ya existe `scheduledTasks`, agregar campos adicionales:

```typescript
// Agregar a scheduledTasks existente
export const scheduledTasks = pgTable("scheduled_tasks", {
  // ... campos existentes ...
  
  // Nuevos campos
  toolId: uuid("tool_id"), // Tool específica a ejecutar
  agentId: uuid("agent_id"), // Agente que ejecuta
  webhookUrl: text("webhook_url"), // URL para notificar resultado
  
  // Configuración de retry
  retryAttempts: integer("retry_attempts").default(3),
  retryDelay: integer("retry_delay").default(60000), // ms
  
  // Notificaciones
  notifyOnSuccess: boolean("notify_on_success").default(false),
  notifyOnFailure: boolean("notify_on_failure").default(true),
})
```

---

### SP-9: Logs y Auditoría

**Dependencias:** SP-3, SP-4, SP-5
**Paralelo posible:** Con SP-6, SP-7, SP-8, SP-10, SP-11
**Duración estimada:** 4-6 horas

#### 9.1 Crear tabla tool_executions

**Archivo:** `packages/server/src/db/schema/tool-execution.ts`

```typescript
export const toolExecutions = pgTable("tool_executions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  sessionId: uuid("session_id"),
  
  // Tool ejecutada
  toolName: text("tool_name").notNull(),
  toolParams: json("tool_params"),
  
  // Resultado
  status: text("status").default("running"), // running, success, failed
  result: json("result"),
  error: text("error"),
  
  // Métricas
  durationMs: integer("duration_ms"),
  
  // Timestamps
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
})

export type ToolExecution = typeof toolExecutions.$inferSelect
```

#### 9.2 Crear tabla audit_logs

**Archivo:** `packages/server/src/db/schema/audit-log.ts`

```typescript
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id"),
  
  // Acción
  action: text("action").notNull(), // create_tool, delete_credential, approve_request, etc.
  
  // Recurso
  resourceType: text("resource_type"), // tool, credential, agent, etc.
  resourceId: text("resource_id"),
  
  // Detalles
  details: json("details").default({}),
  
  // IP/Cliente
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  // Timestamp
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdIdx: index("audit_logs_tenant_id_idx").on(table.tenantId),
  actionIdx: index("audit_logs_action_idx").on(table.action),
}))

export type AuditLog = typeof auditLogs.$inferSelect
```

---

### SP-10: Monitoreo de Uso

**Dependencias:** SP-7
**Paralelo posible:** Con SP-6, SP-8, SP-9, SP-11
**Duración estimada:** 3-4 horas

#### 10.1 Crear tabla usage_metrics

**Archivo:** `packages/server/src/db/schema/usage-metric.ts`

```typescript
export const usageMetrics = pgTable("usage_metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  
  // Tipo de métrica
  metricType: text("metric_type").notNull(), // tokens, requests, storage
  
  // Valor
  value: integer("value").notNull(),
  
  // Contexto
  model: text("model"), // Modelo de AI usado
  sessionId: uuid("session_id"),
  
  // Período
  period: text("period").notNull(), // daily, monthly
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantPeriodIdx: index("usage_metrics_tenant_period_idx")
    .on(table.tenantId, table.period, table.createdAt),
}))

export type UsageMetric = typeof usageMetrics.$inferSelect
```

---

### SP-11: Templates de Agentes

**Dependencias:** SP-3, SP-4, SP-5
**Paralelo posible:** Con SP-6, SP-7, SP-8, SP-9, SP-10
**Duración estimada:** 3-4 horas

#### 11.1 Crear tabla agent_templates

**Archivo:** `packages/server/src/db/schema/agent-template.ts`

```typescript
export const agentTemplates = pgTable("agent_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id"), // null = global
  
  // Identificación
  name: text("name").notNull(),
  description: text("description"),
  
  // Configuración
  type: text("type").notNull(), // MASTER, INTERNAL, EXTERNAL
  systemPrompt: text("system_prompt"),
  instructions: text("instructions"),
  
  // Tools pre-configuradas
  tools: text("tools").array().default([]),
  skills: text("skills").array().default([]),
  
  // Imagen/icono
  icon: text("icon"),
  color: text("color"),
  
  // Estado
  isActive: boolean("is_active").default(true),
  isPublic: boolean("is_public").default(false),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export type AgentTemplate = typeof agentTemplates.$inferSelect
```

#### 11.2 Templates pre-configurados

```typescript
export const DEFAULT_TEMPLATES = [
  {
    name: "Agente de Ventas",
    description: "Ayuda con consultas de productos, precios y procesamiento de pedidos",
    type: "INTERNAL",
    systemPrompt: "Eres un asistente de ventas helpful...",
    tools: ["read_file", "http_request", "whatsapp_send"],
  },
  {
    name: "Agente de Stock",
    description: "Monitorea niveles de inventario y alerta sobre productos bajos",
    type: "INTERNAL",
    systemPrompt: "Eres un asistente de gestión de inventario...",
    tools: ["read_file", "db_query", "schedule_task", "whatsapp_send"],
  },
  {
    name: "Agente de Soporte",
    description: "Responde preguntas frecuentes y crea tickets",
    type: "EXTERNAL",
    systemPrompt: "Eres un agente de soporte técnico...",
    tools: ["read_file", "http_request"],
  },
]
```

---

### SP-12: Frontend - Chat del Agente

**Dependencias:** SP-7
**Paralelo posible:** Con SP-13, SP-14
**Duración estimada:** 6-8 horas

#### 12.1 UI de chat

**Archivo:** `packages/frontend/app/workspace/[tenant]/chat/page.tsx`

```typescript
"use client"

import { useState, useEffect, useRef } from "react"
import { api } from "@/lib/api"
import { storage } from "@/lib/storage"

interface Message {
  id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  toolName?: string
  createdAt: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Auto-scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])
  
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      createdAt: new Date().toISOString(),
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    
    try {
      const token = storage.getItem<string>("token")
      const response = await api.post("/ai/execute", {
        prompt: input,
        sessionId,
      }, token)
      
      setSessionId(response.sessionId)
      
      // Agregar respuesta del asistente
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.content,
        createdAt: new Date().toISOString(),
      }
      
      setMessages(prev => [...prev, assistantMessage])
      
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Lista de mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                msg.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
              Escribiendo...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Escribe un mensaje..."
            className="flex-1 border rounded-lg px-4 py-2"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

### SP-13: Frontend - Gestión de Herramientas

**Dependencias:** SP-5
**Paralelo posible:** Con SP-12, SP-14
**Duración estimada:** 4-6 horas

#### 13.1 UI lista de herramientas

**Archivo:** `packages/frontend/app/workspace/[tenant]/tools/page.tsx`

```typescript
"use client"

import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import { storage } from "@/lib/storage"
import { Plus, Edit, Trash2, Play } from "lucide-react"

interface Tool {
  id: string
  name: string
  description: string
  isActive: boolean
  createdAt: string
}

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    fetchTools()
  }, [])
  
  const fetchTools = async () => {
    try {
      const token = storage.getItem<string>("token")
      const response = await api.get<{ tools: Tool[] }>("/ai/tools", token)
      setTools(response.tools)
    } catch (error) {
      console.error("Error fetching tools:", error)
    } finally {
      setIsLoading(false)
    }
  }
  
  const deleteTool = async (id: string) => {
    if (!confirm("¿Eliminar esta herramienta?")) return
    
    try {
      const token = storage.getItem<string>("token")
      await api.delete(`/ai/tools/${id}`, token)
      setTools(tools.filter(t => t.id !== id))
    } catch (error) {
      console.error("Error deleting tool:", error)
    }
  }
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Mis Herramientas</h1>
        <a
          href="/workspace/[tenant]/tools/new"
          className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg"
        >
          <Plus className="h-4 w-4" />
          Nueva Herramienta
        </a>
      </div>
      
      {isLoading ? (
        <div>Cargando...</div>
      ) : tools.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No tienes herramientas creadas
        </div>
      ) : (
        <div className="grid gap-4">
          {tools.map(tool => (
            <div key={tool.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{tool.name}</h3>
                  <p className="text-sm text-gray-500">{tool.description}</p>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-gray-100 rounded">
                    <Play className="h-4 w-4" />
                  </button>
                  <button className="p-2 hover:bg-gray-100 rounded">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteTool(tool.id)}
                    className="p-2 hover:bg-gray-100 rounded text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

### SP-14: Frontend - Dashboard de Agente

**Dependencias:** SP-10, SP-11
**Paralelo posible:** Con SP-12, SP-13
**Duración estimada:** 4-6 horas

#### 14.1 Panel de control del agente

Extender `packages/frontend/app/[tenant]/dashboard/page.tsx` con:

```typescript
// Agregar sección de Agente Codificador

const agentStats = [
  {
    name: "Sesiones Activas",
    value: "12",
    icon: MessageSquare,
  },
  {
    name: "Herramientas Creadas",
    value: "8",
    icon: Bot,
  },
  {
    name: "Tareas Programadas",
    value: "5",
    icon: Clock,
  },
  {
    name: "Tokens Usados (mes)",
    value: "150K",
    icon: Zap,
  },
]

// Agregar card de Agent Stats
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
  {agentStats.map(stat => (
    <Card key={stat.name}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">{stat.name}</CardTitle>
        <stat.icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{stat.value}</div>
      </CardContent>
    </Card>
  ))}
</div>
```

---

### SP-15: Testing e Integración

**Dependencias:** TODOS los SP anteriores
**Paralelo posible:** NO
**Duración estimada:** 6-8 horas

#### 15.1 Unit tests

```typescript
// packages/server/src/modules/agent-ai/__tests__/workspace.test.ts
describe("WorkspaceManager", () => {
  it("should create workspace directory", async () => {
    const workspace = await workspaceManager.createWorkspace("test-tenant")
    expect(workspace).toContain("test-tenant")
  })
  
  it("should get existing workspace", async () => {
    const workspace1 = await workspaceManager.createWorkspace("test-tenant-2")
    const workspace2 = await workspaceManager.getWorkspace("test-tenant-2")
    expect(workspace1).toBe(workspace2)
  })
})

// packages/server/src/modules/agent-ai/__tests__/encryption.test.ts
describe("EncryptionService", () => {
  it("should encrypt and decrypt", () => {
    const original = "secret-password"
    const encrypted = encryptionService.encrypt(original)
    const decrypted = encryptionService.decrypt(encrypted)
    expect(decrypted).toBe(original)
  })
})
```

#### 15.2 Integration tests

```typescript
// packages/server/src/modules/agent-ai/__tests__/tool-execution.test.ts
describe("Tool Execution", () => {
  it("should execute user tool", async () => {
    const code = `
      return params.value * 2
    `
    const result = await toolExecutor.execute(code, { value: 5 })
    expect(result).toBe(10)
  })
})
```

#### 15.3 E2E tests

```typescript
// packages/e2e/chat-flow.test.ts
describe("Chat Flow", () => {
  it("should send message and receive response", async () => {
    await page.goto("/workspace/test-tenant/chat")
    await page.fill("input[placeholder='Escribe un mensaje...']", "Hola")
    await page.click("button:has-text('Enviar')")
    await expect(page.locator(".bg-blue-500")).toContainText("Hola")
    await expect(page.locator(".bg-gray-100")).toBeVisible()
  })
})
```

---

## 4. GRUPOS DE TRABAJO

### GRUPO A: Infraestructura (SEMANA 1)
| Agente | SP | Descripción |
|--------|-----|-------------|
| AGENTE-A | SP-1 | Infraestructura Core (DB schemas, servicios) |
| AGENTE-B | SP-2 | OpenCode Integration (compilación, typescript) |

### GRUPO B: Herramientas (SEMANA 2)
| Agente | SP | Descripción |
|--------|-----|-------------|
| AGENTE-C | SP-3 | Tools BASE (read, write, bash, glob, grep) |
| AGENTE-D | SP-4 | Tools SISTEMA (http, db_query, schedule, whatsapp) |
| AGENTE-E | SP-5 | Tools USUARIO (CRUD + sandbox) |

### GRUPO C: Features (SEMANA 3)
| Agente | SP | Descripción |
|--------|-----|-------------|
| AGENTE-F | SP-6 | Approval workflow |
| AGENTE-G | SP-7 | Chat con el Agente |
| AGENTE-H | SP-8 | Schedules y Tareas |
| AGENTE-I | SP-9 | Logs y Auditoría |
| AGENTE-J | SP-10 | Monitoreo de Uso |
| AGENTE-K | SP-11 | Templates de Agentes |

### GRUPO D: Frontend (SEMANA 4)
| Agente | SP | Descripción |
|--------|-----|-------------|
| AGENTE-L | SP-12 | Chat UI |
| AGENTE-M | SP-13 | Tools UI |
| AGENTE-N | SP-14 | Dashboard UI |

### GRUPO E: Validación (SEMANA 5)
| Agente | SP | Descripción |
|--------|-----|-------------|
| AGENTE-O | SP-15 | Testing |

---

## 5. ORQUESTACIÓN

```
SEMANA 1 (Días 1-5)
├── AGENTE-A → SP-1: Infraestructura Core
└── AGENTE-B → SP-2: OpenCode Integration

SEMANA 2 (Días 6-10) - PARALELO
├── AGENTE-C → SP-3: Tools BASE
├── AGENTE-D → SP-4: Tools SISTEMA
└── AGENTE-E → SP-5: Tools USUARIO

SEMANA 3 (Días 11-15) - PARALELO
├── AGENTE-F → SP-6: Approval
├── AGENTE-G → SP-7: Chat
├── AGENTE-H → SP-8: Schedules
├── AGENTE-I → SP-9: Logs
├── AGENTE-J → SP-10: Usage
└── AGENTE-K → SP-11: Templates

SEMANA 4 (Días 16-20) - PARALELO
├── AGENTE-L → SP-12: Chat UI
├── AGENTE-M → SP-13: Tools UI
└── AGENTE-N → SP-14: Dashboard UI

SEMANA 5 (Días 21-25)
└── AGENTE-O → SP-15: Testing
```

---

## 6. ARCHIVOS COMPLETOS

### 6.1 Backend - Schemas

| Archivo | SP |
|---------|-----|
| `db/schema/workspace.ts` | SP-1 |
| `db/schema/db-credential.ts` | SP-1 |
| `db/schema/agent-session.ts` | SP-1 |
| `db/schema/agent-message.ts` | SP-1 |
| `db/schema/user-tool.ts` | SP-5 |
| `db/schema/approval-request.ts` | SP-6 |
| `db/schema/tool-execution.ts` | SP-9 |
| `db/schema/audit-log.ts` | SP-9 |
| `db/schema/usage-metric.ts` | SP-10 |
| `db/schema/agent-template.ts` | SP-11 |

### 6.2 Backend - Services

| Archivo | SP |
|---------|-----|
| `modules/agent-ai/services/workspace.service.ts` | SP-1 |
| `modules/agent-ai/services/encryption.service.ts` | SP-1 |
| `modules/agent-ai/services/credential.service.ts` | SP-1 |
| `modules/agent-ai/services/tool-executor.service.ts` | SP-5 |

### 6.3 Backend - Tools

| Archivo | SP |
|---------|-----|
| `lib/opencode/tools/read-file.ts` | SP-3 |
| `lib/opencode/tools/write-file.ts` | SP-3 |
| `lib/opencode/tools/glob.ts` | SP-3 |
| `lib/opencode/tools/grep.ts` | SP-3 |
| `lib/opencode/tools/bash.ts` | SP-3 |
| `lib/opencode/tools/registry.ts` | SP-3 |
| `lib/opencode/tools/http-request.ts` | SP-4 |
| `lib/opencode/tools/db-query.ts` | SP-4 |
| `lib/opencode/tools/schedule-task.ts` | SP-4 |
| `lib/opencode/tools/whatsapp-send.ts` | SP-4 |
| `lib/opencode/tools/read-url.ts` | SP-4 |

### 6.4 Backend - Routes

| Archivo | SP |
|---------|-----|
| `modules/agent-ai/routes/event.routes.ts` | SP-2 |
| `modules/agent-ai/routes/tool.routes.ts` | SP-5 |
| `modules/agent-ai/routes/approval.routes.ts` | SP-6 |
| `modules/agent-ai/routes/ai.routes.ts` | SP-7 |

### 6.5 Frontend

| Archivo | SP |
|---------|-----|
| `app/workspace/[tenant]/chat/page.tsx` | SP-12 |
| `app/workspace/[tenant]/tools/page.tsx` | SP-13 |
| `app/workspace/[tenant]/tools/new/page.tsx` | SP-13 |
| `app/[tenant]/dashboard/page.tsx` (extender) | SP-14 |

---

## HISTORIAL

| Fecha | Versión | Cambio |
|-------|---------|--------|
| 2026-03-19 | 1.0 | Plan inicial creado |
| 2026-03-19 | 2.0 | Agregado plan-resolucion-opencode.md |
| 2026-03-19 | 3.0 | Consolidado en PLAN-MAESTRO-agente-codificador.md |
| 2026-03-19 | 4.0 | Agregados grupos de trabajo para agentes |
| 2026-03-19 | 5.0 | Plan completo con código detallado para cada SP |
