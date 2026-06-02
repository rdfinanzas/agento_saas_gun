import { Queue } from 'bullmq';

// Configuración de conexión Redis como opciones (no como instancia)
// Esto evita problemas de compatibilidad de tipos entre ioredis y bullmq
export const connectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null as null,
};

export const whatsappQueue = new Queue('whatsapp-incoming', {
  connection: connectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export interface WhatsAppJobData {
  messageId: string;
  conversationId: string;
  tenantId: string;
  phoneNumber: string;
  content: string;
  timestamp: Date;
}

export async function closeQueues(): Promise<void> {
  await whatsappQueue.close();
}

export async function getQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    whatsappQueue.getWaitingCount(),
    whatsappQueue.getActiveCount(),
    whatsappQueue.getCompletedCount(),
    whatsappQueue.getFailedCount(),
  ]);
  return { whatsapp: { waiting, active, completed, failed } };
}
