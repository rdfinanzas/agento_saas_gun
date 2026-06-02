/**
 * StreamParser - Parsea el output del CLI de OpenCode
 * Portado desde Accomplish agent-core
 */

import type { OpenCodeMessage, ToolUse, ToolResult, ThoughtContent, ContentBlock } from './types/opencode.js';

export class StreamParser {
  private buffer: string = '';

  parse(line: string): OpenCodeMessage | null {
    try {
      const data = JSON.parse(line);
      return data as OpenCodeMessage;
    } catch {
      return null;
    }
  }

  parseChunk(chunk: string): OpenCodeMessage[] {
    const messages: OpenCodeMessage[] = [];
    this.buffer += chunk;

    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const message = this.parse(trimmed);
      if (message) {
        messages.push(message);
      }
    }

    return messages;
  }

  flush(): OpenCodeMessage[] {
    const messages: OpenCodeMessage[] = [];
    if (this.buffer.trim()) {
      const message = this.parse(this.buffer.trim());
      if (message) {
        messages.push(message);
      }
    }
    this.buffer = '';
    return messages;
  }
}

export function extractToolUse(message: OpenCodeMessage): ToolUse | null {
  if (message.type !== 'tool_use') return null;
  return {
    type: 'tool_use',
    id: message.id || '',
    name: message.name || '',
    input: message.input || {},
  };
}

export function extractToolResult(message: OpenCodeMessage): ToolResult | null {
  if (message.type !== 'tool_result') return null;
  return {
    type: 'tool_result',
    tool_use_id: message.tool_use_id || '',
    content: message.content || '',
    is_error: message.is_error,
  };
}

export function extractThought(message: OpenCodeMessage): ThoughtContent | null {
  if (message.type !== 'content_block_delta') return null;
  if (message.delta?.type !== 'thinking') return null;
  return {
    type: 'thinking',
    thinking: message.delta.thinking || '',
  };
}

export function extractText(message: OpenCodeMessage): string | null {
  if (message.type === 'content_block_delta') {
    if (message.delta?.type === 'text_delta') {
      return message.delta.text || '';
    }
  }
  if (message.type === 'message_delta') {
    if (message.delta?.content) {
      return message.delta.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text || '')
        .join('');
    }
  }
  return null;
}

export function isMessageStart(message: OpenCodeMessage): boolean {
  return message.type === 'message_start';
}

export function isMessageDelta(message: OpenCodeMessage): boolean {
  return message.type === 'message_delta';
}

export function isContentBlockStart(message: OpenCodeMessage): boolean {
  return message.type === 'content_block_start';
}

export function isContentBlockDelta(message: OpenCodeMessage): boolean {
  return message.type === 'content_block_delta';
}

export function isContentBlockStop(message: OpenCodeMessage): boolean {
  return message.type === 'content_block_stop';
}

export function isMessageStop(message: OpenCodeMessage): boolean {
  return message.type === 'message_stop';
}

export function isError(message: OpenCodeMessage): boolean {
  return message.type === 'error';
}
