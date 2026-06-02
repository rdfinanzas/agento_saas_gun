# Plan de Migración: Schema Prisma - Agentes V2

**Fecha:** 2026-03-16
**Objetivo:** Implementar nueva arquitectura de agentes desacoplada de WhatsApp

---

## Resumen de Cambios

### Modelos Nuevos
1. `Agent` - Entidad principal de agentes
2. `Integration` - Integraciones genéricas con APIs
3. `AgentIntegration` - Relación Agent ↔ Integration
4. `KnowledgeEntry` - Base de conocimiento

### Enums Nuevos
- `AgentType` (MASTER, INTERNAL, EXTERNAL)
- `AgentStatus` (DRAFT, ACTIVE, PAUSED, ARCHIVED)
- `AgentAccessType` (PRIVATE, SHARED, PUBLIC)
- `ConversationStatus` (ACTIVE, PENDING_HUMAN, RESOLVED, CLOSED, ARCHIVED)
- `MessageDirection` (INCOMING, OUTGOING)
- `MessageType` (TEXT, IMAGE, AUDIO, VIDEO, DOCUMENT, etc.)
- `MessageStatus` (PENDING, PROCESSING, SENT, DELIVERED, READ, FAILED)
- `IntegrationType` (CRM, ERP, ECOMMERCE, etc.)
- `IntegrationStatus` (PENDING, ACTIVE, ERROR, DISABLED)
- `KnowledgeType` (FAQ, POLICY, DOCUMENT, PROCEDURE, etc.)

### Modelos Modificados
1. `Tenant` - Agregar relación `agents: Agent[]`
2. `WhatsAppConfig` - Agregar `agentId?` opcional
3. `Conversation` - Agregar `agentId?`, cambiar status a enum, modificar unique constraint
4. `Message` - Cambiar strings a enums (direction, type, status)

---

## Orden de Migración

### Fase 1: Enums (Sin dependencias)
**Archivos:** `packages/backend/prisma/schema.prisma`

Agregar al final del archivo (antes de modelos existentes):

```prisma
// ============================================
// NEW ENUMS - AGENTES V2
// ============================================

enum AgentType {
  MASTER
  INTERNAL
  EXTERNAL
}

enum AgentStatus {
  DRAFT
  ACTIVE
  PAUSED
  ARCHIVED
}

enum AgentAccessType {
  PRIVATE
  SHARED
  PUBLIC
}

enum ConversationStatus {
  ACTIVE
  PENDING_HUMAN
  RESOLVED
  CLOSED
  ARCHIVED
}

enum MessageDirection {
  INCOMING
  OUTGOING
}

enum MessageType {
  TEXT
  IMAGE
  AUDIO
  VIDEO
  DOCUMENT
  LOCATION
  CONTACTS
  BUTTONS
  LIST
}

enum MessageStatus {
  PENDING
  PROCESSING
  SENT
  DELIVERED
  READ
  FAILED
}

enum IntegrationType {
  CRM
  ERP
  ECOMMERCE
  ACCOUNTING
  BANK
  CUSTOM_API
  GOOGLE
  MICROSOFT
}

enum IntegrationStatus {
  PENDING
  ACTIVE
  ERROR
  DISABLED
}

enum KnowledgeType {
  FAQ
  POLICY
  DOCUMENT
  PROCEDURE
  PRODUCT
  PRICING
  OTHER
}
```

---

### Fase 2: Modelo Agent (Nuevo)
**Archivo:** `packages/backend/prisma/schema.prisma`

Insertar después del modelo `TenantUser` (línea ~63):

```prisma
model Agent {
  id              String          @id @default(uuid())
  tenantId        String
  name            String
  description     String?

  // Tipo de agente
  type            AgentType       @default(INTERNAL)

  // Estado
  status          AgentStatus     @default(DRAFT)

  // Identidad
  role            String?
  style           String?
  language        String?         @default("es")

  // Configuración
  systemPrompt    String?         @db.Text
  instructions    String?         @db.Text

  // Configuración de acceso
  accessType      AgentAccessType @default(PRIVATE)

  // Workspace (para internos)
  workspaceEnabled Boolean        @default(false)

  // Configuración de herramientas
  allowedTools    String[]        @default([])
  blockedTools    String[]        @default([])

  // Jerarquía (agente padre)
  parentId        String?

  // timestamps
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  // relaciones
  tenant          Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  parent          Agent?          @relation("AgentHierarchy", fields: [parentId], references: [id])
  children        Agent[]         @relation("AgentHierarchy")
  whatsappConfigs WhatsAppConfig[]
  integrations    AgentIntegration[]
  conversations   Conversation[]

  @@index([tenantId])
  @@index([type])
  @@index([status])
  @@map("agents")
}
```

---

### Fase 3: Modelo Integration (Nuevo)
**Archivo:** `packages/backend/prisma/schema.prisma`

Insertar después del modelo `ApiConnector` (línea ~293):

```prisma
model Integration {
  id              String            @id @default(uuid())
  tenantId        String

  name            String
  type            IntegrationType

  // Configuración
  credentials     String            @db.Text
  baseUrl         String?
  webhookUrl      String?

  // Estado
  status          IntegrationStatus @default(PENDING)

  // timestamps
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  // relaciones
  tenant          Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  agentIntegrations AgentIntegration[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@map("integrations")
}
```

---

### Fase 4: Modelo AgentIntegration (Nuevo)
**Archivo:** `packages/backend/prisma/schema.prisma`

Insertar después de `Integration`:

```prisma
model AgentIntegration {
  id              String            @id @default(uuid())
  agentId         String
  integrationId   String

  // Herramientas generadas
  tools           Json              @default("[]")

  // Configuración específica
  config          Json?

  // Estado
  status          IntegrationStatus @default(ACTIVE)

  // timestamps
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  // relaciones
  agent           Agent             @relation(fields: [agentId], references: [id], onDelete: Cascade)
  integration     Integration       @relation(fields: [integrationId], references: [id], onDelete: Cascade)

  @@unique([agentId, integrationId])
  @@map("agent_integrations")
}
```

---

### Fase 5: Modelo KnowledgeEntry (Nuevo)
**Archivo:** `packages/backend/prisma/schema.prisma`

Insertar después del modelo `KnowledgeEmbedding` (línea ~398):

```prisma
model KnowledgeEntry {
  id              String        @id @default(uuid())
  tenantId        String
  agentId         String?       // Null = global del tenant

  // Contenido
  type            KnowledgeType
  title           String
  content         String        @db.Text
  source          String?

  // Metadatos
  tags            String[]      @default([])
  metadata        Json?

  // Estado
  status          String        @default("ACTIVE")

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([tenantId])
  @@index([agentId])
  @@index([type])
  @@map("knowledge_entries")
}
```

---

### Fase 6: Modificar Tenant
**Archivo:** `packages/backend/prisma/schema.prisma`

Agregar relación en el modelo `Tenant` (después de `whatsappConfigs` en línea ~32):

```prisma
agents          Agent[]
integrations    Integration[]
```

---

### Fase 7: Modificar WhatsAppConfig
**Archivo:** `packages/backend/prisma/schema.prisma`

Cambiar el modelo `WhatsAppConfig` (línea 118):

```prisma
model WhatsAppConfig {
  id                  String         @id @default(uuid())
  tenantId            String
  phoneNumberId       String
  phoneNumber         String?
  accessToken         String
  webhookVerifyToken  String
  isActive            Boolean        @default(true)
  agentMode           AgentMode      @default(LIMITED)

  // AGREGAR: Referencia opcional a Agent
  agentId             String?

  // Configuración del agente (override del Agent)
  agentInstructions   String?
  agentLanguage       String?        @default("es")
  agentName           String?
  agentRole           String?
  agentStyle          String?

  // Configuración de WhatsApp
  greetingMessage     String?
  awayMessage        String?

  // Business config (mover aquí si está en otro lugar)
  businessDescription String?
  businessHours       Json?
  businessName        String?
  businessPolicies    Json?
  businessProcedures  Json?
  businessType        String?

  knowledgeBase       Json?
  faq                 Json?

  // Estado
  isDraft             Boolean        @default(true)
  requireApproval     Boolean        @default(false)
  approvalThreshold   Float?
  approvalKeywords    String[]

  allowedTools        String[]
  blockedTools        String[]
  baileysSession      String?
  connectionStatus    String         @default("DISCONNECTED")
  connectionType      ConnectionType @default(CLOUD_API)

  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  conversations       Conversation[]
  tenant              Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  agent               Agent?         @relation(fields: [agentId], references: [id])

  @@unique([tenantId, phoneNumberId])
  @@index([tenantId])
  @@index([agentId])
  @@map("whatsapp_configs")
}
```

---

### Fase 8: Modificar Conversation
**Archivo:** `packages/backend/prisma/schema.prisma`

Cambiar el modelo `Conversation` (línea 158):

```prisma
model Conversation {
  id                String              @id @default(uuid())
  tenantId          String
  configId          String

  // AGREGAR: Referencia opcional a Agent
  agentId           String?

  // Cliente
  phoneNumber       String
  contactName       String?
  contactEmail      String?

  // CAMBIAR: Usar enum en lugar de string
  status            ConversationStatus  @default(ACTIVE)

  lastMessageAt     DateTime?
  messageCount      Int                 @default(0)

  // OpenCode session
  opencodeSessionId String?

  // Metadatos
  tags              String[]            @default([])
  duration          Int?

  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  config            WhatsAppConfig      @relation(fields: [configId], references: [id])
  tenant            Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  agent             Agent?              @relation(fields: [agentId], references: [id])
  messages          Message[]

  // CAMBIAR: Unique constraint ahora incluye configId
  @@unique([tenantId, phoneNumber, configId])
  @@index([agentId])
  @@index([status])
  @@index([tenantId])
  @@map("conversations")
}
```

---

### Fase 9: Modificar Message
**Archivo:** `packages/backend/prisma/schema.prisma`

Cambiar el modelo `Message` (línea 176):

```prisma
model Message {
  id              String          @id @default(uuid())
  tenantId        String
  conversationId  String

  // Identificación
  messageId       String?
  inReplyTo       String?

  // CAMBIAR: Usar enums
  direction       MessageDirection
  type            MessageType     @default(TEXT)
  content         String?         @db.Text

  // Metadata
  metadata        Json?

  // CAMBIAR: Usar enum
  status          MessageStatus   @default(PENDING)

  createdAt       DateTime        @default(now())

  conversation   Conversation    @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@index([tenantId])
  @@index([direction])
  @@map("messages")
}
```

---

### Fase 10: Migración de Datos
**Archivo:** Crear script de migración

Crear script en `packages/backend/prisma/migrations/XXXXXXXXXXXXXX_add_agents_v2/migration.sql`

```sql
-- ============================================
-- MIGRACIÓN DE DATOS PARA AGENTES V2
-- ============================================

-- 1. Crear Agent por defecto para cada WhatsAppConfig existente
INSERT INTO agents (
  id, tenant_id, name, type, status,
  role, style, language, system_prompt,
  access_type, workspace_enabled,
  allowed_tools, blocked_tools,
  created_at, updated_at
)
SELECT
  gen_random_uuid()::text,
  tenant_id,
  COALESCE(agent_name, 'Agente WhatsApp'),
  'EXTERNAL'::agenttype,
  CASE WHEN is_draft THEN 'DRAFT'::agentstatus ELSE 'ACTIVE'::agentstatus END,
  agent_role,
  agent_style,
  COALESCE(agent_language, 'es'),
  agent_instructions,
  'SHARED'::agentaccesstype,
  false,
  allowed_tools,
  blocked_tools,
  NOW(),
  NOW()
FROM whatsapp_configs;

-- 2. Vincular WhatsAppConfig con el Agent creado
UPDATE whatsapp_configs
SET agent_id = (
  SELECT id FROM agents
  WHERE agents.tenant_id = whatsapp_configs.tenant_id
  AND agents.name = COALESCE(whatsapp_configs.agent_name, 'Agente WhatsApp')
  ORDER BY agents.created_at DESC
  LIMIT 1
);

-- 3. Actualizar conversaciones para vincular con el agent
UPDATE conversations c
SET agent_id = (
  SELECT wc.agent_id
  FROM whatsapp_configs wc
  WHERE wc.id = c.config_id
);

-- 4. Actualizar status de conversaciones a enum
UPDATE conversations
SET status = CASE
  WHEN status = 'ACTIVE' THEN 'ACTIVE'
  WHEN status = 'PENDING_HUMAN' THEN 'PENDING_HUMAN'
  WHEN status = 'RESOLVED' THEN 'RESOLVED'
  WHEN status = 'CLOSED' THEN 'CLOSED'
  WHEN status = 'ARCHIVED' THEN 'ARCHIVED'
  ELSE 'ACTIVE'
END;

-- 5. Actualizar direction de mensajes a enum
UPDATE messages
SET direction = CASE
  WHEN direction = 'INCOMING' THEN 'INCOMING'
  WHEN direction = 'OUTGOING' THEN 'OUTGOING'
  ELSE 'INCOMING'
END;

-- 6. Actualizar type de mensajes a enum
UPDATE messages
SET type = CASE
  WHEN type = 'text' THEN 'TEXT'
  WHEN type = 'image' THEN 'IMAGE'
  WHEN type = 'audio' THEN 'AUDIO'
  WHEN type = 'video' THEN 'VIDEO'
  WHEN type = 'document' THEN 'DOCUMENT'
  WHEN type = 'location' THEN 'LOCATION'
  WHEN type = 'contacts' THEN 'CONTACTS'
  WHEN type = 'buttons' THEN 'BUTTONS'
  WHEN type = 'list' THEN 'LIST'
  ELSE 'TEXT'
END;

-- 7. Actualizar status de mensajes a enum
UPDATE messages
SET status = CASE
  WHEN status = 'PENDING' THEN 'PENDING'
  WHEN status = 'PROCESSING' THEN 'PROCESSING'
  WHEN status = 'SENT' THEN 'SENT'
  WHEN status = 'DELIVERED' THEN 'DELIVERED'
  WHEN status = 'READ' THEN 'READ'
  WHEN status = 'FAILED' THEN 'FAILED'
  ELSE 'PENDING'
END;
```

---

## Ejecución de la Migración

### Paso 1: Backup
```bash
# Hacer backup de la base de datos
pg_dump agenTo_saaS > backup_before_agents_v2.sql
```

### Paso 2: Actualizar Schema
```bash
cd packages/backend
npx prisma format
```

### Paso 3: Crear Migración
```bash
npx prisma migrate dev --name add_agents_v2
```

### Paso 4: Regenerar Cliente
```bash
npx prisma generate
```

### Paso 5: Verificar
```bash
npx prisma studio
```

---

## Archivos a Modificar

1. `packages/backend/prisma/schema.prisma` - Schema principal
2. `packages/backend/src/modules/whatsapp/services/whatsapp-config.service.ts` - Adaptar a nuevo modelo
3. `packages/backend/src/modules/whatsapp/services/conversation.service.ts` - Adaptar a nuevo modelo
4. `packages/backend/src/modules/agents/` - Crear nuevo módulo
5. `packages/backend/src/modules/integrations/` - Crear nuevo módulo

---

## Riesgos y Consideraciones

1. **Datos existentes**: La migración crea automáticamente Agents para cada WhatsAppConfig existente
2. **Unique constraint**: El nuevo unique en Conversation incluye configId, puede causar conflictos si hay duplicados
3. **Enums vs Strings**: Cambiar de strings a enums puede requerir limpiar datos inválidos primero
4. **Relaciones opcionales**: agentId es opcional en ambos WhatsAppConfig y Conversation

---

## Tests Requeridos

1. Test de migración de datos
2. Test de creación de Agent
3. Test de vinculación Agent ↔ WhatsAppConfig
4. Test de conversaciones con agentId
5. Test de mensajes con enums
