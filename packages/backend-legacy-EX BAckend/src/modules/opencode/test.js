/**
 * Script de prueba para OpenCode (CommonJS para Node.js directo)
 * Ejecutar: node packages/backend/src/modules/opencode/test.js
 */

const path = require('path');
const fs = require('fs');

console.log('=== Test OpenCode Integration ===\n');

// Test 1: Verificar estructura de archivos
console.log('1. Verificando estructura de archivos...');
const files = [
  'services/cli-resolver.service.ts',
  'services/opencode-executor.service.ts',
  'adapters/whatsapp.adapter.ts',
];

const basePath = path.join(__dirname);
let allExists = true;

for (const file of files) {
  const filePath = path.join(basePath, file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allExists = false;
}

// Test 2: Verificar package.json
console.log('\n2. Verificando dependencias...');
const packageJsonPath = path.join(__dirname, '../../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

const deps = packageJson.dependencies;
console.log(`  ${deps['node-pty'] ? '✅' : '❌'} node-pty`);
console.log(`  ${deps['opencode-ai'] ? '✅' : '❌'} opencode-ai`);
console.log(`  ${deps['@prisma/client'] ? '✅' : '❌'} @prisma/client`);

// Test 3: Verificar cliente Prisma
console.log('\n3. Verificando cliente Prisma...');
const dbPath = path.join(__dirname, '../../../config/database.ts');
const dbExists = fs.existsSync(dbPath);
console.log(`  ${dbExists ? '✅' : '❌'} config/database.ts`);

// Test 4: Verificar directorio de workspace
console.log('\n4. Verificando directorio de workspace...');
const workspacePath = path.join(__dirname, '../../../storage/tenants/test-tenant/workspace');
const workspaceExists = fs.existsSync(workspacePath);
console.log(`  ${workspaceExists ? '✅' : '❌'} storage/tenants/test-tenant/workspace`);

// Resumen
console.log('\n=== Resumen ===');
console.log(`Estructura: ${allExists ? '✅ Completa' : '❌ Incompleta'}`);
console.log(`Dependencias: ${deps['node-pty'] && deps['opencode-ai'] ? '✅ OK' : '❌ Faltan'}`);
console.log(`Cliente DB: ${dbExists ? '✅ Configurado' : '❌ Falta'}`);
console.log(`Workspace: ${workspaceExists ? '✅ Listo' : '⚠️  Crear manualmente'}`);

if (!workspaceExists) {
  console.log('\n💡 Para crear el workspace:');
  console.log('mkdir -p packages/backend/storage/tenants/test-tenant/workspace');
}

console.log('\n✅ Checklist completado');
