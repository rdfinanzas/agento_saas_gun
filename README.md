# Agento SaaS - Node.js 100% con Accomplish

**Arquitectura UNIFICADA con DOS MODOS de uso**

## Visión del Producto

```
┌─────────────────────────────────────────────────────────────────┐
│  MODO FULL: Chat con Accomplish                                │
│  - Ejecutar código, navegar internet, manipular archivos         │
│  - Cada usuario tiene su workspace aislado                      │
│  - Configurar integraciones, subir archivos                      │
├─────────────────────────────────────────────────────────────────┤
│  MODO LIMITADO: Agente WhatsApp                                 │
│  - Solo responder clientes                                      │
│  - Consultar base de conocimiento, integraciones                 │
│  - SIN ejecutar código ni modificar sistema                       │
└─────────────────────────────────────────────────────────────────┘
```

## Estructura del Monorepo

```
agento-saas-nodejs/
├── packages/
│   ├── backend/              # Express API (TypeScript)
│   │   ├── src/
│   │   │   ├── modules/security/  # Capa de seguridad
│   │   │   ├── modules/auth/
│   │   │   ├── modules/chat/
│   │   │   └── modules/whatsapp/
│   │   ├── prisma/schema.prisma
│   │   └── package.json
│   │
│   ├── frontend/             # Next.js 14
│   │   ├── app/
│   │   │   ├── workspace/[tenant]/chat/
│   │   │   └── admin/
│   │   └── package.json
│   │
│   └── ai-worker/            # OpenCode wrapper
│       ├── src/executor/opencode-executor.service.ts
│       └── package.json
│
├── package.json              # Root
├── turbo.json                # Turborepo
└── README.md
```

## Aislamiento Multi-Tenant

```
/storage/tenants/
├── tenant_a/
│   ├── workspace/           # Workspace AISLADO
│   ├── files/                # Archivos del tenant
│   └── context/              # Contexto de conversación
├── tenant_b/
│   ├── workspace/           # AISLADO de tenant_a
│   └── files/
└── tenant_c/
    └── workspace/
```

## Modos de Ejecución

| Modo | Descripción | Comandos Permitidos |
|------|-------------|---------------------|
| **FULL** | Chat con Accomplish | execute_code, browse_web, file_read, file_write, api_call |
| **LIMITED** | Agente WhatsApp | knowledge_query, integration_read, data_lookup |

## Arquitectura de Seguridad

```
REQUEST → Security Layer
           ├─ Valida MODO (FULL vs LIMITED)
           ├─ Filtra comandos permitidos
           ├─ Sanitiza paths (no path traversal)
           ├─ Verifica cuotas del tenant
           └─ Aísla workspace por tenant
           ↓
       OpenCode Executor (node-pty)
           ├─ Proceso SEPARADO por tenant
           ├─ PTY con PATH AISLADO
           ├─ Variables de entorno del tenant
           └─ Contexto del tenant
```

## Configuración

### Backend (Express)
- Puerto: 3000
- Database: PostgreSQL
- Redis: BullMQ colas
- OpenCode: node-pty

### Frontend (Next.js)
- App Router
- TypeScript
- Socket.io client

### AI Worker
- node-pty para ejecutar OpenCode
- Aislamiento por tenant
- Dos modos: FULL y LIMITED

## Instalación

```bash
# Instalar dependencias
cd agento-saas-nodejs
npm install

# Ejecutar en desarrollo
npm run dev

# Build
npm run build
```

## Estado de Implementación

✅ Estructura del monorepo creada
✅ Prisma schema con multi-tenancy
✅ Security layer con modos FULL/LIMITED
✅ OpenCode executor con node-pty
✅ Backend Express básico
✅ Frontend Next.js básico

## Próximos Pasos

1. Ejecutar `npm install` para instalar dependencias
2. Crear migraciones de Prisma: `npx prisma migrate dev`
3. Copiar binarios de OpenCode a `ai-worker/binaries/`
4. Configurar `.env` con tus credenciales
5. Ejecutar: `npm run dev`

---

**Arquitectura diseñada para multi-tenant con DOS MODOS de uso unificados.**
