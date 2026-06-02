/**
 * SandboxController - Controlador para endpoints de simulación
 * FASE 4: Modo Sandbox/Entrenamiento
 */

import { Request, Response } from 'express';
import { simulatorService, SimulationConfig } from '../services/simulator.service';

export class SandboxController {
  /**
   * Crea una nueva sesión de simulación
   */
  async createSimulation(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const config: SimulationConfig = req.body.config || {};

      const session = await simulatorService.createSimulation(tenantId, config);

      res.status(201).json({
        success: true,
        session: {
          id: session.id,
          scenario: session.config.scenario,
          customerProfile: session.config.customerProfile,
          status: session.status,
          startedAt: session.startedAt,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Envía un mensaje en una simulación
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { message, role } = req.body;

      if (!message) {
        res.status(400).json({ error: 'Mensaje es requerido' });
        return;
      }

      const response = await simulatorService.sendSimulatedMessage(
        sessionId,
        message,
        role || 'user'
      );

      res.json({
        success: true,
        message: {
          id: response.id,
          role: response.role,
          content: response.content,
          timestamp: response.timestamp,
          metadata: response.metadata,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Simula una respuesta de cliente
   */
  async simulateCustomer(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { scenario } = req.body;

      const response = await simulatorService.simulateCustomerResponse(
        sessionId,
        scenario
      );

      res.json({
        success: true,
        message: {
          id: response.id,
          role: response.role,
          content: response.content,
          timestamp: response.timestamp,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene logs de una simulación
   */
  async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      const logs = await simulatorService.getSimulationLogs(sessionId);

      res.json({
        success: true,
        logs,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene una sesión de simulación
   */
  async getSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      const session = await simulatorService.getSession(sessionId);

      if (!session) {
        res.status(404).json({ error: 'Sesión no encontrada' });
        return;
      }

      res.json({
        success: true,
        session,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Lista todas las sesiones del tenant
   */
  async listSessions(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;

      const sessions = await simulatorService.listSessions(tenantId);

      res.json({
        success: true,
        sessions: sessions.map(s => ({
          id: s.id,
          scenario: s.config.scenario,
          status: s.status,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          messageCount: s.messages.length,
          metrics: s.metrics,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Termina una sesión de simulación
   */
  async endSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      const session = await simulatorService.endSession(sessionId);

      res.json({
        success: true,
        session: {
          id: session.id,
          status: session.status,
          endedAt: session.endedAt,
          metrics: session.metrics,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Promueve el agente a producción
   */
  async promoteToProduction(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;

      const result = await simulatorService.promoteToProduction(tenantId);

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene métricas agregadas de simulaciones
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;

      const metrics = await simulatorService.getSimulationMetrics(tenantId);

      res.json({
        success: true,
        metrics,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene los escenarios disponibles para entrenamiento
   */
  async getScenarios(req: Request, res: Response): Promise<void> {
    try {
      const scenarios = await simulatorService.getAvailableScenarios();

      res.json({
        success: true,
        scenarios,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Inicia una nueva sesión de entrenamiento
   */
  async startTrainingSession(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { scenarioId, customerProfile } = req.body;

      const session = await simulatorService.createSimulation(tenantId, {
        scenario: scenarioId,
        customerProfile,
      });

      res.status(201).json({
        success: true,
        session: {
          id: session.id,
          scenario: session.config.scenario,
          customerProfile: session.config.customerProfile,
          status: session.status,
          startedAt: session.startedAt,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Lista sesiones de entrenamiento con filtros
   */
  async listTrainingSessions(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { status, startDate, endDate, limit = 50 } = req.query;

      const sessions = await simulatorService.listSessions(tenantId);

      let filteredSessions = sessions;

      if (status) {
        filteredSessions = filteredSessions.filter((s) => s.status === status);
      }

      if (startDate) {
        filteredSessions = filteredSessions.filter(
          (s) => new Date(s.startedAt) >= new Date(startDate as string)
        );
      }

      if (endDate) {
        filteredSessions = filteredSessions.filter(
          (s) => new Date(s.startedAt) <= new Date(endDate as string)
        );
      }

      res.json({
        success: true,
        sessions: filteredSessions
          .slice(0, Number(limit))
          .map((s) => ({
            id: s.id,
            scenario: s.config.scenario,
            status: s.status,
            startedAt: s.startedAt,
            endedAt: s.endedAt,
            messageCount: s.messages.length,
            metrics: s.metrics,
            duration: s.endedAt
              ? new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()
              : null,
          })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene detalles de una sesión de entrenamiento
   */
  async getTrainingSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      const session = await simulatorService.getSession(sessionId);

      if (!session) {
        res.status(404).json({ error: 'Sesión no encontrada' });
        return;
      }

      res.json({
        success: true,
        session: {
          id: session.id,
          scenario: session.config.scenario,
          customerProfile: session.config.customerProfile,
          status: session.status,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          messages: session.messages,
          metrics: session.metrics,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Finaliza una sesión de entrenamiento y obtiene evaluación
   */
  async endTrainingSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { feedback } = req.body;

      const session = await simulatorService.endSession(sessionId);

      // Generar evaluación detallada
      const evaluation = await simulatorService.generateEvaluation(sessionId, feedback);

      res.json({
        success: true,
        session: {
          id: session.id,
          status: session.status,
          endedAt: session.endedAt,
          metrics: session.metrics,
        },
        evaluation,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Valida si el agente está listo para producción
   */
  async validateForPromotion(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;

      const validation = await simulatorService.validateForProduction(tenantId);

      res.json({
        success: true,
        validation,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const sandboxController = new SandboxController();
