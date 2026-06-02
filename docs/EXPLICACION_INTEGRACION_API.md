# ¿Qué es la Integración API? (Estado: 40% completado)

## Concepto

La **Integración API** es la capacidad del sistema para conectar agentes de IA con sistemas externos (CRMs, ERPs, sistemas de stock, etc.) permitiendo que el agente:

1. **Leer documentación** de APIs automáticamente
2. **Generar herramientas** (tools) desde la documentación
3. **Ejecutar acciones** en sistemas externos
4. **Obtener datos** para responder al cliente

Ejemplo real:
```
Usuario: "Conecta el agente con mi sistema de stock.
         Queremos que pueda consultar stock de productos."

Sistema:
  1. Lee la documentación de la API del stock
  2. Genera automáticamente la herramienta `stock_get_product`
  3. El agente puede usar esa herramienta para responder:
     "El producto X tiene 15 unidades disponibles"
```

---

## ¿Qué está implementado? (BACKEND 100% ✅)

### Base de Datos - Modelo Completo
```prisma
model ApiConnector {
  id              String   @id @default(uuid())
  tenantId        String
  name            String
  description     String?
  baseUrl         String
  authType        String   // apiKey, bearer, oauth2, basic, none
  authConfig      Json?
  tools           Json     // Array de GeneratedTool
  rawDocumentation Json?
  isActive        Boolean  @default(true)
}
```

### Servicios Backend Completos

**1. `api-docs.service.ts`** - Servicio principal
- `readDocumentation(url)` - Lee OpenAPI/Swagger desde URL
- `generateConnector(tenantId, docs, config)` - Genera conector automáticamente
- `testConnector(tenantId, connectorId, toolName, input)` - Prueba el conector
- `executeTool(tenantId, connectorId, toolName, input)` - Ejecuta tool del conector

**2. `api-connectors.controller.ts`** - Endpoints REST
```
POST /api-docs/read              → Lee documentación desde URL
POST /api-connectors/generate     → Genera conector desde docs
POST /api-connectors/:id/test     → Prueba un conector
GET  /api-connectors               → Lista conectores del tenant
GET  /api-connectors/:id           → Obtiene un conector
PUT  /api-connectors/:id           → Actualiza conector
DELETE /api-connectors/:id         → Elimina conector
POST /api-connectors/:id/execute   → Ejecuta tool del conector
```

**3. Rutas configuradas**
```typescript
// api-connectors.routes.ts
router.post('/generate', apiConnectorsController.generate);
router.post('/:connectorId/test', apiConnectorsController.test);
router.post('/:connectorId/execute', apiConnectorsController.execute);
```

### Tipos de Autenticación Soportados
- ✅ `apiKey` - Key en header
- ✅ `bearer` - Token Bearer
- ✅ `oauth2` - OAuth 2.0
- ✅ `basic` - Basic Auth
- ✅ `none` - Sin autenticación

---

## ¿Qué FALTA? (FRONTEND 0% ❌)

### No hay UI para crear conectores

Actualmente el backend está 100% implementado pero **no hay interfaz visual** para:

1. **Pantalla de Integraciones**
   - Lista de conectores creados
   - Crear nuevo conector
   - Editar conector existente
   - Eliminar conector

2. **Formulario de Creación**
   - Nombre del conector
   - URL de la API
   - Tipo de autenticación
   - Configuración de auth
   - Importar documentación (URL o archivo)

3. **Visualización de Tools**
   - Lista de herramientas generadas
   - Parámetros de cada tool
   - Descripción de qué hace cada tool

4. **Tester de Conectores**
   - Probar herramienta individual
   - Ver resultado de la prueba
   - Debug de errores

---

## Flujo Completo (Cómo debería funcionar)

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (NO EXISTE)                        │
│  Usuario accede a: /integrations o /api-connectors             │
│                                                                     │
│  1. Ve lista de conectores existentes                           │
│  2. Click "Nuevo Conector"                                      │
│  3. Completa formulario:                                        │
│     - Nombre: "Sistema de Stock"                                │
│     - URL API: "https://api.stock.com"                          │
│     - Auth: Bearer Token                                        │
│     - Token: "xxx..."                                            │
│  4. Click "Importar Documentación"                              │
│     - Ingresa URL de OpenAPI/Swagger                           │
│  5. Sistema analiza y genera tools automáticamente              │
│  6. Usuario ve lista de tools generadas                         │
│  7. Puede probar cada tool                                    │
│  8. Guarda el conector                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (YA EXISTE)                          │
│                                                                     │
│  POST /api-connectors/generate                                  │
│  └→ apiDocsService.generateConnector()                        │
│      └→ Lee documentación Swagger                               │
│      └→ Analiza endpoints                                      │
│      └→ Genera herramientas (tools)                            │
│      └→ Guarda en BD (ApiConnector)                            │
│                                                                     │
│  GET /api-connectors/{id}                                       │
│  └→ Retorna conector con tools generadas                       │
│                                                                     │
│  POST /api-connectors/{id}/execute                              │
│  └→ Ejecuta tool del conector                                  │
│      └→ Hace request a API externa                            │
│      └→ Retorna resultado                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        USO EN AGENTE                              │
│                                                                     │
│  Agente recibiendo pregunta: "¿Hay stock del producto X?"       │
│  └→ Busca en skills disponibles                                │
│      └→ Encuentra: stock_get_product                            │
│      └→ Ejecuta: stock_get_product({ id: "X" })                │
│          └→ POST https://api.stock.com/products/X              │
│      └→ Retorna: { stock: 15 }                                  │
│  └→ Responde: "El producto X tiene 15 unidades disponibles"    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Ejemplo Práctico

### Sistema de Stock (Ficticio)

**1. Documentación de la API (OpenAPI/Swagger)**
```json
{
  "openapi": "3.0",
  "info": { "title": "Stock API", "version": "1.0" },
  "servers": [{ "url": "https://api.mi-empresa.com/stock" }],
  "paths": {
    "/products/{id}": {
      "get": {
        "summary": "Obtener producto",
        "parameters": [{ "name": "id", "in": "path", "required": true }],
        "responses": { "200": { "content": { "application/json": {} }}}
      }
    }
  }
}
```

**2. Backend genera automáticamente:**
```typescript
// Tool generada
{
  name: "getProduct",
  description: "Obtener producto por ID",
  handler: "connector",
  parameters: {
    id: { type: "string", required: true, description: "ID del producto" }
  }
}
```

**3. Agente puede usarla:**
```
Usuario: "¿Cuántas unidades hay del producto PROD-123?"

Agente:
  1. Identifica que necesita consultar stock
  2. Usa tool: stock_get_product
  3. Ejecuta: GET https://api.mi-empresa.com/stock/products/PROD-123
  4. Obtiene: { id: "PROD-123", name: "Camisa", stock: 25 }
  5. Responde: "Hay 25 unidades de la Camisa (PROD-123)"
```

---

## Cómo completar el 40% restante

### Archivos a Crear (Frontend)

1. **`app/[tenant]/integrations/page.tsx`**
   - Lista de conectores
   - Botón "Nuevo Conector"
   - Tarjetas con info de cada conector

2. **`app/[tenant]/integrations/new/page.tsx`**
   - Formulario de creación
   - Importación de documentación
   - Configuración de autenticación

3. **`app/[tenant]/integrations/[id]/page.tsx`**
   - Detalle del conector
   - Lista de herramientas generadas
   - Tester de tools

4. **`components/integrations/ConnectorCard.tsx`**
   - Componente visual para cada conector

### Estimación de Tiempo

| Tarea | Duración |
|-------|----------|
| Página de lista | 2-3 horas |
| Formulario de creación | 3-4 horas |
| Página de detalle | 2-3 horas |
| Tester de tools | 2-3 horas |
| Estilos y UI | 2-3 horas |
| **Total** | **11-16 horas** (2 días) |

---

## Conclusión

La **Integración API** está **implementada al 100% en el backend** y **0% en el frontend**.

**Lo que funciona:**
- ✅ Leer documentación OpenAPI/Swagger
- ✅ Generar conectores automáticamente
- ✅ Ejecutar tools contra APIs externas
- ✅ Soporte para múltiples tipos de autenticación
- ✅ Almacenamiento en BD por tenant

**Lo que falta:**
- ❌ UI para crear conectores
- ❌ UI para ver tools generadas
- ❌ UI para probar conectores
- ❌ Integración visual con el chat

Es una funcionalidad **potente y completamente funcional** a nivel de API, pero requiere la interfaz visual para que los usuarios puedan usarla sin código.
