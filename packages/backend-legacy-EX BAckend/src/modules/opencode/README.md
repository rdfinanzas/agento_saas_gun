# Módulo OpenCode

Este módulo integra OpenCode AI en el backend de Agento SaaS, permitiendo la ejecución de agentes de IA con aislamiento por tenant.

## Arquitectura

```
opencode/
├── services/
│   ├── cli-resolver.service.ts      # Resolución de binarios OpenCode
│   └── opencode-executor.service.ts # Ejecución de prompts con PTY
├── adapters/
│   └── whatsapp.adapter.ts          # Adaptador para conversaciones WhatsApp
└── examples/
    └── test-opencode.example.ts     # Ejemplos de uso
```

## Componentes

### CliResolverService

Detecta y resuelve la ruta al binario de OpenCode según la plataforma:

- **Windows**: Detecta soporte AVX2 y elige binario óptimo
- **macOS/Linux**: Usa binarios universales
- **Fallback**: Usa npx si no encuentra binario local

```typescript
const resolver = new CliResolverService();
const resolved = await resolver.resolve();
console.log(resolved.cliPath); // /path/to/opencode
```

### OpenCodeExecutorService

Ejecuta prompts de OpenCode en contextos aislados:

- Crea PTYs por cada tenant
- Aisla el entorno de ejecución
- Maneja timeouts y errores
- Parsea la salida (elimina códigos ANSI)

```typescript
const executor = new OpenCodeExecutorService();
const result = await executor.execute('¿Qué hora es?', {
  tenantId: 'tenant-123',
  mode: ExecutionMode.LIMITED,
  workspacePath: './storage/tenants/tenant-123/workspace',
  conversationHistory: [...],
  agentInstructions: 'Eres un asistente útil',
  knowledgeBase: {...}
});
```

### WhatsAppAdapter

Adaptador que integra OpenCode con WhatsApp:

- Obtiene configuración de `whatsappConfig` (CORRECCIÓN: no usa `agent`)
- Persiste historial en `conversationContext.messages` (CORRECCIÓN: no usa `memory`)
- Maneja errores de forma amigable
- Mantiene contexto de conversación

```typescript
const adapter = new WhatsAppAdapter(executor);
const response = await adapter.generateResponse(
  'Hola, ¿cuál es el precio?',
  'tenant-123',
  '+1234567890',
  '+0987654321'
);
```

## Modelos Prisma Utilizados

### WhatsAppConfig
```prisma
model WhatsAppConfig {
  id                  String   @id
  tenantId            String
  phoneNumberId       String
  accessToken         String
  webhookVerifyToken  String
  agentMode           AgentMode @default(LIMITED)
  agentInstructions   String?
  knowledgeBase       Json?
  isActive            Boolean  @default(true)
  // ...
}
```

### ConversationContext
```prisma
model ConversationContext {
  id        String   @id
  tenantId  String
  type      ContextType
  messages  Json     @default("[]")
  memory    Json     @default("{}")
  // ...
}
```

## Modos de Ejecución

### FULL
Comandos permitidos:
- `execute_code`
- `browse_web`
- `file_read`
- `file_write`
- `api_call`

### LIMITED
Comandos permitidos:
- `knowledge_query`
- `integration_read`
- `data_lookup`

## Seguridad

- **Aislamiento por tenant**: Cada tenant tiene su propio workspace
- **Variables de entorno**: `TENANT_ID`, `EXECUTION_MODE`, `HOME`
- **Timeout**: Máximo 2 minutos por defecto
- **Sanitización de paths**: Previene path traversal

## Instalación

```bash
# Instalar dependencias
npm install node-pty opencode-ai

# Verificar instalación
npm run test:opencode
```

## Uso

```typescript
import { OpenCodeExecutorService, WhatsAppAdapter } from './modules/opencode';

// Crear executor
const executor = new OpenCodeExecutorService();

// Verificar salud
const health = await executor.checkHealth();
if (!health.available) {
  console.error('OpenCode no disponible');
}

// Ejecutar prompt
const result = await executor.execute('Prompt aquí', {
  tenantId: '...',
  mode: ExecutionMode.LIMITED,
  workspacePath: '...',
});

// Usar con WhatsApp
const adapter = new WhatsAppAdapter(executor);
const response = await adapter.generateResponse(...);
```

## Troubleshooting

### OpenCode no encontrado
```bash
# Instalar opencode-ai
npm install opencode-ai

# O usar npx (fallback automático)
npx opencode --version
```

### Error de permisos en Windows
Ejecuta PowerShell como administrador o cambia la política de ejecución:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### PTY no funciona en WSL
Instalar dependencias:
```bash
sudo apt-get install -y make python3
```

## Dependencias

- `node-pty`: Creación de pseudoterminals
- `opencode-ai`: Binarios de OpenCode AI
- `@prisma/client`: Acceso a base de datos

## Correcciones Aplicadas

1. **Modelos Prisma**: Usar `whatsAppConfig` en lugar de `agent`
2. **Contexto**: Usar `conversationContext.messages` en lugar de `memory`
3. **Binarios**: Detectar AVX2 en Windows para mejor rendimiento
