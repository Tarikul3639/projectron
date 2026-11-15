import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Tool } from '@nestjs/mcp';
import { connectMcpClient } from '@nestjs/mcp/testing';
import * as z from 'zod';
import { describe, expect, it } from 'vitest';
import { FileStorageService } from '../../storage/file-storage.service.js';
import { McpModule } from '../../mcp/mcp.module.js';
import { ActivityLoggingModule } from '../activity-logging.module.js';
import { ActivityLoggingService } from '../services/activity-logging.service.js';

@Injectable()
class LoggedEchoTools {
  @Tool({
    name: 'activity_log_test_echo',
    inputSchema: z.object({ value: z.string() }),
  })
  echo(input: { value: string }) {
    return { echoed: input.value };
  }
}

describe('ActivityLoggingInterceptor MCP integration', () => {
  it('captures real MCP tool arguments and returned output', async () => {
    const files = new Map<string, string>();
    const storage = {
      createDirectory: async () => undefined,
      exists: async (path: string) => files.has(path),
      read: async (path: string) => {
        const value = files.get(path);
        if (value === undefined) throw new Error('File not found: ' + path);
        return value;
      },
      write: async (path: string, content: string) => {
        files.set(path, content);
      },
      append: async (path: string, content: string) => {
        files.set(path, (files.get(path) ?? '') + content);
      },
    };

    const testingModule = await Test.createTestingModule({
      imports: [McpModule, ActivityLoggingModule],
      providers: [LoggedEchoTools],
    })
      .overrideProvider(FileStorageService)
      .useValue(storage)
      .compile();
    const app = testingModule.createNestApplication();
    await app.init();

    try {
      const client = await connectMcpClient(app);
      try {
        const result = await client.callTool({
          name: 'activity_log_test_echo',
          arguments: { value: 'mcp-payload-is-captured' },
        });
        expect(JSON.stringify(result)).toContain('mcp-payload-is-captured');
        const logs = await app
          .get(ActivityLoggingService)
          .getRecentTechnicalLogs();
        expect(logs).toHaveLength(1);
        expect(JSON.stringify(logs[0])).toContain('mcp-payload-is-captured');
        expect(logs[0]).toMatchObject({ status: 'success' });
      } finally {
        await client.close();
      }
    } finally {
      await app.close();
    }
  });
});
