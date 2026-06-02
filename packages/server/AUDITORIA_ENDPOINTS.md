# Auditoría de Endpoints - Backend Node.js

## Resumen

| Categoría | Endpoints | Archivos |
|-----------|-----------|---------|
| Auth | 5 | auth.routes.ts |
| Agents | 15+ | agents.routes.ts, master-agent.routes.ts |
| Chat | ~5 | chat.routes.ts |
| WhatsApp | 15+ | webhook.routes.ts, agent.routes.ts, etc. |
| Billing | ~5 | billing.routes.ts |
| OpenCode | 30+ | providers.routes.ts, skills.routes.ts, etc. |
| Knowledge | ~5 | knowledge.routes.ts |
| Analytics | ~5 | analytics.routes.ts |
| Integrations | 10+ | integration.routes.ts |
| Admin | ~5 | admin.routes.ts |

**Total estimado: ~100 endpoints**

---

## Detalle por Módulo

### 1. Auth (`/api/v1/auth/*`)
- POST /login
- POST /register
- POST /logout
- POST /refresh
- GET /me

### 2. Agents (`/api/v1/agents/*`)
- GET / (list)
- POST / (create)
- GET /:id (get)
- PUT /:id (update)
- DELETE /:id (delete)
- GET /:id/chat ( chat history)
- POST /:id/chat ( send message)

### 3. Master Agent (`/api/v1/master/*`)
- GET / (status)
- POST /chat
- POST /tools/generate
- GET /integrations

### 4. Master Agent V2 (`/api/v1/master/v2/*`)
- POST /create-agent
- POST /configure-integration
- GET /agents
- POST /test-agent

### 5. Chat (`/api/v1/chat/*`)
- POST / (start session)
- GET /:sessionId
- POST /:sessionId/message
- GET /:sessionId/stream (SSE)

### 6. WhatsApp (`/api/v1/whatsapp/*`)
- GET /webhook (verify)
- POST /webhook(incoming message)
- GET /agents(list configs)
- POST /agents(create config)
- GET /agents/:id
- PUT /agents/:id
- GET /conversations
- GET /conversations/:id
- POST /baileys/connect
- GET /baileys/:id/qr

### 7. OpenCode (`/api/v1/opencode/*`)
- GET /providers
- POST /providers
- GET /providers/:id
- PUT /providers/:id
- GET /identity
- PUT /identity
- GET /permissions
- PUT /permissions
- GET /skills
- POST /skills
- GET /skills/:id
- PUT /skills/:id
- GET /marketplace
- GET /marketplace/:id
- POST /marketplace/:id/install
- POST /sandbox/execute
- GET /automation
- POST /automation
- GET /automation/:id
- PUT /automation/:id
- GET /connectors
- POST /connectors
- GET /approval
- POST /approval
- PUT /approval/:id

### 8. Billing (`/api/v1/billing/*`)
- GET / (current subscription)
- POST /subscribe
- POST /cancel
- GET /invoices
- GET /invoices/:id
- POST /webhook/mercadopago

### 9. Knowledge (`/api/v1/knowledge/*`)
- GET / (list entries)
- POST / (create entry)
- GET /:id
- PUT /:id
- DELETE /:id
- POST /search (semantic search)

### 10. Analytics (`/api/v1/analytics/*`)
- GET /overview
- GET /conversations
- GET /agents
- GET /usage

### 11. Integrations (`/api/v1/integrations/*`)
- GET / (list)
- POST / (create)
- GET /:id
- PUT /:id
- DELETE /:id
- POST /:id/sync
- GET /google-sheets
- POST /google-sheets
- GET /google-sheets/:id/data

### 12. Admin (`/api/v1/admin/*`)
- GET /users
- GET /tenants
- GET /stats
- POST /api-keys
- GET /api-keys

---

## Servicios por Módulo

### Auth
- `auth.service.ts` - Autenticación
- `jwt.service.ts` - Tokens JWT

### Agents
- `agents.service.ts` - CRUD de agentes
- `master-agent.service.ts` - Agente maestro
- `internal-chat.service.ts` - Chat interno

### WhatsApp
- `whatsapp-baileys.service.ts` - Baileys (WhatsApp Web)
- `whatsapp-cloud-api.service.ts` - Cloud API oficial
- `agent.service.ts` - Agente de WhatsApp
- `conversation-monitor.service.ts` - Monitoreo

### Billing
- `subscription.service.ts` - Suscripciones
- `mercadopago.service.ts` - Integración MP
- `coupon.service.ts` - Cupones
- `dunning.service.ts` - Recuperación de pagos

### OpenCode
- `agent-identity.service.ts` - Identidad del agente
- `scheduler.service.ts` - Tareas programadas
- `api-docs.service.ts` - Documentación de APIs

---

## Dependencias Externas

| Servicio | Uso | Endpoint |
|----------|-----|----------|
| MercadoPago | Pagos | api.mercadopago.com |
| Meta WhatsApp | Mensajes | graph.facebook.com |
| Google Sheets | Datos | sheets.googleapis.com |
| OpenAI | Embeddings | api.openai.com |
| Anthropic | LLM | api.anthropic.com |

---

## Notas

1. **WebSocket**: Socket.io en `src/modules/chat/chat.gateway.ts`
2. **Workers**: BullMQ queues en `src/modules/ai-worker/`
3. **Redis**: Sesiones y cache
4. **Prisma**: ORM con PostgreSQL

---

*Auditoría generada: FASE 0*
*Fecha: Marzo 2026*
