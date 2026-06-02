# Arquitectura - Agento SaaS Node.js 100%

## Diagrama General

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENTE EN NAVEGADOR                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐      ┌──────────────────────┐       │
│  │ Chat con Accomplish   │      │   Admin Panel         │       │
│  │ (MODO FULL)           │      │                       │       │
│  └──────────┬───────────┘      └──────────────────────┘       │
│             │                                                   │
│  ┌──────────▼───────────┐                                    │
│  │ Chat Workspace        │                                    │
│  │ - Archivos             │                                    │
│  │ - Integraciones        │                                    │
│  │ - Contexto             │                                    │
│  └───────────────────────┘                                    │
│                          │                                        │
│                          ▼ HTTP/WS                              │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXPRESS API (TypeScript)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              SECURITY LAYER (Middleware)                   │  │
│  │  - Valida modo (FULL vs LIMITED)                            │  │
│  │  - Filtra comandos permitidos                               │  │
│  │  - Sanitiza paths                                          │  │
│  │  - Verifica cuotas                                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              ROUTES /api/v1/*                              │  │
│  │                                                               │  │
│  │  /chat              → ChatController (MODO FULL)             │  │
│  │  /workspace         → WorkspaceController                   │  │
│  │  /whatsapp/webhook  → WebhookController                     │  │
│  │  /whatsapp/agent    → AgentController (MODO LIMITADO)       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                          │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────┐
│  POSTGRESQL       │ │  REDIS       │ │  OPENCODE     │
│  (Prisma ORM)     │ │  (BullMQ)    │ │  (node-pty)   │
│                  │ │              │ │               │
│  tenants         │ │  Colas       │ │  Procesos     │
│  users           │ │  Cache       │ │  aislados     │
│  files           │ │              │ │  por tenant   │
│  contexts        │ │              │ │               │
│  whatsapp_configs│ │              │ │               │
└──────────────────┘ └──────────────┘ └──────────────┘
```

## Flujo de Datos: Chat con Accomplish (MODO FULL)

```
Usuario → Escribe en chat "Investiga X en internet"
   ↓
POST /api/v1/chat/message
   ↓
Security Layer valida MODO FULL
   ↓
OpenCodeExecutor ejecuta:
   - Crea PTY aislado del tenant
   - Ejecuta OpenCode con comando browse_web
   - Captura respuesta
   ↓
Respuesta enviada al WebSocket
   ↓
Frontend actualiza chat UI
```

## Flujo de Datos: Agente WhatsApp (MODO LIMITADO)

```
Cliente WhatsApp → "¿Tienen stock?"
   ↓
Meta WhatsApp Cloud API → Webhook
   ↓
POST /api/v1/whatsapp/webhook/{tenantSlug}
   ↓
Security Layer valida MODO LIMITADO
   ↓
Cola BullMQ: "process-message"
   ↓
WhatsAppWorker toma job:
   - Carga configuración del tenant
   - Ejecuta OpenCode en MODO LIMITADO
   - SOLO permite: knowledge_query, integration_read
   - NO ejecuta código
   ↓
Respuesta generada
   ↓
WhatsApp Cloud API → Enviar respuesta
   ↓
Cliente recibe respuesta
```

## Aislamiento Multi-Tenant

```
TENANT_A                                TENANT_B
┌──────────────────────┐            ┌──────────────────────┐
│ Workspace:            │            │ Workspace:            │
│ /storage/tenants/    │            │ /storage/tenants/    │
│   tenant_a/          │            │   tenant_b/          │
│                      │            │                      │
│ [Archivos propios]    │            │ [Archivos propios]    │
│ [Contexto aislado]    │            │ [Contexto aislado]    │
│ [Integraciones]       │            │ [Integraciones]       │
│                      │            │                      │
│ OpenCode Process A    │            │ OpenCode Process B    │
│ (PTY aislado)         │            │ (PTY aislado)         │
└──────────────────────┘            └──────────────────────┘
        │                                      │
        ▼                                      ▼
  ⛔ NO SE CRUZAN NUNCA ⛔
```

## Seguridad por Capas

### Capa 1: Nivel API (Express)
- Validación de JWT
- Tenant resolution por subdominio/header
- Rate limiting por tenant

### Capa 2: Security Layer
- Validación de MODO (FULL vs LIMITED)
- Filtrado de comandos permitidos
- Sanitización de paths

### Capa 3: OpenCode Executor
- PTY aislado por tenant
- Working directory aislado
- Variables de entorno aisladas

### Capa 4: Base de Datos
- Row-Level Security por tenant_id
- Consultas siempre filtran por tenant

### Capa 5: File System
- Paths forzados dentro de /storage/tenants/{tenantId}
- Sin path traversal posible

## Comandos Permitidos por Modo

| Comando | FULL | LIMITED | Justificación |
|---------|------|---------|----------------|
| execute_code | ✅ | ❌ | Puede ejecutar código arbitrario |
| browse_web | ✅ | ❌ | Navegar internet libremente |
| file_read | ✅ | ❌ | Leer archivos del sistema |
| file_write | ✅ | ❌ | Escribir archivos |
| api_call | ✅ | ❌ | Llamar APIs externas |
| knowledge_query | ✅ | ✅ | Consultar base conocimiento |
| integration_read | ✅ | ✅ | Leer integraciones |
| data_lookup | ✅ | ✅ | Buscar datos en archivos |

## Escalabilidad

```
┌─────────────────────────────────────────────────────────────────┐
│                      ESCALABILIDAD                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Horizontal Scaling:                                            │
│  - API: Múltiples instancias detrás de Nginx                     │
│  - Workers: Múltiples procesos de WhatsApp Worker               │
│  - OpenCode: Un proceso por tenant (aislado)                   │
│                                                                   │
│  Vertical Scaling:                                              │
│  - Database: PostgreSQL con connection pooling                   │
│  - Redis: Master/Slave con pub/sub                              │
│  - Storage: S3/NFS para archivos de tenants                      │
│                                                                   │
│  Optimizaciones:                                                │
│  - Caching en Redis de contextos frecuentes                      │
│  - Queue prioritization por tier                                 │
│  - Database read replicas para queries                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```
