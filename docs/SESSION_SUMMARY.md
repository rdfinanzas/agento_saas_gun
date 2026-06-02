# Resumen de Sesión - Configuración de API Keys y Accomplish

## Fecha
14 de marzo de 2026

## Objetivo Principal
Configurar el sistema de API keys para el módulo Accomplish en el SaaS Agento.

---

## Cambios Realizados

### 1. Validación de API Keys
**Archivo**: `packages/backend/src/modules/admin/api-key-validation.ts`

- Se agregó validación automática de API keys antes de guardarlas
- Proveedores soportados para validación:
  - DeepSeek
  - Kimi Coding
  - OpenCode
  - Anthropic
  - OpenAI
  - Google

**Ejemplo de uso**:
```typescript
const validation = await validateApiKey('deepseek', apiKey);
if (!validation.valid) {
  // Mostrar error
}
```

### 2. Guardado Seguro de API Keys
**Archivo**: `packages/backend/src/modules/admin/admin.controller.ts`

- El endpoint `/admin/api-keys` ahora valida la API key antes de guardarla
- Las keys se guardan en SecureStorage con encriptación AES-256-GCM

```typescript
async saveApiKeys(req: Request, res: Response): Promise<void> {
  // Validar API key
  const validation = await validateApiKey(provider, apiKey);
  if (!validation.valid) {
    return res.status(400).json({ error: 'API key inválida', details: validation.error });
  }

  // Guardar en SecureStorage
  await secureStorage.storeApiKey('global', provider, apiKey, baseUrl);
}
```

### 3. Corrección de Datos
**Problema**: Algunos proveedores tenían la API key guardada en el campo `apiKeyName` en lugar del nombre de la variable.

**Solución**: Script para corregir los datos
```bash
npx ts-node scripts/fix-apikey-names.ts
```

### 4. Configuración de Tenant
**Script**: `packages/backend/scripts/create-tenant-config.ts`

Crea la configuración necesaria para que Accomplish funcione:
- Provider: `deepseek`
- Model: `deepseek-chat`
- Workspace: `./storage/tenants`

---

## Problemas Encontrados y Soluciones

### Problema 1: Variables de Entorno
**Error**: `Environment variable not found: DATABASE_URL`

**Causa**: El backend no tenía un archivo `.env` en el directorio `packages/backend/`.

**Solución**: Crear archivo `packages/backend/.env` con:
```env
DATABASE_URL="postgresql://postgres:084caa565c164398afefd970d1af469a@localhost:5432/agento_saas?schema=public"
REDIS_URL="redis://:RedisDev2024!@69.62.90.206:6379"
JWT_SECRET="your-secret-key-change-in-production-min-32-chars"
SECURE_STORAGE_PATH=./secure-storage
AGENTO_STORAGE_PATH=./storage/tenants
```

### Problema 2: Nombre de Variable de API Key
**Error**: El campo `apiKeyName` contenía la API key en lugar del nombre de la variable.

**Solución**: Corregir datos en la base de datos.

### Problema 3: Tenant No Configurado
**Error**: `Tenant not configured` en Accomplish.

**Causa**: El tenant no tenía el archivo `config.json` en `storage/tenants/{tenantId}/`.

**Solución**: Crear el archivo de configuración del tenant.

---

## Cómo Configurar API Keys en Admin SaaS

### Paso 1: Acceder al Panel de Admin
```
http://localhost:3001/admin/ai-models
```

### Paso 2: Editar Proveedor
1. Buscar el proveedor (ej: "DeepSeek")
2. Hacer clic en "Editar"

### Paso 3: Configurar API Key
El modal muestra:
- **Proveedor**: (solo lectura, ejemplo: "deepseek")
- **Variable de entorno**: (generada automáticamente, ejemplo: "DEEPSEEK_API_KEY")
- **API Key**: (campo password para ingresar la key)

### Paso 4: Guardar
Al hacer clic en "Guardar":
1. El backend valida la API key con el proveedor
2. Si es válida, se guarda encriptada en SecureStorage
3. Si es inválida, muestra el error específico

---

## Pruebas Realizadas

### Simulación de Cliente con Accomplish

Se realizó una prueba simulando un cliente enviando un mensaje desde el frontend hacia accomplish:

**Endpoint**: `POST /api/v1/rdfinanzas/accomplish/tasks`

```bash
# Login para obtener token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rdfinanzas@gmail.com","password":"rd130581"}'

# Crear tarea de accomplish
curl -X POST http://localhost:3000/api/v1/rdfinanzas/accomplish/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"prompt":"¿Qué hora es?"}'
```

**Resultado esperado**:
- Tarea creada con status `QUEUED`
- Backend procesa la tarea
- OpenCode ejecuta con el modelo configurado
- Respuesta vía SSE (Server-Sent Events)

**Estado actual**:
- ✅ Backend recibe la petición
- ✅ Tenant configurado correctamente
- ✅ Accomplish funciona
- ❌ API key de DeepSeek no configurada (pendiente de configurar en admin)

### Configuración de Usuario

**Usuario de prueba**: rdfinanzas@gmail.com
**Tenant**: rdfinanzas
**Contraseña**: rd130581

---

## Flujo de Funcionamiento de Accomplish

```
1. Frontend (/rdfinanzas/accomplish)
   ↓
2. Backend POST /api/v1/:tenant/accomplish/tasks
   ↓
3. Backend valida tenant
   ↓
4. Backend obtiene API keys de SecureStorage
   ↓
5. Backend ejecuta FullModeAdapter con OpenCode
   ↓
6. Resultado vía SSE (Server-Sent Events)
```

---

## Archivos Modificados

1. `packages/backend/src/modules/admin/admin.controller.ts`
   - Validación de API keys antes de guardar

2. `packages/backend/src/modules/admin/api-key-validation.ts`
   - Validación para Anthropic, OpenAI, Google

3. `packages/backend/.env` (CREADO)
   - Variables de entorno necesarias para el backend

4. `packages/backend/storage/tenants/{tenantId}/config.json` (CREADO)
   - Configuración del tenant para Accomplish

---

## Scripts Útiles

```bash
# Verificar API keys en BD
npx ts-node scripts/check-apikey-names.ts

# Corregir apiKeyNames
npx ts-node scripts/fix-apikey-names.ts

# Crear config de tenant
npx ts-node scripts/create-tenant-config.ts

# Resetear contraseña de usuario
npx ts-node scripts/reset-user-password.ts
```

---

## Pendientes / Mejoras Futuras

1. **Auto-configuración de tenants**: Crear automáticamente la config cuando se crea un tenant nuevo
2. **UI para mostrar si la API key es válida**: Indicador visual en el admin
3. **Reintentar validación**: Botón para revalidar API keys guardadas
4. **Logs más detallados**: Mostrar en el admin cuándo se usó una API key por última vez

---

## Datos de Conexión

### Base de Datos PostgreSQL
```
Host: localhost
Puerto: 5432
Usuario: postgres
Password: 084caa565c164398afefd970d1af469a
Base de datos: agento_saas
Schema: public
```

### Redis
```
URL: redis://:RedisDev2024!@69.62.90.206:6379
Host: 69.62.90.206
Puerto: 6379
Password: RedisDev2024!
```

### Servicios
```
Frontend: http://localhost:3001
Backend:  http://localhost:3000
Admin:    http://localhost:3001/admin
```

### Usuario de Prueba
```
Email: rdfinanzas@gmail.com
Password: rd130581
Tenant: rdfinanzas
Tenant ID: 73b7dff9-0f04-4f38-9cee-6c6b6e5ef3bb
```

### Rutas Importantes
```
Backend:           E:\agento-saas-nodejs\packages\backend
Frontend:          E:\agento-saas-nodejs\packages\frontend
Secure Storage:    E:\agento-saas-nodejs\packages\backend\secure-storage
Tenant Storage:    E:\agento-saas-nodejs\packages\backend\storage\tenants
Config Tenant:     E:\agento-saas-nodejs\packages\backend\storage\tenants\{tenantId}\config.json
```

### Archivos .env
```
Backend:  E:\agento-saas-nodejs\packages\backend\.env
Raíz:    E:\agento-saas-nodejs\.env
```

---

## Notas Importantes

- Las API keys **nunca** se exponen al frontend
- Las API keys se guardan encriptadas con AES-256-GCM
- La validación se hace en el backend antes de guardar
- El nombre de la variable de entorno (apiKeyName) se genera automáticamente
- El super admin NO debe modificar el campo apiKeyName manualmente
