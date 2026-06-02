#!/usr/bin/env node

/**
 * Script de desarrollo con limpieza automática de puertos
 * Resuelve el problema de procesos zombie ocupando puertos
 */

const { execSync, spawn } = require('child_process');
const path = require('path');

const PORTS = [3000, 3001];

function killProcessesOnPorts() {
  console.log('🧹 Limpiando puertos...');

  PORTS.forEach(port => {
    try {
      // Windows
      if (process.platform === 'win32') {
        try {
          const result = execSync(
            `netstat -ano | findstr ":${port}" | findstr "LISTENING"`,
            { encoding: 'utf8' }
          );

          if (result.trim()) {
            const lines = result.trim().split('\n');
            lines.forEach(line => {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 5) {
                const pid = parts[4];
                try {
                  execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
                  console.log(`  ✓ Proceso ${pid} matado (puerto ${port})`);
                } catch (e) {
                  // Ya no existe
                }
              }
            });
          }
        } catch (e) {
          // No hay procesos en este puerto
        }
      }
    } catch (error) {
      console.log(`  ⚠️  Puerto ${port}: ${error.message}`);
    }
  });

  // Esperar un momento para que los puertos se liberen
  console.log('⏳ Esperando liberación de puertos...');
  setTimeout(() => {}, 1000);
}

function runTurbo() {
  console.log('🚀 Iniciando servidor de desarrollo...');
  console.log('');

  const turbo = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true,
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      FORCE_COLOR: '1',
    },
  });

  turbo.on('error', (error) => {
    console.error('❌ Error al iniciar turbo:', error);
  });

  turbo.on('exit', (code) => {
    console.log(`\n✨ Servidor detenido (código: ${code})`);
    process.exit(code);
  });

  // Manejar Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Deteniendo servidor...');
    turbo.kill('SIGTERM');
  });
}

// Ejecutar
console.log('====================================');
console.log(' AgenTo SaaS - Servidor de Desarrollo');
console.log('====================================\n');

killProcessesOnPorts();
runTurbo();
