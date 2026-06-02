# Investigación: Integración del Agente AI con Accomplish

**Fecha:** 2026-03-20
**Estado:** 🔍 EN INVESTIGACIÓN

---

## 🔍 Descubrimientos

### 1. Configuración del Tenant (rdfinanzas)

**Archivo:** `packages/storage/tenants/73b7dff9-0f04-4f38-9cee-6c6b6e5ef3bb/config.json`

```json
{
  "mode": "FULL",
  "provider": "deepseek",
  "model": "deepseek-chat",
  "allowedTools": ["read_file", "write_file", "list_files", "search_files", "web_search", "execute_command"]
}
```

✅ El tenant tiene configuración completa con provider y model.

### 2. OpenCode Library Location

**Ubicación encontrada:** `packages/opencode-fork/`
- Contiene: `packages/opencode/src/api.ts` ✅

**Problema identificado:**
- El `OpenCodeRuntimeAdapter` intenta importar desde: `../../../lib/opencode/api`
- Pero no existe `packages/server/lib/opencode/`
- La librería OpenCode está en `packages/opencode-fork/`

### 3. Ruta de Importación Incorrecta

**Archivo:** `packages/server/src/modules/agent-ai/adapter/OpenCodeRuntimeAdapter.ts:18`

```typescript
// ❌ INCORRECTO - Esta ruta no existe
import { opencode, OpenCodeAPI, type PromptResult, type TenantSessionConfig } from '../../../lib/opencode/api';
```

**Debería ser:**
```typescript
// ✅ CORRECTO - Apunta a opencode-fork
import { opencode, OpenCodeAPI, type PromptResult, type TenantSessionConfig } from '../../../../opencode-fork/packages/opencode/src/api';
```

### 4. Flujo de Ejecución Actual

```
accomplish.service.ts
  └── executeTask()
      └── executeWithAgent() [usando agentAiService]
          └── agentAiService.execute()
              └── OpenCodeRuntimeAdapter.execute()
                  ├── 1. ensureInitialized() → opencode.initialize()
                  ├── 2. getConfig(tenantId) → Lee config.json ✅
                  ├── 3. getWorkspace(tenantId) → Crea workspace ✅
                  ├── 4. createSession() → opencode.createSession()
                  └── 5. executePrompt() → opencode.executePrompt()
                      ❌ **FALLA AQUÍ** - OpenCode no está disponible o import es incorrecta
```

---

## 🎯 Problemas Identificados

### Problema 1: Importación de OpenCode
- **Ubicación:** `OpenCodeRuntimeAdapter.ts:18`
- **Error:** La ruta `../../../lib/opencode/api` no existe
- **Solución:** Actualizar la ruta para apuntar a `opencode-fork/packages/opencode/src/api`

### Problema 2: Proveedor Global vs Tenant
- **Contexto:** El proveedor es GLOBAL, no depende del tenant
- **Implicación:** La API key del proveedor debe estar configurada a nivel sistema (super admin)
- **Verificar:** SecureStorage debe tener la API key configurada para `deepseek`

### Problema 3: Inicialización de OpenCode
- **Requisito:** `opencode.initialize()` requiere `OPENCODE_DATA_DIR`
- **Configuración:** Usa `.opencode-data` por defecto
- **Verificar:** ¿Existe este directorio? ¿Tiene permisos?

### Problema 4: Base de Datos de OpenCode
- **Requisito:** `initDatabase: true` en initialize()
- **Pregunta:** ¿OpenCode necesita su propia base de datos?
- **Ubicación:** Probablemente en `.opencode-data/`

---

## ✅ Verificaciones Completadas

| Item | Estado | Detalles |
|------|--------|----------|
| Config tenant | ✅ | Tiene provider, model, tools |
| Config tenant path | ✅ | `storage/tenants/{id}/config.json` |
| OpenCode location | ⚠️ | Está en `opencode-fork/`, no en `lib/` |
| OpenCode API | ✅ | `opencode-fork/packages/opencode/src/api.ts` existe |
| Servicio agentAiService | ✅ | Existe y tiene método `execute()` |
| Llamada en accomplish | ✅ | Código llama a `executeWithAgent()` |
| Ejecución background | ✅ | Se ejecuta async después de crear tarea |

---

## 🚀 Plan de Acción

### PASO 1: Corregir importación de OpenCode
**Archivo:** `packages/server/src/modules/agent-adapter/OpenCodeRuntimeAdapter.ts:18`

```typescript
// ANTES (incorrecto):
import { opencode } from '../../../lib/opencode/api';

// DESPUÉS (correcto):
import { opencode } from '../../../../opencode-fork/packages/opencode/src/api';
```

### PASO 2: Verificar API Key del proveedor
```bash
# Verificar si existe API key para deepseek
# Usar SecureStorage para verificar si hay key configurada
```

### PASO 3: Crear directorio OPENCODE_DATA_DIR
```bash
# Crear directorio para datos de OpenCode si no existe
mkdir -p .opencode-data
```

### PASO 4: Verificar paquete dependencies
```bash
# Verificar que opencode-fork está en las dependencias del servidor
cd packages/server
grep opencode-fork package.json
```

### PASO 5: Actualizar package.json (si es necesario)
```json
{
  "dependencies": {
    "opencode": "file:../opencode-fork"
  }
}
```

---

## 🔧 Desafíos Técnicos

### Desafío 1: Estructura de Monorepo
- OpenCode está en `packages/opencode-fork/`
- Servidor está en `packages/server/`
- Necesito importar entre paquetes del monorepo

### Desafío 2: Inicialización de OpenCode
- OpenCode requiere su propia base de datos
- Necesita directorio de datos configurado
- Puede tener dependencias del sistema de archivos

### Desafío 3: Configuración de API Keys
- Las API keys están en SecureStorage (encriptadas)
- Necesito verificar si deepseek tiene key configurada
- Si no hay key, necesito configurarla

### Desafío 4: Modo FULL vs LIMITED
- Tenant rdfinanzas está en modo FULL
- Esto permite todas las herramientas
- Necesito verificar que OpenCode respeta estos permisos

---

## 📊 Estado de Componentes

| Componente | Estado | Notas |
|-----------|--------|--------|
| accomplish.service.ts | ✅ Listo | Llama a agentAiService.execute() |
| agent-ai.service.ts | ✅ Listo | Usa OpenCodeRuntimeAdapter |
| OpenCodeRuntimeAdapter.ts | ⚠️ Rota err | Import incorrecto de opencode |
| TenantManager | ✅ Listo | Encuentra config.json correctamente |
| WorkspaceManager | ✅ Listo | Crea workspace cuando es necesario |
| SecureStorage | ❓ Pendiente | Verificar API key de deepseek |
| opinitialize() | ❓ Pendiente | Verificar que funciona sin errores |

---

## 🎯 Próximos Pasos

1. **CORREGIR IMPORTACIÓN:** Actualizar ruta de OpenCode en OpenCodeRuntimeAdapter.ts
2. **VERIFICAR API KEY:** Revisar SecureStorage para key de deepseek
3. **PROBAR EJECUCIÓN:** Después de corregir import, crear tarea y ver logs
4. **DOCUMENTAR RESULTADOS:** Actualizar este documento con hallazgos

---

**Última actualización:** 2026-03-20 22:45
**Prioridad:** ALTA - El usuario necesita que el agente AI funcione
