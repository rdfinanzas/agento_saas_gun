# ARQUITECTURA DEL SISTEMA - AgenTo SaaS

**Fecha**: 2026-03-13
**Versión**: 1.0

---

## 1. CLARIFICACIÓN: Accomplish vs Workspace

### Accomplish (Referencia)
- **Ubicación**: `E:\agento-saas-nodejs\accomplish\` (directorio de referencia)
- **Propósito**: Código original de Accomplish para consultar/copiar
- **NO está integrado directamente** en el sistema

### Sistema Implementado
El sistema tiene DOS interfaces para interacción con IA/OpenCode:

| Ruta | Propósito | Backend |
|------|-----------|---------|
| `/[tenant]/workspace` | Chat simple con OpenCode | `/api/v1/workspace` + `/api/v1/chat` |
| `/[tenant]/accomplish` | Sistema completo de tareas agenticas | `/api/v1/:tenant/accomplish` |

---

## 2. DIFERENCIAS: Workspace vs Accomplish

### 2.1 Workspace (`/workspace`)

**Características:**
- Chat simple estilo ChatGPT
- Multi-provider (Anthropic, OpenAI, Google, DeepSeek)
- Contexto persistente
- Archivos y documentos
- Herramientas dinámicas
- Sin sistema de tareas complejas

**Backend:**
```typescript
GET    /api/v1/workspace/structure        # Estructura de archivos
GET    /api/v1/workspace/files            # Listar archivos
GET    /api/v1/workspace/files/:path      # Leer archivo
POST   /api/v1/workspace/files            # Crear/editar
POST   /api/v1/workspace/directories      # Crear directorio
DELETE /api/v1/workspace/items/:path      # Eliminar
POST   /api/v1/workspace/upload           # Subir archivo
POST   /api/v1/workspace/search           # Buscar contenido

GET    /api/v1/chat/context               # Obtener contexto
POST   /api/v1/chat/message               # Enviar mensaje
DELETE /api/v1/chat/context               # Limpiar contexto
```

### 2.2 Accomplish (`/accomplish`)

**Características:**
- Sistema de **tareas agenticas** completas
- Streaming de eventos SSE (Server-Sent Events)
- Sistema de permisos interactivo
- Historial de tareas con re-ejecución
- Seguimiento de progreso de herramientas
- Workspace aislado por tarea
- Follow-ups en conversaciones
- Cuotas de almacenamiento

**Backend:**
```typescript
// Tareas
POST   /api/v1/:tenant/accomplish/tasks               # Crear tarea
GET    /api/v1/:tenant/accomplish/tasks/:id           # Obtener tarea
POST   /api/v1/:tenant/accomplish/tasks/:id/followup  # Follow-up
POST   /api/v1/:tenant/accomplish/tasks/:id/reexecute # Re-ejecutar
DELETE /api/v1/:tenant/accomplish/tasks/:id           # Eliminar
DELETE /api/v1/:tenant/accomplish/tasks/:id/cancel    # Cancelar
GET    /api/v1/:tenant/accomplish/tasks/:id/events    # Streaming SSE
GET    /api/v1/:tenant/accomplish/tasks/:id/results   # Resultados
GET    /api/v1/:tenant/accomplish/tasks/:id/export    # Exportar

// Historial
GET    /api/v1/:tenant/accomplish/history             # Listar tareas
GET    /api/v1/:tenant/accomplish/history/:id         # Detalle tarea

// Permisos
POST   /api/v1/:tenant/accomplish/permissions/:requestId/respond  # Responder permiso
GET    /api/v1/:tenant/accomplish/permissions/config               # Config permisos
PUT    /api/v1/:tenant/accomplish/permissions/config               # Actualizar config

// Workspace
GET    /api/v1/:tenant/accomplish/workspace/usage    # Uso de almacenamiento
GET    /api/v1/:tenant/accomplish/workspace/files    # Listar archivos
DELETE /api/v1/:tenant/accomplish/workspace/files/:id # Eliminar archivo
POST   /api/v1/:tenant/accomplish/workspace/cleanup   # Forzar limpieza
```

---

## 3. FLUJO DE USUARIO: Accomplish

### 3.1 Crear Tarea

```
Usuario escribe prompt en /accomplish
       ↓
Frontend: createTask({ prompt })
       ↓
Backend: POST /accomplish/tasks
       ↓
AccomplishService.createTask()
       ↓
OpenCode CLI execution (modo FULL)
       ↓
Streaming de eventos (SSE)
       ↓
Frontend recibe eventos:
- thought (pensamiento)
- tool_use (herramienta usada)
- tool_progress (progreso)
- checkpoint (punto de control)
- result (resultado)
       ↓
Task completada → historial
```

### 3.2 Sistema de Permisos

```
OpenCode necesita permiso
       ↓
Evento: request_permission
       ↓
Frontend: PermissionDialog
       ↓
Usuario responde (allow/deny)
       ↓
Backend: POST /permissions/:requestId/respond
       ↓
OpenCode continúa con respuesta
```

### 3.3 Workspace por Tarea

```
Cada tarea tiene su workspace aislado:

storage/tenants/{tenantId}/
├── user-files/          # Archivos persistentes del usuario
├── tasks/
│   └── {taskId}/        # Workspace de la tarea
│       ├── input/       # Archivos de entrada
│       ├── output/      # Archivos generados
│       └── temp/        # Archivos temporales
└── temp/
    └── {taskId}/        # Temporales de la tarea

Gestión de cuotas:
- Tenant.storageQuota: límite total
- WorkspaceFile: tracking en BD
- cleanupExpiredFiles(): job programado
```

---

## 4. COMPONENTES FRONTEND

### 4.1 Estructura de Accomplish Frontend

```
packages/frontend/
├── app/[tenant]/accomplish/
│   ├── page.tsx                    # Página principal
│   ├── layout.tsx                  # Layout específico
│   ├── history/
│   │   ├── page.tsx                # Listado historial
│   │   └── [taskId]/
│   │       └── page.tsx            # Detalle tarea
│
├── components/accomplish/
│   ├── MessageList.tsx             # Lista de mensajes
│   ├── ChatInput.tsx               # Input de chat
│   ├── PermissionDialog.tsx        # Diálogo de permisos
│   ├── ToolProgress.tsx            # Progreso de herramientas
│   ├── TaskHistory.tsx             # Historial de tareas
│   └── TaskDetail.tsx              # Detalle de tarea
│
├── stores/
│   └── taskStore.ts                # Zustand store para Accomplish
│
└── lib/
    └── accomplish-client.ts        # Cliente API Accomplish
```

### 4.2 Store de Accomplish (Zustand)

```typescript
interface AccomplishState {
  // Estado
  messages: Message[]
  currentTask: Task | null
  isProcessing: boolean
  permissionRequest: PermissionRequest | null
  error: string | null

  // Acciones
  createTask: (params: CreateTaskParams) => Promise<void>
  followUp: (message: string) => Promise<void>
  cancelTask: () => Promise<void>
  respondToPermission: (decision, options?, customResponse?) => Promise<void>
  clearError: () => void
}
```

---

## 5. OPENCODE INTEGRATION

### 5.1 Adaptadores

```typescript
modules/opencode/adapters/
├── opencode.adapter.ts          # Adaptador principal
├── whatsapp.adapter.ts          # Adaptador para WhatsApp (LIMITED)
└── opencode-chat.adapter.ts     # Adaptador para chat simple
```

### 5.2 Modos de Ejecución

| Modo | Descripción | Uso |
|------|-------------|-----|
| **FULL** | Todas las herramientas disponibles | `/accomplish`, `/workspace` |
| **LIMITED** | Solo conocimiento preconfigurado | Agentes WhatsApp |

```typescript
// Ejemplo FULL (Accomplish)
const adapter = new OpenCodeAdapter({
  mode: 'FULL',
  allowedTools: ['bash', 'write', 'edit', 'read', 'glob', 'grep', ...],
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514'
});

// Ejemplo LIMITED (WhatsApp)
const adapter = new WhatsAppAdapter({
  mode: 'LIMITED',
  allowedTools: [],  // Solo conocimiento
  knowledgeBase: knowledgeEntries
});
```

---

## 6. ARQUITECTURA DE DATOS

### 6.1 Modelos Prisma Relevantes

```prisma
model AccomplishTask {
  id            String        @id
  tenantId      String
  userId        String

  prompt        String
  status        TaskStatus    @default(PENDING)

  workspacePath String?
  result        String?       @db.Text

  startedAt     DateTime?
  completedAt   DateTime?

  tokensUsed    Int?
  toolsUsed     String[]

  messages      Message[]
  files         WorkspaceFile[]

  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}

model WorkspaceFile {
  id          String      @id
  tenantId    String
  taskId      String?

  name        String
  path        String
  size        BigInt
  type        FileType

  expiresAt   DateTime?

  createdAt   DateTime    @default(now())
}

enum FileType {
  USER          # Archivos persistentes del usuario
  TASK          # Archivos generados por tarea
  TEMP          # Archivos temporales
}

enum TaskStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

---

## 7. MAPA DE RUTAS COMPLETO

### Frontend
```
/login                           ✅ Auth
/[tenant]/dashboard              ✅ Dashboard general
/[tenant]/workspace              ✅ Chat simple (modo FULL)
/[tenant]/accomplish             ✅ Tareas agenticas completas
/[tenant]/accomplish/history     ✅ Historial de tareas
/[tenant]/agents                 ✅ Agentes WhatsApp
/[tenant]/conversations          ✅ Monitor conversaciones
/[tenant]/analytics              ✅ Métricas y KPIs
/[tenant]/integrations           ✅ Conectores API
/[tenant]/billing                ✅ Suscripciones
/[tenant]/marketplace            ✅ Skills marketplace
/[tenant]/training               ✅ Modo sandbox
/[tenant]/automations            ✅ Tareas programadas
/[tenant]/approvals              ✅ Aprobaciones pendientes
/[tenant]/settings               ✅ Configuración tenant
```

### Backend
```
/api/v1/auth/*                   ✅ Autenticación
/api/v1/chat/*                   ✅ Chat simple
/api/v1/workspace/*              ✅ Filesystem operations
/api/v1/:tenant/accomplish/*     ✅ Tareas agenticas
/api/v1/opencode/*               ✅ OpenCode providers & tools
/api/v1/whatsapp/*               ✅ Agentes + conversaciones
/api/v1/analytics/*              ✅ Métricas
/api/v1/billing/*                ✅ Pagos
/api/v1/knowledge/*              ✅ Embeddings + búsqueda
/api/v1/integrations/*           ✅ Excel + Sheets
/api/v1/admin/*                  ✅ Administración sistema
```

---

## 8. RESUMEN TÉCNICO

| Aspecto | Workspace | Accomplish |
|---------|-----------|------------|
| **Complejidad** | Simple | Avanzado |
| **Persistencia** | Contexto chat | Tareas en BD |
| **Streaming** | WebSocket | SSE |
| **Permisos** | No | Sí (interactivo) |
| **Historial** | No | Sí (completo) |
| **Workspace** | Compartido | Aislado por tarea |
| **Re-ejecución** | No | Sí |
| **Cuotas** | No | Sí |
| **Export** | No | Sí |

---

## 9. CONCLUSIÓN

El sistema tiene **dos formas de interactuar con IA**:

1. **`/workspace`** - Para consultas rápidas y trabajo con archivos (estilo ChatGPT)
2. **`/accomplish`** - Para tareas complejas que requieren tracking, permisos, y persistencia

Ambos usan el **mismo core de OpenCode** pero con diferentes niveles de abstracción.
