import {
  WASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeWASocket,
  useMultiFileAuthState,
  delay,
} from '@whiskeysockets/baileys';
import * as qrcode from 'qrcode-terminal';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { Server as SocketServer } from 'socket.io';

const prisma = new PrismaClient();

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'QR_PENDING' | 'FAILED';

export interface BaileysSession {
  configId: string;
  tenantId: string;
  socket: WASocket | null;
  status: ConnectionStatus;
  qrCode: string | null;
  phoneNumber: string | null;
  lastError: string | null;
  reconnectAttempts: number;
}

const sessions = new Map<string, BaileysSession>();

const STORAGE_PATH = process.env.AGENTO_STORAGE_PATH || path.join(process.cwd(), 'storage', 'tenants');

function getSessionKey(configId: string): string {
  return configId;
}

function getBaileysAuthDir(tenantId: string, configId: string): string {
  const dir = path.join(STORAGE_PATH, tenantId, 'whatsapp-baileys', configId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getSession(configId: string): BaileysSession | undefined {
  return sessions.get(getSessionKey(configId));
}

function getOrCreateSession(configId: string, tenantId: string): BaileysSession {
  const key = getSessionKey(configId);
  if (!sessions.has(key)) {
    sessions.set(key, {
      configId,
      tenantId,
      socket: null,
      status: 'DISCONNECTED',
      qrCode: null,
      phoneNumber: null,
      lastError: null,
      reconnectAttempts: 0,
    });
  }
  return sessions.get(key)!;
}

function updateSession(configId: string, tenantId: string, updates: Partial<BaileysSession>): void {
  const session = getOrCreateSession(configId, tenantId);
  Object.assign(session, updates);
  sessions.set(getSessionKey(configId), session);
}

async function createBaileysSocket(
  configId: string, 
  tenantId: string, 
  io?: SocketServer
): Promise<WASocket> {
  const authDir = getBaileysAuthDir(tenantId, configId);
  const { version } = await fetchLatestBaileysVersion();

  let authState: Awaited<ReturnType<typeof useMultiFileAuthState>> | null = null;
  
  try {
    if (fs.existsSync(path.join(authDir, 'creds.json'))) {
      authState = await useMultiFileAuthState(authDir);
    } else {
      authState = await useMultiFileAuthState(authDir);
    }
  } catch (error) {
    console.error(`[Baileys] Error loading auth state for config ${configId}:`, error);
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
    }
    fs.mkdirSync(authDir, { recursive: true });
    authState = await useMultiFileAuthState(authDir);
  }

  const socket = makeWASocket({
    version,
    auth: {
      creds: authState.state.creds,
      keys: makeCacheableSignalKeyStore(authState.state.keys, console as any),
    },
    printQRInTerminal: false,
    logger: console as any,
    browser: ['Agento SaaS', 'Chrome', '1.0.0'],
    markOnlineOnConnect: true,
  });

  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(`[Baileys] QR code received for config ${configId}`);
      const qrString = qr;
      qrcode.generate(qrString, { small: true });
      
      updateSession(configId, tenantId, {
        status: 'QR_PENDING',
        qrCode: qrString,
      });

      io?.to(`config:${configId}`).emit('baileys:qr', {
        configId,
        tenantId,
        qr: qrString,
      });
    }

    if (connection === 'open') {
      console.log(`[Baileys] Connected for config ${configId}`);
      
      const phone = socket.user?.id?.replace('@s.whatsapp.net', '') || null;
      
      updateSession(configId, tenantId, {
        status: 'CONNECTED',
        qrCode: null,
        phoneNumber: phone,
        reconnectAttempts: 0,
        lastError: null,
      });

      io?.to(`config:${configId}`).emit('baileys:connected', {
        configId,
        tenantId,
        phoneNumber: phone,
      });

      try {
        await prisma.whatsAppConfig.update({
          where: { id: configId },
          data: { 
            connectionStatus: 'CONNECTED',
            phoneNumber: phone,
            isActive: true,
          },
        });
      } catch (e) {
        console.error('[Baileys] Error updating config:', e);
      }

      whatsAppBaileysService.startMessageListener(configId, tenantId).catch(err => {
        console.error(`[Baileys] Error starting message listener:`, err);
      });
    }

    if (connection === 'close') {
      const reason = (lastDisconnect?.error as any)?.toString() || 'unknown';
      const statusCode = (lastDisconnect?.error as any)?.statusCode;

      console.log(`[Baileys] Disconnected for config ${configId}. Reason: ${reason}`);

      const session = getSession(configId);
      const shouldReconnect = 
        session &&
        reason !== DisconnectReason.loggedOut.toString() &&
        statusCode !== 401 &&
        reason !== 'connection_closed' &&
        session.reconnectAttempts < 5;

      if (shouldReconnect && session) {
        const attempts = session.reconnectAttempts + 1;
        const delayMs = Math.min(1000 * Math.pow(2, attempts), 30000);
        
        console.log(`[Baileys] Reconnecting in ${delayMs}ms (attempt ${attempts})...`);
        
        updateSession(configId, tenantId, {
          status: 'CONNECTING',
          reconnectAttempts: attempts,
        });

        await delay(delayMs);
        
        try {
          const newSocket = await createBaileysSocket(configId, tenantId, io || undefined);
          updateSession(configId, tenantId, { socket: newSocket });
        } catch (error) {
          console.error(`[Baileys] Reconnection failed for config ${configId}:`, error);
          updateSession(configId, tenantId, {
            status: 'FAILED',
            lastError: String(error),
          });
        }
      } else {
        updateSession(configId, tenantId, {
          status: 'DISCONNECTED',
          lastError: reason,
        });

        io?.to(`config:${configId}`).emit('baileys:disconnected', {
          configId,
          tenantId,
          reason,
        });

        try {
          await prisma.whatsAppConfig.update({
            where: { id: configId },
            data: { connectionStatus: 'DISCONNECTED' },
          });
        } catch (e) {
          console.error('[Baileys] Error updating config:', e);
        }
      }
    }
  });

  socket.ev.on('creds.update', authState.saveCreds);

  return socket;
}

export class WhatsAppBaileysService {
  private io: SocketServer | null = null;

  setIO(io: SocketServer): void {
    this.io = io;
  }

  async startSession(configId: string): Promise<{ status: ConnectionStatus; qr?: string }> {
    console.log(`[Baileys] Starting session for config ${configId}`);
    
    const config = await prisma.whatsAppConfig.findUnique({
      where: { id: configId },
    });

    if (!config) {
      throw new Error('WhatsAppConfig not found');
    }

    if (config.connectionType !== 'BAILEYS') {
      throw new Error('This config is not configured for Baileys');
    }

    const existingSession = getSession(configId);
    
    if (existingSession?.socket && existingSession.status === 'CONNECTED') {
      return { status: 'CONNECTED' };
    }

    updateSession(configId, config.tenantId, { status: 'CONNECTING' });

    try {
      const socket = await createBaileysSocket(configId, config.tenantId, this.io || undefined);
      updateSession(configId, config.tenantId, { socket });
      
      return { 
        status: 'CONNECTING',
        qr: existingSession?.qrCode || undefined,
      };
    } catch (error) {
      console.error(`[Baileys] Failed to start session for config ${configId}:`, error);
      updateSession(configId, config.tenantId, {
        status: 'FAILED',
        lastError: String(error),
      });
      
      return { status: 'FAILED' };
    }
  }

  async closeSession(configId: string): Promise<void> {
    console.log(`[Baileys] Closing session for config ${configId}`);
    
    const session = getSession(configId);
    
    if (session?.socket) {
      try {
        await session.socket.logout();
      } catch (error) {
        console.error(`[Baileys] Error logging out:`, error);
      }
    }

    sessions.delete(getSessionKey(configId));

    try {
      await prisma.whatsAppConfig.update({
        where: { id: configId },
        data: { 
          connectionStatus: 'DISCONNECTED',
          isActive: false,
        },
      });
    } catch (e) {
      console.error('[Baileys] Error updating config:', e);
    }
  }

  async sendMessage(configId: string, to: string, message: string): Promise<boolean> {
    const session = getSession(configId);
    
    if (!session?.socket || session.status !== 'CONNECTED') {
      console.error(`[Baileys] Socket not connected for config ${configId}`);
      return false;
    }

    try {
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      await session.socket.sendMessage(jid, { text: message });
      console.log(`[Baileys] Message sent to ${to}`);
      return true;
    } catch (error) {
      console.error(`[Baileys] Failed to send message to ${to}:`, error);
      return false;
    }
  }

  async sendMedia(
    configId: string, 
    to: string, 
    media: Buffer, 
    type: 'image' | 'video' | 'audio' | 'document',
    caption?: string
  ): Promise<boolean> {
    const session = getSession(configId);
    
    if (!session?.socket || session.status !== 'CONNECTED') {
      console.error(`[Baileys] Socket not connected for config ${configId}`);
      return false;
    }

    try {
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      
      let messageContent: any;
      switch (type) {
        case 'image':
          messageContent = { image: media, caption };
          break;
        case 'video':
          messageContent = { video: media, caption };
          break;
        case 'audio':
          messageContent = { audio: media };
          break;
        case 'document':
          messageContent = { document: media };
          break;
      }

      await session.socket.sendMessage(jid, messageContent);
      console.log(`[Baileys] Media sent to ${to}`);
      return true;
    } catch (error) {
      console.error(`[Baileys] Failed to send media to ${to}:`, error);
      return false;
    }
  }

  getStatus(configId: string): ConnectionStatus {
    return getSession(configId)?.status || 'DISCONNECTED';
  }

  getQRCode(configId: string): string | null {
    return getSession(configId)?.qrCode || null;
  }

  isConnected(configId: string): boolean {
    const session = getSession(configId);
    return session?.status === 'CONNECTED' && session?.socket !== null;
  }

  async startMessageListener(configId: string, tenantId: string): Promise<void> {
    console.log(`[Baileys] Starting message listener for config ${configId}`);
    
    const session = getSession(configId);
    
    if (!session?.socket) {
      console.warn(`[Baileys] No socket for config ${configId}`);
      return;
    }

    session.socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (msg.key.fromMe) continue;

        const from = msg.key.remoteJid?.replace('@s.whatsapp.net', '') || '';
        const body = this.extractMessageBody(msg);
        const msgType = this.getMessageType(msg);
        const msgId = msg.key.id || '';
        const timestamp = msg.messageTimestamp || 0;

        console.log(`[Baileys] Message from ${from}: ${body.substring(0, 50)}...`);

        try {
          const { Queue } = await import('bullmq');
          
          const redisConfig = {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
          };

          const whatsappQueue = new Queue('whatsapp-incoming', {
            connection: redisConfig
          });

          await whatsappQueue.add(
            'process-message',
            {
              tenantId,
              phoneNumber: from,
              message: body,
              messageId: msgId,
              messageType: msgType,
              timestamp: new Date(Number(timestamp) * 1000),
              source: 'baileys',
              configId,
            },
            {
              jobId: `${tenantId}-${msgId}`,
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 2000
              }
            }
          );

          console.log(`[Baileys] Message enqueued for processing: ${msgId}`);
        } catch (error) {
          console.error(`[Baileys] Error enqueuing message:`, error);
        }
      }
    });
  }

  private extractMessageBody(msg: any): string {
    const message = msg.message;
    if (!message) return '';

    if (message.conversation) return message.conversation;
    if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
    if (message.imageMessage?.caption) return message.imageMessage.caption;
    if (message.videoMessage?.caption) return message.videoMessage.caption;
    if (message.documentMessage?.caption) return message.documentMessage.caption;
    if (message.audioMessage) return '[Audio]';
    if (message.imageMessage) return '[Imagen]';
    if (message.videoMessage) return '[Video]';
    if (message.stickerMessage) return '[Sticker]';
    if (message.documentMessage) return '[Documento]';
    if (message.contactMessage) return '[Contacto]';
    if (message.locationMessage) return '[Ubicación]';

    return '[Mensaje]';
  }

  private getMessageType(msg: any): string {
    const message = msg.message;
    if (!message) return 'unknown';

    if (message.conversation || message.extendedTextMessage) return 'text';
    if (message.imageMessage) return 'image';
    if (message.videoMessage) return 'video';
    if (message.audioMessage) return 'audio';
    if (message.stickerMessage) return 'sticker';
    if (message.documentMessage) return 'document';
    if (message.contactMessage) return 'contact';
    if (message.locationMessage) return 'location';

    return 'unknown';
  }

  async recoverSessions(): Promise<void> {
    console.log('[Baileys] Attempting to recover sessions...');
    
    const configs = await prisma.whatsAppConfig.findMany({
      where: {
        connectionType: 'BAILEYS',
        connectionStatus: 'CONNECTED',
      },
    });

    console.log(`[Baileys] Found ${configs.length} configs to recover`);

    for (const config of configs) {
      try {
        console.log(`[Baileys] Recovering session for config ${config.id}`);
        const socket = await createBaileysSocket(config.id, config.tenantId, this.io || undefined);
        updateSession(config.id, config.tenantId, { socket });
      } catch (error) {
        console.error(`[Baileys] Failed to recover session for config ${config.id}:`, error);
      }
    }
  }
}

export const whatsAppBaileysService = new WhatsAppBaileysService();
