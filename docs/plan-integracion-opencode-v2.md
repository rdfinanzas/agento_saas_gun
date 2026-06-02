# Plan: Integración de OpenCode como Librería en AgenTo SaaS (v2)

## Problema Actual

El SDK (`@opencode-ai/sdk`) ejecuta el CLI como proceso hijo:

```typescript
const proc = spawn(`opencode`, args, {...})
```

Esto NO funciona bien en VPS Linux.

## Solución: Fork + Exports Directos

### Paso 1: Fork del Repo

```bash
git clone https://github.com/anomalyco/opencode.git
cd opencode && bun install
```

### Paso 2: Crear API exports

Crear `packages/opencode/src/api.ts`:

```typescript
import { Server } from "./server/server";
import { Session } from "./session";
import { SessionPrompt } from "./session/prompt";

export class OpenCodeAPI {
  async start(options: { port: number; hostname: string }) {
    return Server.listen(options);
  }

  async createSession(config: { title?: string; agent?: string }) {
    return Session.create(config);
  }

  async executePrompt(sessionID: string, prompt: string, options?: any) {
    return SessionPrompt.prompt({
      sessionID,
      message: { text: prompt },
      ...options,
    });
  }

  async listSessions() {
    return Session.list();
  }
}

export const opencode = new OpenCodeAPI();
```

### Paso 3: Modificar agent-core

```typescript
// packages/agent-core/src/OpenCodeRunner.ts
import { opencode } from "../../../opencode/packages/opencode/src/api";

export class OpenCodeRunner {
  async execute(tenantId: string, prompt: string) {
    const session = await opencode.createSession({
      title: `Tenant:${tenantId}`,
    });
    return opencode.executePrompt(session.id, prompt);
  }
}
```

## Arquitectura

```
VPS Linux:
├── Backend (Tu SaaS)
│   ├── API REST (auth, usuarios, agentes WhatsApp)
│   └── WebSocket
├── OpenCode Fork (importado como paquete)
│   ├── Session Prompt
│   ├── Tools (bash, read, write, grep, etc.)
│   └── Providers (Anthropic, OpenAI, etc.)
└── PostgreSQL + Redis
```

## Multi-Tenant

Estrategia: un directorio por tenant

```typescript
const workspace = `/var/data/agento/tenants/${tenantId}/workspace`;
const session = await Session.create({ directory: workspace });
```

## Modificaciones en el Fork

| Archivo                | Cambio                          |
| ---------------------- | ------------------------------- |
| `src/index.ts`         | Exportar funciones principales  |
| `src/server/server.ts` | Permitir CORS desde tu frontend |

## Tiempo Estimado

- Fork + setup: 1h
- Crear exports en api.ts: 2h
- Modificar agent-core: 3h
- Integrar con WhatsApp: 4h
- Testing: 2h

**Total: ~12 horas**

## Preguntas

1. ¿Fork vs copiar código? (Fork permite updates automáticos)
2. ¿OpenCode en SQLite o PostgreSQL?
3. ¿Cuántos tenants esperás?
4. ¿Necesitás modificar herramientas de OpenCode?
