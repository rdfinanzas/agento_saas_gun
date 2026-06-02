/**
 * WhatsAppWorker - Procesa mensajes de WhatsApp de forma asincrona
 * Usa WhatsAppAgentService para generar respuestas con IA
 * Emite eventos WebSocket para monitoreo en tiempo real
 */

import { Worker, Job } from 'bullmq';
import { prisma } from '../../../config/database';
import { WhatsAppJobData } from '../../../config/queue';
import { WhatsAppCloudApiService } from '../services/whatsapp-cloud-api.service';
import { WhatsAppAgentService } from '../services/agent.service';
import {
  emitNewMessage,
  emitConversationUpdate,
  emitNotification,
  isWebSocketInitialized
} from '../../../config/websocket';

// Configuración de conexión Redis para BullMQ
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

export class WhatsAppWorker {
  private worker: Worker | null = null;
  private whatsappApi: WhatsAppCloudApiService;
  private agentService: WhatsAppAgentService;

  constructor() {
    this.whatsappApi = new WhatsAppCloudApiService();
    this.agentService = new WhatsAppAgentService(this.whatsappApi);
  }

  /**
   * Inicia el worker para procesar mensajes
   */
  start() {
    this.worker = new Worker<WhatsAppJobData>(
      'whatsapp-incoming',
      async (job: Job<WhatsAppJobData>) => {
        console.log(`[WhatsAppWorker] Processing job ${job.id}: ${job.data.messageId}`);
        return await this.processMessage(job);
      },
      {
        connection: redisConnection,
        concurrency: 5, // Procesar 5 mensajes simultaneamente
        limiter: {
          max: 10, // Max 10 jobs
          duration: 1000 // Por segundo
        }
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`[WhatsAppWorker] Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`[WhatsAppWorker] Job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err) => {
      console.error(`[WhatsAppWorker] Worker error:`, err.message);
    });

    console.log('[WhatsAppWorker] Worker started and listening for jobs');
  }

  /**
   * Procesa un mensaje individual
   */
  private async processMessage(job: Job<WhatsAppJobData>) {
    const { messageId, conversationId, tenantId, phoneNumber, content } = job.data;

    try {
      // 1. Verificar que la conversacion no este en modo human takeover
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId }
      });

      if (conversation?.status === 'HUMAN_TAKEOVER') {
        console.log(`[WhatsAppWorker] Conversation ${conversationId} in human takeover mode, skipping`);
        return { success: true, skipped: true, reason: 'human_takeover' };
      }

      // 2. Emitir evento de mensaje recibido (WebSocket)
      if (isWebSocketInitialized()) {
        emitNewMessage(tenantId, {
          conversationId,
          messageId,
          phoneNumber,
          content,
          direction: 'INCOMING',
          timestamp: new Date(),
        });
      }

      // 3. Procesar mensaje con el agente de IA
      const agentResponse = await this.agentService.processIncomingMessage({
        tenantId,
        phoneNumber,
        message: content,
        messageId
      });

      console.log(`[WhatsAppWorker] AI response generated (confidence: ${agentResponse.confidence})`);

      // 4. Enviar respuesta por WhatsApp
      await this.agentService.sendResponse(tenantId, phoneNumber, agentResponse.response);

      console.log(`[WhatsAppWorker] Response sent to ${phoneNumber}`);

      // 5. Emitir evento de respuesta enviada (WebSocket)
      if (isWebSocketInitialized()) {
        // Emitir mensaje de respuesta
        emitNewMessage(tenantId, {
          conversationId,
          messageId: `out_${messageId}`,
          phoneNumber,
          content: agentResponse.response,
          direction: 'OUTGOING',
          timestamp: new Date(),
        });

        // Emitir actualizacion de conversacion
        emitConversationUpdate(tenantId, conversationId, {
          lastMessage: agentResponse.response.substring(0, 100),
          lastMessageAt: new Date(),
        });
      }

      return {
        success: true,
        response: agentResponse.response,
        confidence: agentResponse.confidence,
        sources: agentResponse.sources,
        tokensUsed: agentResponse.tokensUsed
      };

    } catch (error: any) {
      console.error(`[WhatsAppWorker] Error processing message:`, error);

      // Actualizar estado del mensaje a fallido
      await prisma.message.updateMany({
        where: { messageId },
        data: { status: 'FAILED' }
      });

      // Emitir notificacion de error (WebSocket)
      if (isWebSocketInitialized()) {
        emitNotification(tenantId, {
          type: 'error',
          title: 'Error procesando mensaje',
          message: `No se pudo procesar el mensaje de ${phoneNumber}: ${error.message}`,
          data: { messageId, phoneNumber, error: error.message }
        });
      }

      // Re-lanzar para que BullMQ maneje los reintentos
      throw error;
    }
  }

  /**
   * Detiene el worker
   */
  async stop() {
    if (this.worker) {
      await this.worker.close();
      console.log('[WhatsAppWorker] Worker stopped');
    }
  }

  /**
   * Obtiene estadisticas del worker
   */
  async getStats() {
    if (!this.worker) {
      return { running: false };
    }

    return {
      running: this.worker.isRunning(),
      // @ts-ignore
      id: this.worker.id
    };
  }
}

// Singleton instance
export const whatsAppWorker = new WhatsAppWorker();

// Auto-start si se ejecuta directamente
if (require.main === module) {
  const worker = new WhatsAppWorker();
  worker.start();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[WhatsAppWorker] SIGTERM received, shutting down...');
    await worker.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('[WhatsAppWorker] SIGINT received, shutting down...');
    await worker.stop();
    process.exit(0);
  });
}
