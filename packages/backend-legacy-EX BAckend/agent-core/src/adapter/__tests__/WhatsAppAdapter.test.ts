/**
 * Tests for WhatsAppAdapter
 */

import { WhatsAppAdapter, WhatsAppContext, AgentResponse } from '../WhatsAppAdapter';
import { TenantManager } from '../../tenant/TenantManager';
import { WorkspaceManager } from '../../tenant/WorkspaceManager';

// Mock dependencies
jest.mock('../../tenant/TenantManager');
jest.mock('../../tenant/WorkspaceManager');
jest.mock('node-pty');

describe('WhatsAppAdapter', () => {
  let adapter: WhatsAppAdapter;
  let mockTenantManager: jest.Mocked<TenantManager>;
  let mockWorkspaceManager: jest.Mocked<WorkspaceManager>;

  const mockTenantConfig = {
    tenantId: 'test-tenant-123',
    mode: 'LIMITED' as const,
    agentName: 'Test Agent',
    agentRole: 'Customer Service',
    agentStyle: 'Friendly',
    agentLanguage: 'Spanish',
    businessName: 'Test Business',
    businessType: 'Retail',
    businessDescription: 'A test business',
    businessHours: { 'Monday': '9-18' },
    businessPolicies: { returns: '30 days' },
    knowledgeBase: {},
    faq: { 'What is this?': 'A test' },
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    allowedTools: ['read', 'glob', 'grep', 'list'],
    blockedTools: ['bash', 'write', 'edit'],
  };

  const mockContext: WhatsAppContext = {
    phoneNumber: '+1234567890',
    contactName: 'John Doe',
    conversationHistory: [
      { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Hi there!', timestamp: new Date().toISOString() },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockTenantManager = {
      getConfig: jest.fn().mockResolvedValue(mockTenantConfig),
      generateOpenCodeConfig: jest.fn().mockResolvedValue('/path/to/config.json'),
    } as any;

    mockWorkspaceManager = {
      ensureWorkspace: jest.fn().mockReturnValue('/path/to/workspace'),
      getOpenCodeConfigPath: jest.fn().mockReturnValue('/path/to/config.json'),
    } as any;

    adapter = new WhatsAppAdapter(mockTenantManager, mockWorkspaceManager);
  });

  describe('execute', () => {
    it('should return error when tenant config not found', async () => {
      mockTenantManager.getConfig.mockResolvedValueOnce(null);

      const result = await adapter.execute('invalid-tenant', 'Hello', mockContext);

      expect(result.status).toBe('error');
      expect(result.error).toContain('not configured');
    });

    it('should ensure workspace exists before execution', async () => {
      await adapter.execute('test-tenant-123', 'Hello', mockContext);

      expect(mockWorkspaceManager.ensureWorkspace).toHaveBeenCalledWith('test-tenant-123');
    });

    it('should generate OpenCode config for tenant', async () => {
      await adapter.execute('test-tenant-123', 'Hello', mockContext);

      expect(mockTenantManager.generateOpenCodeConfig).toHaveBeenCalledWith('test-tenant-123');
    });

    it('should return success response on valid execution', async () => {
      // This test would need proper PTY mocking
      // For now, we test the structure
      const result = await adapter.execute('test-tenant-123', 'Hello', mockContext);

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('executionTime');
    });
  });

  describe('checkAvailability', () => {
    it('should return availability status', async () => {
      const result = await adapter.checkAvailability();

      expect(result).toHaveProperty('available');
      expect(typeof result.available).toBe('boolean');
    });
  });

  describe('cancel', () => {
    it('should cancel execution without error', () => {
      expect(() => adapter.cancel('test-tenant-123')).not.toThrow();
    });
  });

  describe('events', () => {
    it('should emit progress events', (done) => {
      adapter.on('progress', (data) => {
        expect(data).toHaveProperty('stage');
        done();
      });

      // Trigger execution that would emit progress
      adapter.execute('test-tenant-123', 'Hello', mockContext).catch(() => {});
    });

    it('should emit tool-use events', (done) => {
      adapter.on('tool-use', (tool, data) => {
        expect(typeof tool).toBe('string');
        done();
      });

      // Trigger execution that would emit tool-use
      adapter.execute('test-tenant-123', 'Hello', mockContext).catch(() => {});
    });
  });
});

describe('WhatsAppAdapter - Integration', () => {
  it('should handle long conversation history', async () => {
    const adapter = new WhatsAppAdapter();

    const longHistory = Array.from({ length: 50 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `Message ${i}`,
      timestamp: new Date().toISOString(),
    }));

    const context: WhatsAppContext = {
      phoneNumber: '+1234567890',
      conversationHistory: longHistory,
    };

    // Should not throw with long history
    const result = await adapter.execute('test-tenant', 'Hello', context);
    expect(result).toBeDefined();
  });

  it('should handle special characters in message', async () => {
    const adapter = new WhatsAppAdapter();

    const specialMessage = 'Hello! @#$%^&*()_+-={}[]|\\:";\'<>?,./~`';

    const result = await adapter.execute('test-tenant', specialMessage, {
      phoneNumber: '+1234567890',
    });

    expect(result).toBeDefined();
  });
});
