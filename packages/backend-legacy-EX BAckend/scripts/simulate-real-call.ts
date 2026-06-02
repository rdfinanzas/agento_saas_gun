/**
 * SIMULACIÓN REAL DE LLAMADA A AGENTO SAAS
 *
 * Este script simula una llamada REAL usando la API de AgenTo SaaS.
 * No es mock - hace peticiones HTTP reales al backend.
 */

import axios from 'axios';

// ============================================
// CONFIGURACIÓN
// ============================================

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TENANT_SLUG = 'rdfinanzas'; // Tenant existente

// ============================================
// TYPES
// ============================================

interface TaskResponse {
  id: string;
  tenantId: string;
  prompt: string;
  status: string;
  messages: any[];
  createdAt: string;
}

interface SSEEvent {
  type: string;
  data: any;
}

// ============================================
// CLIENTE API
// ============================================

class AgenToClient {
  private baseUrl: string;
  private token: string | null = null;
  private tenantSlug: string;

  constructor(baseUrl: string, tenantSlug: string) {
    this.baseUrl = baseUrl;
    this.tenantSlug = tenantSlug;
  }

  async authenticate(): Promise<void> {
    console.log('\n🔐 Autenticando...');

    try {
      // Login con credenciales del cliente
      const response = await axios.post(`${this.baseUrl}/api/v1/auth/login`, {
        email: 'rdfinanzas@gmail.com',
        password: 'rd130581',
      });

      if (response.data.token) {
        this.token = response.data.token;
        console.log('✅ Login exitoso (rdfinanzas@gmail.com)');
        return;
      }
    } catch (error: any) {
      console.error('❌ Error de autenticación:', error.response?.data || error.message);
      throw error;
    }
  }

  async createTask(prompt: string): Promise<TaskResponse> {
    if (!this.token) {
      throw new Error('No autenticado');
    }

    console.log(`\n📝 Creando tarea: "${prompt}"`);

    const response = await axios.post(
      `${this.baseUrl}/api/v1/${this.tenantSlug}/accomplish/tasks`,
      { prompt },
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`✅ Tarea creada: ${response.data.id}`);
    return response.data;
  }

  async subscribeToTaskEvents(taskId: string): Promise<void> {
    if (!this.token) {
      throw new Error('No autenticado');
    }

    console.log(`\n📡 Suscribiendo a eventos SSE de tarea ${taskId}...`);

    const eventSourceUrl = `${this.baseUrl}/api/v1/${this.tenantSlug}/accomplish/tasks/${taskId}/events`;

    // Usar fetch para SSE
    const response = await fetch(eventSourceUrl, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'text/event-stream',
      },
    });

    if (!response.ok) {
      throw new Error(`Error SSE: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No reader available');
    }

    console.log('✅ Conectado a SSE');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log('\n📡 SSE cerrado');
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Procesar líneas completas
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') {
            console.log('\n✅ Tarea completada');
            return;
          }

          try {
            const event: SSEEvent = JSON.parse(data);
            this.handleSSEEvent(event);
          } catch (error) {
            // Ignorar errores de parseo
          }
        }
      }
    }
  }

  private handleSSEEvent(event: SSEEvent): void {
    const timestamp = new Date().toLocaleTimeString('es-ES');

    switch (event.type) {
      case 'connected':
        console.log(`\n[${timestamp}] 🔗 Conectado al servidor`);
        break;

      case 'message':
        const role = event.data.role === 'user' ? '👤 USUARIO' : '🤖 AGENTE';
        const content = event.data.content?.substring(0, 100) || '';
        console.log(`\n[${timestamp}] ${role}`);
        console.log(`   "${content}${event.data.content?.length > 100 ? '...' : ''}"`);
        break;

      case 'tool':
        console.log(`\n[${timestamp}] 🔧 Herramienta: ${event.data.toolName}`);
        break;

      case 'progress':
        const progress = event.data.progress || 0;
        const step = event.data.step || '';
        const details = event.data.details || '';
        console.log(`\n[${timestamp}] ⏳ Progreso: ${step} ${progress}% - ${details}`);
        break;

      case 'permission':
        console.log(`\n[${timestamp}] ❓ Permiso solicitado: ${event.data.description}`);
        break;

      case 'complete':
        console.log(`\n[${timestamp}] ✅ COMPLETADO`);
        if (event.data.result) {
          console.log(`   Resultado: ${JSON.stringify(event.data.result).substring(0, 100)}...`);
        }
        break;

      case 'error':
        console.log(`\n[${timestamp}] ❌ ERROR: ${event.data.error}`);
        break;

      case 'started':
        console.log(`\n[${timestamp}] ▶️ Tarea iniciada`);
        break;

      default:
        console.log(`\n[${timestamp}] 📨 Evento: ${event.type}`);
    }
  }

  async getTaskResult(taskId: string): Promise<any> {
    if (!this.token) {
      throw new Error('No autenticado');
    }

    const response = await axios.get(
      `${this.baseUrl}/api/v1/${this.tenantSlug}/accomplish/tasks/${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      }
    );

    return response.data;
  }
}

// ============================================
// SIMULADOR DE LLAMADA
// ============================================

class CallSimulator {
  private client: AgenToClient;
  private conversation: string[] = [];

  constructor(baseUrl: string, tenantSlug: string) {
    this.client = new AgenToClient(baseUrl, tenantSlug);
  }

  async simulateCall(): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('📞 SIMULACIÓN DE LLAMADA REAL - AGENTO SAAS');
    console.log('='.repeat(60));
    console.log(`API: ${this.client['baseUrl']}`);
    console.log(`Tenant: ${this.client['tenantSlug']}`);
    console.log(`Inicio: ${new Date().toLocaleString('es-ES')}`);
    console.log('='.repeat(60));

    try {
      // 1. Autenticar
      await this.client.authenticate();

      // 2. Simular conversación
      await this.runConversation();

      console.log('\n' + '='.repeat(60));
      console.log('📞 FIN DE LA LLAMADA');
      console.log('='.repeat(60));

    } catch (error: any) {
      console.error('\n❌ Error en la simulación:', error.message);

      if (error.code === 'ECONNREFUSED') {
        console.log('\n💡 Asegúrate de que el backend esté corriendo:');
        console.log('   cd packages/backend && npm run dev');
      }
    }
  }

  private async runConversation(): Promise<void> {
    // Conversación simulada de soporte técnico
    const conversationFlow = [
      {
        user: 'Hola, buen día. Tengo un problema con mi API.',
        delay: 1000,
      },
      {
        user: 'El problema es que cuando creo un usuario, me devuelve un error 500.',
        delay: 2000,
      },
      {
        user: 'Sí, el error dice "Database connection failed". Pasó después de un deploy.',
        delay: 2000,
      },
      {
        user: 'Déjame verificar... Sí, las credenciales están correctas.',
        delay: 1500,
      },
      {
        user: '¡Ah, ya lo encontré! La variable DB_HOST no estaba configurada. ¡Gracias!',
        delay: 2000,
      },
    ];

    // Primer mensaje - crear tarea inicial
    console.log('\n--- INICIO DE CONVERSACIÓN ---');

    const firstPrompt = conversationFlow[0].user;
    const task = await this.client.createTask(firstPrompt);

    // Suscribirse a eventos en background
    const eventPromise = this.client.subscribeToTaskEvents(task.id);

    // Esperar un poco
    await this.sleep(3000);

    // Enviar follow-ups
    for (let i = 1; i < conversationFlow.length; i++) {
      const turn = conversationFlow[i];
      await this.sleep(turn.delay);

      console.log(`\n👤 CLIENTE: "${turn.user}"`);

      try {
        await this.client.createTask(turn.user);
      } catch (error: any) {
        console.log(`⚠️ Error en follow-up: ${error.message}`);
      }
    }

    // Esperar a que terminen los eventos
    await eventPromise;

    // Obtener resultado final
    await this.sleep(2000);
    const result = await this.client.getTaskResult(task.id);
    console.log('\n📊 RESULTADO FINAL:');
    console.log(`   Estado: ${result.status}`);
    console.log(`   Mensajes: ${result.messages?.length || 0}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// EJECUTAR SIMULACIÓN
// ============================================

async function main(): Promise<void> {
  const simulator = new CallSimulator(API_URL, TENANT_SLUG);
  await simulator.simulateCall();
}

main().catch(console.error);
