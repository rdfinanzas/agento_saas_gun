/**
 * Ejemplo de uso de OpenCode Executor Service
 *
 * Para ejecutar: npm run dev
 * Luego: curl http://localhost:3001/api/v1/opencode/test
 */

import { OpenCodeExecutorService } from '../services/opencode-executor.service';
import { ExecutionMode } from '../../security/services/security-layer.service';

export async function testOpenCodeExecutor() {
  const executor = new OpenCodeExecutorService();

  // Verificar salud del servicio
  console.log('=== Verificando OpenCode ===');
  const health = await executor.checkHealth();
  console.log('Disponible:', health.available);
  console.log('Versión:', health.version);
  console.log('Ruta:', health.cliPath);

  if (!health.available) {
    console.error('❌ OpenCode no está disponible');
    console.log('Instala opencode-ai: npm install opencode-ai');
    return;
  }

  // Ejecutar un test simple
  console.log('\n=== Ejecutando test ===');
  const result = await executor.execute(
    '¿Qué hora es? Responde en español.',
    {
      tenantId: 'test-tenant',
      mode: ExecutionMode.LIMITED,
      workspacePath: process.cwd(),
      conversationHistory: [],
      timeout: 30000,
    }
  );

  console.log('Resultado:', result.content);
  console.log('Tiempo de ejecución:', result.executionTime, 'ms');

  if (result.error) {
    console.error('Error:', result.error);
  }
}

// Ejemplo de uso con WhatsApp
export async function testWhatsAppAdapter() {
  const { WhatsAppAdapter } = await import('../adapters/whatsapp.adapter');
  const executor = new OpenCodeExecutorService();
  const adapter = new WhatsAppAdapter(executor);

  console.log('\n=== Test WhatsApp Adapter ===');
  // Este test requiere que existan configuraciones en la DB
  // console.log('Stats:', await adapter.getConversationStats('test-tenant'));
}
