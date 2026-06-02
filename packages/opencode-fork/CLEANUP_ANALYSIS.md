# Análisis de Limpieza del Fork de OpenCode

## Overview

Este documento contiene el análisis de qué módulos y paquetes del fork de OpenCode (`packages/opencode-fork/`) son necesarios para ejecutar el agente de forma autónoma en el SaaS y cuáles pueden eliminarse.

**Fecha de análisis**: 2025-03-16

---

## Paquetes Completos a Eliminar

| Paquete             | Tamaño | Razón                                 |
| ------------------- | ------ | ------------------------------------- |
| `ui/`               | 41MB   | Componentes UI para desktop (SolidJS) |
| `console/`          | 33MB   | Backend SaaS de OpenCode              |
| `web/`              | 14MB   | Documentación (Astro)                 |
| `desktop/`          | 9MB    | App Tauri (Rust)                      |
| `desktop-electron/` | 8.7MB  | App Electron                          |
| `app/`              | 3.3MB  | Frontend SolidJS                      |
| `storybook/`        | 173K   | Docs de componentes                   |
| `slack/`            | 72K    | Integración Slack                     |
| `containers/`       | 21K    | Docker configs                        |
| `extensions/`       | 6K     | Extensiones VSCode                    |

**Total a eliminar**: ~120MB+

---

## Módulos de `src/` a Eliminar

### Módulos NO necesarios para ejecución autónoma:

| Módulo          | Razón                                      |
| --------------- | ------------------------------------------ |
| `cli/`          | CLI commands locales (tui, upgrade, etc)   |
| `server/`       | Servidor HTTP interno                      |
| `pty/`          | Pseudo-terminal (terminal interactiva)     |
| `ide/`          | Integración VSCode                         |
| `acp/`          | Agent Client Protocol (no es MCP)          |
| `share/`        | Compartir sesiones                         |
| `installation/` | Upgrade de OpenCode (no aplicable en SaaS) |
| `format/`       | Formateo de código local                   |
| `patch/`        | Parches                                    |
| `worktree/`     | Git worktree                               |
| `scheduler/`    | No se usa                                  |

---

## Módulos de `src/` a CONSERVAR

### Módulos necesarios para el agente:

| Módulo           | Para qué                                                    |
| ---------------- | ----------------------------------------------------------- |
| `agent/`         | Definición de agentes (build, plan, explore, etc)           |
| `provider/`      | Conexión a LLMs (OpenAI, Anthropic, Google, etc)            |
| `tool/`          | Herramientas (edit, read, bash, grep, glob, websearch, etc) |
| `session/`       | Sesiones, prompts, contexto, mensajes                       |
| `storage/`       | Base de datos SQLite (Drizzle)                              |
| `project/`       | Workspace/project management                                |
| `config/`        | Configuración                                               |
| `permission/`    | Permisos y seguridad                                        |
| `bus/`           | Event bus                                                   |
| `global/`        | Paths globales                                              |
| `id/`            | Identificadores                                             |
| `mcp/`           | Model Context Protocol - herramientas externas (APIs, DBs)  |
| `lsp/`           | Language Server Protocol - análisis de código               |
| `shell/`         | Ejecutar comandos bash                                      |
| `file/`          | Operaciones de archivo                                      |
| `snapshot/`      | Snapshots para undo                                         |
| `command/`       | Invocar subagentes/skills                                   |
| `plugin/`        | Sistema de plugins                                          |
| `skill/`         | Skills del agente                                           |
| `question/`      | Hacer preguntas al usuario                                  |
| `flag/`          | Feature flags                                               |
| `control-plane/` | Workspace management                                        |
| `auth/`          | Autenticación                                               |
| `account/`       | Cuentas                                                     |
| `util/`          | Utilidades varias                                           |

---

## Dependencias Detectadas

### Imports problemáticos a limpiar (ejemplos):

1. **`session/prompt.ts`** importa:
   - `shell/` ✅ necesario (bash)
   - `command/` ✅ necesario (subagentes)

2. **`tool/bash.ts`** importa:
   - `shell/` ✅ necesario

3. **`tool/edit.ts`** importa:
   - `lsp/` ✅ necesario (para diagnostics)

4. **`tool/read.ts`** importa:
   - `lsp/` ✅ necesario

5. **`session/message-v2.ts`** importa:
   - `lsp/` ✅ necesario

6. **`api.ts`** importa:
   - `installation/` ⚠️ NO necesario - solo para upgrades

### Imports a eliminar en archivos clave:

- `api.ts`: eliminar import de `installation/`
- `session/llm.ts`: eliminar import de `installation/`
- `config/config.ts`: eliminar import de `installation/` (puede requerirse refactor)

---

## Acción Recomendada

### Paso 1: Eliminar paquetes completos

```bash
rm -rf packages/opencode-fork/packages/ui/
rm -rf packages/opencode-fork/packages/console/
rm -rf packages/opencode-fork/packages/web/
rm -rf packages/opencode-fork/packages/desktop/
rm -rf packages/opencode-fork/packages/desktop-electron/
rm -rf packages/opencode-fork/packages/app/
rm -rf packages/opencode-fork/packages/storybook/
rm -rf packages/opencode-fork/packages/slack/
rm -rf packages/opencode-fork/packages/containers/
rm -rf packages/opencode-fork/packages/extensions/
```

### Paso 2: Eliminar módulos src innecesarios

```bash
rm -rf packages/opencode-fork/packages/opencode/src/cli/
rm -rf packages/opencode-fork/packages/opencode/src/server/
rm -rf packages/opencode-fork/packages/opencode/src/pty/
rm -rf packages/opencode-fork/packages/opencode/src/ide/
rm -rf packages/opencode-fork/packages/opencode/src/acp/
rm -rf packages/opencode-fork/packages/opencode/src/share/
rm -rf packages/opencode-fork/packages/opencode/src/installation/
rm -rf packages/opencode-fork/packages/opencode/src/format/
rm -rf packages/opencode-fork/packages/opencode/src/patch/
rm -rf packages/opencode-fork/packages/opencode/src/worktree/
rm -rf packages/opencode-fork/packages/opencode/src/scheduler/
```

### Paso 3: Limpiar imports problemáticos

- Revisar y eliminar imports de `installation/` en archivos como `api.ts`, `session/llm.ts`
- Posiblemente needed refactor de `config/config.ts`

---

## Notas Importantes

1. **MCP es necesario**: El agente usa MCP para conectar con herramientas externas (APIs, databases, etc). NO eliminar.

2. **LSP es necesario**: El agente usa LSP para análisis de código (autocomplete, diagnostics). NO eliminar.

3. **Shell es necesario**: El agente ejecuta comandos bash. NO eliminar.

4. **CLI vs API**: El fork expone una API en `src/api.ts` que es lo que usa `agent-core`. El código CLI local no es necesario para el SaaS.

5. **Server interno**: OpenCode corre un servidor HTTP interno para la UI TUI. No es necesario para el SaaS porque el frontend es separado.

---

## Verificación Post-Limpieza

Después de la limpieza, verificar:

1. `agent-core` puede importar `api.ts` correctamente
2. El agente puede ejecutar tools (edit, read, bash, etc)
3. La base de datos SQLite funciona
4. Los LLMs responden correctamente
5. MCP tools están disponibles

---

## Tamaño Estimado Post-Limpieza

| Antes                         | Después                    |
| ----------------------------- | -------------------------- |
| ~120MB+ (paquetes eliminados) | ~8-9MB (solo `opencode/`)  |
| ~30+ módulos src              | ~20 módulos src necesarios |

Reducción: **~90%** del código eliminado.
