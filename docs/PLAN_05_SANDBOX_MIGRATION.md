# PLAN #5: Migrar Sandbox a @agento/agent-core

**Proyecto:** AgenTo SaaS  
**Problema:** Sandbox/Simulator usa `OpenCodeExecutorService` (viejo) en lugar de `@agento/agent-core`  
**Severidad:** ALTA  
**Fecha:** 2026-03-11

---

## 1. Diagnóstico del Problema

### Estado Actual

En `simulator.service.ts` línea 83:
```typescript
// PROBLEMA: Usa ejecutor viejo
this.adapter = new WhatsAppAdapter(new OpenCodeExecutorService());
```

En `automation.worker.ts` línea 35:
```typescript
// PROBLEMA: Usa ejecutor viejo
this.adapter = new WhatsAppAdapter(new OpenCodeExecutorService());
```

En `agent-identity.controller.ts` línea 13:
```typescript
// PROBLEMA: Usa ejecutor viejo
private adapter = new WhatsAppAdapter(new OpenCodeExecutorService());
```

### Impacto

- Inconsistencia entre Sandbox y producción
- Código duplicado (dos ejecutores diferentes)
- Mantenimiento más difícil
- Posibles bugs en uno que no existen en otro

---

## 2. Solución Propuesta

### Migrar de `OpenCodeExecutorService` a `@agento/agent-core`

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ANTES (Dualidad)                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   WhatsAppAgentService    →  @agento/agent-core  (PRODUCCIÓN)      │
│   SimulatorService       →  OpenCodeExecutorService (SANDBOX)      │
│   AutomationWorker       →  OpenCodeExecutorService (AUTO)         │
│   AgentIdentityService   →  OpenCodeExecutorService (IDENTITY)     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        DESPUÉS (Unificado)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   WhatsAppAgentService    →  @agento/agent-core  ✓                 │
│   SimulatorService       →  @agento/agent-core  ✓                 │
│   AutomationWorker       →  @agento/agent-core  ✓                 │
│   AgentIdentityService   →  @agento/agent-core  ✓                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Plan de Implementación

### 3.1 Verificar qué ofrece @agento/agent-core

Revisar `packages/agent-core/src/index.ts` para confirmar que tiene lo necesario:
- WhatsAppAdapter (ya existe)
- Herramientas necesarias
- Streaming de eventos

### 3.2 Actualizar SimulatorService

**Archivo:** `packages/backend/src/modules/opencode/services/simulator.service.ts`

```typescript
// ANTES:
import { WhatsAppAdapter } from '../adapters/whatsapp.adapter';
import { OpenCodeExecutorService } from '../services/opencode-executor.service';

// DESPUÉS:
import { WhatsAppAdapter } from '@agento/agent-core';
// No necesita OpenCodeExecutorService - WhatsAppAdapter ya lo incluye
```

**Cambio línea 83:**
```typescript
// ANTES:
this.adapter = new WhatsAppAdapter(new OpenCodeExecutorService());

// DESPUÉS:
this.adapter = new WhatsAppAdapter(); // @agento/agent-core maneja internamente
```

### 3.3 Actualizar AutomationWorker

**Archivo:** `packages/backend/src/modules/opencode/workers/automation.worker.ts`

```typescript
// ANTES:
import { WhatsAppAdapter } from '../adapters/whatsapp.adapter';
import { OpenCodeExecutorService } from '../services/opencode-executor.service';

// DESPUÉS:
import { WhatsAppAdapter } from '@agento/agent-core';

// Cambiar línea 35:
this.adapter = new WhatsAppAdapter();
```

### 3.4 Actualizar AgentIdentityController

**Archivo:** `packages/backend/src/modules/opencode/controllers/agent-identity.controller.ts`

```typescript
// ANTES:
import { WhatsAppAdapter } from '../adapters/whatsapp.adapter';
import { OpenCodeExecutorService } from '../services/opencode-executor.service';

// DESPUÉS:
import { WhatsAppAdapter } from '@agento/agent-core';

// Cambiar línea 13:
private adapter = new WhatsAppAdapter();
```

### 3.5 Deprecate OpenCodeExecutorService

**Archivo:** `packages/backend/src/modules/opencode/services/opencode-executor.service.ts`

```typescript
/**
 * @deprecated Usar @agento/agent-core en su lugar
 * Este servicio será eliminado en versión 2.0
 */
@deprecated
export class OpenCodeExecutorService {
  // ... mantener implementación actual por compatibilidad
}
```

### 3.6 Limpiar imports

Eliminar imports de los archivos que ya no usan:
- `../adapters/whatsapp.adapter`
- `../services/opencode-executor.service`

---

## 4. Archivos a Modificar

```
packages/backend/src/modules/opencode/
├── services/
│   ├── simulator.service.ts           (línea 83)
│   └── opencode-executor.service.ts   (deprecar)
├── workers/
│   └── automation.worker.ts           (línea 35)
└── controllers/
    └── agent-identity.controller.ts    (línea 13)
```

---

## 5. Testing

```typescript
describe('Migración a @agento/agent-core', () => {
  it('SimulatorService funciona con nuevo adapter');
  it('AutomationWorker ejecuta tareas');
  it('AgentIdentityService genera configuraciones');
  it('Comportamiento idéntico al anterior');
});
```

---

## 6. Estimación

| Tarea | Duración |
|-------|----------|
| Verificar exports de agent-core | 1 hora |
| Actualizar SimulatorService | 1 hora |
| Actualizar AutomationWorker | 1 hora |
| Actualizar AgentIdentityController | 1 hora |
| Deprecar OpenCodeExecutor | 30 min |
| Testing | 2 horas |
| **Total** | **1 día** |

---

## 7. Riesgos y Mitigación

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Breaking changes en agent-core | Baja | Testing exhaustivo |
| Incompatibilidad de APIs | Baja | Verificar antes de migrar |

---

## 8. Beneficios

- Código unificado
- Mantenimiento más fácil
- Bugs corregidos en un solo lugar
- Совместимость futura garantizada
