/**
 * Script de diagnóstico para OpenCode CLI
 * Verifica si OpenCode está instalado y funcionando correctamente
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(process.cwd(), '..', '..');
const OPENCODE_PATHS = [
  path.join(PROJECT_ROOT, 'node_modules', 'opencode-windows-x64-baseline', 'bin', 'opencode.exe'),
  path.join(PROJECT_ROOT, 'node_modules', 'opencode-windows-x64', 'bin', 'opencode.exe'),
];

console.log('🔍 DIAGNÓSTICO DE OPENCODE CLI\n');
console.log(`Proyecto: ${PROJECT_ROOT}`);

// 1. Verificar si OpenCode está instalado
console.log('\n1️⃣ Verificando instalación de OpenCode...');
let opencodePath = '';
for (const p of OPENCODE_PATHS) {
  if (fs.existsSync(p)) {
    opencodePath = p;
    console.log(`✅ Encontrado: ${p}`);
    break;
  }
}

if (!opencodePath) {
  console.log('❌ OpenCode CLI NO encontrado en:');
  OPENCODE_PATHS.forEach(p => console.log(`   - ${p}`));

  // Verificar si hay algún paquete opencode instalado
  console.log('\nBuscando paquetes opencode...');
  const nodeModules = path.join(PROJECT_ROOT, 'node_modules');
  if (fs.existsSync(nodeModules)) {
    const packages = fs.readdirSync(nodeModules).filter(p => p.includes('opencode'));
    console.log(`Paquetes encontrados: ${packages.join(', ') || 'none'}`);
  }
  process.exit(1);
}

// 2. Verificar versión
console.log('\n2️⃣ Verificando versión...');
const versionResult = spawn(opencodePath, ['--version'], { shell: true });
versionResult.stdout.on('data', (data) => console.log(`   ${data}`.trim()));
versionResult.stderr.on('data', (data) => console.error(`   ERROR: ${data}`.trim()));

// 3. Ejecutar pruebas cuando la verificación de versión termine
versionResult.on('close', () => {
  // Verificar si puede ejecutar un comando simple
  console.log('\n3️⃣ Probando ejecución simple...');
  const testArgs = [
    'run',
    '--format', 'json',
    '--max-iterations', '1',
    '--timeout', '10s',
    'Hola mundo'
  ];

  console.log(`   Comando: opencode ${testArgs.join(' ')}`);

  const testProcess = spawn(opencodePath, testArgs, {
    shell: true,
    cwd: PROJECT_ROOT,
    env: { ...process.env }
  });

  let output = '';
  let errorOutput = '';

  testProcess.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    console.log(`   STDOUT: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
  });

  testProcess.stderr.on('data', (data) => {
    const text = data.toString();
    errorOutput += text;
    console.log(`   STDERR: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
  });

  testProcess.on('close', (code) => {
    console.log(`\n   Exit code: ${code}`);
    console.log(`   Total output: ${output.length} caracteres`);
    console.log(`   Total error: ${errorOutput.length} caracteres`);

    // 4. Analizar la salida
    console.log('\n4️⃣ Analizando salida...');

    // Verificar si hay JSON válido
    const lines = output.split('\n').filter(l => l.trim().startsWith('{'));
    console.log(`   Líneas JSON encontradas: ${lines.length}`);

    if (lines.length > 0) {
      console.log('   Muestras de JSON:');
      lines.slice(0, 3).forEach((line, i) => {
        try {
          const parsed = JSON.parse(line);
          console.log(`   [${i + 1}] type=${parsed.type}, valid=✅`);
        } catch (e) {
          console.log(`   [${i + 1}] parse error=❌`);
          console.log(`       ${line.substring(0, 100)}...`);
        }
      });
    }

    // Verificar caracteres ANSI
    const ansiCount = (output.match(/\x1b\[/g) || []).length;
    console.log(`   Secuencias ANSI encontradas: ${ansiCount}`);

    if (ansiCount > 0) {
      console.log('   ⚠️ La salida contiene caracteres ANSI que deben limpiarse');
    }

    // Verificar si hay texto legible
    const withoutAnsi = output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '');
    console.log(`   Salida sin ANSI: ${withoutAnsi.length} caracteres`);

    if (withoutAnsi.length > 0) {
      console.log('   Primeros 200 caracteres sin ANSI:');
      console.log(`   ${withoutAnsi.substring(0, 200)}...`);
    }

    // 5. Diagnóstico final
    console.log('\n5️⃣ DIAGNÓSTICO FINAL:');

    if (code !== 0) {
      console.log('   ❌ OpenCode terminó con error');
      console.log(`   Revisa el STDERR arriba para más detalles`);
    } else if (lines.length === 0) {
      console.log('   ❌ No se encontró salida JSON válida');
      console.log('   OpenCode podría no estar ejecutándose en modo JSON');
    } else if (ansiCount > 0) {
      console.log('   ⚠️ OpenCode funciona pero la salida necesita limpieza de ANSI');
    } else {
      console.log('   ✅ OpenCode parece funcionar correctamente');
    }
  });
});
