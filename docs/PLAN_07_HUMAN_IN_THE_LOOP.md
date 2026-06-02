# PLAN #7: Conectar Human in the Loop al Agente

**Proyecto:** AgenTo SaaS  
**Problema:** Sistema de aprobaciones existe pero NO está conectado al agente WhatsApp  
**Severidad:** MEDIA  
**Fecha:** 2026-03-11

---

## 1. Diagnóstico del Problema

### Estado Actual

**El sistema existe:**
- ✅ Tabla `PendingResponse` en DB
- ✅ `ApprovalService` con métodos completos
- ✅ Endpoints API (`/approval/pending`, `/approval/:id/approve`, etc.)
- ✅ UI en frontend (`/approvals`)
- ❌ **NO está conectado al agente**

**Flujo actual del agente:**
```
1. Recibe mensaje de WhatsApp
2. Procesa con @agento/agent-core
3. Genera respuesta
4. ENVÍA RESPUESTA DIRECTA ← PROBLEMA
5. No verifica si requiere aprobación
```

**Flujo esperado:**
```
1. Recibe mensaje de WhatsApp
2. Procesa con @agento/agent-core
3. Genera respuesta
4. ¿Requiere aprobación? 
   ├── SÍ → Crear PendingResponse → NO enviar aún
   └── NO → Enviar respuesta
5. Usuario approves/rejects en UI
6. Si approved → Enviar respuesta
```

---

## 2. Solución Propuesta

### Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WHATSAPP AGENT SERVICE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   1. processIncomingMessage()                                      │
│          ↓                                                         │
│   2. Generar respuesta con agente                                   │
│          ↓                                                         │
│   3. shouldRequireApproval(response) ← NUEVO                        │
│          ↓                                                         │
│   4. ¿Aprobación requerida?                                        │
│      ├── SÍ ↓                                                      │
│      │    5. approvalService.createPendingResponse()               │
│      │    6. NO enviar a WhatsApp                                   │
│      │    7. Notificar via WebSocket                                │
│      │                                                              │
│      └── NO ↓                                                       │
│           5. Enviar respuesta a WhatsApp                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         UI DE APROBACIONES                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   • Lista de PendingResponse                                       │
│   • Botones Approve/Reject                                         │
│   • Notificación en tiempo real                                    │
│   • Al approve → Enviar a WhatsApp                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Plan de Implementación

### 3.1 Crear ApprovalDecisionService

**Archivo nuevo:** `packages/backend/src/modules/whatsapp/services/approval-decision.service.ts`

```typescript
class ApprovalDecisionService {
  /**
   * Determina si una respuesta requiere aprobación humana
   */
  async shouldRequireApproval(
    response: string,
    context: {
      tenantId: string;
      confidence?: number;
      containsRefund?: boolean;
      containsCancellation?: boolean;
      isHighValue?: boolean;
    }
  ): Promise<boolean>

  /**
   * Crea pending response y NOTifica
   */
  async createPendingApproval(
    tenantId: string,
    conversationId: string,
    response: string,
    reason?: string
  ): Promise<PendingResponse>
}
```

### 3.2 Modificar WhatsAppAgentService

**Archivo:** `packages/backend/src/modules/whatsapp/services/agent.service.ts`

**Agregar después de generar respuesta (línea ~350):**

```typescript
// Después de: const response = await this.adapter.generateResponse(...)
// Y antes de: await this.whatsAppCloudApi.sendMessage(...)

// 1. Verificar si requiere aprobación
const needsApproval = await approvalDecisionService.shouldRequireApproval(
  response.content,
  { tenantId, confidence: response.confidence }
);

// 2. Si requiere aprobación
if (needsApproval) {
  // Crear pending response
  const pending = await approvalDecisionService.createPendingApproval(
    tenantId,
    conversationId,
    response.content,
    `Confidence: ${response.confidence}`
  );
  
  // Notificar via WebSocket
  this.io.to(`tenant:${tenantId}`).emit('pending_approval', {
    conversationId,
    pendingId: pending.id
  });
  
  // NO enviar a WhatsApp aún
  return { 
    status: 'PENDING_APPROVAL', 
    pendingId: pending.id 
  };
}

// 3. Si no requiere, enviar normalmente
await this.whatsAppCloudApi.sendMessage(...);
```

### 3.3 Conectar approve/reject al envío de WhatsApp

**Modificar ApprovalService:**

```typescript
// Cuando se approve:
async approveResponse(tenantId: string, responseId: string) {
  // ... lógica existente ...
  
  // NUEVO: Enviar a WhatsApp después de approve
  const pending = await this.getPendingResponseById(tenantId, responseId);
  if (pending) {
    const whatsappService = new WhatsAppCloudApiService();
    await whatsappService.sendMessage(
      tenantId,
      pending.conversationId,
      pending.proposedResponse
    );
  }
}
```

### 3.4 Configuración por tenant

**En WhatsAppConfig (schema.prisma):**

```prisma
model WhatsAppConfig {
  // ... campos existentes ...
  
  // Configuración de aprobaciones
  requireApproval       Boolean  @default(false)
  approvalThreshold     Float    @default(0.7)  // Por debajo de esto, requiere aprobación
  approvalKeywords      String[] @default(["reembolso", "cancelar", "devolver"])  // Palabras que disparan aprobación
}
```

### 3.5 Notificaciones WebSocket

**Asegurar que el WebSocket emita eventos:**

```typescript
// En ApprovalService
this.io.to(`tenant:${tenantId}`).emit('pending_approval', {
  conversationId,
  pendingId: pending.id,
  preview: pending.proposedResponse.substring(0, 100)
});
```

---

## 4. Archivos a Modificar

### Nuevos
```
packages/backend/src/modules/whatsapp/
└── services/
    └── approval-decision.service.ts    (NUEVO)
```

### Modificar
```
packages/backend/src/modules/whatsapp/
└── services/
    └── agent.service.ts                (agregar flujo de aprobación)

packages/backend/src/modules/opencode/
└── services/
    └── approval.service.ts             (conectar envío a WhatsApp)
```

---

## 5. Lógica de decisión

```typescript
// shouldRequireApproval()
const conditions = [
  // 1. Configuración global del tenant
  config.requireApproval === true,
  
  // 2. Baja confianza del modelo
  confidence < config.approvalThreshold,
  
  // 3. Palabras clave sensibles
  containsKeywords(response, config.approvalKeywords),
  
  // 4. Operaciones de alto riesgo
  isRefund || isCancellation || isDiscount > 50%
];

// Requiere aprobación si ALGUNA condición es true
return conditions.some(c => c === true);
```

---

## 6. UI de aprobaciones (frontend)

La UI ya existe en `/approvals`. Solo necesita:
- Conectar con WebSocket para notificaciones
- Mostrar preview de mensaje antes de approve/reject

---

## 7. Testing

```typescript
describe('Human in the Loop', () => {
  it('crea pending response cuando confidence < threshold');
  it('no envía a WhatsApp cuando requiere aprobación');
  it('envía a WhatsApp después de approve');
  it('no envía a WhatsApp después de reject');
  it('dispara aprobación por palabras clave');
});
```

---

## 8. Estimación

| Tarea | Duración |
|-------|----------|
| Crear ApprovalDecisionService | 1 día |
| Modificar AgentService | 1 día |
| Conectar approve → WhatsApp | 4 horas |
| Configuración por tenant | 4 horas |
| WebSocket notifications | 2 horas |
| Testing | 1 día |
| **Total** | **4-5 días** |

---

## 9. Consideraciones

### Performance
- Approval decision debe ser rápido (<100ms)
- Cachear configuración del tenant

### UX
- Notificar al usuario cuando hay aprobación pendiente
- Timeout de aprobación (ej: 24 horas)

### Edge cases
- Qué pasa si la conversación se cierra mientras hay approval pending?
- Qué pasa si el agente genera otra respuesta antes de que se approve?
