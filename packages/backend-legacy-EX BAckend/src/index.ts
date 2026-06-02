import 'reflect-metadata';
import { createServer } from './server';
import path from 'path';
import { config } from 'dotenv';
import { whatsAppWorker } from './modules/whatsapp/workers/whatsapp.worker';
import { schedulerService } from './modules/opencode/services/scheduler.service';
import { getWebSocketStats } from './config/websocket';

// Load .env from project root
config({ path: path.resolve(__dirname, '../../.env') });

const port = process.env.PORT || 3000;

async function startServer() {
  try {
    const { app, httpServer } = await createServer();

    // Inicializar WhatsApp Worker
    console.log('[Startup] Inicializando WhatsApp Worker...');
    whatsAppWorker.start();

    // Inicializar Scheduler de tareas programadas
    console.log('[Startup] Inicializando Scheduler...');
    await schedulerService.initializeAllJobs();

    // Iniciar servidor HTTP (con WebSocket)
    httpServer.listen(port, () => {
      console.log(`🚀 Agento API listening on port ${port}`);
      console.log(`📡 WhatsApp Worker: Activo`);
      console.log(`⏰ Scheduler: Activo`);
      console.log(`🔌 WebSocket: Activo`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n[Shutdown] ${signal} recibido, cerrando conexiones...`);

      // Cerrar servidor HTTP
      httpServer.close(() => {
        console.log('[Shutdown] Servidor HTTP cerrado');
      });

      // Cerrar WhatsApp Worker
      await whatsAppWorker.stop();
      console.log('[Shutdown] WhatsApp Worker detenido');

      // Detener todas las tareas programadas
      await schedulerService.stopAllJobs();
      console.log('[Shutdown] Scheduler detenido');

      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Log periodico de estado
    setInterval(() => {
      const wsStats = getWebSocketStats();
      if (wsStats.connectedClients > 0) {
        console.log(`[Status] WebSocket: ${wsStats.connectedClients} clientes conectados`);
      }
    }, 60000); // Cada minuto

  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

startServer();
