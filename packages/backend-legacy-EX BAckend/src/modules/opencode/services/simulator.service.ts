/**
 * SimulatorService - Sistema de simulación para entrenamiento de agentes
 * FASE 4: Modo Sandbox/Entrenamiento
 *
 * PLAN #5: Migrado a @agento/agent-core
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../../config/database';
import { agentIdentityService } from './agent-identity.service';
import { WhatsAppAdapter } from '@agento/agent-core';

// Interfaces
export interface SimulationConfig {
  scenario?: 'positive' | 'negative' | 'question' | 'custom';
  customerProfile?: CustomerProfile;
  initialContext?: string;
  autoRespond?: boolean;
}

export interface TrainingScenario {
  id: string;
  title: string;
  description: string;
  category: 'sales' | 'support' | 'complaints' | 'general';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number;
  objectives: string[];
  customerPersona: CustomerProfile;
}

export interface CustomerProfile {
  name: string;
  tone: 'friendly' | 'formal' | 'casual' | 'angry';
  language?: string;
  interests?: string[];
}

export interface SandboxSession {
  id: string;
  tenantId: string;
  agentId: string;
  config: SimulationConfig;
  messages: SimulationMessage[];
  startedAt: Date;
  endedAt?: Date | null;
  status: 'active' | 'completed' | 'abandoned';
  metrics: SimulationMetrics;
}

export interface SimulationMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    intent?: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
    responseTime?: number;
  };
}

export interface SimulationMetrics {
  totalMessages: number;
  avgResponseTime: number;
  sentimentScore: number;
  resolutionRate: number;
  escalatedCount: number;
}

export interface SimulationLog {
  sessionId: string;
  timestamp: Date;
  event: string;
  details: Record<string, any>;
}

export class SimulatorService {
  private sessions: Map<string, SandboxSession> = new Map();
  private logs: Map<string, SimulationLog[]> = new Map();
  private adapter: WhatsAppAdapter;

  constructor() {
    // PLAN #5: Usar @agento/agent-core - WhatsAppAdapter maneja internamente la ejecución
    this.adapter = new WhatsAppAdapter();
  }

  /**
   * Crea una nueva sesión de simulación
   */
  async createSimulation(
    tenantId: string,
    config: SimulationConfig = {}
  ): Promise<SandboxSession> {
    // Obtener configuración del agente
    const agentConfig = await agentIdentityService.getIdentity(tenantId);

    if (!agentConfig) {
      throw new Error('No hay configuración de agente para este tenant');
    }

    const sessionId = uuidv4();
    const agentId = agentConfig.id;

    const session: SandboxSession = {
      id: sessionId,
      tenantId,
      agentId,
      config: {
        scenario: config.scenario || 'positive',
        customerProfile: config.customerProfile || {
          name: 'Cliente de Prueba',
          tone: 'friendly',
          language: 'es',
        },
        autoRespond: config.autoRespond ?? false,
        ...config,
      },
      messages: [],
      startedAt: new Date(),
      status: 'active',
      metrics: {
        totalMessages: 0,
        avgResponseTime: 0,
        sentimentScore: 0,
        resolutionRate: 0,
        escalatedCount: 0,
      },
    };

    // Guardar en memoria y BD
    this.sessions.set(sessionId, session);
    this.logs.set(sessionId, []);

    // Guardar en BD
    await prisma.simulationSession.create({
      data: {
        id: sessionId,
        tenantId,
        agentId,
        config: session.config as any,
        messages: [],
        status: 'active',
        startedAt: session.startedAt,
        metrics: session.metrics as any,
      },
    });

    this.logEvent(sessionId, 'session_created', {
      scenario: session.config.scenario,
      customerProfile: session.config.customerProfile,
    });

    // Mensaje inicial del sistema
    await this.addSystemMessage(sessionId, this.generateWelcomeMessage(session));

    return session;
  }

  /**
   * Envía un mensaje en la simulación
   */
  async sendSimulatedMessage(
    sessionId: string,
    message: string,
    role: 'user' | 'agent' = 'user'
  ): Promise<SimulationMessage> {
    let session = this.sessions.get(sessionId);

    if (!session) {
      // Intentar cargar de BD
      const dbSession = await prisma.simulationSession.findUnique({
        where: { id: sessionId },
      });

      if (!dbSession) {
        throw new Error('Sesión de simulación no encontrada');
      }

      // Restaurar sesión
      session = {
        id: dbSession.id,
        tenantId: dbSession.tenantId,
        agentId: dbSession.agentId,
        config: dbSession.config as unknown as SimulationConfig,
        messages: dbSession.messages as unknown as SimulationMessage[],
        metrics: dbSession.metrics as unknown as SimulationMetrics,
        status: dbSession.status as SandboxSession['status'],
        startedAt: dbSession.startedAt,
        endedAt: dbSession.endedAt ?? undefined,
      };
      this.sessions.set(sessionId, session);
    }

    if (!session) {
      throw new Error('Sesión de simulación no encontrada');
    }

    if (session.status !== 'active') {
      throw new Error('La sesión de simulación no está activa');
    }

    const startTime = Date.now();

    // Agregar mensaje del usuario
    const userMessage: SimulationMessage = {
      id: uuidv4(),
      role,
      content: message,
      timestamp: new Date(),
    };

    session.messages.push(userMessage);
    session.metrics.totalMessages++;

    this.logEvent(sessionId, 'message_sent', {
      role,
      content: message,
      messageId: userMessage.id,
    });

    // Si es mensaje del usuario, generar respuesta del agente
    if (role === 'user') {
      try {
        // PLAN #5: Usar execute() de @agento/agent-core
        const response = await this.adapter.execute(
          session.tenantId,
          message,
          {
            phoneNumber: 'sim-customer',
            metadata: { sessionId: `sim-${sessionId}` }
          }
        );

        const responseTime = Date.now() - startTime;

        const agentMessage: SimulationMessage = {
          id: uuidv4(),
          role: 'agent',
          content: response.content,
          timestamp: new Date(),
          metadata: {
            responseTime,
            sentiment: this.analyzeSentiment(response.content),
          },
        };

        session.messages.push(agentMessage);
        session.metrics.totalMessages++;

        // Actualizar métricas
        this.updateMetrics(session, responseTime);

        this.logEvent(sessionId, 'agent_response', {
          content: response.content,
          responseTime,
        });

        // Guardar en BD
        await this.persistSession(session);

        return agentMessage;
      } catch (error: any) {
        this.logEvent(sessionId, 'error', {
          error: error.message,
          step: 'agent_response',
        });

        const errorMessage: SimulationMessage = {
          id: uuidv4(),
          role: 'system',
          content: `Error: ${error.message}`,
          timestamp: new Date(),
        };

        session.messages.push(errorMessage);
        await this.persistSession(session);

        return errorMessage;
      }
    }

    await this.persistSession(session);
    return userMessage;
  }

  /**
   * Simula una respuesta de cliente basada en escenario
   */
  async simulateCustomerResponse(
    sessionId: string,
    scenario?: 'positive' | 'negative' | 'question'
  ): Promise<SimulationMessage> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error('Sesión de simulación no encontrada');
    }

    const effectiveScenario = scenario || session.config.scenario || 'positive';
    const customerMessage = this.generateCustomerMessage(
      effectiveScenario,
      session.config.customerProfile,
      session.messages
    );

    this.logEvent(sessionId, 'customer_simulation', {
      scenario: effectiveScenario,
      message: customerMessage,
    });

    return this.sendSimulatedMessage(sessionId, customerMessage, 'user');
  }

  /**
   * Obtiene los logs de una simulación
   */
  async getSimulationLogs(sessionId: string): Promise<SimulationLog[]> {
    const logs = this.logs.get(sessionId);

    if (logs) {
      return logs;
    }

    // Intentar cargar de BD
    const dbLogs = await prisma.simulationLog.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
    });

    return dbLogs.map(log => ({
      sessionId: log.sessionId,
      timestamp: log.timestamp,
      event: log.event,
      details: log.details as Record<string, any>,
    }));
  }

  /**
   * Obtiene una sesión de simulación
   */
  async getSession(sessionId: string): Promise<SandboxSession | null> {
    let session = this.sessions.get(sessionId);

    if (!session) {
      const dbSession = await prisma.simulationSession.findUnique({
        where: { id: sessionId },
      });

      if (dbSession) {
        session = {
          ...dbSession,
          config: dbSession.config as unknown as SimulationConfig,
          messages: dbSession.messages as unknown as SimulationMessage[],
          metrics: dbSession.metrics as unknown as SimulationMetrics,
          status: dbSession.status as SandboxSession['status'],
        };
        this.sessions.set(sessionId, session);
      }
    }

    return session || null;
  }

  /**
   * Lista todas las sesiones de un tenant
   */
  async listSessions(tenantId: string): Promise<SandboxSession[]> {
    const dbSessions = await prisma.simulationSession.findMany({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
    });

    return dbSessions.map(s => ({
      ...s,
      config: s.config as unknown as SimulationConfig,
      messages: s.messages as unknown as SimulationMessage[],
      metrics: s.metrics as unknown as SimulationMetrics,
      status: s.status as SandboxSession['status'],
    }));
  }

  /**
   * Termina una sesión de simulación
   */
  async endSession(sessionId: string): Promise<SandboxSession> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error('Sesión de simulación no encontrada');
    }

    session.status = 'completed';
    session.endedAt = new Date();

    // Calcular métricas finales
    session.metrics.resolutionRate = this.calculateResolutionRate(session);
    session.metrics.sentimentScore = this.calculateSentimentScore(session);

    this.logEvent(sessionId, 'session_ended', {
      duration: session.endedAt.getTime() - session.startedAt.getTime(),
      totalMessages: session.metrics.totalMessages,
      finalMetrics: session.metrics,
    });

    await this.persistSession(session);

    return session;
  }

  /**
   * Promueve el agente a producción
   */
  async promoteToProduction(tenantId: string): Promise<{
    success: boolean;
    message: string;
    validation?: any;
  }> {
    // Validar que el agente esté listo
    const validation = await agentIdentityService.validateForProduction(tenantId);

    if (!validation.valid) {
      return {
        success: false,
        message: 'El agente no cumple con los requisitos para producción',
        validation,
      };
    }

    // Verificar que haya al menos una simulación completada
    const sessions = await this.listSessions(tenantId);
    const completedSessions = sessions.filter(s => s.status === 'completed');

    if (completedSessions.length === 0) {
      return {
        success: false,
        message: 'Debe completar al menos una simulación antes de promover a producción',
        validation: {
          ...validation,
          issues: [
            ...validation.issues,
            {
              field: 'simulations',
              message: 'No hay simulaciones completadas',
              severity: 'error' as const,
            },
          ],
        },
      };
    }

    // Activar el agente
    const result = await agentIdentityService.activateAgent(tenantId);

    if (result.success) {
      this.logEvent('system', 'agent_promoted', {
        tenantId,
        previousStatus: 'draft',
        newStatus: 'active',
        simulationCount: completedSessions.length,
      });
    }

    return {
      success: result.success,
      message: result.message,
      validation,
    };
  }

  /**
   * Obtiene métricas agregadas de simulaciones
   */
  async getSimulationMetrics(tenantId: string): Promise<{
    totalSessions: number;
    completedSessions: number;
    avgMessagesPerSession: number;
    avgResponseTime: number;
    overallSentiment: number;
    resolutionRate: number;
  }> {
    const sessions = await this.listSessions(tenantId);
    const completedSessions = sessions.filter(s => s.status === 'completed');

    if (completedSessions.length === 0) {
      return {
        totalSessions: sessions.length,
        completedSessions: 0,
        avgMessagesPerSession: 0,
        avgResponseTime: 0,
        overallSentiment: 0,
        resolutionRate: 0,
      };
    }

    const totalMessages = completedSessions.reduce(
      (sum, s) => sum + s.metrics.totalMessages,
      0
    );

    const avgResponseTime =
      completedSessions.reduce((sum, s) => sum + s.metrics.avgResponseTime, 0) /
      completedSessions.length;

    const overallSentiment =
      completedSessions.reduce((sum, s) => sum + s.metrics.sentimentScore, 0) /
      completedSessions.length;

    const resolutionRate =
      completedSessions.reduce((sum, s) => sum + s.metrics.resolutionRate, 0) /
      completedSessions.length;

    return {
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      avgMessagesPerSession: totalMessages / completedSessions.length,
      avgResponseTime,
      overallSentiment,
      resolutionRate,
    };
  }

  // ============================================
  // Métodos privados
  // ============================================

  private generateWelcomeMessage(session: SandboxSession): string {
    const profile = session.config.customerProfile;
    return `[SIMULACIÓN INICIADA]
Escenario: ${session.config.scenario}
Cliente simulado: ${profile?.name || 'Cliente'}
Tono: ${profile?.tone || 'neutral'}

Puedes comenzar enviando un mensaje como si fueras el cliente para probar las respuestas del agente.`;
  }

  private generateCustomerMessage(
    scenario: string,
    profile?: CustomerProfile,
    previousMessages?: SimulationMessage[]
  ): string {
    const messages: Record<string, string[]> = {
      positive: [
        'Hola, me interesa conocer más sobre sus productos',
        '¿Tienen disponibilidad para esta semana?',
        'Excelente, muchas gracias por la información',
        'Perfecto, procederé con la compra',
        '¿Cuáles son las opciones de pago?',
      ],
      negative: [
        'Estoy muy decepcionado con el servicio',
        'Esto no es lo que me prometieron',
        'Quiero hablar con un supervisor',
        'No estoy de acuerdo con esa respuesta',
        'Voy a cancelar mi suscripción',
      ],
      question: [
        '¿Cuáles son los horarios de atención?',
        '¿Hacen envíos a mi ciudad?',
        '¿Cuánto cuesta el envío?',
        '¿Tienen garantía los productos?',
        '¿Puedo devolver el producto si no me gusta?',
      ],
    };

    const scenarioMessages = messages[scenario] || messages.positive;

    // Evitar repetir mensajes anteriores
    const usedMessages = (previousMessages || [])
      .filter(m => m.role === 'user')
      .map(m => m.content);

    const availableMessages = scenarioMessages.filter(
      m => !usedMessages.includes(m)
    );

    if (availableMessages.length === 0) {
      return scenarioMessages[0]; // Reciclar si se agotaron
    }

    return availableMessages[Math.floor(Math.random() * availableMessages.length)];
  }

  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['gracias', 'excelente', 'perfecto', 'genial', 'bueno', 'ayuda'];
    const negativeWords = ['error', 'problema', 'malo', 'no puedo', 'imposible', 'lamentamos'];

    const lowerText = text.toLowerCase();

    const positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private updateMetrics(session: SandboxSession, responseTime: number): void {
    const messages = session.messages.filter(m => m.role === 'agent');
    const totalTime = messages.reduce((sum, m) => sum + (m.metadata?.responseTime || 0), 0);
    session.metrics.avgResponseTime = Math.round(totalTime / messages.length);
  }

  private calculateResolutionRate(session: SandboxSession): number {
    const userMessages = session.messages.filter(m => m.role === 'user').length;
    const agentMessages = session.messages.filter(m => m.role === 'agent').length;

    if (userMessages === 0) return 0;

    // Simple heuristic: ratio de respuestas del agente
    return Math.min(100, Math.round((agentMessages / userMessages) * 100));
  }

  private calculateSentimentScore(session: SandboxSession): number {
    const agentMessages = session.messages.filter(m => m.role === 'agent');

    if (agentMessages.length === 0) return 0;

    const sentiments = agentMessages.map(m => {
      const s = m.metadata?.sentiment;
      if (s === 'positive') return 100;
      if (s === 'negative') return 0;
      return 50;
    });

    return Math.round(sentiments.reduce((a: number, b: number) => a + b, 0) / sentiments.length);
  }

  private async addSystemMessage(
    sessionId: string,
    content: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const message: SimulationMessage = {
      id: uuidv4(),
      role: 'system',
      content,
      timestamp: new Date(),
    };

    session.messages.push(message);
  }

  private logEvent(
    sessionId: string,
    event: string,
    details: Record<string, any>
  ): void {
    const logs = this.logs.get(sessionId) || [];

    logs.push({
      sessionId,
      timestamp: new Date(),
      event,
      details,
    });

    this.logs.set(sessionId, logs);

    // También guardar en BD de forma asíncrona
    prisma.simulationLog.create({
      data: {
        sessionId,
        event,
        details,
      },
    }).catch(err => {
      console.error('Error saving simulation log:', err);
    });
  }

  private async persistSession(session: SandboxSession): Promise<void> {
    await prisma.simulationSession.update({
      where: { id: session.id },
      data: {
        messages: session.messages as any,
        status: session.status,
        endedAt: session.endedAt,
        metrics: session.metrics as any,
      },
    });
  }

  /**
   * Obtiene escenarios disponibles para entrenamiento
   */
  async getAvailableScenarios(): Promise<TrainingScenario[]> {
    return [
      {
        id: 'sales-inquiry',
        title: 'Consulta de Ventas',
        description: 'Cliente interesado en productos/servicios',
        category: 'sales',
        difficulty: 'beginner',
        estimatedDuration: 5,
        objectives: [
          'Identificar necesidades del cliente',
          'Presentar información relevante',
          'Guiar hacia una decisión',
        ],
        customerPersona: {
          name: 'María González',
          tone: 'friendly',
          language: 'es',
          interests: ['tecnología', 'ofertas', 'calidad'],
        },
      },
      {
        id: 'support-issue',
        title: 'Problema Técnico',
        description: 'Cliente con dificultad técnica',
        category: 'support',
        difficulty: 'intermediate',
        estimatedDuration: 8,
        objectives: [
          'Diagnosticar el problema',
          'Proporcionar solución clara',
          'Verificar resolución',
        ],
        customerPersona: {
          name: 'Carlos Rodríguez',
          tone: 'casual',
          language: 'es',
          interests: ['resolución rápida', 'guías claras'],
        },
      },
      {
        id: 'complaint-resolution',
        title: 'Resolución de Quejas',
        description: 'Cliente insatisfecho requiere atención',
        category: 'complaints',
        difficulty: 'advanced',
        estimatedDuration: 10,
        objectives: [
          'Escuchar activamente',
          'Mostrar empatía',
          'Ofrecer solución satisfactoria',
        ],
        customerPersona: {
          name: 'Ana Martínez',
          tone: 'angry',
          language: 'es',
          interests: ['solución', 'compensación'],
        },
      },
      {
        id: 'general-inquiry',
        title: 'Consulta General',
        description: 'Preguntas frecuentes sobre servicios',
        category: 'general',
        difficulty: 'beginner',
        estimatedDuration: 3,
        objectives: [
          'Responder información básica',
          'Proporcionar recursos adicionales',
          'Mantener conversación cordial',
        ],
        customerPersona: {
          name: 'Juan López',
          tone: 'formal',
          language: 'es',
          interests: ['información detallada', 'horarios'],
        },
      },
      {
        id: 'upsell-opportunity',
        title: 'Oportunidad de Venda Cruzada',
        description: 'Cliente existente interesado en más productos',
        category: 'sales',
        difficulty: 'intermediate',
        estimatedDuration: 7,
        objectives: [
          'Identificar oportunidades adicionales',
          'Presentar productos complementarios',
          'Cerrar venta adicional',
        ],
        customerPersona: {
          name: 'Laura Sánchez',
          tone: 'friendly',
          language: 'es',
          interests: ['promociones', 'paquetes', 'descuentos'],
        },
      },
      {
        id: 'refund-request',
        title: 'Solicitud de Reembolso',
        description: 'Cliente solicita devolución de pago',
        category: 'complaints',
        difficulty: 'advanced',
        estimatedDuration: 12,
        objectives: [
          'Entender la razón del reembolso',
          'Evaluar política de devoluciones',
          'Ofrecer alternativas o procesar devolución',
        ],
        customerPersona: {
          name: 'Roberto Díaz',
          tone: 'angry',
          language: 'es',
          interests: ['reembolso rápido', 'políticas claras'],
        },
      },
      {
        id: 'product-information',
        title: 'Información de Producto',
        description: 'Cliente requiere detalles específicos',
        category: 'support',
        difficulty: 'beginner',
        estimatedDuration: 5,
        objectives: [
          'Proporcionar especificaciones',
          'Aclarar dudas técnicas',
          'Ofrecer documentación adicional',
        ],
        customerPersona: {
          name: 'Carmen Torres',
          tone: 'formal',
          language: 'es',
          interests: ['especificaciones técnicas', 'manuales'],
        },
      },
      {
        id: 'follow-up-interaction',
        title: 'Seguimiento Post-Venta',
        description: 'Contacto posterior a una compra',
        category: 'general',
        difficulty: 'intermediate',
        estimatedDuration: 6,
        objectives: [
          'Verificar satisfacción',
          'Ofrecer asistencia adicional',
          'Fidelizar cliente',
        ],
        customerPersona: {
          name: 'Diego Flores',
          tone: 'friendly',
          language: 'es',
          interests: ['soporte continuo', 'actualizaciones'],
        },
      },
    ];
  }

  /**
   * Genera evaluación detallada de una sesión
   */
  async generateEvaluation(
    sessionId: string,
    feedback?: string
  ): Promise<{
    overallScore: number;
    strengths: string[];
    improvements: string[];
    recommendations: string[];
  }> {
    const session = await this.getSession(sessionId);

    if (!session) {
      throw new Error('Sesión no encontrada');
    }

    const metrics = session.metrics;
    const overallScore = Math.round(
      (metrics.sentimentScore * 0.4 +
        metrics.resolutionRate * 0.4 +
        (100 - Math.min(metrics.avgResponseTime / 10, 100)) * 0.2)
    );

    const strengths: string[] = [];
    const improvements: string[] = [];
    const recommendations: string[] = [];

    if (metrics.sentimentScore > 70) {
      strengths.push('Excelente tono positivo en las respuestas');
    } else if (metrics.sentimentScore < 40) {
      improvements.push('Mejorar el tono y empatía en las respuestas');
    }

    if (metrics.resolutionRate > 80) {
      strengths.push('Alta tasa de resolución de consultas');
    } else if (metrics.resolutionRate < 50) {
      improvements.push('Aumentar la completitud de las respuestas');
    }

    if (metrics.avgResponseTime < 1000) {
      strengths.push('Tiempos de respuesta muy rápidos');
    } else if (metrics.avgResponseTime > 3000) {
      improvements.push('Reducir tiempos de respuesta');
      recommendations.push('Considerar usar respuestas predefinidas para preguntas frecuentes');
    }

    if (metrics.escalatedCount === 0) {
      strengths.push('No hubo necesidad de escalación');
    }

    if (feedback) {
      recommendations.push(`Feedback del usuario: ${feedback}`);
    }

    if (overallScore > 80) {
      recommendations.push('El agente está listo para producción');
    } else if (overallScore > 60) {
      recommendations.push('Se recomienda practicar más escenarios antes de producción');
    } else {
      recommendations.push('El agente necesita más entrenamiento antes de producción');
    }

    return {
      overallScore,
      strengths,
      improvements,
      recommendations,
    };
  }

  /**
   * Valida si el agente está listo para producción
   */
  async validateForProduction(tenantId: string): Promise<{
    valid: boolean;
    issues: Array<{
      field: string;
      message: string;
      severity: 'error' | 'warning';
    }>;
  }> {
    const issues: Array<{
      field: string;
      message: string;
      severity: 'error' | 'warning';
    }> = [];

    const metrics = await this.getSimulationMetrics(tenantId);

    if (metrics.completedSessions < 3) {
      issues.push({
        field: 'sessions',
        message: `Se requieren al menos 3 sesiones completadas (actual: ${metrics.completedSessions})`,
        severity: 'error',
      });
    }

    if (metrics.overallSentiment < 60) {
      issues.push({
        field: 'sentiment',
        message: `El puntaje de sentimiento debe ser mayor a 60 (actual: ${Math.round(metrics.overallSentiment)})`,
        severity: 'error',
      });
    }

    if (metrics.resolutionRate < 70) {
      issues.push({
        field: 'resolution',
        message: `La tasa de resolución debe ser mayor al 70% (actual: ${Math.round(metrics.resolutionRate)}%)`,
        severity: 'error',
      });
    }

    if (metrics.avgResponseTime > 3000) {
      issues.push({
        field: 'responseTime',
        message: `El tiempo de respuesta promedio es alto (${metrics.avgResponseTime}ms)`,
        severity: 'warning',
      });
    }

    return {
      valid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
    };
  }
}

export const simulatorService = new SimulatorService();
