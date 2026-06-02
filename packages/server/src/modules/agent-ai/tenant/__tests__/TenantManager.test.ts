/**
 * Tests for TenantManager
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { TenantManager, TenantConfig } from '../TenantManager';

// Mock fs and path modules
const mockFs = {
  existsSync: mock(() => false),
  readFileSync: mock(() => ''),
  mkdirSync: mock(() => {}),
  writeFileSync: mock(() => {}),
};

const mockPath = {
  join: mock((...args: string[]) => args.join('/')),
};

// Mock the modules
mock.module('fs', () => mockFs);
mock.module('path', () => mockPath);

describe('TenantManager', () => {
  let manager: TenantManager;
  const mockBasePath = '/test/storage/tenants';

  beforeEach(() => {
    // Clear mock calls and reset
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue('{}');
    mockFs.mkdirSync.mockImplementation(() => {});
    mockFs.writeFileSync.mockImplementation(() => {});

    manager = new TenantManager(mockBasePath);
  });

  describe('getConfig', () => {
    test('should return null when config does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await manager.getConfig('non-existent-tenant');

      expect(result).toBeNull();
    });

    test('should return cached config if available', async () => {
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

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      // First call to populate cache
      await manager.getConfig('cached-tenant');

      // Clear the mock calls
      mockFs.existsSync.mockClear();

      // Second call should use cache
      const result = await manager.getConfig('cached-tenant');

      expect(result).toEqual(mockConfig);
      // existsSync should not be called again due to cache
      expect(mockFs.existsSync).toHaveBeenCalledTimes(0);
    });

    test('should read config from file system', async () => {
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

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const result = await manager.getConfig('file-tenant');

      expect(result).toEqual(mockConfig);
    });
  });

  describe('saveConfig', () => {
    test('should create directory if it does not exist', async () => {
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

      mockFs.existsSync.mockReturnValue(false);

      await manager.saveConfig(config);

      expect(mockFs.mkdirSync).toHaveBeenCalled();
    });

    test('should write config to file', async () => {
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

      // Clear previous calls
      mockFs.writeFileSync.mockClear();

      await manager.saveConfig(config);

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockFs.writeFileSync.mock.calls[0];
      expect(JSON.parse(writeCall[1] as string)).toMatchObject({
        tenantId: 'save-tenant'
      });
    });

    test('should cache config after saving', async () => {
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
      mockFs.existsSync.mockClear();

      // Get config should return from cache
      const result = await manager.getConfig('cache-tenant');

      expect(result).toEqual(config);
    });
  });

  describe('getWorkspace', () => {
    test('should create workspace if it does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await manager.getWorkspace('workspace-tenant');

      expect(mockFs.mkdirSync).toHaveBeenCalled();
      expect(result.exists).toBe(true);
    });

    test('should return existing workspace', async () => {
      mockFs.existsSync.mockReturnValue(true);

      const result = await manager.getWorkspace('existing-tenant');

      expect(result.exists).toBe(true);
    });
  });

  describe('generateOpenCodeConfig', () => {
    test('should throw error if tenant not found', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(manager.generateOpenCodeConfig('non-existent'))
        .rejects.toThrow('not found');
    });

    test('should generate config file for tenant', async () => {
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

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const result = await manager.generateOpenCodeConfig('opencode-tenant');

      expect(result).toContain('opencode.json');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });
});

describe('TenantManager - System Prompt Generation', () => {
  let manager: TenantManager;

  beforeEach(() => {
    manager = new TenantManager('/test/storage');
  });

  test('should include business hours in prompt', async () => {
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

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(config));
    mockFs.writeFileSync.mockClear();

    await manager.generateOpenCodeConfig('hours-tenant');

    const writeCall = mockFs.writeFileSync.mock.calls.find((call) => {
      try {
        const parsed = JSON.parse(call[1] as string);
        return parsed.agent && parsed.agent['agento-agent'];
      } catch {
        return false;
      }
    });

    expect(writeCall).toBeDefined();
    const writtenConfig = JSON.parse(writeCall![1] as string);

    expect(writtenConfig.agent['agento-agent'].prompt).toContain('Monday');
    expect(writtenConfig.agent['agento-agent'].prompt).toContain('9:00 - 18:00');
  });

  test('should include FAQ in prompt', async () => {
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

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(config));
    mockFs.writeFileSync.mockClear();

    await manager.generateOpenCodeConfig('faq-tenant');

    const writeCall = mockFs.writeFileSync.mock.calls.find((call) => {
      try {
        const parsed = JSON.parse(call[1] as string);
        return parsed.agent && parsed.agent['agento-agent'];
      } catch {
        return false;
      }
    });

    expect(writeCall).toBeDefined();
    const writtenConfig = JSON.parse(writeCall![1] as string);

    expect(writtenConfig.agent['agento-agent'].prompt).toContain('What are your hours?');
    expect(writtenConfig.agent['agento-agent'].prompt).toContain('We are open 9-6');
  });

  test('should set LIMITED mode permissions', async () => {
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

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(config));
    mockFs.writeFileSync.mockClear();

    await manager.generateOpenCodeConfig('limited-tenant');

    const writeCall = mockFs.writeFileSync.mock.calls.find((call) => {
      try {
        const parsed = JSON.parse(call[1] as string);
        return parsed.permission && parsed.permission['*'];
      } catch {
        return false;
      }
    });

    expect(writeCall).toBeDefined();
    const writtenConfig = JSON.parse(writeCall![1] as string);

    expect(writtenConfig.permission['*']).toBe('deny');
    expect(writtenConfig.permission['read']).toBe('allow');
  });

  test('should set FULL mode permissions', async () => {
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

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(config));
    mockFs.writeFileSync.mockClear();

    await manager.generateOpenCodeConfig('full-tenant');

    const writeCall = mockFs.writeFileSync.mock.calls.find((call) => {
      try {
        const parsed = JSON.parse(call[1] as string);
        return parsed.permission && parsed.permission['*'];
      } catch {
        return false;
      }
    });

    expect(writeCall).toBeDefined();
    const writtenConfig = JSON.parse(writeCall![1] as string);

    expect(writtenConfig.permission['*']).toBe('allow');
  });
});
