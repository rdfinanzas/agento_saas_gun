# Plan de Implementación - WhatsApp Baileys (API No Oficial)

## Objetivo

Agregar soporte para API no oficial de WhatsApp usando Baileys, permitiendo a los usuarios conectar su WhatsApp sin necesidad de WhatsApp Business API de Meta.

## Arquitectura Actual

- **WhatsAppConfig**: Modelo que representa una configuración de WhatsApp
  - Un tenant puede tener MÚLTIPLES configuraciones (múltiples números)
  - Cada agente referencia un `WhatsAppConfig` específico
- **Conexión actual**: Solo WhatsApp Cloud API (oficial)

## Arquitectura Propuesta

### Modelo de Datos (ya adicionado en schema.prisma)

```prisma
enum ConnectionType {
  CLOUD_API  // Actual - WhatsApp Business API
  BAILEYS    // Nuevo - API no oficial
}

model WhatsAppConfig {
  id                  String         @id @default(uuid())
  tenantId            String
  connectionType      ConnectionType @default(CLOUD_API)
  connectionStatus    String         @default("DISCONNECTED")
  phoneNumber         String?        // Se fill cuando conecta
  baileysSession      String?        // path a credenciales (opcional)
  // ... resto de campos
}
```

### Almacenamiento de Sesiones

```
storage/
└── tenants/
    └── {tenantId}/
        └── whatsapp/
            └── {configId}/
                ├── creds.json        # Credenciales de Baileys
                └── keys/             # Claves de sesión
```

**Una sesión por WhatsAppConfig** (no por tenant), permitiendo múltiples números por tenant.

---

## Flujo de Conexión

### 1. Usuario configura agente en frontend

1. Va a `/agents/new` o `/agents/[id]`
2. Selecciona tipo de conexión: "API No Oficial (Baileys)"
3. Ve botón "Escanear QR"
4. Click → llama a `POST /api/v1/whatsapp/baileys/:configId/start`

### 2. Backend procesa QR

```
POST /whatsapp/baileys/:configId/start
  ├── Busca WhatsAppConfig por configId
  ├── Verifica connectionType == BAILEYS
  ├── Crea directorio de sesión: storage/tenants/{tenantId}/whatsapp/{configId}/
  ├── Inicializa Baileys socket
  ├── Recibe QR code
  ├── Emite por WebSocket: 'baileys:qr' { configId, qr }
  └── Retorna QR al frontend
```

### 3. Frontend muestra QR

1. Recibe QR por WebSocket
2. Muestra código QR para escanear
3. Usuario escanea con su WhatsApp
4. WhatsApp confirma conexión
5. Backend recibe evento 'connection.update' con status: 'open'
6. Backend guarda `phoneNumber` en WhatsAppConfig
7. Emite: 'baileys:connected' { configId, phoneNumber }
8. Frontend muestra "Conectado"

### 4. Mensajes entrantes

```
WhatsApp ──mensaje──> Baileys Socket
       ──> Encola en BullMQ 'whatsapp-incoming'
       ──> WhatsAppWorker procesa
       ──> WhatsAppAgentService.generateResponse()
       ──> Determina tipo de envío (Cloud API vs Baileys)
       ──> Envía respuesta
```

### 5. Recuperación tras reinicio

Al iniciar el servidor:
1. Buscar todos los WhatsAppConfig con `connectionType=BAILEYS` y `connectionStatus=CONNECTED`
2. Para cada uno, reconectar automáticamente
3. Restaurar sesiones desde archivos en storage

---

## Endpoints API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/whatsapp/baileys/:configId/start` | Iniciar conexión (genera QR) |
| POST | `/whatsapp/baileys/:configId/stop` | Cerrar conexión |
| GET | `/whatsapp/baileys/:configId/status` | Ver estado de conexión |
| POST | `/whatsapp/baileys/:configId/send` | Enviar mensaje (para testing) |

---

## Eventos WebSocket

| Evento | Datos | Descripción |
|--------|-------|-------------|
| `baileys:qr` | `{ configId, qr }` | QR code generado |
| `baileys:connected` | `{ configId, phoneNumber }` | Conectado exitosamente |
| `baileys:disconnected` | `{ configId, reason }` | Desconectado |

---

## Cambios en Agent Service

```typescript
// En agent.service.ts - sendResponse()
async sendResponse(tenantId: string, phoneNumber: string, message: string) {
  const config = await this.getWhatsAppConfig(tenantId);
  
  if (config.connectionType === 'BAILEYS') {
    await whatsAppBaileysService.sendMessage(config.id, phoneNumber, message);
  } else {
    await this.whatsappApi.sendTextMessage({ ... });
  }
}
```

---

## Tareas de Implementación

### Tarea 1: Corregir WhatsAppBaileysService
- [x] Usar `configId` como identificador de sesión
- [x] Guardar sesiones en `storage/tenants/{tenantId}/whatsapp/{configId}/`
- [ ] Corregir todas las funciones para usar configId
- [ ] Implementar recuperación automática de sesiones al iniciar

### Tarea 2: Corregir Controlador y Rutas
- [x] Rutas con `:configId` en vez de `:tenantId`
- [x] Controller usa configId para operaciones
- [ ] Registrar rutas en app.ts

### Tarea 3: Frontend
- [x] Selector de tipo de conexión en formulario de agente
- [x] Panel de QR cuando selecciona Baileys
- [ ] Conectar WebSocket para recibir eventos
- [ ] Mostrar estado de conexión

### Tarea 4: Integración con Agent Service
- [ ] Modificar sendResponse() para detectar tipo de conexión
- [ ] Usar servicio correcto según config

### Tarea 5: Pruebas
- [ ] Instalar dependencias: `@whiskeysockets/baileys`, `qrcode-terminal`
- [ ] Regenerar Prisma
- [ ] Escanear QR desde frontend
- [ ] Verificar conexión
- [ ] Enviar mensaje de prueba
- [ ] Verificar que agente responde

---

## Dependencias a Instalar

```bash
cd packages/backend
npm install @whiskeysockets/baileys qrcode-terminal
npx prisma generate
npx prisma migrate dev
```

---

## Consideraciones de Seguridad

1. **Credenciales**: Se guardan en archivo local, no en BD
2. **Path traversal**: Validar que configId pertenezca al tenant
3. **Sesiones múltiples**: Cada configId es independiente
4. **Reconexión automática**: Solo si estaba CONNECTED antes del reinicio

---

## Riesgos y Limitaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Ban de WhatsApp | Alto | Usar con precaución, no para producción masiva |
| Sesiones en memoria | Medio | Recuperar automáticamente al iniciar |
|Chrome no disponible | Alto | Baileys no requiere Chrome (vs whatsapp-web.js) |
