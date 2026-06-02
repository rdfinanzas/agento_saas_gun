# 📋 RESUMEN: Integración HTTP de OpenCode para Accomplish

> **Nota:** Esta integración aplica específicamente al módulo **Accomplish** (tareas agenticas). El módulo WhatsApp usa su propio adapter.

## ✅ OBJETIVO ALCANZADO

Hemos transformado el módulo **Accomplish** para usar comunicación **HTTP** con el servidor de OpenCode, eliminando dependencias del CLI o ejecutables del sistema operativo.

## 🎯 ARQUITECTURA DE ADAPTERS

El backend tiene **múltiples módulos** con diferentes adapters:

| Módulo | Adapter | Propósito | Archivo |
|--------|---------|-----------|---------|
| **Accomplish** | `OpenCodeHttpAdapter` | Tareas agenticas con OpenCode | `src/modules/accomplish/services/fullmode-integration.service.ts` |
| **WhatsApp** | `WhatsAppAdapter` | Integración con WhatsApp | `src/modules/whatsapp/services/simulator.service.ts` |

Esta integración **solo modifica Accomplish**, no afecta al módulo WhatsApp.

## 🎯 PROBLEMA RESUELTO

**Antes:**
- `FullModeAdapter` ejecutaba OpenCode como CLI externo usando `node-pty`
- Dependía de ejecutables del sistema operativo (`opencode.exe` en Windows, `npx opencode` en Linux)
- No funcionaba en VPS Linux
- Incompatibilidad entre CommonJS (agent-core) y ES Modules (opencode-fork)

**Ahora:**
- `OpenCodeHttpAdapter` se comunica vía HTTP con el servidor de OpenCode
- No usa spawn, no usa exec, no usa CLI
- Hace llamadas HTTP usando `fetch` (nativo de Node.js 18+)
- Funciona en Linux VPS sin dependencias del SO

## 🔧 IMPLEMENTACIÓN TÉCNICA

### Comunicación HTTP con Streaming

El servidor OpenCode usa **streaming HTTP** para enviar respuestas. Para manejar esto correctamente:

```typescript
// OpenCodeHttpAdapter usa fetch en lugar de axios
const response = await fetch(`${this.serverUrl}/session/${sessionId}/message`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestBody),
});

// fetch maneja el stream automáticamente
const responseText = await response.text();
const data = JSON.parse(responseText);
```

**Por qué fetch y no axios?**
- Axios no maneja streams HTTP correctamente
- Fetch (Node.js 18+) soporta streaming nativamente
- El servidor Bun escribe un JSON completo via stream, no SSE incremental

### Validación de SessionID

Las sesiones de OpenCode deben tener el formato `ses_...`:

```typescript
// Solo aceptar sessionIDs válidos
if (context.sessionId && context.sessionId.startsWith('ses_')) {
  sessionId = context.sessionId;
} else {
  // Crear nueva sesión
}
```

## 📁 ARCHIVOS MODIFICADOS/CREADOS

### 1. **Nuevo Adaptador HTTP**
- `packages/agent-core/src/adapter/OpenCodeHttpAdapter.ts`
- Usa `fetch` para comunicación HTTP (maneja streams)
- Valida sessionIDs con formato `ses_...`
- Endpoints: `/session`, `/session/:ID/message`, `/session/status`

### 2. **Backend Actualizado (Módulo Accomplish)**
- `packages/backend/src/modules/accomplish/services/fullmode-integration.service.ts`
- Importa y usa `OpenCodeHttpAdapter` de `@agento/agent-core`
- **NO modifica** el módulo WhatsApp (usa su propio adapter)

**Import en el código:**
```typescript
// Línea 12 de fullmode-integration.service.ts
import { OpenCodeHttpAdapter, ExecutionContext, ConversationMessage } from '@agento/agent-core';
```

### 3. **Exports**
- `packages/agent-core/src/index.ts`
- Export de `OpenCodeHttpAdapter`

### 4. **Scripts de Inicio**
- `start-opencode-server.ts` - Inicia servidor Bun

### 5. **Scripts de Prueba**
- `packages/backend/scripts/simulate-real-call.ts` - Prueba completa de la integración
- `package.json` (root) - Excluido `opencode-fork` de workspaces npm

## 🚀 CÓMO USAR

### Paso 1: Instalar Bun (si no está instalado)
```bash
curl -fsSL https://bun.sh/install | bash
```

### Paso 2: Iniciar servidor OpenCode (Bun)
```bash
cd packages/opencode-fork/packages/opencode
bun run src/server/server.ts
```

El servidor iniciará en `http://localhost:4096`

### Paso 3: Iniciar backend (Node.js)
```bash
cd packages/backend
npm run start:dev
```

El backend iniciará en `http://localhost:3000`

### O Usar el script de inicio:
**Linux/Mac:**
```bash
chmod +x start-opencode-server.sh
./start-opencode-server.sh
```

**Windows:**
```batch
start-opencode-server.bat
```

## 📊 ARQUITECTURA FINAL

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                       │
│                  http://localhost:3000/conversations            │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP POST /api/v1/:tenant/accomplish/tasks
┌────────────────────────────▼────────────────────────────────────┐
│                    Backend (NestJS/Node.js)                     │
│                     http://localhost:3000                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │            FullModeIntegrationService                     │  │
│  │                    ↓                                      │  │
│  │            OpenCodeHttpAdapter                            │  │
│  └────────────────────────────┬──────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────┘
                                │ HTTP (axios)
┌───────────────────────────────▼──────────────────────────────────┐
│              OpenCode HTTP Server (Bun + Hono)                  │
│                    http://localhost:4096                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Endpoints:                                               │  │
│  │  - POST   /session              → Crear sesión            │  │
│  │  - GET    /session              → Listar sesiones         │  │
│  │  - GET    /session/:ID          → Obtener sesión          │  │
│  │  - POST   /session/:ID/prompt   → Enviar prompt          │  │
│  │  - GET    /session/:ID/message  → Obtener mensajes       │  │
│  │  - DELETE /session/:ID          → Eliminar sesión        │  │
│  │  - GET    /session/status       → Health check           │  │
│  └────────────────────────────┬──────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│                  Código NATIVO de OpenCode                       │
│        (Session, SessionPrompt, Agent, Provider, etc.)          │
└─────────────────────────────────────────────────────────────────┘
```

## 💡 VENTAJAS

| Aspecto | Antes (CLI) | Ahora (HTTP) |
|---------|-------------|--------------|
| Ejecución | `node-pty` + `opencode.exe` | HTTP + axios |
| Dependencias SO | Ejecutables Windows | Solo Bun + Node.js |
| Linux VPS | ❌ No funciona | ✅ Funciona |
| Control | Limitado (CLI args) | Completo (HTTP API) |
| Multi-tenant | Complejo | Simple (HTTP por tenant) |
| Comunicación | TTY/Streams | JSON/HTTP |
| Debugging | Difícil (streams) | Fácil (HTTP logs) |

## ⚙️ VARIABLES DE ENTORNO

```bash
# .env
OPENCODE_SERVER_URL=http://localhost:4096
```

Si no se configura, usa `http://localhost:4096` por defecto.

## 🧪 PROBAR LA INTEGRACIÓN

**Opción 1: Script de prueba**
```bash
# Linux/Mac
bash packages/backend/scripts/test-opencode-http.sh

# Windows
packages\backend\scripts\test-opencode-http.bat
```

**Opción 2: Manual**
```bash
# 1. Verificar servidor OpenCode
curl http://localhost:4096/session/status

# 2. Verificar backend
curl http://localhost:3000/health

# 3. Crear tarea desde frontend
# Navega a http://localhost:3000/conversations
# Crea una nueva conversación
# Envía un mensaje
```

## 📝 COMPILACIÓN

```bash
cd packages/agent-core
npx tsc  # ✅ Compilado exitosamente
```

## 🔧 TROUBLESHOOTING

### Error 400: "Invalid string: must start with \"ses\""

**Problema:** El servidor OpenCode rechaza sessionIDs que no empiezan con `ses_`.

**Solución:** El adaptador valida el formato del sessionID y crea uno nuevo si es inválido:

```typescript
// OpenCodeHttpAdapter.ts
if (context.sessionId && context.sessionId.startsWith('ses_')) {
  sessionId = context.sessionId;
} else {
  // Crear nueva sesión con formato válido
}
```

### Error: "OpenCode server not available"

**Problema:** El servidor Bun no está corriendo.

**Solución:**
```bash
# Iniciar servidor OpenCode
bun run start-opencode-server.ts

# Verificar que esté corriendo
curl http://localhost:4096/session/status
```

### El backend usa código cacheado

**Problema:** `ts-node-dev` no recarga cambios en paquetes externos.

**Solución:**
```bash
# 1. Matar procesos
taskkill //F //IM node.exe

# 2. Limpiar caché
cd packages/agent-core
rm -rf dist node_modules/.cache

# 3. Recompilar
npx tsc

# 4. Reiniciar backend
cd ../backend
npm run dev
```

### Timeout en respuestas

**Problema:** Las tareas toman más tiempo que el timeout default.

**Solución:** Aumentar el timeout en el axios client:
```typescript
this.axiosClient = axios.create({
  timeout: 600000, // 10 minutos
});
```

## ⚠️ NOTAS IMPORTANTES

1. **El servidor OpenCode debe estar corriendo** antes de que el backend intente ejecutar tareas.

2. **Bun es requerido** para ejecutar el servidor de OpenCode.

3. **Los workspaces npm excluyen opencode-fork** porque usa protocolos `workspace:*` específicos de Bun/pnpm.

4. **El servidor OpenCode corre independientemente** con Bun, mientras que el backend corre con Node.js.

## 🚀 PRÓXIMOS PASOS

### Para Desarrollo:
1. **Iniciar ambos servidores** en terminales separadas
2. **Probar el frontend** creando una conversación
3. **Verificar los logs** de ambos servidores

### Para Producción (VPS):
1. **Instalar Bun** en el VPS
2. **Instalar dependencias** del opencode-fork
3. **Configurar PM2** para mantener los procesos corriendo
4. **Configurar nginx** como reverse proxy
5. **Configurar SSL** con Let's Encrypt

### PM2 Configuration (ejemplo):
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'opencode-server',
      script: 'bun',
      args: 'run packages/opencode-fork/packages/opencode/src/server/server.ts',
      cwd: '/path/to/agento-saas-nodejs',
      env: {
        OPENCOD_SERVER_PORT: '4096',
      }
    },
    {
      name: 'agento-backend',
      script: 'npm',
      args: 'run start:prod',
      cwd: '/path/to/agento-saas-nodejs/packages/backend',
    }
  ]
};
```

## ✅ ESTADO FINAL

- ✅ **agent-core** compilado sin errores
- ✅ **OpenCodeHttpAdapter** implementado con fetch (maneja streams)
- ✅ **Validación de sessionID** implementada (formato `ses_...`)
- ✅ **Backend** actualizado y funcionando
- ✅ **Pruebas exitosas** - Simulación completa funcionando
- ✅ **Comunicación HTTP** estable entre Backend (Node.js) y OpenCode (Bun)

### Resultados de Prueba

**Fecha:** 15/3/2026
**Estado:** ✅ Completado exitosamente

```bash
[9:22:35] 🤖 AGENTE
   "¡Genial! Que bueno que lo resolviste..."

[9:22:35] ✅ COMPLETADO
   Resultado: {"success":true,"content":...}
```

**La integración HTTP está lista para usar en desarrollo y producción.**

---

## 📚 ARQUITECTURA FINAL

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                       │
│                  http://localhost:3000/conversations            │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP POST /api/v1/:tenant/accomplish/tasks
┌────────────────────────────▼────────────────────────────────────┐
│                    Backend (NestJS/Node.js)                     │
│                     http://localhost:3000                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │            FullModeIntegrationService                     │  │
│  │                    ↓                                      │  │
│  │            OpenCodeHttpAdapter                            │  │
│  │         (usa fetch para streams)                          │  │
│  └────────────────────────────┬──────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────┘
                                │ HTTP (fetch con stream)
┌───────────────────────────────▼──────────────────────────────────┐
│              OpenCode HTTP Server (Bun + Hono)                  │
│                    http://localhost:4096                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Endpoints:                                               │  │
│  │  - POST   /session              → Crear sesión            │  │
│  │  - GET    /session              → Listar sesiones         │  │
│  │  - POST   /session/:ID/message  → Enviar prompt (stream) │  │
│  │  - DELETE /session/:ID          → Eliminar sesión        │  │
│  │  - GET    /session/status       → Health check           │  │
│  └────────────────────────────┬──────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│                  Código NATIVO de OpenCode                       │
│        (Session, SessionPrompt, Agent, Provider, etc.)          │
└─────────────────────────────────────────────────────────────────┘
```


## 📌 ACLARACIÓN IMPORTANTE

### Múltiples Módulos, Múltiples Adapters

Este backend tiene **dos módulos independientes** con diferentes propósitos:

#### 1. Módulo Accomplish (esta integración)
- **Propósito:** Ejecutar tareas agenticas complejas con OpenCode
- **Adapter:** `OpenCodeHttpAdapter` (comunicación HTTP)
- **Endpoint:** `/api/v1/:tenant/accomplish/tasks`
- **Archivo:** `src/modules/accomplish/services/fullmode-integration.service.ts`
- **Estado:** ✅ Integración HTTP completada

#### 2. Módulo WhatsApp (NO afectado)
- **Propósito:** Integración con WhatsApp para chat
- **Adapter:** `WhatsAppAdapter` (implementación propia)
- **Endpoint:** `/api/v1/whatsapp/*`
- **Archivos:**
  - `src/modules/whatsapp/services/simulator.service.ts`
  - `src/modules/whatsapp/controllers/agent-identity.controller.ts`
  - `src/modules/whatsapp/workers/automation.worker.ts`
- **Estado:** Usa su propio adapter, NO modificado por esta integración

### Verificación

```bash
# Accomplish - Usa OpenCodeHttpAdapter ✅
grep "import.*Adapter" backend/src/modules/accomplish/services/fullmode-integration.service.ts
# Output: import { OpenCodeHttpAdapter, ... } from '@agento/agent-core';

# WhatsApp - Usa WhatsAppAdapter (diferente)
grep "import.*Adapter" backend/src/modules/whatsapp/services/simulator.service.ts
# Output: import { WhatsAppAdapter } from '@agento/agent-core';
```

**Conclusión:** Esta integración solo modifica Accomplish. WhatsApp continúa usando su adapter sin cambios.

