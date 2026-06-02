# PLAN #3: Integración de Skills con Agente WhatsApp

**Proyecto:** AgenTo SaaS  
**Problema:** Skills instalados NO se convierten en tools disponibles para el agente  
**Severidad:** ALTA  
**Fecha:** 2026-03-11

---

## 1. Diagnóstico del Problema

### Estado Actual

```
Flujo Actual:
┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐
│ 1. Usuario instala │ →  │ 2. Se guarda en    │ →  │ 3. Skill aparece   │
│    skill desde      │    │    installed_skills│    │    en "Mis Skills" │
│    Marketplace      │    │    (DB)            │    │    (UI)             │
└────────────────────┘    └────────────────────┘    └────────────────────┘
                                                                  ↓
                                                     ┌────────────────────┐
                                                     │ 4. El agente NUNCA │
                                                     │    lo usa          │
                                                     │    ❌              │
                                                     └────────────────────┘
```

### Problema

En `agent.service.ts` (líneas 329-330):
```typescript
allowedTools: LIMITED_MODE_TOOLS,  // ← Lista estática hardcodeada
blockedTools: ['bash', 'write', 'edit', 'task'],  // ← No incluye skills
```

**El agente usa una lista FIJA de tools**, no carga los skills instalados.

---

## 2. Solución Propuesta

### Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AGENTE WHATSAPP                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Cargar config del tenant (WhatsAppConfig)                      │
│         ↓                                                           │
│  2. Obtener skills instalados (installed_skills table)              │
│         ↓                                                           │
│  3. Convertir skills a tools dinámicas                              │
│         ↓                                                           │
│  4. Combinar con tools base (LIMITED_MODE_TOOLS)                    │
│         ↓                                                           │
│  5. Ejecutar con todas las tools disponibles                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Plan de Implementación

### 3.1 Crear SkillLoaderService

**Archivo nuevo:** `packages/backend/src/modules/whatsapp/services/skill-loader.service.ts`

```typescript
class SkillLoaderService {
  /**
   * Carga skills instalados y los convierte a formato de tools
   */
  async loadSkillsAsTools(tenantId: string): Promise<SkillTool[]>
  
  /**
   * Convierte un skill individual a tool
   */
  private skillToTool(marketplaceSkill: MarketplaceSkill): SkillTool
  
  /**
   * Ejecuta un skill
   */
  async executeSkill(skillId: string, input: any): Promise<any>
}
```

### 3.2 Modificar AgentService

**Archivo:** `packages/backend/src/modules/whatsapp/services/agent.service.ts`

**Cambios en líneas 308-331:**

```typescript
// ANTES (hardcodeado):
const tenantConfig = {
  mode: 'LIMITED' as const,
  allowedTools: LIMITED_MODE_TOOLS,
  blockedTools: ['bash', 'write', 'edit', 'task'],
};

// DESPUÉS (dinámico):
// 1. Cargar skills instalados
const skillLoader = new SkillLoaderService();
const skillTools = await skillLoader.loadSkillsAsTools(tenantId);

// 2. Combinar con tools base
const baseTools = LIMITED_MODE_TOOLS;
const allAllowedTools = [...baseTools, ...skillTools.map(t => t.name)];

const tenantConfig = {
  mode: 'LIMITED' as const,
  allowedTools: allAllowedTools,
  blockedTools: ['bash', 'write', 'edit', 'task'],
  skills: skillTools,  // Información de los skills para ejecución
};
```

### 3.3 Definir formato de SkillTool

```typescript
interface SkillTool {
  name: string;              // Comando para invocar, ej: "google-sheets"
  description: string;       // Descripción para el agente
  parameters?: Parameter[];   // Parámetros que acepta
  handler: string;           // Qué hace cuando se invoca
  category: string;          // Categoría del skill
}

interface Parameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  description: string;
  required: boolean;
}
```

### 3.4 Integrar ejecución de skills

**En el flujo del agente** (`agent.service.ts`):

```typescript
// Cuando el agente devuelve una tool call:
if (skillTools.some(t => t.name === toolName)) {
  // Es un skill, ejecutar
  const result = await skillLoader.executeSkill(toolName, toolInput);
  return { content: result, type: 'skill_result' };
}
```

---

## 4. Archivos a Modificar

### Nuevos
```
packages/backend/src/modules/whatsapp/
└── services/
    └── skill-loader.service.ts    (NUEVO)
```

### Modificar
```
packages/backend/src/modules/whatsapp/
└── services/
    └── agent.service.ts           (líneas 308-331, y flujo de ejecución)
```

---

## 5. Dependencias

- **SkillsMarketplaceService** (ya existe) - para obtener skills instalados
- **Prisma** - para consultar `installed_skills` table

---

## 6. Testing

```typescript
// Tests unitarios
describe('SkillLoaderService', () => {
  it('carga skills instalados como tools');
  it('convierte skill a formato tool');
  it('ejecuta skill y devuelve resultado');
  it('maneja skills sin parámetros');
});

// Tests de integración
describe('Agent with Skills', () => {
  it('agente puede invocar skill instalado');
  it('skill recibe parámetros correctamente');
  it('respuesta de skill se integra en conversación');
});
```

---

## 7. Estimación

| Tarea | Duración |
|-------|----------|
| Crear SkillLoaderService | 1-2 días |
| Modificar AgentService | 1 día |
| Integrar ejecución | 1 día |
| Testing | 1 día |
| **Total** | **4-5 días** |

---

## 8. Consideraciones

### Seguridad
- Validar que el skill pertenece al tenant antes de ejecutar
- Sanitizar inputs de usuarios hacia skills
- Rate limiting por skill

### Performance
- Cachear skills carregados (no consultar DB en cada mensaje)
- TTL: 5 minutos

### Fallbacks
- Si skill falla → devolver error amigable
- No romper conversación si skill no responde

---

## 9. Alternativas Consideradas

| Alternativa | Pros | Contras |
|-------------|------|---------|
| **A. Cargar en runtime (propuesta)** | Dinámico, actualiza al instante | Más queries a DB |
| **B. Cargar en startup** | Menos queries | Requiere reiniciar para actualizar |
| **C. Skills como MCP server** | Más robusto | Mayor complejidad |

**Selección:** Alternativa A (cargar en runtime con cache)
