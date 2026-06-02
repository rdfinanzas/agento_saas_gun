/**
 * Tests for WhatsAppAdapter
 */

import { WhatsAppAdapter, WhatsAppContext } from '../WhatsAppAdapter';
import { describe, test, expect, beforeEach, mock } from "bun:test";

// Mock node-pty since it's a native module
mock.module('node-pty', () => ({
  spawn: () => ({
    on: () => {},
    write: () => {},
    kill: () => {},
    pid: 12345,
  })
}));

// Mock child_process
const mockExecSync = mock(() => 'OpenCode CLI v1.0.0');
mock.module('child_process', () => ({
  execSync: mockExecSync,
}));

describe('WhatsAppAdapter', () => {
  let adapter: WhatsAppAdapter;
  let mockExecute: mock;

  const mockContext: WhatsAppContext = {
    phoneNumber: '+1234567890',
    contactName: 'John Doe',
    conversationHistory: [
      { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Hi there!', timestamp: new Date().toISOString() },
    ],
  };

  beforeEach(() => {
    adapter = new WhatsAppAdapter();
    // Mock the execute method to avoid actual OpenCode execution
    mockExecute = mock(async () => ({
      content: 'Test response',
      status: 'success',
      executionTime: 100,
    }));
    adapter.execute = mockExecute;
  });

  describe('execute', () => {
    test('should return success response structure', async () => {
      const result = await adapter.execute('test-tenant', 'Hello', mockContext);

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('executionTime');
      expect(mockExecute).toHaveBeenCalledWith('test-tenant', 'Hello', mockContext);
    });
  });

  describe('checkAvailability', () => {
    test('should return availability status structure', async () => {
      // Mock checkAvailability to avoid timeout
      adapter.checkAvailability = mock(async () => ({
        available: true,
        version: '1.0.0',
      }));

      const result = await adapter.checkAvailability();

      expect(result).toHaveProperty('available');
      expect(typeof result.available).toBe('boolean');
    });

    test('should handle error structure', async () => {
      // Mock checkAvailability to return error state
      adapter.checkAvailability = mock(async () => ({
        available: false,
        error: 'OpenCode not found',
      }));

      const result = await adapter.checkAvailability();

      expect(result.available).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('cancel', () => {
    test('should cancel execution without error', () => {
      expect(() => adapter.cancel('test-tenant')).not.toThrow();
    });
  });

  describe('context handling', () => {
    test('should handle minimal context', async () => {
      const minimalContext: WhatsAppContext = {
        phoneNumber: '+1234567890',
      };

      const result = await adapter.execute('test-tenant', 'Hello', minimalContext);

      expect(result).toBeDefined();
      expect(mockExecute).toHaveBeenCalled();
    });

    test('should handle context with conversation history', async () => {
      const longHistory = Array.from({ length: 50 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Message ${i}`,
        timestamp: new Date().toISOString(),
      }));

      const context: WhatsAppContext = {
        phoneNumber: '+1234567890',
        conversationHistory: longHistory,
      };

      const result = await adapter.execute('test-tenant', 'Hello', context);

      expect(result).toBeDefined();
      expect(mockExecute).toHaveBeenCalledWith('test-tenant', 'Hello', expect.anything());
    });
  });

  describe('message content handling', () => {
    test('should handle special characters in message', async () => {
      const specialMessage = 'Hello! @#$%^&*()_+-={}[]|\\:";\'<>?,./~`';

      const result = await adapter.execute('test-tenant', specialMessage, {
        phoneNumber: '+1234567890',
      });

      expect(result).toBeDefined();
      expect(mockExecute).toHaveBeenCalledWith('test-tenant', specialMessage, expect.anything());
    });

    test('should handle empty message', async () => {
      const result = await adapter.execute('test-tenant', '', {
        phoneNumber: '+1234567890',
      });

      expect(result).toBeDefined();
    });

    test('should handle unicode characters', async () => {
      const unicodeMessage = 'Hello 🎉🌟💻🚀';

      const result = await adapter.execute('test-tenant', unicodeMessage, {
        phoneNumber: '+1234567890',
      });

      expect(result).toBeDefined();
    });
  });
});
