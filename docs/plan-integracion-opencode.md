# Plan: Integración Completa de OpenCode en AgenTo SaaS

## Contexto

**Problema actual:**
- `FullModeAdapter` ejecuta OpenCode como CLI externo usando `node-pty`
- Depende de ejecutables del sistema operativo (`opencode.exe` en Windows, `npx opencode` en Linux)
- No funciona correctamente en VPS Linux
- Código disperso entre el CLI de OpenCode y nuestro wrapper

**Objetivo (según docs/objetivo.md):**
Transformar Accomplish en **plataforma SaaS multiusuario** para VPS que:
- ✅ Mantiene **TODAS las funcionalidades** de OpenCode (codificar, documentos, Excel, código, contexto, herramientas, APIs, tareas)
- ✅ No depende de ejecutables externos del sistema
- ✅ Control completo del flujo de ejecución
- ✅ Funciona en cualquier VPS (Linux/Windows)
- ✅ Un solo repositorio listo para subir al servidor
- ✅ Mantiene el core de OpenCode intacto

**Rutas clave:**
- **Código OpenCode original:** `E:\opencode-dev\`
- **Proyecto AgenTo SaaS:** `E:\agento-saas-nodejs`
- **Referencia Accomplish:** `D:\laragon\www\agento-saas-nodejs` (solo referencia, no usar)

## Arquitectura Propuesta

### Nueva Estructura de Directorios

```
agento-saas-nodejs/
├── packages/
│   ├── opencode/              ← NUEVO: OpenCode completo integrado
│   │   ├── src/
│   │   │   ├── session/         ← Copiar TODO de E:\opencode-dev\packages\opencode\src\session\
│   │   │   ├── agent/           ← Copiar TODO de E:\opencode-dev\packages\opencode\src\agent\
│   │   │   ├── provider/        ← Copiar TODO de E:\opencode-dev\packages\opencode\src\provider\
│   │   │   ├── tool/            ← Copiar TODO de E:\opencode-dev\packages\opencode\src\tool\
│   │   │   ├── command/         ← Copiar TODO de E:\opencode-dev\packages\opencode\src\command\
│   │   │   ├── control/         ← Copiar TODO de E:\opencode-dev\packages\opencode\src\control\
│   │   │   ├── acp/             ← Copiar TODO de E:\opencode-dev\packages\opencode\src\acp\
│   │   │   ├── bus/             ← Copiar TODO de E:\opencode-dev\packages\opencode\src\bus\
│   │   │   ├── config/          ← Copiar TODO de E:\opencode-dev\packages\opencode\src\config\
│   │   │   ├── env/             ← Copiar TODO de E:\opencode-dev\packages\opencode\src\env\
│   │   │   ├── storage/         ← Copiar TODO de E:\opencode-dev\packages\opencode\src\storage\
│   │   │   ├── util/            ← Copiar TODO de E:\opencode-dev\packages\opencode\src\util\
│   │   │   ├── global/          ← Copiar TODO de E:\opencode-dev\packages\opencode\src\global\
│   │   │   ├── id/              ← Copiar TODO de E:\opencode-dev\packages\opencode\src\id\
│   │   │   ├── permission/      ← Copiar TODO de E:\opencode-dev\packages\opencode\src\permission\
│   │   │   ├── pty/             ← Copiar TODO de E:\opencode-dev\packages\opencode\src\pty\
│   │   │   ├── project/         ← Copiar TODO de E:\opencode-dev\packages\opencode\src\project\
│   │   │   ├── installation/    ← Copiar TODO de E:\opencode-dev\packages\opencode\src\installation\
│   │   │   └── index.ts         ← Entry point original (modificado para SaaS)
│   │   ├── package.json         ← Modificar para nuestro proyecto
│   │   └── tsconfig.json
│   ├── agent-core/              ← MODIFICAR: Usar opencode interno
│   └── backend/                ← MODIFICAR: Usar opencode interno
└── package.json                 ← ACTUALIZAR: Workspace
```

### Decisión: Copiar TODO OpenCode

**ALCANCE: COMPLETO**
- ✅ Copiar TODOS los módulos de `E:\opencode-dev\packages\opencode\src\`
- ✅ Incluir TODAS las funcionalidades de OpenCode
- ✅ NO excluir nada (excepto CLI específico de ejecución directa)
- ✅ Mantener: codificar, documentos, Excel, código, contexto, herramientas, APIs, tareas

**DEPENDENCIAS: COMPLETAS**
- ✅ Copiar TODAS las dependencias de OpenCode
- ✅ Incluir: Vercel AI SDK, MCP SDK, Drizzle, etc.
- ✅ NO simplificar - usar todo el ecosistema de OpenCode

**EXCLUSIONES MÍNIMAS**
- ❌ Solo `cli/index.ts` (entry point de línea de comandos)
- ❌ Solo `bin/` (scripts ejecutables)

### Modificaciones Necesarias

#### 1. **Crear packages/opencode-core**

**Archivo:** `packages/opencode-core/package.json`
```json
{
  "name": "@agento/opencode-core",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "dependencies": {
    "@ai-sdk/openai": "^1.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "@modelcontextprotocol/sdk": "^1.25.2",
    "drizzle-orm": "^0.29.0",
    "zod": "^3.22.0",
    "glob": "^10.0.0",
    "diff": "^5.0.0",
    "tree-sitter": "^0.20.0",
    "uuid": "^9.0.0"
  }
}
```

#### 2. **Modificar packages/agent-core**

**Cambios en `FullModeAdapter.ts`:**
- **Eliminar:** Ejecución vía `node-pty` del CLI
- **Reemplazar por:** Import directo de `SessionPrompt` de `@agento/opencode-core`

**Nuevo código:**
```typescript
import { SessionPrompt } from '@agento/opencode/core';

async execute(prompt: string, context: ExecutionContext): Promise<ExecutionResult> {
  const result = await SessionPrompt.prompt({
    message: prompt,
    agent: context.config.agent || 'build',
    model: `${context.config.provider}/${context.config.model}`,
    tools: this.getTools(context),
    onProgress: (event) => this.emitEvent(event),
    onToolCall: (tool, input) => this.handleTool(tool, input)
  });

  return {
    content: result.content,
    sessionId: result.sessionID,
    tokensUsed: result.tokens
  };
}
```

#### 3. **Actualizar package.json raíz**

**Archivo:** `package.json` (raíz)
```json
{
  "workspaces": [
    "packages/*",
    "packages/opencode-core"  // ← NUEVO
  ]
}
```

#### 4. **Simplificar SessionPrompt**

**Problema:** `SessionPrompt` original tiene muchas dependencias CLI

**Solución:** Crear una versión simplificada en `packages/opencode-core/src/SessionRunner.ts`

```typescript
export class SessionRunner {
  static async execute(config: {
    message: string;
    agent?: string;
    model?: string;
    tools?: ToolDefinition[];
    apiKey?: string;
  }): Promise<SessionResult> {
    // Usar directamente el core de OpenCode sin CLI
  }
}
```

## Archivos Críticos a Modificar

1. **Nuevo:** `packages/opencode-core/src/index.ts` - Entry point
2. **Modificar:** `packages/agent-core/src/adapter/FullModeAdapter.ts` - Usar imports directos
3. **Modificar:** `packages/backend/package.json` - Agregar dependencia de opencode-core
4. **Nuevo:** `package.json` (raíz) - Workspace configuration

## Copiado de Código

### Script de Copia

```bash
#!/bin/bash
OPENCODE_SRC="E:/opencode-dev/packages/opencode/src"
OPENCORE_DST="E:/agento-saas-nodejs/packages/opencode-core/src"

# Módulos a copiar
MODULES=(
  "session"
  "agent"
  "provider"
  "tool"
  "command"
  "control"
  "acp"
  "bus"
  "config"
  "env"
  "storage"
  "util"
  "global"
  "id"
  "permission"
)

for module in "${MODULES[@]}"; do
  echo "Copying $module..."
  cp -r "$OPENCODE_SRC/$module" "$OPENCORE_DST/"
done
```

### Limpieza de Dependencias

**Archivos a modificar después de copiar:**
- Eliminar imports relativos a `cli/`, `ui/`, `app/`, etc.
- Reemplazar imports internos `@/` por imports relativos
- Eliminar código específico de CLI

## Verificación

### Pasos de prueba:

1. **Compilar opencode-core**
   ```bash
   cd packages/opencode-core
   npx tsc
   ```

2. **Probar integración**
   ```bash
   cd packages/agent-core
   npm test
   ```

3. **Prueba end-to-end**
   ```bash
   cd packages/backend
   npm run dev
   # Crear tarea de accomplish y verificar que funciona
   ```

## Orden de Implementación

1. ✅ Crear estructura `packages/opencode-core/`
2. ✅ Copiar módulos de OpenCode
3. ✅ Crear `SessionRunner` simplificado
4. ✅ Configurar TypeScript y dependencias
5. ✅ Modificar `FullModeAdapter` para usar imports directos
6. ✅ Compilar y probar
7. ✅ Verificar que funciona en Windows y Linux

## Tiempo Estimado

- **Copiado de código:** 1 hora
- **Limpieza de dependencias:** 2 horas
- **Modificación de FullModeAdapter:** 1 hora
- **Compilación y pruebas:** 2 horas

**Total:** ~6 horas de trabajo
