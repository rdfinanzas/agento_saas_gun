import { createApp } from './app';
import { createServer as createHttpServer } from 'http';
import { initializeWebSocket } from './config/websocket';
import { initializeApprovalService } from './modules/opencode/services/approval.service';
import { initializeWhatsAppAgentService } from './modules/whatsapp/services/agent.service';
import { whatsAppBaileysService } from './modules/whatsapp/services/whatsapp-baileys.service';

export async function createServer() {
  const app = createApp();

  // Crear servidor HTTP
  const httpServer = createHttpServer(app);

  // Inicializar WebSocket sobre el servidor HTTP
  const io = initializeWebSocket(httpServer);

  // PLAN #7: Inicializar servicios con Socket.io
  initializeApprovalService(io);
  initializeWhatsAppAgentService(io);
  whatsAppBaileysService.setIO(io);

  // TODO: Initialize database when Prisma is set up
  // await initDatabase();

  return { app, httpServer };
}
