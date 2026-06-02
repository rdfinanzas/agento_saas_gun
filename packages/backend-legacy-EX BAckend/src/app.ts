import express, { Application } from 'express';
import cors from 'cors';
import { chatRouter } from './modules/chat/chat.routes';
import { workspaceRoutes } from './modules/workspace/workspace.routes';
import { analyticsRoutes } from './modules/analytics';
import { integrationRoutes } from './modules/integrations';
import { authRoutes } from './modules/auth/routes/auth.routes';
import { webhookRoutes } from './modules/whatsapp/routes/webhook.routes';
import { agentRoutes } from './modules/whatsapp/routes/agent.routes';
import conversationMonitorRoutes from './modules/whatsapp/routes/conversation-monitor.routes';
import baileysRoutes from './modules/whatsapp/routes/baileys.routes';
import whatsAppAgentLinkRoutes from './modules/whatsapp/routes/whatsapp-agent-link.routes';
import { knowledgeRoutes } from './modules/memory/routes/knowledge.routes';
import { billingRoutes } from './modules/billing';
import { adminRoutes, publicRouter as adminPublicRouter } from './modules/admin/admin.routes';
import { accomplishRoutes, skillsRoutes as accomplishSkillsRoutes, workspaceRoutes as accomplishWorkspaceRoutes } from './modules/accomplish';
import agentsRoutes from './modules/agents/routes/agents.routes';
import masterAgentRoutes from './modules/agents/routes/master-agent.routes';
import masterAgentV2Routes from './modules/agents/routes/master-agent-v2.routes';
import integrationsRoutes from './modules/integrations-v2/routes/integrations.routes';
import {
  providersRoutes,
  agentIdentityRoutes,
  permissionsRoutes,
  skillsRoutes,
  skillsMarketplaceRoutes,
  sandboxRoutes,
  automationRoutes,
  apiConnectorsRoutes,
  approvalRoutes
} from './modules/opencode';

export function createApp(): Application {
  const app = express();

  // Middleware
  app.use(cors({
    origin: ['http://localhost:3001', 'http://localhost:3000'],
    credentials: true
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'agento-api' });
  });

  // Auth Routes (FASE 1)
  app.use('/api/v1/auth', authRoutes);

  // Agents Routes (V2 - Desacoplados de canales)
  app.use('/api/v1/agents', agentsRoutes);

  // Master Agent Routes (V2 - Agente Maestro)
  app.use('/api/v1/master', masterAgentRoutes);

  // Master Agent V2 Routes (V2 - Agente Maestro Avanzado)
  app.use('/api/v1/master/v2', masterAgentV2Routes);

  // Chat Routes
  app.use('/api/v1/chat', chatRouter);

  // Workspace Routes
  app.use('/api/v1/workspace', workspaceRoutes);

  // Analytics Routes (FASE 7)
  app.use('/api/v1/analytics', analyticsRoutes);

  // Integrations Routes (FASE 8 - Excel/Sheets)
  app.use('/api/v1/integrations', integrationRoutes);

  // Integrations V2 Routes (FASE 4 - Agentes V2)
  app.use('/api/v1/integrations-v2', integrationsRoutes);

  // WhatsApp Routes (FASE 4, 5, 7)
  app.use('/api/v1/whatsapp/webhook', webhookRoutes);
  app.use('/api/v1/whatsapp/agents', agentRoutes);
  app.use('/api/v1/whatsapp/conversations', conversationMonitorRoutes);
  app.use('/api/v1/whatsapp/baileys', baileysRoutes);

  // WhatsApp Agent Link Routes (FASE 3 - V2)
  app.use('/api/v1/whatsapp', whatsAppAgentLinkRoutes);

  // OpenCode Routes - AI Providers & Agent Identity
  app.use('/api/v1/opencode/providers', providersRoutes);
  app.use('/api/v1/opencode/identity', agentIdentityRoutes);
  app.use('/api/v1/opencode/permissions', permissionsRoutes);
  app.use('/api/v1/opencode/skills', skillsRoutes);
  app.use('/api/v1/opencode/marketplace', skillsMarketplaceRoutes);
  app.use('/api/v1/opencode/sandbox', sandboxRoutes);
  app.use('/api/v1/opencode/automation', automationRoutes);
  app.use('/api/v1/opencode/connectors', apiConnectorsRoutes);
  app.use('/api/v1/opencode/approval', approvalRoutes);

  // Knowledge Routes - Embeddings & Semantic Search (FASE 4)
  app.use('/api/v1/knowledge', knowledgeRoutes);

  // Billing Routes - MercadoPago (FASE 5)
  app.use('/api/v1/billing', billingRoutes);

  // Admin Routes
  app.use('/api/v1/admin', adminRoutes);

  // Public AI Providers endpoint (authenticated users)
  app.use('/api/v1/ai-providers', adminPublicRouter);

  // Accomplish Routes (Modo FULL)
  app.use('/api/v1/:tenant/accomplish', accomplishRoutes);
  app.use('/api/v1/:tenant/skills', accomplishSkillsRoutes);
  app.use('/api/v1/:tenant/workspace', accomplishWorkspaceRoutes);

  return app;
}
