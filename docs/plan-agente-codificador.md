# Plan: Integración de OpenCode como Agente Codificador

**Fecha:** 2026-03-18
**Última actualización:** 2026-03-18
**Objetivo:** OpenCode como agente codificador que crea/configura otros agentes

---

## RESUMEN DE DECISIONES

| Decisión | Valor |
|----------|-------|
| Código de OpenCode | Copiar TODO, luego eliminar lo que no sirve |
| Limpieza OpenCode | ✅ ELIMINADO: pty, cli, server, lsp, ide, ui, cmd, acp, bin, account, archivos compilados |
| Dependencias binarias | ELIMINAR (pty, lsp, cli, server, etc.) |
| Import | Direct import (no lazy load) |
| MASTER en BD | Sí, cada tenant tiene su propio AgenteCodificador |
| Sandbox | Bun sandbox para ejecutar tools |
| Tools base | En CÓDIGO (read, write, bash, etc.) |
| Tools custom | En BASE DE DATOS |
| Skills | En Base de Datos, solo el agente codificador los crea |
| Herencia | Agents internos heredan tools del codificador + tienen los suyos |
| Tipos | EXTERNOS (no tocan código), INTERNOS (sí tocan código) |
| Creación | Automática al crear tenant |

---

## ESTADO ACTUAL

### Completado ✅
- [x] Código de OpenCode copiado a `server/src/lib/opencode/`
- [x] **LIMPIEZA OpenCode**: eliminados pty, cli, server, lsp, ide, ui, cmd, acp, bin, account, archivos compilados (.js, .d.ts)
- [x] **STUBS creados** para imports eliminados:
  - `lib/opencode/lsp/index.ts` - LSP stub (no-ops)
  - `lib/opencode/server/server.ts` - Server stub (no-ops)
  - `lib/opencode/cli/cmd/tui/event.ts` - CLI TUI event stub (no-ops)
- [x] Schema de agentes en `server/src/db/schema/agent.ts`
- [x] Enums: MASTER, INTERNAL, EXTERNAL, DRAFT, ACTIVE, PAUSED
- [x] Módulo CRUD de agentes en `server/src/modules/agents/`
- [x] Routes de AI en `server/src/modules/agent-ai/routes/`
- [x] Controller AI en `server/src/modules/agent-ai/controllers/`
- [x] Service AI en `server/src/modules/agent-ai/services/`
- [x] `/api/v1/ai` registrado en app.ts
- [x] **Fase 2**: Migrar OpenCodeRuntimeAdapter a lib/opencode (Direct import)
- [x] **Fase 3**: Agregar dependencias de IA al package.json
- [x] **Fase 4**: Crear schema de skills en DB (skill.ts)
- [x] **Fase 5**: Crear schema de tools en DB (tool.ts)
- [x] **Fase 6**: Crear ToolRegistry (carga tools de BD + Bun sandbox)
- [x] **Fase 7**: Crear SkillRegistry (carga skills de BD)
- [x] **Fase 8-11**: AgenteCodificador (MASTER) + herencia de tools + permisos
- [x] **Fase 12-13**: Endpoints del codificador (`/api/v1/ai/coder/*`)

### Pendiente ❌
- [ ] Testing

---

## ARQUITECTURA DEL SISTEMA

### Jerarquía de Agentes

```
Tenant (empresa)
│
├── Agente Codificador (MASTER) ← OpenCode integrado
│   ├── Skills: instrucciones claras para crear agents
│   ├── Tools: TODAS (read, write, bash, edit, glob, grep, etc.)
│   └── Puede: crear agents, crear tools, ejecutar código
│
├── Agente Ventas (INTERNAL) ← hereda tools del codificador
│   ├── Tools propios: consulta_stock, procesa_pago
│   └── Puede: ejecutar código propio
│
├── Agente WhatsApp (EXTERNAL) ← hereda tools del codificador
│   ├── Tools propios: enviar_mensaje, recibir_mensaje
│   └── NO puede: tocar código
│
└── Agente Soporte (EXTERNAL)
    ├── Tools propios: buscar_faq, crear_ticket
    └── NO puede: tocar código
```

### Diferencia entre INTERNAL y EXTERNAL

| Característica | INTERNAL | EXTERNAL |
|---------------|----------|----------|
| Hereda tools del codificador | ✅ | ✅ |
| Tiene tools propios | ✅ | ✅ |
| Puede ejecutar código | ✅ | ❌ |
| Puede crear agents | ❌ | ❌ |
| Puede crear tools | ❌ | ❌ |

---

## FLUJO: Agente Codificador crea nuevo Agent

```
1. Usuario envía prompt:
   "Crea un agente de ventas que consulte stock"

2. Agente Codificador recibe el prompt

3. Busca skill "create_agent"
   → instructions = "Crear agentes especializados..."

4. Analiza: necesito tools de stock, pagos, etc.

5. Crea tools en BD:
   - consulta_stock (con código JavaScript)
   - procesa_pago (con código JavaScript)

6. Crea registro de Agent en BD:
   - name: "Agente Ventas"
   - type: "INTERNAL"
   - parentId: codificador.id
   - skills: [ventas_skill]
   - tools: [consulta_stock, procesa_pago]

7. El nuevo agente hereda tools del codificador
   + tiene sus propias tools

8. Devuelve resultado al usuario
```

---

## SCHEMA DE DATOS

### tools.sql.ts

```typescript
import { pgTable, uuid, text, boolean, timestamp, json } from "drizzle-orm/pg-core"

export const tools = pgTable("tools", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull(),

  // Propietario: null = global del codificador, o agentId específico
  agentId: uuid("agent_id"),  // null = tool global del codificador

  // Identificación
  name: text("name").notNull(),
  description: text("description"),

  // Código ejecutable
  code: text("code").notNull(),  // JavaScript/TypeScript
  parameters: json("parameters").notNull(),  // Zod schema

  // Permisos
  canExecuteCode: boolean("can_execute_code").default(false),
  isSystem: boolean("is_system").default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export type Tool = typeof tools.$inferSelect
export type NewTool = typeof tools.$inferInsert
```

### skills.sql.ts

```typescript
import { pgTable, uuid, text, boolean, timestamp, json } from "drizzle-orm/pg-core"

export const skills = pgTable("skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  agentId: uuid("agent_id"),  // null = skill global del codificador

  name: text("name").notNull(),
  description: text("description"),

  // Instrucciones del skill
  instructions: text("instructions").notNull(),  // Prompt con comportamiento

  // Tools asociadas
  tools: text("tools").array().default([]),

  isSystem: boolean("is_system").default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export type Skill = typeof skills.$inferSelect
export type NewSkill = typeof skills.$inferInsert
```

---

## SKILLS DEL AGENTE CODIFICADOR

```typescript
const CODER_SKILLS = {
  create_agent: {
    description: "Crear nuevos agentes especializados",
    instructions: `Eres el Agente Codificador de AgenTo.
Analiza la documentación proporcionada por el usuario.
Crea agentes con las tools apropiadas para su función.
Guarda todo en la base de datos.`,
  },

  create_tool: {
    description: "Crear herramientas para agents",
    instructions: `Eres el Agente Codificador de AgenTo.
Genera código JavaScript para la tool solicitada.
La tool debe ser segura y auditorable.
Guarda la tool en la base de datos.`,
  },

  configure_agent: {
    description: "Configurar agentes existentes",
    instructions: `Eres el Agente Codificador de AgenTo.
Modifica prompts, tools, y comportamiento de agentes existentes.
Solo modifica agentes del tenant del usuario.`,
  },

  integrate_api: {
    description: "Integrar APIs externas",
    instructions: `Eres el Agente Codificador de AgenTo.
Lee la documentación de la API proporcionada.
Genera código de integración.
Crea una tool que el agente pueda usar.`,
  },
}
```

---

## OPENCODE: CARPETAS A ELIMINAR

| Carpeta/Archivo | Razón |
|-----------------|-------|
| `pty/` | Terminal interactiva (no sirve en VPS) |
| `cli/` | Interface CLI (para humanos) |
| `server/` | Servidor TUI (interface web propia) |
| `lsp/` | Language servers (binarios) |
| `ide/` | Integración IDE |
| `ui.ts` | Interface de usuario |
| `cmd/` | Comandos CLI |
| `bun/` | Bundler para CLI |
| `bin/` | Binarios |

## OPENCODE: CARPETAS A MANTENER

| Carpeta | Razón |
|---------|-------|
| `session/` | Procesamiento de prompts |
| `agent/` | Lógica del agente |
| `provider/` | Conexión con IA (OpenAI, Anthropic, etc.) |
| `tool/` | Sistema de tools (read, write, bash, etc.) |
| `skill/` | Sistema de skills |
| `bus/` | Event bus para comunicación interna |
| `config/` | Configuración |
| `storage/` | Persistencia |
| `project/` | Gestión de proyectos |
| `auth/` | Autenticación IA |
| `effect/` | Effect framework |
| `global/` | Paths y configuración global |
| `util/` | Utilidades |
| `file/` | Manejo de archivos |

---

## ESTRUCTURA DEL PROYECTO

```
server/src/
├── lib/
│   └── opencode/           # Core del agente (limpio)
│       ├── session/        # Procesamiento de prompts
│       ├── agent/          # Lógica del agente
│       ├── provider/       # Todos los providers de IA
│       ├── tool/           # Sistema de tools
│       ├── skill/           # Sistema de skills
│       ├── bus/            # Event bus
│       ├── config/         # Configuración
│       ├── storage/        # Persistencia
│       ├── project/         # Gestión de proyectos
│       ├── auth/            # Autenticación IA
│       ├── effect/          # Effect framework
│       ├── global/          # Paths y configuración
│       ├── util/            # Utilidades
│       └── file/            # Manejo de archivos
│
├── modules/
│   └── agent-ai/
│       ├── routes/
│       │   ├── ai.routes.ts        # Execute, sessions
│       │   └── coder.routes.ts     # Create agent, create tool
│       ├── controllers/
│       │   └── ai.controller.ts
│       └── services/
│           ├── agent-runner.service.ts    # Ejecuta prompts con OpenCode
│           ├── tool-registry.service.ts    # Carga tools desde BD
│           └── skill-registry.service.ts   # Carga skills desde BD
│
└── db/
    └── schema/
        ├── agent.ts     # Ya existe
        ├── tool.ts      # Tools en BD
        └── skill.ts     # Skills en BD
```

---

## DEPENDENCIAS A AGREGAR

```json
{
  "dependencies": {
    "@ai-sdk/openai": "2.x",
    "@ai-sdk/anthropic": "2.x",
    "@ai-sdk/google": "2.x",
    "@ai-sdk/azure": "2.x",
    "@ai-sdk/google-vertex": "2.x",
    "@ai-sdk/amazon-bedrock": "2.x",
    "@ai-sdk/cohere": "2.x",
    "@ai-sdk/groq": "2.x",
    "@ai-sdk/mistral": "2.x",
    "@ai-sdk/perplexity": "2.x",
    "@ai-sdk/xai": "2.x",
    "ai": "3.x",
    "effect": "catalog:",
    "zod": "catalog:",
    "@modelcontextprotocol/sdk": "1.x"
  }
}
```

## DEPENDENCIAS A ELIMINAR

```json
{
  "bun-pty": "0.4.x",           // ❌ Terminal interactiva
  "@parcel/watcher": "2.x",     // ❌ File watching para CLI
  "web-tree-sitter": "0.25.x"   // ❌ LSP
}
```

---

## ENDPOINTS DE API

### /api/v1/ai/execute
Ejecuta un prompt con un agente.

```typescript
POST /api/v1/ai/execute
{
  "agentId": "uuid",
  "prompt": "Crea un reporte de ventas",
  "context": {}
}

Response:
{
  "result": "Aquí está el reporte...",
  "sessionId": "uuid",
  "toolsUsed": ["read_file", "bash"]
}
```

### /api/v1/ai/sessions
Lista sesiones del agente.

```typescript
GET /api/v1/ai/sessions?agentId=uuid
```

### /api/v1/ai/coder/create-agent
El agente codificador crea un nuevo agente.

```typescript
POST /api/v1/ai/coder/create-agent
{
  "name": "Agente de Ventas",
  "type": "INTERNAL",
  "documentation": "文档...",
  "tools": ["consulta_stock", "procesa_pago"]
}
```

### /api/v1/ai/coder/create-tool
El agente codificador crea una nueva tool.

```typescript
POST /api/v1/ai/coder/create-tool
{
  "name": "consulta_stock",
  "description": "Consulta el stock de productos",
  "code": "async function consulta_stock(params, ctx) { ... }",
  "parameters": { "type": "object", "properties": {...} }
}
```

---

## FASES DE IMPLEMENTACIÓN

| Fase | Descripción | Estado |
|------|-------------|--------|
| **1** | Limpiar OpenCode (eliminar pty, cli, server, lsp, ide, ui, bin, cmd, acp, account) | ✅ COMPLETADO |
| **2** | Migrar OpenCodeRuntimeAdapter a lib/opencode (Direct import) | PENDIENTE |
| **3** | Agregar dependencias de IA al package.json | PENDIENTE |
| **4** | Crear schema de skills en DB (skill.ts) | PENDIENTE |
| **5** | Crear schema de tools en DB (tool.ts) | PENDIENTE |
| **6** | Crear ToolRegistry (carga desde BD + Bun sandbox) | PENDIENTE |
| **7** | Crear SkillRegistry (carga desde BD) | PENDIENTE |
| **8** | Crear AgenteCodificador (registro MASTER en BD por tenant) | PENDIENTE |
| **9** | Implementar herencia de tools (INTERNAL hereda del MASTER) | PENDIENTE |
| **10** | Implementar permisos (INTERNAL vs EXTERNAL) | PENDIENTE |
| **11** | Crear skills iniciales del codificador en BD | PENDIENTE |
| **12** | Crear endpoint /api/v1/ai/coder/create-agent | PENDIENTE |
| **13** | Crear endpoint /api/v1/ai/coder/create-tool | PENDIENTE |
| **14** | Testing | PENDIENTE |

---

## NOTES

- El Agente Codificador usa Bun.spawn() para ejecutar comandos
- Bun.spawn() es la terminal a nivel de código (no necesita bun-pty)
- Cada tenant tiene su propio AgenteCodificador (aislado)
- Tools BASE van en CÓDIGO (read, write, bash, etc.)
- Tools CUSTOM van en BASE DE DATOS
- Skills van en BASE DE DATOS
- Bun sandbox para ejecutar código de tools (seguro)
- Solo el agente codificador puede crear tools y skills
- Agentes EXTERNAL no pueden ejecutar código
- Agentes INTERNAL heredan tools del codificador y pueden ejecutar código
- El AgenteCodificador se crea automáticamente al crear un tenant
- Direct import de lib/opencode (no lazy load)

---

## PRÓXIMOS PASOS

1. Ejecutar **FASE 2**: Migrar OpenCodeRuntimeAdapter a lib/opencode
2. Ejecutar **FASE 3**: Agregar dependencias de IA
3. Continuar con las siguientes fases
