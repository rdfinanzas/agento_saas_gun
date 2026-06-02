# AI Worker Package Migration Analysis

## Overview

The `@agento/ai-worker` package is a worker module designed to execute AI tasks using the OpenCode CLI. This document analyzes its structure and provides guidance for migrating it to the `@agento/server` package.

---

## File Structure

```
packages/ai-worker/
├── package.json
├── tsconfig.json
├── binaries/
│   └── opencode-windows-x64/
│       ├── package.json
│       └── bin/
│           └── opencode.exe
└── src/
    ├── index.ts
    ├── context/
    │   └── context-manager.ts
    ├── executor/
    │   ├── opencode-executor.service.ts
    │   └── cli-resolver.ts
    └── integrations/
        └── integration-manager.ts
```

---

## Files and Their Purpose

### 1. `src/index.ts`
**Purpose**: Main entry point for the ai-worker package. Exports all public modules.

**Exports**:
- `OpenCodeExecutor` class and singleton instance
- `ExecutionContext`, `ExecutionInput`, `ExecutionOutput` types
- `ContextManager` class and singleton instance
- Context-related types (`ConversationContext`, `ContextMessage`, `TenantContext`, etc.)

### 2. `src/context/context-manager.ts`
**Purpose**: Manages conversation context and tenant-specific configurations.

**Key Classes/Functions**:
- `ContextManager` class
  - `createContext(tenantId, conversationId)` - Creates new conversation context
  - `getContext(contextId)` - Retrieves context by ID
  - `addMessage(contextId, message)` - Adds message to context
  - `getMessages(contextId)` - Gets all messages in context
  - `clearContext(contextId)` - Clears context messages
  - `setTenantContext(tenantId, context)` - Sets tenant configuration
  - `getTenantContext(tenantId)` - Gets tenant configuration
  - `loadTenantKnowledge(tenantId)` - Loads tenant knowledge base
  - `searchKnowledge(tenantId, query)` - Searches knowledge base

**Types Defined**:
- `ConversationContext` - Full conversation state
- `ContextMessage` - Individual message with role, content, timestamp
- `TenantContext` - Tenant workspace and configuration
- `KnowledgeEntry` - Knowledge base entry with optional embedding
- `IntegrationConfig` - External integration configuration
- `AgentConfig` - Agent mode and tool restrictions

### 3. `src/executor/opencode-executor.service.ts`
**Purpose**: Executes OpenCode CLI via pseudo-terminal (PTY) for AI task processing.

**Key Classes/Functions**:
- `OpenCodeExecutor` class (extends EventEmitter)
  - `execute(context, input, options)` - Main execution method
  - `cancelExecution(sessionId)` - Cancels running execution
  - `cancelAll()` - Cancels all active executions
  - Private methods:
    - `buildArgs(context, input)` - Constructs CLI arguments
    - `extractResponse(output)` - Parses CLI output
    - `getDefaultWorkspace(tenantId)` - Gets workspace path
    - `generateSessionId()` - Creates unique session ID

**Events Emitted**:
- `message` - Output data received
- `complete` - Execution finished successfully
- `error` - Execution failed

**Types Defined**:
- `ExecutionContext` - Execution environment configuration
- `ExecutionInput` - Prompt and tools for execution
- `ExecutionOutput` - Response with optional tokens and tool calls

### 4. `src/executor/cli-resolver.ts`
**Purpose**: Resolves the OpenCode CLI binary path across different environments.

**Key Classes/Functions**:
- `CliResolverService` class
  - `resolve()` - Finds CLI path (cached)
  - `isAvailable()` - Checks if CLI is accessible
  - Private methods:
    - `resolveLocalCli()` - Checks local/bundled paths
    - `resolveNpxCli()` - Falls back to npx

**Types Defined**:
- `ResolvedCliPaths` - CLI path information with source type

### 5. `src/integrations/integration-manager.ts`
**Purpose**: Manages external integrations (Google Sheets, Excel, API, Webhooks).

**Key Classes/Functions**:
- `IntegrationManager` class
  - `register(integration)` - Registers new integration
  - `get(id)` - Gets integration by ID
  - `getAll()` - Lists all integrations
  - `getEnabled()` - Lists enabled integrations
  - `execute(integrationId, action, params)` - Executes integration action
  - Private methods:
    - `executeGoogleSheets()` - Google Sheets integration (placeholder)
    - `executeExcel()` - Excel integration (placeholder)
    - `executeApi()` - Generic API calls
    - `executeWebhook()` - Webhook execution

**Types Defined**:
- `Integration` - Integration configuration
- `IntegrationResult` - Execution result with success/error

### 6. `binaries/opencode-windows-x64/`
**Purpose**: Bundled Windows x64 binary for OpenCode CLI.

**Contents**:
- `package.json` - Package metadata for the binary
- `bin/opencode.exe` - Windows executable

---

## Dependencies

### Production Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `node-pty` | ^1.0.0 | Pseudo-terminal for CLI execution |
| `opencode-ai` | ^1.2.10 | OpenCode AI integration |
| `bullmq` | ^5.7.0 | Job queue for task processing |
| `ioredis` | ^5.3.2 | Redis client for queue backend |

### Development Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `@types/node` | ^20.11.0 | Node.js type definitions |
| `typescript` | ^5.3.0 | TypeScript compiler |

### Additional Dependencies (Implicit)
| Package | Source | Purpose |
|---------|--------|---------|
| `uuid` | Used in context-manager | UUID generation |

---

## Integration Points with agent-core

The ai-worker package has significant overlap with `@agento/agent-core`. Key integration points:

### 1. CLI Resolution
Both packages have CLI resolution logic:
- **ai-worker**: `src/executor/cli-resolver.ts`
- **agent-core**: `src/utils/cli-resolver.ts`

**Recommendation**: Use agent-core's CLI resolver as it's more comprehensive.

### 2. Execution Adapters
Similar execution patterns exist:
- **ai-worker**: `OpenCodeExecutor` uses node-pty
- **agent-core**: `FullModeAdapter` uses node-pty with more features

**Key Differences**:
| Feature | ai-worker | agent-core |
|---------|-----------|------------|
| Security Layer | None | Integrated |
| Tenant Management | Basic | Full support |
| Permission Handling | None | Full support |
| Progress Events | Basic | Detailed |
| Tool Validation | None | SecurityLayer |

### 3. Context Management
- **ai-worker**: In-memory context with Maps
- **agent-core**: Uses TenantManager and WorkspaceManager

### 4. Shared Types
Both define similar interfaces:
- `ExecutionContext`
- `ExecutionOutput` / `ExecutionResult`
- Tool execution types

---

## Suggested Migration Approach

### Phase 1: Assessment and Planning
1. **Audit current usage**: Check if ai-worker is used anywhere in the codebase
2. **Identify unique features**: Find any features not present in agent-core
3. **Map dependencies**: Ensure all dependencies are available in server package

### Phase 2: Integration Decision
Choose one of the following approaches:

#### Option A: Merge into agent-core (Recommended)
- Move context management to agent-core
- Enhance agent-core adapters with any missing features
- Deprecate ai-worker package entirely

#### Option B: Import as dependency
- Add ai-worker as dependency to server
- Use as-is with minimal changes
- Less code duplication but adds complexity

#### Option C: Selective migration
- Move only needed components to server
- Keep ai-worker for backwards compatibility
- Gradual deprecation path

### Phase 3: Migration Steps (Option A Recommended)

1. **Move Context Manager**
   ```
   src/context/context-manager.ts -> packages/agent-core/src/context/ContextManager.ts
   ```
   - Update imports to use agent-core types
   - Integrate with TenantManager

2. **Move Integration Manager**
   ```
   src/integrations/integration-manager.ts -> packages/server/src/modules/integrations/manager.ts
   ```
   - Keep in server package as integrations are server-side

3. **Consolidate CLI Resolution**
   - Use agent-core's `resolveOpenCodeCli`
   - Remove ai-worker's cli-resolver.ts

4. **Enhance FullModeAdapter**
   - Add any missing features from OpenCodeExecutor
   - Ensure all use cases are covered

5. **Handle Binary Assets**
   - Move binaries to shared location or reference from agent-core

### Phase 4: Update Dependencies

Add to server package.json:
```json
{
  "dependencies": {
    "node-pty": "^1.0.0",
    "bullmq": "^5.7.0",
    "ioredis": "^5.3.2",
    "uuid": "^9.0.0"
  }
}
```

### Phase 5: Testing

1. Unit tests for migrated components
2. Integration tests with agent-core
3. End-to-end tests via server API

---

## Risk Assessment

### High Risk
- **node-pty native module**: Requires compilation, may have platform-specific issues
- **BullMQ/Redis**: Adds infrastructure dependency

### Medium Risk
- **Type compatibility**: Interface differences between packages
- **Event handling**: Different EventEmitter patterns

### Low Risk
- **UUID**: Common utility, easy to add
- **Context management**: Pure TypeScript, no native dependencies

---

## Files to Create in Server Package

If following Option A (merge into agent-core):

```
packages/server/src/
├── modules/
│   └── integrations/
│       ├── index.ts
│       ├── integration-manager.ts (from ai-worker)
│       └── types.ts
└── workers/
    └── ai-worker/
        ├── index.ts
        └── README.md

packages/agent-core/src/
├── context/
│   ├── ContextManager.ts (enhanced from ai-worker)
│   └── types.ts
└── (existing files updated)
```

---

## Checklist for Migration

- [ ] Verify ai-worker is not imported elsewhere
- [ ] Add required dependencies to server package
- [ ] Move context management with tests
- [ ] Move integration manager
- [ ] Update all imports
- [ ] Add BullMQ worker setup
- [ ] Configure Redis connection
- [ ] Update TypeScript configs
- [ ] Create migration tests
- [ ] Update documentation
- [ ] Remove ai-worker package

---

## Additional Notes

1. **BullMQ Integration**: The ai-worker includes BullMQ for job queuing but doesn't show the worker implementation. This needs to be added during migration.

2. **Redis Requirement**: BullMQ requires Redis. Ensure Redis is available in the deployment environment.

3. **Binary Size**: The opencode.exe binary is platform-specific. Consider:
   - Using npm packages for cross-platform support
   - Downloading binaries during install
   - Platform-specific package variants

4. **Placeholder Implementations**: Google Sheets and Excel integrations are placeholders. Full implementation requires:
   - Google API credentials
   - Microsoft Graph API setup
   - OAuth2 flow integration

---

*Document generated: 2026-03-17*
*Package version analyzed: @agento/ai-worker@1.0.0*
