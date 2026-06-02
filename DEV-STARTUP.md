# AgenTo SaaS - Guía de Inicio Rápido

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        AgenTo SaaS                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐        ┌──────────────────────┐   │
│  │   Backend (Bun)     │        │  Frontend (Next.js)  │   │
│  │   Puerto: 3000      │◄──────►│  Puerto: 3004        │   │
│  │                     │        │                      │   │
│  │  - Hono Framework   │        │  - React 19          │   │
│  │  - Drizzle ORM      │        │  - Tailwind CSS      │   │
│  │  - PostgreSQL       │        │  - Radix UI          │   │
│  │  - Redis            │        │                      │   │
│  │  - OpenCode ✅      │        │                      │   │
│  └─────────────────────┘        └──────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘

OpenCode está INTEGRADO en el backend (no corre como servicio separado)
```

## Requisitos Previos

Antes de iniciar, asegúrate de tener instalado:

1. **Bun** (Runtime del backend)
   ```bash
   # Windows (PowerShell)
   irm bun.sh/install.ps1 | iex

   # Linux/Mac
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Node.js** v20+ (Para el frontend)
   - Descargar desde: https://nodejs.org/

3. **PostgreSQL** (Base de datos)
   - Asegúrate de que esté corriendo en `localhost:5432`

4. **Redis** (Opcional, para colas y cache)
   - Configurado en servidor remoto: `69.62.90.206:6379`

## Scripts de Inicio

### Windows

| Script | Descripción |
|--------|-------------|
| `start.bat` | Inicia Backend + Frontend |
| `start-backend.bat` | Solo Backend (para pruebas) |
| `start-frontend.bat` | Solo Frontend (para pruebas) |
| `stop.bat` | Detiene todos los servicios |
| `clean.bat` | Limpia logs y caché |

### Linux/Mac

| Script | Descripción |
|--------|-------------|
| `./start.sh` | Inicia Backend + Frontend |
| `Ctrl+C` | Detiene todos los servicios |

## Inicio Rápido

### Windows
```bash
# Doble clic en:
start.bat

# O desde terminal:
start.bat
```

### Linux/Mac
```bash
# Dar permisos y ejecutar:
chmod +x start.sh
./start.sh
```

## Acceso a los Servicios

Una vez iniciado, puedes acceder a:

| Servicio | URL |
|----------|-----|
| **Backend API** | http://localhost:3000 |
| **Health Check** | http://localhost:3000/health |
| **Frontend** | http://localhost:3004 |
| **API Docs** | http://localhost:3000/api/v1 |

## Endpoints Principales

### Chat con el Agente
```
POST /api/v1/ai/execute
{
  "prompt": "Hola, ¿qué puedes hacer?",
  "sessionId": "opcional-id-de-sesion"
}
```

### Sesiones
```
GET    /api/v1/ai/sessions           # Listar sesiones
POST   /api/v1/ai/sessions           # Crear sesión
GET    /api/v1/ai/sessions/:id       # Obtener sesión con mensajes
DELETE /api/v1/ai/sessions/:id       # Eliminar sesión
```

### Herramientas del Agente
```
GET    /api/v1/ai/tools              # Listar herramientas
POST   /api/v1/ai/tools              # Crear herramienta
GET    /api/v1/ai/tools/:id          # Obtener herramienta
PUT    /api/v1/ai/tools/:id          # Modificar herramienta
DELETE /api/v1/ai/tools/:id          # Eliminar herramienta
POST   /api/v1/ai/tools/:id/execute  # Ejecutar herramienta
```

### Aprobaciones
```
GET    /api/v1/ai/approvals          # Listar pendientes
POST   /api/v1/ai/approvals/:id/approve   # Aprobar
POST   /api/v1/ai/approvals/:id/reject    # Rechazar
```

## Configuración

### Variables de Entorno

Las variables de entorno se configuran en:

- **Backend**: `packages/server/.env`
- **Frontend**: `packages/frontend/.env.local`

### Configuración Segura de AI

Las API keys de los proveedores de AI se gestionan a través de un JSON seguro:

```json
{
  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-xxx",
      "models": ["claude-3-5-sonnet", "claude-3-haiku"]
    },
    "openai": {
      "apiKey": "sk-xxx",
      "models": ["gpt-4", "gpt-3.5-turbo"]
    }
  }
}
```

Ubicación: `packages/server/config/ai-providers.json` (crearlo si no existe)

## Troubleshooting

### Puerto 3000 en uso
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Error de conexión a PostgreSQL
- Verifica que PostgreSQL esté corriendo
- Verifica la conexión en `packages/server/.env`
- La base de datos debe existir: `agento_saas`

### Error de conexión a Redis
- Verifica la URL en `packages/server/.env`
- El servidor Redis debe estar accesible

## Estructura del Proyecto

```
agento-saas-nodejs/
├── packages/
│   ├── server/          # Backend (Bun + Hono)
│   │   ├── src/
│   │   │   ├── db/              # Schemas y conexión
│   │   │   ├── lib/
│   │   │   │   └── opencode/    # OpenCode integrado ✅
│   │   │   ├── modules/
│   │   │   │   ├── agent-ai/    # Módulo de agente AI
│   │   │   │   ├── auth/        # Autenticación
│   │   │   │   ├── billing/     # Facturación
│   │   │   │   ├── whatsapp/    # WhatsApp
│   │   │   │   └── ...
│   │   │   └── routes/          # Rutas API
│   │   └── .env                 # Configuración backend
│   │
│   └── frontend/         # Frontend (Next.js)
│       ├── app/                 # Páginas Next.js
│       ├── components/          # Componentes React
│       └── package.json
│
├── start.bat              # Inicio Windows
├── start.sh               # Inicio Linux/Mac
├── start-backend.bat      # Solo backend
├── start-frontend.bat     # Solo frontend
├── stop.bat               # Detener servicios
└── clean.bat              # Limpiar caché
```

## Próximos Pasos

1. **Inicia los servicios**: `start.bat` (o `./start.sh` en Linux/Mac)
2. **Verifica el health check**: http://localhost:3000/health
3. **Abre el frontend**: http://localhost:3004
4. **Prueba el agente**: Envía un mensaje al endpoint `/api/v1/ai/execute`

## Documentación Adicional

- [Plan Maestro del Agente Codificador](./docs/PLAN-MAESTRO-agente-codificador-detallado.md)
- [Arquitectura de Agentes v2](./docs/ARQUITECTURA_AGENTES_V2.md)
