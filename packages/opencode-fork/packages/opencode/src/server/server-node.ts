/**
 * OpenCode HTTP Server - Node.js Compatible Version
 *
 * Este es un servidor HTTP simplificado que funciona con Node.js
 * y expone los endpoints necesarios para la integración con AgenTo SaaS.
 *
 * NOTA: Este es un wrapper mínimo. Para funcionalidad completa,
 * usa el servidor original con Bun.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';

// ============================================
// CONFIGURACIÓN
// ============================================

const PORT = process.env.OPENCOD_SERVER_PORT || 4096;
const HOST = process.env.OPENCOD_SERVER_HOST || '0.0.0.0';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// TYPES
// ============================================

interface Session {
  sessionID: string;
  title?: string;
  directory?: string;
  createdAt: number;
  updatedAt: number;
  messages: any[];
}

interface PromptRequest {
  message: {
    role: string;
    parts: Array<{ type: string; text: string }>;
  };
  model?: string;
  agent?: string;
}

// ============================================
// ESTADO (en memoria para desarrollo)
// ============================================

const sessions = new Map<string, Session>();
let sessionIdCounter = 1;

// ============================================
// UTILIDADES
// ============================================

function generateSessionId(): string {
  return `session-${Date.now()}-${sessionIdCounter++}`;
}

function log(method: string, path: string, status: number = 200) {
  console.log(`[${new Date().toISOString()}] ${method} ${path} - ${status}`);
}

// ============================================
// ROUTES - /session
// ============================================

// GET /session/status - Health check
app.get('/session/status', (_req: Request, res: Response) => {
  log('GET', '/session/status');
  res.json({
    status: 'ok',
    sessions: Array.from(sessions.keys()),
    timestamp: Date.now(),
  });
});

// POST /session - Crear nueva sesión
app.post('/session', (req: Request, res: Response) => {
  const { title, directory } = req.body || {};

  const sessionID = generateSessionId();
  const now = Date.now();

  const session: Session = {
    sessionID,
    title: title || `Session ${sessionID}`,
    directory: directory || process.cwd(),
    createdAt: now,
    updatedAt: now,
    messages: [],
  };

  sessions.set(sessionID, session);

  log('POST', '/session', 201);
  res.status(201).json(session);
});

// GET /session - Listar sesiones
app.get('/session', (req: Request, res: Response) => {
  const { directory } = req.query || {};

  let sessionsList = Array.from(sessions.values());

  if (directory) {
    sessionsList = sessionsList.filter(s => s.directory === directory);
  }

  log('GET', '/session');
  res.json(sessionsList);
});

// GET /session/:sessionID - Obtener sesión
app.get('/session/:sessionID', (req: Request, res: Response) => {
  const { sessionID } = req.params;

  const session = sessions.get(sessionID);

  if (!session) {
    log('GET', `/session/${sessionID}`, 404);
    return res.status(404).json({ error: 'Session not found' });
  }

  log('GET', `/session/${sessionID}`);
  res.json(session);
});

// POST /session/:sessionID/prompt - Enviar prompt
app.post('/session/:sessionID/prompt', async (req: Request, res: Response) => {
  const { sessionID } = req.params;
  const { message, model, agent } = req.body || {};

  const session = sessions.get(sessionID);

  if (!session) {
    log('POST', `/session/${sessionID}/prompt`, 404);
    return res.status(404).json({ error: 'Session not found' });
  }

  // Extraer el texto del mensaje
  const text = message?.parts?.find((p: any) => p.type === 'text')?.text ||
               message?.text ||
               JSON.stringify(message);

  // Simular respuesta del agente
  const responseContent = `Respuesta simulada para: "${text}". ` +
    `Model: ${model || 'default'}, Agent: ${agent || 'build'}. ` +
    `NOTA: Este es un servidor de desarrollo. Para funcionalidad completa, ` +
    `ejecuta el servidor original con Bun.`;

  // Guardar mensaje del usuario
  session.messages.push({
    id: `msg-${Date.now()}-1`,
    role: 'user',
    content: text,
    timestamp: new Date().toISOString(),
  });

  // Guardar respuesta del asistente
  const assistantMessage = {
    id: `msg-${Date.now()}-2`,
    role: 'assistant',
    content: responseContent,
    timestamp: new Date().toISOString(),
  };
  session.messages.push(assistantMessage);

  session.updatedAt = Date.now();

  log('POST', `/session/${sessionID}/prompt`);
  res.json({
    content: responseContent,
    sessionID,
    tokens: Math.floor(Math.random() * 1000),
    model: model || 'default',
  });
});

// GET /session/:sessionID/message - Obtener mensajes
app.get('/session/:sessionID/message', (req: Request, res: Response) => {
  const { sessionID } = req.params;

  const session = sessions.get(sessionID);

  if (!session) {
    log('GET', `/session/${sessionID}/message`, 404);
    return res.status(404).json({ error: 'Session not found' });
  }

  log('GET', `/session/${sessionID}/message`);
  res.json({ messages: session.messages });
});

// DELETE /session/:sessionID - Eliminar sesión
app.delete('/session/:sessionID', (req: Request, res: Response) => {
  const { sessionID } = req.params;

  const deleted = sessions.delete(sessionID);

  if (!deleted) {
    log('DELETE', `/session/${sessionID}`, 404);
    return res.status(404).json({ error: 'Session not found' });
  }

  log('DELETE', `/session/${sessionID}`);
  res.json({ success: true });
});

// ============================================
// ROUTES - Health
// ============================================

app.get('/health', (_req: Request, res: Response) => {
  log('GET', '/health');
  res.json({ status: 'ok', service: 'opencode-server-node', timestamp: Date.now() });
});

// ============================================
// 404 Handler
// ============================================

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`\n==========================================================`);
  console.log(`   OpenCode HTTP Server (Node.js)`);
  console.log(`==========================================================`);
  console.log(`   Server corriendo en: http://${HOST}:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Session status: http://localhost:${PORT}/session/status`);
  console.log(`==========================================================`);
  console.log(`   NOTA: Este es un servidor de desarrollo.`);
  console.log(`   Para funcionalidad completa, usa Bun con el servidor original.`);
  console.log(`==========================================================\n`);
});

export { app };
