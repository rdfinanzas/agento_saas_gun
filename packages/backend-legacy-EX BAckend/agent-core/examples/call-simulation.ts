/**
 * Simulación de Llamada Telefónica con OpenCode Integration
 *
 * Este script simula una llamada telefónica donde un cliente habla con
 * el agente de IA (OpenCode) para resolver un problema técnico.
 */

import { EventEmitter } from 'events';

// ============================================
// Types para la simulación
// ============================================

interface CallEvent {
  timestamp: Date;
  type: 'incoming' | 'outgoing';
  content: string;
  speaker: 'customer' | 'agent';
}

interface SimulationConfig {
  customerName: string;
  businessName: string;
  problem: string;
  tenantId: string;
}

// ============================================
// Simulador de OpenCode Runtime
// ============================================

class MockOpenCodeRuntime extends EventEmitter {
  private sessionId: string;
  private messages: Array<{ role: string; content: string; timestamp: Date }> = [];

  constructor(sessionId: string) {
    super();
    this.sessionId = sessionId;
  }

  async executePrompt(prompt: string, context: any): Promise<{
    content: string;
    sessionId: string;
    tokens: number;
  }> {
    console.log(`\n[OpenCode] Processing prompt: "${prompt.substring(0, 50)}..."`);

    // Simular pensamiento del agente
    await this.delay(1000);

    // Generar respuesta basada en el prompt
    const response = this.generateResponse(prompt);

    this.messages.push({
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    });

    return {
      content: response,
      sessionId: this.sessionId,
      tokens: Math.floor(Math.random() * 500) + 100,
    };
  }

  private generateResponse(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    // Respuestas simuladas basadas en el contexto
    if (lowerPrompt.includes('hola') || lowerPrompt.includes('buenos días')) {
      return `¡Hola! Gracias por llamar a ${this.getBusinessName()}. Soy su asistente virtual. ¿En qué puedo ayudarle hoy?`;
    }

    if (lowerPrompt.includes('problema') || lowerPrompt.includes('error') || lowerPrompt.includes('no funciona')) {
      return `Entiendo que tiene un problema. Lamento los inconvenientes. Para poder ayudarle mejor, ¿podría darme más detalles sobre qué está ocurriendo exactamente? Por ejemplo:
1. ¿Cuándo comenzó el problema?
2. ¿Qué mensaje de error ve, si hay alguno?
3. ¿Qué estaba haciendo cuando ocurrió?`;
    }

    if (lowerPrompt.includes('api') || lowerPrompt.includes('endpoint')) {
      return `Perfecto, veo que es un problema con la API. Déjeme analizar esto...

[BASH] Ejecutando: curl -X GET https://api.example.com/health
[RESPONSE] {"status":"ok","uptime":12345}

El servidor de la API está funcionando correctamente. El problema podría estar en:
1. La configuración del cliente
2. El token de autenticación
3. La versión de la API

¿Podría verificar su archivo de configuración?`;
    }

    if (lowerPrompt.includes('gracias') || lowerPrompt.includes('funciona')) {
      return `¡Excelente! Me alegra que hayamos resuelto el problema. Si tiene alguna otra pregunta o necesita más ayuda en el futuro, no dude en llamar nuevamente.

¿Hay algo más en lo que pueda ayudarle hoy?`;
    }

    if (lowerPrompt.includes('adiós') || lowerPrompt.includes('chau')) {
      return `¡Gracias por llamar! Que tenga un excelente día. ¡Adiós!`;
    }

    // Respuesta por defecto
    return `Entiendo. Déjeme buscar información sobre eso...

[SEARCH] Buscando: "${prompt.substring(0, 30)}..."
[RESULTS] Encontré 3 resultados relevantes

Basándome en la información, le recomiendo:
1. Verificar la configuración actual
2. Revisar los logs del sistema
3. Actualizar a la última versión

¿Puede confirmar si alguna de estas opciones aplica a su caso?`;
  }

  private getBusinessName(): string {
    return 'TechCorp Soluciones';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// Simulador de Llamada Telefónica
// ============================================

class CallSimulator extends EventEmitter {
  private openCode: MockOpenCodeRuntime;
  private config: SimulationConfig;
  private callLog: CallEvent[] = [];
  private active: boolean = false;

  constructor(config: SimulationConfig) {
    super();
    this.config = config;
    this.openCode = new MockOpenCodeRuntime(`session-${config.tenantId}`);
  }

  async startCall(): Promise<void> {
    if (this.active) {
      console.log('[Call] La llamada ya está activa');
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📞 LLAMADA TELEFÓNICA SIMULADA');
    console.log('='.repeat(60));
    console.log(`Cliente: ${this.config.customerName}`);
    console.log(`Empresa: ${this.config.businessName}`);
    console.log(`Tenant ID: ${this.config.tenantId}`);
    console.log(`Inicio: ${new Date().toLocaleString('es-ES')}`);
    console.log('='.repeat(60) + '\n');

    this.active = true;
    this.emit('call:started');

    // Saludo inicial del cliente
    await this.customerSpeaks('Hola, buenos días. Estoy llamando porque tengo un problema técnico con mi sistema.');

    // Simular conversación
    await this.runConversation();

    this.endCall();
  }

  private async runConversation(): Promise<void> {
    const conversationFlow = [
      {
        customer: 'Sí, el problema es que mi API de usuarios está devolviendo un error 500 cuando intento crear un nuevo usuario.',
        agentContext: 'Error 500 en API de creación de usuarios'
      },
      {
        customer: 'El error dice "Database connection failed". Comenzó hace unos 30 minutos, justo después de que hicimos un deploy.',
        agentContext: 'Error de conexión a base de datos después de deploy'
      },
      {
        customer: 'Déjame verificar... Sí, veo que las credenciales de base de datos están correctas. El usuario tiene todos los permisos necesarios.',
        agentContext: 'Credenciales verificadas correctamente'
      },
      {
        customer: '¡Excelente! Sí, me funcionó. El problema era que la variable de entorno DB_HOST no estaba configurada en el nuevo servidor. Muchas gracias por tu ayuda.',
        agentContext: 'Problema resuelto - variable de entorno DB_HOST'
      },
      {
        customer: 'No, eso es todo. ¡Gracias de nuevo! Adiós.',
        agentContext: 'Despedida'
      }
    ];

    for (const turn of conversationFlow) {
      await this.agentResponds(turn.agentContext);
      await this.delay(500);
      await this.customerSpeaks(turn.customer);
      await this.delay(300);
    }
  }

  private async customerSpeaks(message: string): Promise<void> {
    const event: CallEvent = {
      timestamp: new Date(),
      type: 'incoming',
      content: message,
      speaker: 'customer'
    };

    this.callLog.push(event);

    console.log(`\n👤 CLIENTE [${this.formatTime(event.timestamp)}]`);
    console.log(`   "${message}"`);
    this.emit('call:message', event);
  }

  private async agentResponds(context: string): Promise<void> {
    const prompt = `[Contexto de llamada: Cliente ${this.config.customerName} de ${this.config.businessName}]
[Situación actual: ${context}]

Como agente de soporte técnico, responde al cliente de manera profesional y amable. Ayuda a resolver el problema.`;

    const result = await this.openCode.executePrompt(prompt, {
      tenantId: this.config.tenantId,
      taskId: `task-${Date.now()}`
    });

    const event: CallEvent = {
      timestamp: new Date(),
      type: 'outgoing',
      content: result.content,
      speaker: 'agent'
    };

    this.callLog.push(event);

    console.log(`\n🤖 AGENTE [${this.formatTime(event.timestamp)}]`);
    console.log(`   "${result.content}"`);
    console.log(`   [Tokens: ${result.tokens}]`);
    this.emit('call:message', event);
  }

  private endCall(): void {
    this.active = false;

    const duration = this.callLog.length > 0
      ? new Date().getTime() - this.callLog[0].timestamp.getTime()
      : 0;

    console.log('\n' + '='.repeat(60));
    console.log('📞 FIN DE LA LLAMADA');
    console.log('='.repeat(60));
    console.log(`Duración: ${Math.floor(duration / 1000)} segundos`);
    console.log(`Eventos: ${this.callLog.length}`);
    console.log(`Fin: ${new Date().toLocaleString('es-ES')}`);
    console.log('='.repeat(60) + '\n');

    this.emit('call:ended', {
      duration,
      events: this.callLog.length,
      log: this.callLog
    });
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getCallLog(): CallEvent[] {
    return [...this.callLog];
  }
}

// ============================================
// Ejecutar Simulación
// ============================================

async function runSimulation(): Promise<void> {
  const config: SimulationConfig = {
    customerName: 'Juan Pérez',
    businessName: 'TechCorp Soluciones',
    problem: 'Error 500 en API',
    tenantId: 'tenant-techcorp-001'
  };

  const simulator = new CallSimulator(config);

  // Escuchar eventos
  simulator.on('call:started', () => {
    console.log('[System] Call started');
  });

  simulator.on('call:message', (event: CallEvent) => {
    // Log event to file or system
  });

  simulator.on('call:ended', (summary: any) => {
    console.log('[System] Call ended');
    console.log(`[System] Duration: ${Math.floor(summary.duration / 1000)}s`);
    console.log(`[System] Total messages: ${summary.events}`);

    // Guardar log
    const logPath = `./call-log-${Date.now()}.json`;
    console.log(`[System] Call log saved to: ${logPath}`);
  });

  // Iniciar llamada
  await simulator.startCall();
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runSimulation().catch(console.error);
}

export { CallSimulator, MockOpenCodeRuntime, SimulationConfig, CallEvent };
