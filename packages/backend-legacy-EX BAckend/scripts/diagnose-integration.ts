/**
 * Diagnostic Script - Check OpenCode Integration
 *
 * Verifica qué adaptador está siendo usado por el backend
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function checkBackend() {
  console.log('====================================');
  console.log('DIAGNÓSTICO: Integración OpenCode');
  console.log('====================================\n');

  // 1. Check backend health
  console.log('[1] Verificando backend...');
  try {
    const health = await axios.get(`${API_URL}/health`, { timeout: 5000 });
    console.log('✅ Backend responde:', health.data);
  } catch (error: any) {
    console.log('❌ Backend no responde:', error.message);
    return;
  }

  // 2. Check agent-core exports
  console.log('\n[2] Verificando agent-core exports...');
  try {
    const agentCore = await import('@agento/agent-core');
    console.log('✅ agent-core importado');
    console.log('   - OpenCodeHttpAdapter:', typeof agentCore.OpenCodeHttpAdapter);
    console.log('   - OpenCodeNativeAdapter:', typeof agentCore.OpenCodeNativeAdapter);
    console.log('   - OpenCodeRuntimeAdapter:', typeof agentCore.OpenCodeRuntimeAdapter);
  } catch (error: any) {
    console.log('❌ Error importando agent-core:', error.message);
  }

  // 3. Check backend service
  console.log('\n[3] Verificando backend service...');
  try {
    const servicePath = '../src/modules/accomplish/services/fullmode-integration.service';
    const service = await import(servicePath);
    console.log('✅ Service importado');

    // Check which adapter is being used
    const serviceContent = await import('fs').then(fs =>
      fs.readFileSync('./src/modules/accomplish/services/fullmode-integration.service.ts', 'utf8')
    );

    if (serviceContent.includes('OpenCodeHttpAdapter')) {
      console.log('✅ Source code usa: OpenCodeHttpAdapter');
    } else if (serviceContent.includes('OpenCodeNativeAdapter')) {
      console.log('❌ Source code usa: OpenCodeNativeAdapter');
    } else if (serviceContent.includes('OpenCodeRuntimeAdapter')) {
      console.log('❌ Source code usa: OpenCodeRuntimeAdapter');
    } else {
      console.log('⚠️  No se pudo determinar el adaptador');
    }
  } catch (error: any) {
    console.log('❌ Error verificando service:', error.message);
  }

  console.log('\n====================================');
  console.log('FIN DEL DIAGNÓSTICO');
  console.log('====================================\n');
}

checkBackend().catch(console.error);
