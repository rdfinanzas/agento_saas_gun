# AgenTo Test Suite

Suite completa de tests para AgenTo SaaS Platform.

## 📁 Estructura

```
tests/
├── e2e/                    # Tests End-to-End con Playwright
│   ├── auth/              # Tests de autenticación
│   ├── agents/            # Tests de gestión de agentes
│   ├── chat/              # Tests de chat y conversaciones
│   └── billing/           # Tests de pagos y suscripciones
├── unit/                  # Tests unitarios del backend
├── fixtures/              # Datos de prueba
├── helpers/               # Utilidades para tests
├── playwright.config.ts   # Configuración de Playwright
└── README.md             # Este archivo
```

## 🚀 Ejecución de Tests

### Prerrequisitos

```bash
# Instalar dependencias
cd tests
npm install
npx playwright install

# Backend debe estar corriendo
cd ../packages/server && bun run dev

# Frontend debe estar corriendo
cd ../packages/frontend && npm run dev
```

### Tests E2E

```bash
# Ejecutar todos los tests E2E
npm run test

# Ejecutar en modo UI (interactivo)
npm run test:ui

# Ejecutar en modo headed (ver navegador)
npm run test:headed

# Ejecutar un archivo específico
npx playwright test e2e/auth/login.spec.ts

# Ejecutar con debug
npm run test:debug
```

### Tests Unitarios

```bash
# Desde el directorio del servidor
cd ../packages/server

# Ejecutar todos los tests
bun test

# Ejecutar con cobertura
bun test --coverage

# Ejecutar tests específicos
bun test src/tests/unit/auth.service.test.ts

# Ejecutar en modo watch
bun test --watch
```

### Tests de Integración

```bash
cd ../packages/server
bun test src/tests/integration/api.test.ts
```

## 🧪 Tipos de Tests

### 1. Unit Tests (`packages/server/src/tests/unit/`)

Tests aislados para servicios y utilidades:

- `auth.service.test.ts` - Autenticación y JWT
- `agent-coder.service.test.ts` - Gestión de agentes
- `tools.test.ts` - Herramientas OpenCode

### 2. Integration Tests (`packages/server/src/tests/integration/`)

Tests de integración para endpoints API:

- `api.test.ts` - Tests de endpoints principales

### 3. E2E Tests (`tests/e2e/`)

Tests de flujo completo con navegador:

- `auth/login.spec.ts` - Flujo de login/registro
- `agents/create-agent.spec.ts` - Creación y gestión de agentes
- `chat/conversation.spec.ts` - Chat y conversaciones
- `billing/subscription.spec.ts` - Pagos y suscripciones

## 📝 Convenciones

### Nomenclatura

- Archivos de test: `*.test.ts` (unitarios) o `*.spec.ts` (E2E)
- Describe blocks: Nombre del componente o flujo
- Test names: Deberían completar la frase "It should..."

### Estructura de Tests

```typescript
describe('ServiceName', () => {
  beforeEach(() => {
    // Setup
  })

  describe('methodName', () => {
    it('should do something when condition', async () => {
      // Arrange
      const input = {}
      
      // Act
      const result = await service.method(input)
      
      // Assert
      expect(result).toBe(expected)
    })
  })
})
```

## 🎯 Cobertura

### Objetivos de Cobertura

| Tipo | Mínimo | Objetivo |
|------|--------|----------|
| Statements | 70% | 80% |
| Branches | 60% | 75% |
| Functions | 70% | 80% |
| Lines | 70% | 80% |

### Generar Reporte de Cobertura

```bash
# Unit tests con cobertura
cd ../packages/server
bun test --coverage

# Ver reporte HTML
open coverage/index.html
```

## 🔧 Configuración

### Variables de Entorno

Crear archivo `.env.local` en `tests/`:

```env
# URLs
FRONTEND_URL=http://localhost:3001
API_URL=http://localhost:3000

# Test Data
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword

# CI
CI=true
```

### Playwright Config

Configuración en `playwright.config.ts`:

- Navegadores: Chromium, Firefox, WebKit
- Viewports: Desktop y Mobile
- Workers: Paralelo en local, secuencial en CI
- Retries: 2 en CI, 0 en local

## 🔍 Debugging

### Tests Unitarios

```bash
# Debug con console.log
bun test --inspect

# Debug con breakpoints
bun test --inspect-brk
```

### Tests E2E

```bash
# Modo UI interactivo
npm run test:ui

# Modo headed (ver navegador)
npm run test:headed

# Debug específico
npx playwright test --debug
```

### Grabar Nuevos Tests

```bash
# Generar test automáticamente
npx playwright codegen http://localhost:3001
```

## 🐛 Troubleshooting

### Tests Fallan en CI pero Pasan Localmente

1. Verificar variables de entorno
2. Aumentar timeouts si es necesario
3. Revisar screenshots/videos en artifacts
4. Verificar estado de servicios (DB, Redis)

### Timeouts

```typescript
// Aumentar timeout para test específico
test('slow test', async ({ page }) => {
  test.setTimeout(60000)
  // ...
})
```

### Flaky Tests

```typescript
// Reintentar si falla
test('flaky test', async ({ page }) => {
  await expect(page.locator('.dynamic-element')).toBeVisible({ timeout: 10000 })
})
```

## 📊 Reportes

### Playwright HTML Report

```bash
# Generar y ver reporte
npm run test
npx playwright show-report
```

### Cobertura

```bash
# Generar reporte LCOV
cd ../packages/server
bun test --coverage --reporter=lcov

# Enviar a Codecov (en CI)
curl -s https://codecov.io/bash | bash
```

## 🤝 Contribución

1. Escribir tests para nuevas features
2. Mantener tests actualizados
3. Seguir convenciones de nomenclatura
4. Documentar tests complejos
5. Verificar cobertura antes de PR

## 📚 Recursos

- [Playwright Docs](https://playwright.dev/)
- [Bun Test Docs](https://bun.sh/docs/cli/test)
- [Testing Best Practices](https://testing.googleblog.com/)
