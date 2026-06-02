# OpenCode Integration Guide

## Overview

AgenTo SaaS now integrates OpenCode as an internal library instead of executing it as an external CLI. This provides better performance, cross-platform compatibility, and full control over the execution flow.

## Architecture

```
agento-saas-nodejs/
├── packages/
│   ├── opencode/                 # OpenCode fork (local workspace dependency)
│   │   └── packages/
│   │       └── opencode/
│   │           ├── src/
│   │           │   ├── api.ts    # ← New: API exports for SaaS integration
│   │           │   ├── lib.ts    # ← New: Library entry point
│   │           │   ├── session/  # Session management
│   │           │   ├── agent/    # Agent definitions
│   │           │   └── provider/ # AI providers
│   │           └── package.json
│   ├── agent-core/               # AgenTo agent core
│   │   ├── src/
│   │   │   ├── adapter/
│   │   │   │   ├── FullModeAdapter.ts        # Old: CLI-based (deprecated)
│   │   │   │   └── OpenCodeApiAdapter.ts     # New: API-based
│   │   │   ├── opencode/
│   │   │   │   └── OpenCodeIntegration.ts    # Integration module
│   │   │   └── index.ts
│   │   └── package.json
│   ├── backend/                  # NestJS backend
│   └── frontend/                 # Next.js frontend
└── package.json                  # Root workspace config
```

## Usage

### 1. Initialize OpenCode API

```typescript
import { initializeOpenCode } from '@agento/agent-core';

// Initialize with custom data directory
const adapter = await initializeOpenCode({
  baseDataDir: '/var/data/agento/tenants',
});
```

### 2. Execute a Prompt

```typescript
import { getOpenCodeAdapter } from '@agento/agent-core';

const adapter = await getOpenCodeAdapter();

const result = await adapter.execute(
  'Create a REST API endpoint for user management',
  {
    tenantId: 'tenant-123',
    taskId: 'task-456',
  }
);

console.log(result.content);
console.log('Tokens used:', result.tokensUsed);
```

### 3. Use with Sessions

```typescript
// Create a new session
const session = await opencodeApi.createSession({
  tenantId: 'tenant-123',
  directory: '/var/data/agento/tenants/tenant-123/workspace',
  title: 'API Development',
});

// Execute prompt in session
const result = await opencodeApi.executePrompt(session.id, {
  prompt: 'Add authentication to the API',
  model: 'anthropic/claude-sonnet-4-20250514',
  agent: 'build',
});
```

## Multi-Tenant Support

Each tenant has:
- **Isolated workspace**: `/var/data/agento/tenants/{tenantId}/workspace`
- **OpenCode database**: `/var/data/agento/tenants/{tenantId}/opencode.db`
- **Configuration**: Custom opencode.json per tenant

### Directory Structure

```
/var/data/agento/tenants/
├── tenant-123/
│   ├── workspace/           # Working directory for code
│   │   └── package.json
│   ├── opencode.db          # SQLite database for sessions
│   └── config.json          # Tenant configuration
└── tenant-456/
    ├── workspace/
    ├── opencode.db
    └── config.json
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENCODE_DATA_DIR` | Base directory for OpenCode data | `.opencode-data` |
| `AGENTO_STORAGE_PATH` | Base directory for tenant storage | `/storage/tenants` |

## Migration from CLI-based Approach

### Before (CLI-based)
```typescript
// FullModeAdapter spawned opencode.exe via node-pty
const adapter = new FullModeAdapter();
await adapter.execute(prompt, context);
```

### After (API-based)
```typescript
// OpenCodeApiAdapter imports OpenCode directly
const adapter = await getOpenCodeAdapter();
await adapter.execute(prompt, context);
```

## Benefits

1. **Cross-platform**: Works on Linux VPS without OS-specific executables
2. **Better performance**: No process spawning overhead
3. **Full control**: Access to all OpenCode internals
4. **Easier debugging**: Direct access to execution context
5. **Updates**: Can pull updates from OpenCode upstream

## Troubleshooting

### Database Initialization

If you see database errors, ensure the data directory is writable:

```bash
mkdir -p /var/data/agento/tenants
chmod 755 /var/data/agento/tenants
```

### TypeScript Errors

If you see import errors, ensure the workspace is configured correctly:

```json
// package.json (root)
{
  "workspaces": [
    "packages/*",
    "packages/opencode/packages/*"
  ]
}
```

### Session Management

Sessions are automatically created per tenant. To list sessions:

```typescript
const sessions = await opencodeApi.listSessions('tenant-123');
for (const session of sessions) {
  console.log(session.title, session.id);
}
```

## Next Steps

1. Update backend services to use `OpenCodeApiAdapter` instead of `FullModeAdapter`
2. Add proper error handling and retry logic
3. Implement streaming of execution progress
4. Add metrics and monitoring
