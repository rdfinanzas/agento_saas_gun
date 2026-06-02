# PLAN #4: Corregir Configuración de Seguridad Hardcodeada

**Proyecto:** AgenTo SaaS  
**Problema:** El modo y las tools están hardcodeadas, no se lee desde la DB  
**Severidad:** ALTA  
**Fecha:** 2026-03-11

---

## 1. Diagnóstico del Problema

### Estado Actual

En `agent.service.ts` líneas 312, 329-330:

```typescript
const tenantConfig = {
  tenantId,
  mode: 'LIMITED' as const,  // ← HARDCODEADO
  agentName: (config as any).agentName || 'Asistente',
  // ...
  allowedTools: LIMITED_MODE_TOOLS,  // ← HARDCODEADO, no usa config de DB
  blockedTools: ['bash', 'write', 'edit', 'task'],  // ← HARDCODEADO
};
```

### Problema

- El campo `agentMode` en `WhatsAppConfig` es ignorado
- `allowedTools` y `blockedTools` siempre son los mismos valores
- No hay forma de configurar tools por tenant desde la UI

---

## 2. Solución Propuesta

### 2.1 Agregar campos a WhatsAppConfig (schema.prisma)

```prisma
model WhatsAppConfig {
  // ... campos existentes ...
  
  // Configuración de seguridad y herramientas
  agentMode          String   @default("LIMITED")  // "LIMITED" | "FULL"
  allowedTools       String[] @default([])         // Lista de tools permitidas
  blockedTools       String[] @default(["bash", "write", "edit", "task"])
  
  // Si allowedTools está vacío, usa las del modo
  // Si tiene valores, usa esos (prioridad)
}
```

### 2.2 Modificar AgentService

**Cambio en líneas 310-331:**

```typescript
// ANTES (hardcodeado):
const tenantConfig = {
  mode: 'LIMITED' as const,
  allowedTools: LIMITED_MODE_TOOLS,
  blockedTools: ['bash', 'write', 'edit', 'task'],
};

// DESPUÉS (desde DB):
const agentMode = (config as any).agentMode || 'LIMITED';
const configuredAllowedTools = (config as any).allowedTools || [];
const configuredBlockedTools = (config as any).blockedTools || getDefaultBlockedTools(agentMode);

// Si tiene tools configuradas, usarlas; si no, usar las del modo
const allowedTools = configuredAllowedTools.length > 0 
  ? configuredAllowedTools 
  : getToolsForMode(agentMode);

const tenantConfig = {
  mode: agentMode,
  allowedTools,
  blockedTools: configuredBlockedTools,
};
```

### 2.3 Funciones auxiliares

```typescript
function getToolsForMode(mode: 'LIMITED' | 'FULL'): string[] {
  if (mode === 'FULL') {
    return FULL_MODE_TOOLS;  // Todas las tools
  }
  return LIMITED_MODE_TOOLS; // Solo lectura
}

function getDefaultBlockedTools(mode: 'LIMITED' | 'FULL'): string[] {
  if (mode === 'FULL') {
    return []; // No bloquea nada en modo FULL
  }
  return ['bash', 'write', 'edit', 'task']; // Bloquea peligrosas en LIMITED
}
```

### 2.4 Migration

```bash
npx prisma migrate add --name add_agent_config_fields
```

---

## 3. UI en Frontend

### 3.1 Modificar AgentForm

**Archivo:** `packages/frontend/app/[tenant]/agents/new/page.tsx` (y edit)

Agregar sección de configuración de herramientas:

```tsx
<div className="space-y-4">
  <div>
    <label>Modo del Agente</label>
    <select 
      value={form.agentMode} 
      onChange={(e) => setForm({...form, agentMode: e.target.value})}
    >
      <option value="LIMITED">Limitado (solo lectura)</option>
      <option value="FULL">Completo (todas las herramientas)</option>
    </select>
  </div>
  
  {form.agentMode === 'LIMITED' && (
    <div>
      <label>Herramientas bloqueadas</label>
      <MultiSelect 
        options={AVAILABLE_TOOLS}
        selected={form.blockedTools}
        onChange={(tools) => setForm({...form, blockedTools: tools})}
      />
    </div>
  )}
</div>
```

---

## 4. Archivos a Modificar

### Schema
```
packages/backend/prisma/schema.prisma
```

### Backend
```
packages/backend/src/modules/whatsapp/
└── services/
    └── agent.service.ts           (líneas 310-331)
```

### Frontend
```
packages/frontend/app/[tenant]/
└── agents/
    ├── new/page.tsx              (agregar campos)
    └── [id]/page.tsx             (agregar campos)
```

---

## 5. Testing

```typescript
describe('Agent Configuration', () => {
  it('usa modo LIMITED por defecto');
  it('lee agentMode desde DB');
  it('usa allowedTools cuando está configurado');
  it('bloquea herramientas según blockedTools');
  it('FULL mode permite todas las tools');
});
```

---

## 6. Estimación

| Tarea | Duración |
|-------|----------|
| Agregar campos a schema | 1 hora |
| Crear migración | 30 min |
| Modificar AgentService | 2 horas |
| Actualizar UI | 2 horas |
| Testing | 1 hora |
| **Total** | **1 día** |

---

## 7. Valores por defecto

| Modo | allowedTools | blockedTools |
|------|-------------|--------------|
| LIMITED | `[read, glob, grep, list, knowledge_query]` | `[bash, write, edit, task]` |
| FULL | `[TODAS]` | `[]` |

---

## 8. Beneficios

- ✅ Configuración por tenant
- ✅ UI para configurar tools
- ✅ Modo FULL disponible
- ✅ Respetar configuración de DB
