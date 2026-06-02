# Diagnóstico: Integración de OpenCode como Agente Codificador

**Fecha:** 2026-03-18
**Estado:** BLOQUEADO

---

## RESUMEN EJECUTIVO

La integración de OpenCode como Agente Codificador está **BLOQUEADA** debido a problemas de compatibilidad estructurales. El código de OpenCode no puede copiarse directamente al servidor.

---

## PROBLEMA PRINCIPAL

OpenCode fue diseñado como una aplicación de terminal/CLI, no como una librería. Para usarlo en el servidor se necesitaría:

1. Replicar toda la configuración del monorepo (path aliases, dependencias)
2. Instalar múltiples dependencias binarias no disponibles
3. Reescribir código que depende de entornos interactivos

---

## ERRORES DETECTADOS

### 1. TypeScript Path Aliases

OpenCode usa path aliases que no existen en nuestro proyecto:

```typescript
// Archivos con imports rotos:
import { X } from "@/plugin"
import { X } from "@/global"
import { X } from "@/permission/next"
```

**Solución requerida:** Configurar tsconfig con los mismos path aliases que OpenCode.

---

### 2. Dependencias Faltantes

| Dependencia | Estado |
|------------|--------|
| `remeda` | ❌ No instalada |
| `ai` (API diferente) | ⚠️ Versión incompatible |
| `bun-pty` | ❌ Binario nativo |
| `vscode-languageserver-*` | ❌ Múltiples paquetes |
| `@parcel/watcher` | ❌ Binario nativo |

---

### 3. Código Dependiente de Entorno Interactivo

Múltiples archivos asumen un entorno de terminal:

```typescript
// tool/write.ts - línea 55
await LSP.touchFile(filepath, true)  // LSP no existe en server

// cli/index.ts - línea 3
import { RunCommand } from "./cli/cmd/run"  // CLI commands no existen
```

---

### 4. Errores de TypeScript (300+)

```
src/lib/opencode/agent/agent.ts:
  - Module '"ai"' has no exported member 'ModelMessage'
  - Cannot find module '@/permission/next'
  - Cannot find module 'remeda'
  - Cannot find module '@/global'
  - Cannot find module '@/plugin'
  - 50+ errores de tipos

src/lib/opencode/session/*.ts:
  - 100+ errores de tipos por imports faltantes

src/lib/opencode/tool/*.ts:
  - 50+ errores por LSP no disponible
```

---

## ANÁLISIS DE LAS 13 FASES

### ✅ FASE 1: Limpieza (Parcial)
- Carpetas `pty`, `lsp`, `cli`, `server` eliminadas
- **PERO:** Stubs creados no resuelven el problema de fondo
- **PERO:** 300+ imports rotos permanecen

### ✅ FASE 2: Migrar Adapter
- OpenCodeRuntimeAdapter usa direct import
- **PERO:** lib/opencode no compila

### ✅ FASE 3: Dependencias
- AI SDKs agregados al package.json
- **PERO:** Dependencias de OpenCode no compatibles con Bun

### ✅ FASE 4-5: Schemas
- `db/schema/skill.ts` - OK
- `db/schema/tool.ts` - OK

### ⚠️ FASE 6: ToolRegistry
- Base tools implementadas (read, write, bash)
- Usa `new Function()` en vez de Bun sandbox
- **PERO:** No puede ejecutarse porque depende de OpenCode

### ✅ FASE 7: SkillRegistry
- Skills del codificador definidos
- Carga desde BD

### ✅ FASE 8-13: Servicios y Endpoints
- AgentCoderService creado
- coder.routes.ts creado
- Registrado en app.ts

---

#