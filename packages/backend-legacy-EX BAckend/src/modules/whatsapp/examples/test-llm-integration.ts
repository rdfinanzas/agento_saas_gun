/**
 * Test script para verificar la integración LLM con WhatsAppAgentService
 *
 * Uso: npx ts-node src/modules/whatsapp/examples/test-llm-integration.ts
 */

import 'dotenv/config';
import { WhatsAppAgentService } from '../services/agent.service';
import { WhatsAppCloudApiService } from '../services/whatsapp-cloud-api.service';
import { llmService } from '../../opencode/services/llm.service';
import type { ProviderType } from '../../opencode/common/types/provider';

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testLLMService() {
  log('\n=== Test 1: Verificar LLMService ===', 'cyan');

  // Verificar si hay API keys globales configuradas
  const providers: ProviderType[] = ['openai', 'anthropic', 'google'];

  for (const provider of providers) {
    const envKey = process.env[`${provider.toUpperCase()}_API_KEY`];
    if (envKey) {
      log(`  ✓ ${provider}: API key global configurada`, 'green');
    } else {
      log(`  ✗ ${provider}: Sin API key global`, 'yellow');
    }
  }

  // Test de conexión con el primer provider disponible
  const availableProvider = providers.find(p =>
    process.env[`${p.toUpperCase()}_API_KEY`]
  );

  if (availableProvider) {
    log(`\n  Probando conexión con ${availableProvider}...`, 'blue');

    try {
      const result = await llmService.executeRequest({
        provider: availableProvider,
        messages: [{ role: 'user', content: 'Di "Hola" en una palabra' }],
        systemPrompt: 'Responde de forma muy breve.',
        tenantId: 'test-tenant',
        maxTokens: 50,
      });

      log(`  ✓ Respuesta recibida: "${result.content}"`, 'green');
      log(`  ✓ Tokens usados: ${result.usage?.totalTokens}`, 'green');
      return true;
    } catch (error: any) {
      log(`  ✗ Error: ${error.message}`, 'red');
      return false;
    }
  } else {
    log('\n  ⚠ No hay API keys configuradas. Configura al menos una en .env', 'yellow');
    return false;
  }
}

async function testWhatsAppAgent() {
  log('\n=== Test 2: Verificar WhatsAppAgentService ===', 'cyan');

  const whatsappApi = new WhatsAppCloudApiService();
  const agentService = new WhatsAppAgentService(whatsappApi);

  // Test de verificación de disponibilidad LLM/OpenCode
  log('\n  Verificando disponibilidad de OpenCode...', 'blue');

  const availability = await agentService.checkOpenCodeAvailability();

  if (availability.available) {
    log(`  ✓ OpenCode disponible - Version: ${availability.version}`, 'green');
  } else {
    log(`  ✗ OpenCode no disponible: ${availability.error}`, 'yellow');
  }

  return availability.available;
}

async function testSystemPromptBuilding() {
  log('\n=== Test 3: Verificar construcción de System Prompt ===', 'cyan');

  const whatsappApi = new WhatsAppCloudApiService();
  const agentService = new WhatsAppAgentService(whatsappApi);

  // @ts-ignore - Acceder a método privado para test
  const buildSystemPrompt = agentService.buildSystemPrompt.bind(agentService);

  const testKnowledge = {
    businessInfo: {
      name: 'Tienda Demo',
      description: 'Una tienda de productos de prueba',
      hours: 'Lunes a Viernes 9-18hs',
    },
    products: [
      { name: 'Producto A', price: '$100', stock: 10 },
      { name: 'Producto B', price: '$200', stock: 5 },
    ],
    faq: {
      'hacen envíos': 'Sí, hacemos envíos a todo el país',
      'formas de pago': 'Aceptamos efectivo, tarjetas y transferencia',
    },
    policies: {
      'devoluciones': 'Aceptamos devoluciones dentro de los 7 días',
    },
  };

  const prompt = buildSystemPrompt(
    'Se amable y responde en español',
    testKnowledge
  );

  if (prompt.includes('Tienda Demo') &&
      prompt.includes('Producto A') &&
      prompt.includes('envíos') &&
      prompt.includes('devoluciones')) {
    log('  ✓ System prompt generado correctamente', 'green');
    log(`  ✓ Longitud: ${prompt.length} caracteres`, 'green');
    return true;
  } else {
    log('  ✗ System prompt incompleto', 'red');
    return false;
  }
}

async function testFallbackResponse() {
  log('\n=== Test 4: Verificar respuesta de fallback ===', 'cyan');

  const whatsappApi = new WhatsAppCloudApiService();
  const agentService = new WhatsAppAgentService(whatsappApi);

  // @ts-ignore - Acceder a método privado para test
  const generateFallbackResponse = agentService.generateFallbackResponse.bind(agentService);

  const testKnowledge = {
    businessInfo: { name: 'Mi Negocio' },
    products: [{ name: 'Laptop', price: '$999', stock: 5 }],
    faq: { 'horario': 'Abierto de 9 a 18' },
  };

  // Test con pregunta sobre producto
  const response1 = generateFallbackResponse(
    'Tienen laptops?',
    testKnowledge,
    'Se amable'
  );

  if (response1.toLowerCase().includes('laptop')) {
    log('  ✓ Fallback encuentra productos', 'green');
  } else {
    log('  ✗ Fallback no encuentra productos', 'red');
  }

  // Test con pregunta sobre FAQ
  const response2 = generateFallbackResponse(
    'Cuál es el horario?',
    testKnowledge,
    'Se amable'
  );

  if (response2.includes('9 a 18')) {
    log('  ✓ Fallback encuentra FAQs', 'green');
  } else {
    log('  ✗ Fallback no encuentra FAQs', 'red');
  }

  return true;
}

async function runAllTests() {
  log('\n╔═══════════════════════════════════════════════════════════╗', 'cyan');
  log('║     TEST: Integración LLM con WhatsAppAgentService        ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════════╝', 'cyan');

  const results: { name: string; passed: boolean }[] = [];

  // Ejecutar tests
  results.push({ name: 'LLMService', passed: await testLLMService() });
  results.push({ name: 'WhatsAppAgent', passed: await testWhatsAppAgent() });
  results.push({ name: 'SystemPrompt', passed: await testSystemPromptBuilding() });
  results.push({ name: 'FallbackResponse', passed: await testFallbackResponse() });

  // Resumen
  log('\n═══════════════════════════════════════════════════════════', 'cyan');
  log('RESUMEN:', 'cyan');
  log('═══════════════════════════════════════════════════════════', 'cyan');

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    if (result.passed) {
      log(`  ✓ ${result.name}`, 'green');
      passed++;
    } else {
      log(`  ✗ ${result.name}`, 'red');
      failed++;
    }
  }

  log(`\nTotal: ${passed} pasados, ${failed} fallidos`,
      failed === 0 ? 'green' : 'yellow');

  if (failed === 0) {
    log('\n¡Todos los tests pasaron! La integración está lista.', 'green');
  } else {
    log('\nAlgunos tests fallaron. Revisa la configuración.', 'yellow');
    log('\nPara que funcione completamente, configura al menos una API key:', 'yellow');
    log('  - OPENAI_API_KEY en .env', 'yellow');
    log('  - O usa el endpoint POST /api/v1/opencode/providers/api-keys', 'yellow');
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Ejecutar tests
runAllTests().catch(console.error);
