# Analytics Module - FASE 3.2

## Overview

Módulo de analytics para el dashboard de Agento SaaS. Proporciona métricas y estadísticas sobre conversaciones, mensajes, uso de la plataforma y performance de agentes.

## Estructura

```
analytics/
├── services/
│   └── analytics.service.ts      # Lógica de negocio y consultas a la BD
├── controllers/
│   └── analytics.controller.ts   # Controladores HTTP
├── routes/
│   └── analytics.routes.ts       # Definición de rutas
├── examples/
│   └── test-analytics.example.ts # Ejemplos de uso
├── index.ts                      # Exportaciones públicas
└── README.md                     # Este archivo
```

## Endpoints API

Todos los endpoints requieren autenticación mediante token JWT. El `tenantId` se extrae del token.

### Dashboard Stats
```
GET /api/v1/analytics/dashboard
```
Retorna estadísticas generales:
- Total de conversaciones
- Conversaciones activas
- Total de mensajes
- Cantidad de agentes
- Conversaciones y mensajes de hoy
- Promedios calculados

### Conversation Metrics
```
GET /api/v1/analytics/conversations?period=day&days=30
```
Retorna métricas de conversaciones agrupadas por período:
- `period`: `day` | `week` | `month` (default: day)
- `days`: número de días a analizar (default: 30)

Retorna:
- Total de conversaciones
- Total de mensajes
- Promedio de mensajes por conversación
- Conversaciones por estado (active, closed, human_takeover)
- Timeline con datos agrupados por período

### Usage Stats
```
GET /api/v1/analytics/usage?days=30
```
Retorna estadísticas de uso desde `TenantUsage`:
- Requests y mensajes por día
- Totales acumulados
- Promedios diarios
- Día pico de uso
- Tendencia (comparación últimos 7 días con 7 días anteriores)

### Agent Performance
```
GET /api/v1/analytics/agents/performance?days=30
```
Retorna performance por agente (WhatsAppConfig):
- Total de conversaciones por agente
- Conversaciones activas
- Total de mensajes
- Promedio de mensajes por conversación
- Conversaciones por estado
- Ordenado por rendimiento

### Top Queries
```
GET /api/v1/analytics/queries/top?limit=10&days=30
```
Retorna las queries más frecuentes:
- `limit`: número de resultados (default: 10)
- `days`: período a analizar (default: 30)

Retorna:
- Queries más frecuentes
- Categorización automática (greeting, pricing, support, product)
- Mensajes recientes de ejemplo

### Response Time Metrics
```
GET /api/v1/analytics/response-time?days=30
```
Retorna métricas de tiempo de respuesta:
- Tiempo promedio de respuesta
- Tiempo mínimo
- Tiempo máximo
- Total de respuestas analizadas

### Complete Analytics
```
GET /api/v1/analytics/complete?days=30
```
Retorna todas las métricas anteriores en una sola llamada:
- Dashboard stats
- Conversation metrics
- Usage stats
- Agent performance
- Top queries

## Uso del Servicio

```typescript
import { AnalyticsService } from '@/modules/analytics';

const analyticsService = new AnalyticsService();

// Obtener stats del dashboard
const stats = await analyticsService.getDashboardStats(tenantId);

// Métricas de conversaciones
const metrics = await analyticsService.getConversationMetrics(
  tenantId,
  'day',  // agrupar por día
  30      // últimos 30 días
);

// Estadísticas de uso
const usage = await analyticsService.getUsageStats(tenantId, 30);

// Performance de agentes
const performance = await analyticsService.getAgentPerformance(tenantId, 30);

// Top queries
const topQueries = await analyticsService.getTopQueries(tenantId, 10, 30);

// Tiempo de respuesta
const responseTime = await analyticsService.getResponseTimeMetrics(tenantId, 30);

// Todo en una llamada
const complete = await analyticsService.getCompleteAnalytics(tenantId, 30);
```

## Modelos Prisma Utilizados

El módulo utiliza los siguientes modelos de Prisma:

### Conversation
```typescript
model Conversation {
  id              String
  tenantId        String
  configId        String
  phoneNumber     String
  status          String
  lastMessageAt   DateTime?
  messages        Message[]
}
```

### Message
```typescript
model Message {
  id              String
  tenantId        String
  conversationId  String
  fromPhone       String
  toPhone         String
  direction       String   // INCOMING | OUTGOING
  type            String
  content         String?
  status          String
  createdAt       DateTime
}
```

### TenantUsage
```typescript
model TenantUsage {
  id                String
  tenantId          String
  date              DateTime
  requestsCount     Int
  whatsappMessages  Int
}
```

### WhatsAppConfig
```typescript
model WhatsAppConfig {
  id                String
  tenantId          String
  phoneNumberId     String
  phoneNumber       String?
  accessToken       String
  agentMode         AgentMode  // FULL | LIMITED
  isActive          Boolean
  conversations     Conversation[]
}
```

## Ejemplos de Respuestas

### Dashboard Stats Response
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalConversations": 150,
      "activeConversations": 45,
      "totalMessages": 3420,
      "agentsCount": 3,
      "conversationsToday": 12,
      "messagesToday": 285
    },
    "calculated": {
      "avgMessagesPerConversation": 22.8,
      "activeRate": 30
    }
  }
}
```

### Conversation Metrics Response
```json
{
  "success": true,
  "data": {
    "period": "30 días agrupados por day",
    "summary": {
      "totalConversations": 150,
      "totalMessages": 3420,
      "avgMessagesPerConversation": 22.8,
      "byStatus": {
        "active": 45,
        "closed": 95,
        "humanTakeover": 10
      }
    },
    "timeline": [
      {
        "date": "2026-03-01",
        "conversations": 12,
        "messages": 285,
        "byStatus": { "active": 4, "closed": 7, "humanTakeover": 1 }
      }
    ]
  }
}
```

## Testing

Para probar el módulo, puedes ejecutar los ejemplos:

```bash
cd packages/backend
npx ts-node src/modules/analytics/examples/test-analytics.example.ts
```

O hacer llamadas HTTP usando curl:

```bash
# Primero obtén un token JWT del endpoint de login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password","tenantSlug":"your-tenant"}'

# Luego usa el token para obtener analytics
curl http://localhost:3001/api/v1/analytics/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

curl "http://localhost:3001/api/v1/analytics/conversations?period=day&days=30" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

curl "http://localhost:3001/api/v1/analytics/complete?days=30" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Notas de Implementación

1. **Multi-tenancy**: Todas las consultas están filtradas por `tenantId` para asegurar isolation de datos.

2. **Performance**: Las consultas usan `Prisma` con `select` y `include` optimizados para minimizar el número de queries.

3. **Agrupación**: Los datos se pueden agrupar por día, semana o mes según el parámetro `period`.

4. **Cálculos**: Se realizan cálculos de promedios, tendencias y picos para proporcionar insights valiosos.

5. **Categorización**: Las queries se categorizan automáticamente usando pattern matching (greeting, pricing, support, product).

## Próximas Mejoras

- [ ] Agregar caché Redis para endpoints frecuentes
- [ ] Implementar paginación para datasets grandes
- [ ] Agregar exportación a CSV/Excel
- [ ] Métricas en tiempo real con WebSockets
- [ ] Alertas automáticas para anomalías
- [ ] Comparación con períodos anteriores
- [ ] Predicciones usando machine learning

## Créditos

Implementado como parte de la FASE 3.2 del Plan de Acción de Agento SaaS.
