# PLAN OFICIAL: Implementación del Modo FULL de Accomplish

**Proyecto:** AgenTo SaaS  
**Objetivo:** Agregar interfaz de chat interactiva tipo Accomplish con herramientas completas  
**Fecha:** 2026-03-11  
**Versión:** 1.0

---

## RESUMEN EJECUTIVO

El objetivo es agregar al SaaS una interfaz de chat interactiva donde los usuarios puedan ejecutar tareas agenticas con herramientas completas (bash, write, edit, read, etc.), similar a Accomplish pero integrado con la infraestructura multi-tenant existente.

### Decisiones Clave Confirmadas:

| Decisión | Selección |
|----------|-----------|
| Acceso al modo FULL | Todos los tenants |
| Workspace persistente | Sí, con límites por cuota |
| Storage | Local (con abstracción para futuro S3) |
| Exceder cuota | Pagar extra por más almacenamiento |
| Políticas de retención | Globales por tipo de archivo |
| Reutilizar UI | shadcn/ui base |

---

## ARQUITECTURA GENERAL

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Next.js)                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  [tenant]/accomplish/page.tsx - Chat principal                 │   │
│  │  [tenant]/accomplish/history/page.tsx - Historial              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ SSE / HTTP
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (Express/NestJS)                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  /modules/accomplish/                                           │   │
│  │  ├── routes/ - Endpoints API                                    │   │
│  │  ├── controllers/ - Lógica HTTP                                 │   │
│  │  ├── services/ - Negocio                                        │   │
│  │  │   ├── AccomplishService - Ejecución de tareas                │   │
│  │  │   ├── PermissionService - Permisos de herramientas          │   │
│  │  │   ├── WorkspaceService - Gestión de archivos                │   │
│  │  │   └── CleanupService - Limpieza automática                  │   │
│  │  └── tools/ - Herramientas dinámicas                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        @agento/agent-core                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  FullModeAdapter - Ejecutor modo FULL                           │   │
│  │  SecurityLayer - Permisos y validación                         │   │
│  │  WorkspaceManager - Gestión de workspace                        │   │
│  │  StorageAdapter (Disk) - Abstracción de storage                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## FASE 1: Infraestructura de Backend

**Duración estimada:** 2 semanas  
**Entregable:** Backend API funcionando para crear y ejecutar tareas

### 1.1 Schema de Base de Datos

**Archivo:** `packages/backend/prisma/schema.prisma`

```prisma
// Agregar al modelo Tenant
model Tenant {
  // ... campos existentes
  workspaceUsed      BigInt   @default(0)
  workspaceItems    Int      @default(0)
  storageQuota      BigInt   @default(1073741824)  // 1GB por defecto
}

// Nuevos modelos
model AccomplishTask {
  id            String    @id @default(uuid())
  tenantId      String
  prompt        String    @db.Text
  status        TaskStatus @default(QUEUED)
  sessionId     String?
  
  // Mensajes y resultados
  messages      Json      @default("[]")
  result        Json?
  error         String?
  
  // Workspace
  workspacePath String?
  
  // Metadatos
  createdAt     DateTime  @default(now())
  startedAt     DateTime?
  completedAt   DateTime?
  
  tenant        Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@index([tenantId])
  @@index([status])
  @@map("accomplish_tasks")
}

enum TaskStatus {
  QUEUED
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

// Workspace files
model WorkspaceFile {
  id            String    @id @default(uuid())
  tenantId      String
  taskId        String?   // null si es archivo del usuario
  
  type          FileType  // USER, TASK, TEMP
  path          String
  name          String
  size          BigInt
  
  expiresAt     DateTime? // Para archivos temporales/tareas
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  @@index([tenantId])
  @@index([tenantId, type])
  @@map("workspace_files")
}

enum FileType {
  USER    // Archivos del usuario (persistentes)
  TASK    // Archivos de tareas (30 días)
  TEMP    // Temporales (se borran al terminar tarea)
}
```

### 1.2 Rutas API

**Archivo:** `packages/backend/src/modules/accomplish/routes/accomplish.routes.ts`

```typescript
// Endpoints necesarios
POST   /api/v1/:tenant/accomplish/tasks          - Crear tarea
GET    /api/v1/:tenant/accomplish/tasks/:id      - Obtener tarea
POST   /api/v1/:tenant/accomplish/tasks/:id/followup - Follow-up
DELETE /api/v1/:tenant/accomplish/tasks/:id      - Cancelar tarea
GET    /api/v1/:tenant/accomplish/tasks/:id/events - SSE stream

// Workspace
GET    /api/v1/:tenant/workspace/usage           - Ver uso
GET    /api/v1/:tenant/workspace/files           - Listar archivos
DELETE /api/v1/:tenant/workspace/files/:id      - Eliminar archivo
POST   /api/v1/:tenant/workspace/files/move     - Mover archivo
POST   /api/v1/:tenant/workspace/cleanup         - Forzar limpieza

// Historial
GET    /api/v1/:tenant/accomplish/history        - Historial de tareas
GET    /api/v1/:tenant/accomplish/history/:id   - Detalle de tarea
```

### 1.3 AccomplishService

**Archivo:** `packages/backend/src/modules/accomplish/services/accomplish.service.ts`

```typescript
class AccomplishService {
  // Crea y ejecuta una tarea
  async executeTask(tenantId: string, prompt: string): Promise<AccomplishTask>
  
  // Follow-up en sesión existente
  async sendFollowUp(taskId: string, message: string): Promise<AccomplishTask>
  
  // Cancela tarea en ejecución
  async cancelTask(taskId: string): Promise<void>
  
  // Obtiene tarea por ID
  async getTask(taskId: string): Promise<AccomplishTask | null>
  
  // Obtiene historial
  async getHistory(tenantId: string, limit?: number): Promise<AccomplishTask[]>
}
```

### 1.4 FullModeAdapter

**Archivo:** `packages/agent-core/src/adapter/FullModeAdapter.ts` (NUEVO)

```typescript
class FullModeAdapter {
  // Ejecuta con TODAS las herramientas permitidas en modo FULL:
  // - bash, write, edit, read, glob, grep, list
  // - webfetch, websearch
  // - execute_code
  // - excel_read, excel_write
  // - sheets_read, sheets_write
  // - knowledge_query
  
  async execute(prompt: string, context: ExecutionContext): Promise<ExecutionResult>
  
  // Streaming de eventos
  on(event: string, handler: EventHandler): void
}
```

---

## FASE 2: UI de Chat Accomplish

**Duración estimada:** 2 semanas  
**Entregable:** Interfaz de chat funcional

### 2.1 Estructura de Rutas

```
packages/frontend/app/[tenant]/
└── accomplish/
    ├── page.tsx           - Chat principal
    ├── layout.tsx         - Layout con sidebar
    ├── history/
    │   └── page.tsx       - Historial de tareas
    └── components/
        ├── ChatInput.tsx
        ├── MessageList.tsx
        ├── MessageBubble.tsx
        ├── ToolProgress.tsx
        ├── PermissionDialog.tsx
        └── DebugPanel.tsx
```

### 2.2 Componentes Principales

| Componente | Descripción | Reutiliza |
|------------|-------------|-----------|
| `ChatInput` | Input de texto con toolbar (skills, send) | shadcn: Input, Button |
| `MessageList` | Lista de mensajes con streaming | shadcn: ScrollArea |
| `MessageBubble` | Burbuja individual (user/assistant/tool) | shadcn: Card |
| `ToolProgress` | Indicador de tool en ejecución | shadcn: Progress |
| `PermissionDialog` | Dialog de permisos | shadcn: Dialog |
| `DebugPanel` | Panel de logs/debug | shadcn: Card |

### 2.3 API Client

**Archivo:** `packages/frontend/lib/accomplish-client.ts`

```typescript
class AccomplishClient {
  createTask(prompt: string): Promise<Task>
  getTask(taskId: string): Promise<Task>
  followUp(taskId: string, message: string): Promise<Task>
  cancelTask(taskId: string): Promise<void>
  
  // SSE para streaming
  subscribeToTask(taskId: string, callbacks: {
    onMessage: (msg) => void
    onTool: (tool) => void
    onPermission: (req) => void
    onComplete: (result) => void
    onError: (err) => void
  }): () => void  // unsubscribe
}
```

---

## FASE 3: Streaming y Tiempo Real

**Duración estimada:** 1 semana  
**Entregable:** Mensajes en tiempo real

### 3.1 Server-Sent Events (SSE)

**Backend:** `packages/backend/src/modules/accomplish/routes/accomplish.routes.ts`

```typescript
// GET /api/v1/:tenant/accomplish/tasks/:id/events
// Content-Type: text/event-stream
//
// Eventos:
// - message: { type: 'message', role: 'user'|'assistant'|'tool', content: string }
// - tool: { type: 'tool', toolName: string, input: object }
// - permission: { type: 'permission', request: PermissionRequest }
// - complete: { type: 'complete', result: TaskResult }
// - error: { type: 'error', error: string }
```

**Frontend:** `packages/frontend/lib/sse-client.ts`

```typescript
// Usar @microsoft/fetch-event-source para SSE
import { fetchEventSource } from '@microsoft/fetch-event-source'

class SSEClient {
  connect(url: string, onMessage: (data) => void): () => void
}
```

### 3.2 Zustand Store

**Archivo:** `packages/frontend/stores/taskStore.ts` (extender)

```typescript
interface AccomplishStore {
  // Estado
  currentTask: Task | null
  messages: Message[]
  isLoading: boolean
  permissionRequest: PermissionRequest | null
  
  // Acciones
  createTask: (prompt: string) => Promise<void>
  followUp: (message: string) => Promise<void>
  cancelTask: () => Promise<void>
  respondToPermission: (decision: 'allow' | 'deny', options?: string[]) => Promise<void>
  
  // Handlers de eventos SSE
  handleTaskEvent: (event: TaskEvent) => void
}
```

---

## FASE 4: Sistema de Permisos y Seguridad

**Duración estimada:** 1 semana  
**Entregable:** Permisos funcionando

### 4.1 PermissionService

**Archivo:** `packages/backend/src/modules/accomplish/services/permission.service.ts`

```typescript
interface PermissionRequest {
  id: string
  taskId: string
  type: 'tool' | 'question' | 'custom'
  toolName?: string
  description: string
  options?: string[]  // Opciones predefinidas
  timeout: number    // ms
}

class PermissionService {
  // Solicita permiso (espera respuesta)
  async requestPermission(tenantId: string, request: PermissionRequest): Promise<PermissionResponse>
  
  // Responde a permiso
  async respond(requestId: string, decision: 'allow' | 'deny', options?: string[]): Promise<void>
  
  // Configuración por tenant
  async getDefaultPermissions(tenantId: string): Promise<PermissionConfig>
  async updateDefaultPermissions(tenantId: string, config: PermissionConfig): Promise<void>
}
```

### 4.2 UI de Permisos

**Archivo:** `packages/frontend/components/accomplish/PermissionDialog.tsx`

- Mostrar qué herramienta quiere ejecutar
- Descripción de lo que hará
- Opciones predefinidas (Allow/Deny)
- Campo para respuesta custom
- Timeout visual (cuenta regresiva)

### 4.3 Seguridad

**Middleware:** `packages/backend/src/modules/accomplish/middleware/security.middleware.ts`

```typescript
// Validaciones:
// 1. Rate limiting por tenant
// 2. Timeout de tareas (max 10 min por defecto)
// 3. Límite de tokens por tarea
// 4. Validación de comandos peligrosos
// 5. Aislamiento de workspaces
```

---

## FASE 5: Skills y Tools

**Duración estimada:** 1 semana  
**Entregable:** Skills disponibles en chat

### 5.1 Integración de Skills

**Archivo:** `packages/backend/src/modules/accomplish/services/skills.service.ts`

```typescript
class SkillsService {
  // Obtiene skills instalados del tenant
  async getInstalledSkills(tenantId: string): Promise<Skill[]>
  
  // Convierte skill a tool para OpenCode
  skillToTool(skill: Skill): Tool
  
  // Ejecuta skill
  async executeSkill(skillId: string, input: object): Promise<object>
}
```

### 5.2 Tools Dinámicas

**Carpeta:** `packages/backend/src/modules/accomplish/tools/`

```typescript
// tools/excel.tools.ts
const excelTools = {
  excel_read: { ... },
  excel_write: { ... }
}

// tools/sheets.tools.ts
const sheetsTools = {
  sheets_read: { ... },
  sheets_write: { ... }
}

// tools/knowledge.tools.ts
const knowledgeTools = {
  knowledge_query: { ... }
}
```

### 5.3 PlusMenu en Frontend

**Archivo:** `packages/frontend/components/accomplish/PlusMenu.tsx`

- Dropdown de skills instalados
- Selector de connectors
- Acceso rápido a settings

---

## FASE 6: Workspace con Cuotas

**Duración estimada:** 1 semana  
**Entregable:** Workspace funcionando con límites

### 6.1 WorkspaceService

**Archivo:** `packages/agent-core/src/tenant/WorkspaceManager.ts` (extender)

```typescript
class WorkspaceManager {
  // Crear workspace para tarea
  async createTaskWorkspace(tenantId: string, taskId: string): Promise<string>
  
  // Paths
  getUserFilesPath(tenantId: string): string
  getTaskPath(tenantId: string, taskId: string): string
  getTempPath(tenantId: string, taskId: string): string
  
  // Limpiar workspace de tarea
  async cleanupTaskWorkspace(taskId: string): Promise<void>
  
  // Calcular uso
  async calculateUsage(tenantId: string): Promise<WorkspaceUsage>
}
```

### 6.2 StorageAdapter (Abstracción)

**Archivo:** `packages/agent-core/src/storage/DiskStorageAdapter.ts` (NUEVO)

```typescript
interface StorageAdapter {
  read(path: string): Promise<Buffer>
  write(path: string, data: Buffer): Promise<void>
  delete(path: string): Promise<void>
  list(prefix: string): Promise<FileInfo[]>
  getSize(path: string): Promise<number>
}

class DiskStorageAdapter implements StorageAdapter {
  constructor(private basePath: string)
}
```

### 6.3 CleanupService

**Archivo:** `packages/backend/src/modules/accomplish/services/cleanup.service.ts`

```typescript
class CleanupService {
  // Job diário de limpieza
  @Cron('0 2 * * *')  // 2am diário
  async runCleanup(): Promise<void> {
    // 1. Limpiar temp/ de tareas terminadas
    // 2. Eliminar tasks/ mayores a 30 días
    // 3. Calcular uso por tenant
    // 4. Notificar si > 80% quota
  }
  
  // Limpiar tarea específica
  async cleanupTask(taskId: string): Promise<void>
  
  // Mover archivo de tarea a usuario
  async moveToUserFiles(taskId: string, filePath: string): Promise<void>
}
```

### 6.4 Políticas de Retención

| Tipo | Ubicación | Retención | Acción al límite |
|------|------------|-----------|------------------|
| USER | `/workspace/{tenant}/user-files/` | Indefinida | Cuenta para quota |
| TASK | `/workspace/{tenant}/tasks/{taskId}/` | 30 días | Auto-delete |
| TEMP | `/workspace/{tenant}/temp/{taskId}/` | Fin de tarea | Auto-delete |

### 6.5 APIs de Gestión

```typescript
// GET /workspace/usage
{
  userFiles: "500MB",
  tasks: "300MB", 
  temp: "10MB",
  quota: "1GB",
  percentUsed: "81%"
}

// GET /workspace/files?type=user
// GET /workspace/files?type=tasks
{
  files: [
    { path: "user-files/script.js", size: "5KB", createdAt: "..." },
    { path: "tasks/task-123/output.txt", size: "10KB", expiresAt: "...", type: "TASK" }
  ]
}
```

---

## FASE 7: Historial y Persistencia

**Duración estimada:** 1 semana  
**Entregable:** Historial funcional

### 7.1 API de Historial

```typescript
// GET /accomplish/history
{
  tasks: [
    { id: "123", prompt: "Genera un script...", status: "COMPLETED", createdAt: "..." },
    { id: "124", prompt: "Analiza datos...", status: "FAILED", createdAt: "..." }
  ],
  total: 50,
  page: 1
}

// GET /accomplish/history/:id
{
  id: "123",
  prompt: "Genera un script...",
  status: "COMPLETED",
  messages: [...],
  result: {...},
  workspacePath: "/workspace/tenant/tasks/task-123"
}
```

### 7.2 UI de Historial

**Página:** `packages/frontend/app/[tenant]/accomplish/history/page.tsx`

- Lista de tareas con filtros (fecha, status)
- Ver detalle de tarea
- Re-ejecutar tarea
- Eliminar tarea
- Descargar resultados

---

## ARCHIVOS A CREAR/MODIFICAR

### Backend - Nuevos

```
packages/backend/src/modules/accomplish/
├── routes/accomplish.routes.ts
├── controllers/accomplish.controller.ts
├── services/
│   ├── accomplish.service.ts
│   ├── permission.service.ts
│   ├── workspace.service.ts
│   ├── cleanup.service.ts
│   └── skills.service.ts
├── middleware/security.middleware.ts
└── tools/
    ├── excel.tools.ts
    ├── sheets.tools.ts
    └── knowledge.tools.ts
```

### Backend - Modificar

```
packages/backend/prisma/schema.prisma      # Agregar modelos
packages/backend/src/modules.ts           # Registrar módulo
packages/backend/src/app.module.ts        # Imports
```

### Agent-Core - Nuevos

```
packages/agent-core/src/
├── adapter/FullModeAdapter.ts
├── storage/DiskStorageAdapter.ts
└── storage/index.ts                      # Export
```

### Agent-Core - Modificar

```
packages/agent-core/src/index.ts          # Exportar nuevos
packages/agent-core/src/security/
    └── security-layer.service.ts        # Extender permisos
```

### Frontend - Nuevos

```
packages/frontend/app/[tenant]/
└── accomplish/
    ├── page.tsx
    ├── layout.tsx
    ├── history/page.tsx
    └── components/
        ├── ChatInput.tsx
        ├── MessageList.tsx
        ├── MessageBubble.tsx
        ├── ToolProgress.tsx
        ├── PermissionDialog.tsx
        ├── DebugPanel.tsx
        └── PlusMenu.tsx
```

### Frontend - Modificar

```
packages/frontend/lib/accomplish-client.ts  # API client
packages/frontend/stores/taskStore.ts       # Zustand store
packages/frontend/app/[tenant]/layout.tsx  # Agregar sidebar item
```

---

## DEPENDENCIAS

### Backend

```bash
npm install @microsoft/fetch-event-source  # SSE client
npm install uuid                            # Generar IDs
```

### Frontend

```bash
npm install @microsoft/fetch-event-source  # SSE client
npm install framer-motion                  # Animaciones
# shadcn/ui - ya debería estar instalado
```

---

## ESTIMACIÓN DE TIEMPO

| Fase | Duración | Acumulado |
|------|----------|-----------|
| FASE 1: Backend | 2 semanas | 2 semanas |
| FASE 2: UI Chat | 2 semanas | 4 semanas |
| FASE 3: Streaming | 1 semana | 5 semanas |
| FASE 4: Permisos | 1 semana | 6 semanas |
| FASE 5: Skills | 1 semana | 7 semanas |
| FASE 6: Workspace | 1 semana | 8 semanas |
| FASE 7: Historial | 1 semana | 9 semanas |

**Total estimado:** 9 semanas

---

## PRIORIDADES DE IMPLEMENTACIÓN

### MVP (Mínimo Producto Viable) - Primeras 4 semanas

1. Schema de BD
2. AccomplishService básico
3. FullModeAdapter
4. UI de chat básica
5. SSE streaming
6. Permisos básicos

### Post-MVP - Semanas 5-9

1. Skills y tools
2. Workspace con cuotas
3. Cleanup service
4. Historial completo
5. Debug panel

---

## NOTAS

- La abstracción de storage (disk → S3) se implementará cuando sea necesario
- Las políticas de retención son configurables por plan (FREE/PRO/ENTERPRISE)
- El modo FULL usa las mismas herramientas que Accomplish referencia
- El sistema de permisos sigue el modelo de Accomplish (allow/deny con timeout)
