# PLAN MAESTRO: Agente Codificador para AgenTo SaaS

**Fecha:** 2026-03-19
**Versión:** 4.0 (Final)
**Estado:** LISTO PARA EJECUTAR

---

## CONTEXTO DEL PROYECTO

### Qué existe ✅
| Componente | Ubicación |
|------------|-----------|
| Código OpenCode copiado | `packages/server/src/lib/opencode/` |
| Stubs básicos | `lsp/`, `server/`, `cli/` |
| API wrapper OpenCode | `lib/opencode/api.ts` |
| Adapter OpenCode | `modules/agent-ai/adapter/OpenCodeRuntimeAdapter.ts` |
| Schemas DB | `agent.ts`, `tool.ts`, `skill.ts` |
| BullMQ + Scheduling | `workers/`, `scheduled-task.ts` |
| WhatsApp | `modules/whatsapp/` |
| Frontend Dashboard | `app/[tenant]/dashboard/` |
| WebSocket | `hooks/useWebSocket.ts` |

### Qué falta ❌
| Componente | Descripción |
|------------|-------------|
| Path aliases OpenCode | 248+ imports rotos |
| Schemas nuevos | workspaces, db_credentials, agent_sessions |
| Tools BASE | read_file, write_file, bash, etc. |
| Tools SISTEMA | http_request, db_query, schedule_task, etc. |
| Chat UI | Interfaz de chat con el agente |
| Approval workflow | UI y lógica de approvals |
| Logs/Auditoría | Historial detallado |

---

## VISIÓN DEL SISTEMA

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CLIENTE: "Crea un agente que todos los días a las 9am consulte mi DB    │
│  de stock y envíe WhatsApp si hay productos bajo"                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AGENTE CODIFICADOR (por tenant)                          │
│                                                                             │
│  El agente:                                                                 │
│  1. Lee la documentación (URL)                                             │
│  2. Se conecta a la DB del cliente (credenciales seguras)                  │
│  3. Crea herramientas y código                                            │
│  4. Programa la tarea (cron via BullMQ)                                    │
│  5. Envía WhatsApp para notificaciones                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## SUB-PLANES

### SP-1: Infraestructura Core
**Dependencias:** Ninguna
**Paralelo posible:** NO
```
1.1 Crear tabla workspaces (path por tenant)
1.2 Crear tabla db_credentials (encriptado AES-256)
1.3 Crear tabla agent_sessions
1.4 Crear tabla agent_messages
1.5 Crear WorkspaceManager service
1.6 Crear CredentialManager service
1.7 Crear servicio de encriptación
```

### SP-2: OpenCode Integration
**Dependencias:** Ninguna (inicia en paralelo con SP-1)
**Paralelo posible:** NO (pero puede iniciar junto SP-1)
```
2.1 Configurar TypeScript (baseUrl + path aliases)
2.2 Copiar paquetes workspace (util, plugin, sdk, script)
2.3 Instalar dependencias faltantes
2.4 Crear stubs (bun-pty, watcher, tree-sitter)
2.5 Reescribir api.ts para PostgreSQL
2.6 Crear endpoint SSE /event
2.7 Adaptar bash.ts para Bun.spawn
```

### SP-3: Sistema de Herramientas BASE
**Dependencias:** SP-2
**Paralelo posible:** Con SP-4, SP-5
```
3.1 Tool: read_file (Bun.file)
3.2 Tool: write_file (Bun.write)
3.3 Tool: edit_file (diff-match-patch)
3.4 Tool: bash (Bun.spawn)
3.5 Tool: glob (glob library)
3.6 Tool: grep (ripgrep)
3.7 Tool: ToolRegistry
```

### SP-4: Herramientas del SISTEMA
**Dependencias:** SP-2
**Paralelo posible:** Con SP-3, SP-5
```
4.1 Tool: http_request (fetch/axios)
4.2 Tool: db_query (pg/mysql2 + credenciales)
4.3 Tool: schedule_task (BullMQ)
4.4 Tool: whatsapp_send (chat.service existente)
4.5 Tool: read_url (fetch + turndown)
4.6 Permission system para tools
```

### SP-5: Registro de Herramientas del USUARIO
**Dependencias:** SP-2
**Paralelo posible:** Con SP-3, SP-4
```
5.1 Crear tabla user_tools
5.2 API CRUD herramientas
5.3 Tool Executor (sandbox Bun)
5.4 Validación de código
```

### SP-6: Workflow de Approval
**Dependencias:** SP-3, SP-4, SP-5
**Paralelo posible:** Con SP-7, SP-8, SP-9, SP-10, SP-11
```
6.1 Crear tabla approval_requests
6.2 API de approvals
6.3 Notificaciones (email/push)
6.4 UI de approvals en frontend
```

### SP-7: Chat con el Agente
**Dependencias:** SP-3, SP-4, SP-5
**Paralelo posible:** Con SP-6, SP-8, SP-9, SP-10, SP-11
```
7.1 Endpoint POST /api/v1/ai/execute
7.2 Endpoint GET /api/v1/ai/sessions
7.3 Guardar mensajes en DB
7.4 Streaming SSE
7.5 UI Chat en frontend
```

### SP-8: Schedules y Tareas
**Dependencias:** SP-4
**Paralelo posible:** Con SP-6, SP-7, SP-9, SP-10, SP-11
```
8.1 Extender tabla schedules existente
8.2 API CRUD schedules
8.3 Worker para ejecución cron
8.4 UI de schedules en frontend
```

### SP-9: Logs y Auditoría
**Dependencias:** SP-3, SP-4, SP-5
**Paralelo posible:** Con SP-6, SP-7, SP-8, SP-10, SP-11
```
9.1 Crear tabla tool_executions
9.2 Crear tabla audit_logs
9.3 API de logs
9.4 UI de logs en frontend
```

### SP-10: Monitoreo de Uso
**Dependencias:** SP-7
**Paralelo posible:** Con SP-6, SP-8, SP-9, SP-11
```
10.1 Crear tabla usage_metrics
10.2 Tracking de tokens
10.3 Tracking de requests
10.4 API de métricas
10.5 Dashboard de uso
```

### SP-11: Templates de Agentes
**Dependencias:** SP-3, SP-4, SP-5
**Paralelo posible:** Con SP-6, SP-7, SP-8, SP-9, SP-10
```
11.1 Crear tabla agent_templates
11.2 Templates pre-configurados
11.3 API CRUD templates
11.4 UI de templates
```

### SP-12: Frontend - Chat del Agente
**Dependencias:** SP-7
**Paralelo posible:** Con SP-13, SP-14
```
12.1 UI de chat (workspace/[tenant]/chat/)
12.2 Lista de sesiones
12.3 Historial de conversación
12.4 Streaming en tiempo real
```

### SP-13: Frontend - Gestión de Herramientas
**Dependencias:** SP-5
**Paralelo posible:** Con SP-12, SP-14
```
13.1 UI lista de herramientas
13.2 UI crear/editar herramienta
13.3 UI ejecutar herramienta
```

### SP-14: Frontend - Dashboard de Agente
**Dependencias:** SP-10, SP-11
**Paralelo posible:** Con SP-12, SP-13
```
14.1 Panel de control del agente
14.2 Stats de uso
14.3 Accesos rápidos
14.4 Notificaciones
```

### SP-15: Testing e Integración
**Dependencias:** TODOS los SP anteriores
**Paralelo posible:** NO
```
15.1 Unit tests
15.2 Integration tests
15.3 E2E tests
15.4 Load testing
```

---

## GRUPOS DE TRABAJO PARA AGENTES

### GRUPO A: Infraestructura (Ejecutar PRIMERO)
| SP | Descripción | Agente |
|----|-------------|--------|
| SP-1 | Infraestructura Core (DB, encriptación, workspaces) | AGENTE-A |
| SP-2 | OpenCode Integration (resuelve 248+ errors) | AGENTE-B |

### GRUPO B: Herramientas (Pueden ejecutar en PARALELO)
| SP | Descripción | Agente |
|----|-------------|--------|
| SP-3 | Tools BASE (read, write, bash, glob, grep) | AGENTE-C |
| SP-4 | Tools SISTEMA (http, db_query, schedule, whatsapp) | AGENTE-D |
| SP-5 | Tools USUARIO (CRUD + sandbox) | AGENTE-E |

### GRUPO C: Features (Pueden ejecutar en PARALELO después de GRUPO B)
| SP | Descripción | Agente |
|----|-------------|--------|
| SP-6 | Approval workflow | AGENTE-F |
| SP-7 | Chat con el Agente | AGENTE-G |
| SP-8 | Schedules y Tareas | AGENTE-H |
| SP-9 | Logs y Auditoría | AGENTE-I |
| SP-10 | Monitoreo de Uso | AGENTE-J |
| SP-11 | Templates de Agentes | AGENTE-K |

### GRUPO D: Frontend (Pueden ejecutar en PARALELO)
| SP | Descripción | Agente |
|----|-------------|--------|
| SP-12 | Chat UI | AGENTE-L |
| SP-13 | Tools UI | AGENTE-M |
| SP-14 | Dashboard UI | AGENTE-N |

### GRUPO E: Validación
| SP | Descripción | Agente |
|----|-------------|--------|
| SP-15 | Testing | AGENTE-O |

---

## ORQUESTACIÓN OPTIMIZADA

```
SEMANA 1 (Días 1-5)
├── AGENTE-A → SP-1: Infraestructura Core
└── AGENTE-B → SP-2: OpenCode Integration (paralelo)

SEMANA 2 (Días 6-10) - GRUPO B en PARALELO
├── AGENTE-C → SP-3: Tools BASE
├── AGENTE-D → SP-4: Tools SISTEMA
└── AGENTE-E → SP-5: Tools USUARIO

SEMANA 3 (Días 11-15) - GRUPO C en PARALELO
├── AGENTE-F → SP-6: Approval
├── AGENTE-G → SP-7: Chat
├── AGENTE-H → SP-8: Schedules
├── AGENTE-I → SP-9: Logs
├── AGENTE-J → SP-10: Usage
└── AGENTE-K → SP-11: Templates

SEMANA 4 (Días 16-20) - GRUPO D en PARALELO
├── AGENTE-L → SP-12: Chat UI
├── AGENTE-M → SP-13: Tools UI
└── AGENTE-N → SP-14: Dashboard UI

SEMANA 5 (Días 21-25)
└── AGENTE-O → SP-15: Testing
```

---

## DIAGRAMA DE DEPENDENCIAS

```
                    ┌─────────────────────────┐
                    │         SP-1           │
                    │    Infraestructura      │
                    │   (AGENTE-A)           │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       │
┌───────────────────┐   ┌───────────────────┐            │
│       SP-2        │   │                   │            │
│  OpenCode (1)    │   │                   │            │
│  (AGENTE-B)      │   │                   │            │
└─────────┬────────┘   │                   │            │
          │             │                   │            │
          └─────────────┼───────────────────┘            │
                        │                               │
        ┌───────────────┼───────────────┐               │
        │               │               │               │
        ▼               ▼               ▼               │
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ │
│     SP-3       │ │     SP-4       │ │     SP-5       │ │
│ Tools BASE     │ │ Tools SISTEMA  │ │ Tools USUARIO │ │
│ (AGENTE-C)     │ │ (AGENTE-D)     │ │ (AGENTE-E)    │ │
└───────┬───────┘ └───────┬───────┘ └───────┬───────┘ │
        │               │               │               │
        └───────────────┼───────────────┘               │
                        │                               │
        ┌───────────────┼───────────────┬───────────────┼───────────────┐
        │               │               │               │               │
        ▼               ▼               ▼               ▼               ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│     SP-6       │ │     SP-7       │ │     SP-8       │ │     SP-9       │ │    SP-11       │
│   Approval     │ │     Chat       │ │   Schedules    │ │     Logs       │ │   Templates    │
│ (AGENTE-F)     │ │ (AGENTE-G)     │ │ (AGENTE-H)     │ │ (AGENTE-I)     │ │ (AGENTE-K)     │
└───────┬───────┘ └───────┬───────┘ └───────────────┘ └───────┬───────┘ └───────────────┘
        │               │                                       │
        │               └───────────────┬───────────────────────┘
        │                               │
        ▼                               ▼
┌───────────────┐               ┌───────────────┐
│    SP-10       │               │    SP-12       │
│    Usage       │               │   Chat UI      │
│ (AGENTE-J)     │               │ (AGENTE-L)     │
└───────┬───────┘               └───────┬───────┘
        │                               │
        └───────────────┬───────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│    SP-13       │ │    SP-14       │ │    SP-15       │
│   Tools UI     │ │   Dashboard    │ │   Testing      │
│ (AGENTE-M)     │ │ (AGENTE-N)     │ │ (AGENTE-O)     │
└───────────────┘ └───────────────┘ └───────────────┘
```

---

## ESTIMACIÓN TOTAL

| Grupo | SP | Horas | Agente |
|-------|-----|-------|--------|
| **Infraestructura** | SP-1, SP-2 | 12-18h | A, B |
| **Herramientas** | SP-3, SP-4, SP-5 | 16-22h | C, D, E |
| **Features** | SP-6, SP-7, SP-8, SP-9, SP-10, SP-11 | 24-34h | F, G, H, I, J, K |
| **Frontend** | SP-12, SP-13, SP-14 | 14-20h | L, M, N |
| **Testing** | SP-15 | 6-8h | O |
| **TOTAL** | 15 SPs | **72-102 horas** | |

---

## ARCHIVOS A CREAR/MODIFICAR

### Backend - Schemas (SP-1)
```
db/schema/workspace.ts          # NUEVO
db/schema/db-credential.ts     # NUEVO
db/schema/agent-session.ts      # NUEVO
db/schema/agent-message.ts      # NUEVO
```

### Backend - Services (SP-1, SP-5)
```
modules/agent-ai/services/
├── workspace.service.ts        # NUEVO
├── credential.service.ts      # NUEVO
├── encryption.service.ts       # NUEVO
└── tool-executor.service.ts    # NUEVO
```

### Backend - Tools (SP-3, SP-4)
```
lib/opencode/tools/
├── read-file.ts               # NUEVO
├── write-file.ts              # NUEVO
├── edit-file.ts               # NUEVO
├── bash.ts                    # MODIFICAR (adaptar Bun)
├── glob.ts                    # NUEVO
├── grep.ts                    # NUEVO
├── http-request.ts            # NUEVO
├── db-query.ts                # NUEVO
├── schedule-task.ts           # NUEVO
├── whatsapp-send.ts           # NUEVO
└── read-url.ts                # NUEVO
```

### Backend - Routes (SP-6, SP-7, SP-8, SP-9, SP-10)
```
modules/agent-ai/routes/
├── approval.routes.ts         # NUEVO
├── credential.routes.ts       # NUEVO
└── schedule.routes.ts         # NUEVO (extender existente)
```

### Frontend (SP-12, SP-13, SP-14)
```
app/workspace/[tenant]/
├── chat/                      # NUEVO
│   ├── page.tsx
│   └── [sessionId]/page.tsx
├── tools/                     # NUEVO
│   ├── page.tsx
│   └── [toolId]/page.tsx
├── schedules/                 # NUEVO
│   └── page.tsx
└── logs/                      # NUEVO
    └── page.tsx

app/[tenant]/
└── approvals/                 # NUEVO
    └── page.tsx
```

---

## CRONOGRAMA SIMPLIFICADO

| Semana | Backend | Frontend | Entregable |
|--------|---------|----------|------------|
| 1 | SP-1, SP-2 | - | OpenCode compila |
| 2 | SP-3, SP-4, SP-5 | - | Todas las tools |
| 3 | SP-6, SP-7, SP-8, SP-9, SP-10, SP-11 | - | Features completos |
| 4 | - | SP-12, SP-13, SP-14 | UI completa |
| 5 | SP-15 | - | Testing OK |

---

## DEFINICIONES

### Agent Types
- **MASTER (Codificador):** 1 por tenant, puede crear tools/agentes
- **INTERNAL:** Hereda tools del codificador, puede ejecutar código
- **EXTERNAL:** NO ejecuta código

### Credentials
- Encriptadas AES-256
- Solo el propietario accede

### Approval Workflow
1. Tool requiere approval
2. Se crea `approval_request`
3. Se notifica al usuario
4. Usuario aprueba/rechaza
5. Se ejecuta y loguea

---

## HISTORIAL

**2026-03-19:** Plan creado consolidando plan-resolucion-opencode.md y PLAN-MAESTRO-agente-codificador.md en un solo plan optimizado para ejecución por múltiples agentes.
