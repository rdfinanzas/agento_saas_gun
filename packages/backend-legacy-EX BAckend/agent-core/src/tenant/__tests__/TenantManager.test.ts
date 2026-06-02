/**
 * Tests for TenantManager
 */

import { TenantManager, TenantConfig } from '../TenantManager';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
jest.mock('path');

describe('TenantManager', () => {
  let manager: TenantManager;
  const mockBasePath = '/test/storage/tenants';

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new TenantManager(mockBasePath);
  });

  describe('getConfig', () => {
    it('should return null when config does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await manager.getConfig('non-existent-tenant');

      expect(result).toBeNull();
    });

    it('should return cached config if available', async () => {
      const mockConfig: TenantConfig = {
        tenantId: 'cached-tenant',
        mode: 'LIMITED',
        agentName: 'Test Agent',
        agentRole: 'Agent',
        agentStyle: 'Friendly',
        agentLanguage: 'Spanish',
        businessName: 'Test Business',
        businessType: 'Retail',
        businessDescription: 'Test',
        businessHours: {},
        businessPolicies: {},
        knowledgeBase: {},
        faq: {},
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        allowedTools: [],
        blockedTools: [],
      };

      // First call to populate cache
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      await manager.getConfig('cached-tenant');

      // Second call should use cache
      (fs.existsSync as jest.Mock).mockClear();

      const result = await manager.getConfig('cached-tenant');

      expect(result).toEqual(mockConfig);
      // existsSync should not be called again due to cache
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    it('should read config from file system', async () => {
      const mockConfig: TenantConfig = {
        tenantId: 'file-tenant',
        mode: 'FULL',
        agentName: 'File Agent',
        agentRole: 'Agent',
        agentStyle: 'Professional',
        agentLanguage: 'English',
        businessName: 'File Business',
        businessType: 'Service',
        businessDescription: 'Test',
        businessHours: {},
        businessPolicies: {},
        knowledgeBase: {},
        faq: {},
        provider: 'openai',
        model: 'gpt-4',
        allowedTools: [],
        blockedTools: [],
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      const result = await manager.getConfig('file-tenant');

      expect(result).toEqual(mockConfig);
    });
  });

  describe('saveConfig', () => {
    it('should create directory if it does not exist', async () => {
      const config: TenantConfig = {
        tenantId: 'new-tenant',
        mode: 'LIMITED',
        agentName: 'New Agent',
        agentRole: 'Agent',
        agentStyle: 'Friendly',
        agentLanguage: 'Spanish',
        businessName: 'New Business',
        businessType: 'Retail',
        businessDescription: 'Test',
        businessHours: {},
        businessPolicies: {},
        knowledgeBase: {},
        faq: {},
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        allowedTools: [],
        blockedTools: [],
      };

      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await manager.saveConfig(config);

      expect(fs.mkdirSync).toHaveBeenCalled();
    });

    it('should write config to file', async () => {
      const config: TenantConfig = {
        tenantId: 'save-tenant',
        mode: 'LIMITED',
        agentName: 'Save Agent',
        agentRole: 'Agent',
        agentStyle: 'Friendly',
        agentLanguage: 'Spanish',
        businessName: 'Save Business',
        businessType: 'Retail',
        businessDescription: 'Test',
        businessHours: {},
        businessPolicies: {},
        knowledgeBase: {},
        faq: {},
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        allowedTools: [],
        blockedTools: [],
      };

      await manager.saveConfig(config);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      expect(writeCall[1]).toContain('save-tenant');
    });

    it('should cache config after saving', async () => {
      const config: TenantConfig = {
        tenantId: 'cache-tenant',
        mode: 'LIMITED',
        agentName: 'Cache Agent',
        agentRole: 'Agent',
        agentStyle: 'Friendly',
        agentLanguage: 'Spanish',
        businessName: 'Cache Business',
        businessType: 'Retail',
        businessDescription: 'Test',
        businessHours: {},
        businessPolicies: {},
        knowledgeBase: {},
        faq: {},
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        allowedTools: [],
        blockedTools: [],
      };

      await manager.saveConfig(config);

      // Clear fs mocks
      (fs.existsSync as jest.Mock).mockClear();

      // Get config should return from cache
      const result = await manager.getConfig('cache-tenant');

      expect(result).toEqual(config);
    });
  });

  describe('getWorkspace', () => {
    it('should create workspace if it does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await manager.getWorkspace('workspace-tenant');

      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(result.exists).toBe(true);
    });

    it('should return existing workspace', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = await manager.getWorkspace('existing-tenant');

      expect(result.exists).toBe(true);
    });
  });

  describe('generateOpenCodeConfig', () => {
    it('should throw error if tenant not found', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(manager.generateOpenCodeConfig('non-existent'))
        .rejects.toThrow('not found');
    });

    it('should generate config file for tenant', async () => {
      const mockConfig: TenantConfig = {
        tenantId: 'opencode-tenant',
        mode: 'LIMITED',
        agentName: 'OpenCode Agent',
        agentRole: 'Agent',
        agentStyle: 'Friendly',
        agentLanguage: 'Spanish',
        businessName: 'OpenCode Business',
        businessType: 'Retail',
        businessDescription: 'Test',
        businessHours: {},
        businessPolicies: {},
        knowledgeBase: {},
        faq: {},
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        allowedTools: [],
        blockedTools: [],
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

      const result = await manager.generateOpenCodeConfig('opencode-tenant');

      expect(result).toContain('opencode.json');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });
});

describe('TenantManager - System Prompt Generation', () => {
  let manager: TenantManager;

  beforeEach(() => {
    manager = new TenantManager('/test/storage');
  });

  it('should include business hours in prompt', async () => {
    const config: TenantConfig = {
      tenantId: 'hours-tenant',
      mode: 'LIMITED',
      agentName: 'Hours Agent',
      agentRole: 'Agent',
      agentStyle: 'Friendly',
      agentLanguage: 'Spanish',
      businessName: 'Hours Business',
      businessType: 'Retail',
      businessDescription: 'Test',
      businessHours: {
        'Monday': '9:00 - 18:00',
        'Tuesday': '9:00 - 18:00',
      },
      businessPolicies: {},
      knowledgeBase: {},
      faq: {},
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      allowedTools: [],
      blockedTools: [],
    };

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(config));

    await manager.generateOpenCodeConfig('hours-tenant');

    const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
    const writtenConfig = JSON.parse(writeCall[1]);

    expect(writtenConfig.agent['agento-agent'].prompt).toContain('Monday');
    expect(writtenConfig.agent['agento-agent'].prompt).toContain('9:00 - 18:00');
  });

  it('should include FAQ in prompt', async () => {
    const config: TenantConfig = {
      tenantId: 'faq-tenant',
      mode: 'LIMITED',
      agentName: 'FAQ Agent',
      agentRole: 'Agent',
      agentStyle: 'Friendly',
      agentLanguage: 'Spanish',
      businessName: 'FAQ Business',
      businessType: 'Retail',
      businessDescription: 'Test',
      businessHours: {},
      businessPolicies: {},
      knowledgeBase: {},
      faq: {
        'What are your hours?': 'We are open 9-6',
        'Do you deliver?': 'Yes, we deliver',
      },
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      allowedTools: [],
      blockedTools: [],
    };

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(config));

    await manager.generateOpenCodeConfig('faq-tenant');

    const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
    const writtenConfig = JSON.parse(writeCall[1]);

    expect(writtenConfig.agent['agento-agent'].prompt).toContain('What are your hours?');
    expect(writtenConfig.agent['agento-agent'].prompt).toContain('We are open 9-6');
  });

  it('should set LIMITED mode permissions', async () => {
    const config: TenantConfig = {
      tenantId: 'limited-tenant',
      mode: 'LIMITED',
      agentName: 'Limited Agent',
      agentRole: 'Agent',
      agentStyle: 'Friendly',
      agentLanguage: 'Spanish',
      businessName: 'Limited Business',
      businessType: 'Retail',
      businessDescription: 'Test',
      businessHours: {},
      businessPolicies: {},
      knowledgeBase: {},
      faq: {},
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      allowedTools: [],
      blockedTools: [],
    };

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(config));

    await manager.generateOpenCodeConfig('limited-tenant');

    const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
    const writtenConfig = JSON.parse(writeCall[1]);

    expect(writtenConfig.permission['*']).toBe('deny');
    expect(writtenConfig.permission['read']).toBe('allow');
  });

  it('should set FULL mode permissions', async () => {
    const config: TenantConfig = {
      tenantId: 'full-tenant',
      mode: 'FULL',
      agentName: 'Full Agent',
      agentRole: 'Agent',
      agentStyle: 'Friendly',
      agentLanguage: 'Spanish',
      businessName: 'Full Business',
      businessType: 'Retail',
      businessDescription: 'Test',
      businessHours: {},
      businessPolicies: {},
      knowledgeBase: {},
      faq: {},
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      allowedTools: [],
      blockedTools: [],
    };

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(config));

    await manager.generateOpenCodeConfig('full-tenant');

    const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
    const writtenConfig = JSON.parse(writeCall[1]);

    expect(writtenConfig.permission['*']).toBe('allow');
  });
});
