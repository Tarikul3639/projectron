import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Tool } from '@nestjs/mcp';
import { connectMcpClient } from '@nestjs/mcp/testing';
import * as z from 'zod';
import { describe, expect, it } from 'vitest';
import { McpModule } from './mcp.module.js';

@Injectable()
class EchoTools {
  @Tool({ name: 'mcp_test_echo', inputSchema: z.object({ value: z.string() }) })
  echo(input: { value: string }) {
    return input.value;
  }
}

describe('McpModule', () => {
  it('discovers and serves decorated tools through the in-memory client', async () => {
    const testingModule = await Test.createTestingModule({
      imports: [McpModule],
      providers: [EchoTools],
    }).compile();
    const app = testingModule.createNestApplication();
    await app.init();

    try {
      const client = await connectMcpClient(app);
      try {
        const result = await client.callTool({
          name: 'mcp_test_echo',
          arguments: { value: 'mcp-ok' },
        });
        expect(JSON.stringify(result)).toContain('mcp-ok');
      } finally {
        await client.close();
      }
    } finally {
      await app.close();
    }
  });
});
