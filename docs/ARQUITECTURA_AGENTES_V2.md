# ARQUITECTURA AGENTES - AgenTo SaaS

**Versión:** 2.0  
**Fecha:** 2026-03-15  
**Extiende:** `objetivo.md`

---

## 1. RESUMEN EJECUTIVO

AgenTo SaaS es una **plataforma SaaS multiempresa** que permite crear **agentes digitales especializados**:

- **Agentes internos** para empleados (contador, abogado, RRHH) - Web Chat
- **Agentes externos** para clientes (ventas, soporte) - WhatsApp
- **Agente Maestro** para configuración y creación de otros agentes
- **Integraciones dinámicas** con APIs empresariales

---

## 2. MODELO CONCEPTUAL

```
TENANT (Empresa)
│
├── AGENTE MAESTRO (configura todo)
│   └── Web Chat interno
│
├── AGENTES INTERNOS (sin WhatsApp)
│   ├── Contable      → Web Chat
│   ├── Abogado       → Web Chat
│   └── RRHH          → Web Chat
│
└── AGENTES EXTERNOS (con WhatsApp)
    ├── Ventas        → WhatsApp 1
    ├── Atención      → WhatsApp 2
    └── Proveedores   → WhatsApp 3
```

---

## 3. TAXONOMÍA DE AGENTES

| Tipo        | Acceso   | WhatsApp | Propósito                                     |
| ----------- | -------- | -------- | --------------------------------------------- |
| **Maestro** | Web Chat | ❌       | Configurar otros agentes, crear integraciones |
| **Interno** | Web Chat | ❌       | Asistir empleados (contador, abogado)         |
| **Externo** | WhatsApp | ✅       | Atender clientes                              |

---

## 4. MODELO DE DATOS

### 4.1 Esquema Principal

```prisma
// ============================================
// ENTIDADES PRINCIPALES
// ============================================

model Tenant {
  id                  String    @id @default(uuid())
  name                String
  slug                String    @unique
  plan                Plan      @default(FREE)

  // Workspace
  workspaceUsed       BigInt    @default(0)
  workspaceQuota      BigInt    @default(1073741824) // 1GB

  // timestamps
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // relaciones
  users               User[]
  agents              Agent[]
  whatsappConfigs     WhatsAppConfig[]
  conversations       Conversation[]
  integrations        Integration[]

  @@map("tenants")
}

enum Plan {
  FREE
  PRO
  ENTERPRISE
}

// ============================================
// AGENTE
// ============================================

model Agent {
  id              String      @id @default(uuid())
  tenantId        String
  name            String      // "Contador", "Abogado", "Ventas"
  description     String?

  // Tipo de agente
  type            AgentType   @default(INTERNAL)

  // Estado
  status          AgentStatus @default(DRAFT)

  // Identidad
  role            String?     // "Asistente contable profesional"
  style           String?     // "Profesional", "Amigable", "Formal"
  language        String?     // "es", "en"

  // Configuración
  systemPrompt    String?     // Prompt base del agente
  instructions    String?     // Instrucciones adicionales

  // Configuración de acceso
  accessType      AgentAccessType @default(PRIVATE)

  // Workspace (para internos)
  workspaceEnabled Boolean     @default(false)

  // Configuración de herramientas
  allowedTools    String[]    @default([])
  blockedTools    String[]    @default([])

  // timestamps
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  // relaciones
  tenant          Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  parent          Agent?      @relation("AgentHierarchy", fields: [parentId], references: [id])
  children        Agent[]     @relation("AgentHierarchy")
  whatsappConfigs WhatsAppConfig[]
  integrations    AgentIntegration[]
  conversations   Conversation[]

  @@index([tenantId])
  @@index([type])
  @@index([status])
  @@map("agents")
}

enum AgentType {
  MASTER    // Agente Maestro (configuración)
  INTERNAL  // Agente interno (empleados)
  EXTERNAL  // Agente externo (clientes via WhatsApp)
}

enum AgentStatus {
  DRAFT     // Borrador
  ACTIVE    // Activo
  PAUSED    // Pausado
  ARCHIVED  // Archivado
}

enum AgentAccessType {
  PRIVATE   // Solo el creador
  SHARED    // Compartido en el tenant
  PUBLIC    // Accesible desde fuera (para externos)
}

// ============================================
// CONEXIÓN WHATSAPP
// ============================================

model WhatsAppConfig {
  id                  String    @id @default(uuid())
  agentId             String?
  tenantId            String

  // Meta WhatsApp Business
  phoneNumberId       String
  phoneNumber        String?
  accessToken        String
  webhookVerifyToken String

  // Estado
  isActive            Boolean   @default(true)
  connectionStatus    String    @default("DISCONNECTED")
  connectionType      ConnectionType @default(CLOUD_API)

  // Configuración del agente en este WhatsApp
  agentMode           AgentMode @default(LIMITED)

  // Configuración de WhatsApp
  greetingMessage    String?
  awayMessage       String?

  // Requiere aprobación humana
  requireApproval    Boolean   @default(false)
  approvalKeywords   String[]  @default([])
  approvalThreshold Float?

  // timestamps
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // relaciones
  agent              Agent?    @relation(fields: [agentId], references: [id])
  tenant             Tenant    @relation(fields: [tenantId], references: [id])
  conversations      Conversation[]

  @@unique([tenantId, phoneNumberId])
  @@index([agentId])
  @@index([tenantId])
  @@map("whatsapp_configs")
}

enum ConnectionType {
  CLOUD_API   // API oficial de Meta
  BAILEYS     // WhatsApp Web no oficial
}

enum AgentMode {
  FULL    // Todas las herramientas
  LIMITED // Solo lectura, sin ejecución
}

// ============================================
// CONVERSACIÓN
// ============================================

model Conversation {
  id                String              @id @default(uuid())
  tenantId          String
  configId          String              // WhatsAppConfig
  agentId           String?

  // Cliente
  phoneNumber       String
  contactName       String?
  contactEmail      String?

  // Estado
  status            ConversationStatus  @default(ACTIVE)

  // OpenCode
  opencodeSessionId String?

  // Métricas
  messageCount      Int                 @default(0)
  lastMessageAt     DateTime?
  duration          Int?

  // tags
  tags              String[]            @default([])

  // timestamps
  createdAt         DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  // relaciones
  config            WhatsAppConfig      @relation(fields: [configId], references: [id])
  tenant            Tenant              @relation(fields: [tenantId], references: [id])
  agent             Agent?              @relation(fields: [agentId], references: [id])
  messages          Message[]

  @@unique([tenantId, phoneNumber, configId])
  @@index([agentId])
  @@index([status])
  @@index([tenantId])
  @@map("conversations")
}

enum ConversationStatus {
  ACTIVE         // En curso
  PENDING_HUMAN  // Esperando intervención humana
  RESOLVED       // Resuelta
  CLOSED         // Cerrada
  ARCHIVED       // Archivada
}

// ============================================
// MENSAJE
// ============================================

model Message {
  id              String        @id @default(uuid())
  conversationId  String
  tenantId        String

  // Identificación
  messageId       String?
  inReplyTo       String?
  direction       MessageDirection
  type            MessageType   @default(TEXT)
  content         String        @db.Text

  // Metadata
  metadata        Json?

  // Estado
  status          MessageStatus @default(PENDING)

  // timestamps
  createdAt       DateTime      @default(now())

  // relaciones
  conversation   Conversation  @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@index([tenantId])
  @@index([direction])
  @@map("messages")
}

enum MessageDirection {
  INCOMING   // Del cliente
  OUTGOING   // Del agente/empresa
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

// ============================================
// INTEGRACIONES
// ============================================

model Integration {
  id              String            @id @default(uuid())
  tenantId        String

  name            String            // "Salesforce", "SAP", "MercadoLibre"
  type            IntegrationType

  // Configuración
  credentials     String            // JSON encriptado
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

enum IntegrationType {
  CRM           // Salesforce, HubSpot
  ERP           // SAP, Oracle
  ECOMMERCE     // MercadoLibre, Shopify
  ACCOUNTING    // QuickBooks, ContaPlus
  BANK          // Bills, Stripe
  CUSTOM_API    // API genérica
  GOOGLE        // Sheets, Drive
  MICROSOFT     // Teams, Excel
}

enum IntegrationStatus {
  PENDING
  ACTIVE
  ERROR
  DISABLED
}

// ============================================
// INTEGRACIÓN POR AGENTE
// ============================================

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

// ============================================
// MEMORIA / KNOWLEDGE BASE
// ============================================

model KnowledgeEntry {
  id              String    @id @default(uuid())
  tenantId        String
  agentId         String?   // Null = global

  // Contenido
  type            KnowledgeType
  title           String
  content         String    @db.Text
  source          String?

  // Metadatos
  tags            String[]  @default([])
  metadata        Json?

  // Estado
  status          String    @default("ACTIVE")

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([tenantId])
  @@index([agentId])
  @@index([type])
  @@map("knowledge_entries")
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

## 5. ARQUITECTURA TÉCNICA

### 5.1 Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Web Chat │  │  Agentes    │  │ Conversation│  │   Configuración     │ │
│  │  Interno   │  │  (CRUD)     │  │   (WhatsApp)│  │   Maestro          │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ REST API + SSE
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (Node.js/Express)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Auth JWT   │  │  Agentes    │  │ WhatsApp    │  │   Integraciones     │ │
│  │  Middleware│  │  Service    │  │  Webhook    │  │   Service           │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Permisos   │  │  Session    │  │  Conversation│  │   Knowledge        │ │
│  │  Service    │  │  Manager    │  │   Service   │  │   Service          │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Redis           │    │  OpenCode Server │    │  WhatsApp API    │
│  - Sesiones     │    │  (Bun)          │    │  (Meta)          │
│  - Cache        │    │  - Ejecución    │    │  - Webhook       │
│  - TTL          │    │  - Tools        │    └──────────────────┘
└──────────────────┘    └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  External APIs   │
                       │  (CRM, ERP)     │
                       └──────────────────┘
```

---

## 6. GESTIÓN DE SESIONES

### 6.1 Clave de Sesión

```typescript
// ============================================
// ANTES (PROBLEMA)
// ============================================
activeSessions: Map<tenantId, sessionId>;
// ❌ Todos los clientes comparten la misma sesión

// ============================================
// DESPUÉS (SOLUCIÓN)
// ============================================

// Para agentes internos
// Key: `${tenantId}:${agentId}:${userId}`
// Ejemplo: "tenant1:contable:user123" → "ses_xxx"

// Para agentes externos (WhatsApp)
// Key: `${tenantId}:${agentId}:${phoneNumber}`
// Ejemplo: "tenant1:ventas:+5491111111111" → "ses_xxx"
```

### 6.2 Redis para Sesiones

```typescript
// Estructura en Redis
// Key: session:{tenantId}:{agentId}:{identifier}
// Value: { opencodeSessionId: string, createdAt: number, lastActivity: number }
// TTL: 30 minutos (renovable)
```

**Configuración Redis sugerida:**

- Servidor: Redis interno (open source)
- Base de datos: 0 para sesiones
- TTL: 30 minutos de inactividad
- Persistencia: RDB cada 5 minutos

---

## 7. AGENTE MAESTRO

### 7.1 Responsabilidades

1. **Creación de agentes**
   - Crear nuevo agente con configuración base
   - Generar prompts iniciales

2. **Integración con APIs**
   - Leer documentación de APIs
   - Generar herramientas (tools) para OpenCode
   - Probar integraciones

3. **Configuración**
   - Modificar system prompts
   - Ajustar permisos de herramientas
   - Gestionar conocimientos (knowledge base)

4. **Análisis y reportes**
   - Estadísticas de conversaciones
   - Performance de agentes
   - Recomendaciones de mejora

### 7.2 Flujo de Creación de Agente

```
Usuario: "Crea un agente contable para mi empresa"

Agente Maestro:
  1. Solicita información:
     - ¿Qué funciones contables necesitas? (facturas, payroll, impuestos)
     - ¿Qué sistema contable usan?
     - ¿Qué datos deben conocer?

  2. Crea el agente en BD:
     - name: "Contable"
     - type: INTERNAL
     - systemPrompt: Plantilla + info específica

  3. Configura herramientas:
     - Si tiene sistema contable → crear integración
     - Generar tools específicas

  4. Prepara knowledge base:
     - Agregar políticas contables
     - Agregar FAQ

  5. Confirma al usuario:
     - "He creado el agente Contable"
     - "Tiene acceso a las siguientes herramientas..."
     - "¿Querés probarlo?"
```

---

## 8. RUTAS DE ACCESO

### 8.1 Frontend Routes

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND ROUTES                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  /{tenant}/agents              → Lista de agentes             │
│  /{tenant}/agents/new          → Crear agente                 │
│  /{tenant}/agents/{id}         → Ver/editar agente            │
│  /{tenant}/agents/{id}/chat   → Chat con agente (INTERNAL)    │
│  /{tenant}/agents/{id}/stats  → Estadísticas                  │
│  /{tenant}/agents/{id}/know   → Knowledge base               │
│                                                                 │
│  /{tenant}/whatsapp            → Configuraciones WhatsApp     │
│  /{tenant}/whatsapp/{id}/conversations → Conversaciones       │
│  /{tenant}/whatsapp/{id}/chat → Chat en vivo (supervisor)    │
│                                                                 │
│  /{tenant}/master              → Agente Maestro                │
│  /{tenant}/master/chat         → Chat con Maestro              │
│  /{tenant}/master/integrations → Gestionar integraciones      │
│  /{tenant}/master/analytics   → Analytics global              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. SUPOSICIONES Y DECISIONES DE DISEÑO

1. **Múltiples usuarios simultáneos**: Arquitectura preparada para escalar con Redis
2. **Agente Maestro**: Acceso total al tenant, solo usuarios admin
3. **Idioma**: Solo español
4. **Redis**: Servidor interno open source para sesiones y cache
5. **Sesiones**: Por combinación única (tenant + agente + identificador)

---

## 10. ROADMAP DE IMPLEMENTACIÓN

### Fase 1: Fundación (Semanas 1-2)

- [ ] Actualizar schema de Prisma con nuevos modelos
- [ ] Crear migraciones de BD
- [ ] Implementar CRUD de agentes
- [ ] Implementar WhatsAppConfig-Agent linking

### Fase 2: Redis + Chat Internos (Semanas 3-4)

- [ ] Implementar Redis para gestión de sesiones
- [ ] Chat web para agentes internos
- [ ] Integración con OpenCode (1 sesión por agente+usuario)
- [ ] Sistema de workspace por agente

### Fase 3: WhatsApp (Semanas 5-6)

- [ ] Webhook WhatsApp
- [ ] Sistema de conversaciones
- [ ] 1 sesión por conversación (cliente)
- [ ] Derivación a humano

### Fase 4: Integraciones (Semanas 7-8)

- [ ] Sistema de integraciones genérico
- [ ] Agente Maestro básico
- [ ] Generación dinámica de tools

### Fase 5: Maestro Completo (Semanas 9-10)

- [ ] Lectura de documentación API
- [ ] Creación automática de integraciones
- [ ] Recomendaciones inteligente

### Fase 6: Optimización (Semanas 11-12)

- [ ] Caché de sesiones
- [ ] Rate limiting
- [ ] Métricas y analytics
- [ ] Tests de carga

---

## 11. REFERENCIAS

- Documento original: `objetivo.md`
- Plan Accomplish: `PLAN_OFICIAL_ACCOMPLISH_SAAS.md`
- Código actual: `packages/agent-core/`, `packages/backend/`
- Fork OpenCode: `packages/opencode-fork/`
