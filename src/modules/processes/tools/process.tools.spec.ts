import type { McpContext } from '@nestjs/mcp';
import { describe, expect, it, vi } from 'vitest';
import { McpApprovalService } from '../../approval/services/mcp-approval.service.js';
import { ProcessExecutionService } from '../services/process-execution.service.js';
import { ProcessRegistryService } from '../services/process-registry.service.js';
import {
  processIdSchema,
  startProcessSchema,
  stopProcessSchema,
} from '../schemas/processes.schemas.js';
import { ProcessTools } from './process.tools.js';

describe('ProcessTools', () => {
  it('validates process-management input contracts', () => {
    expect(
      startProcessSchema.safeParse({
        command: 'sleep',
        workingDirectory: '/tmp',
        clientId: 'test',
      }).success,
    ).toBe(true);
    expect(
      startProcessSchema.safeParse({
        command: '',
        workingDirectory: '/tmp',
        clientId: 'test',
      }).success,
    ).toBe(false);
    expect(processIdSchema.safeParse({ pid: 12 }).success).toBe(true);
    expect(processIdSchema.safeParse({ pid: -1 }).success).toBe(false);
    expect(
      stopProcessSchema.safeParse({ pid: 12, clientId: 'test' }).success,
    ).toBe(true);
    expect(stopProcessSchema.safeParse({ pid: 12 }).success).toBe(false);
  });

  it('delegates process listing, status, and logs to the registry', async () => {
    const registry = {
      list: vi.fn().mockReturnValue([{ pid: 12 }]),
      get: vi.fn().mockReturnValue({ pid: 12, status: 'running' }),
      getLogs: vi.fn().mockReturnValue({ stdout: 'ok', stderr: '' }),
    };
    const tools = new ProcessTools(
      {} as unknown as ProcessExecutionService,
      registry as unknown as ProcessRegistryService,
      {} as unknown as McpApprovalService,
    );

    expect(tools.list()).toEqual([{ pid: 12 }]);
    expect(tools.status({ pid: 12 })).toEqual({
      pid: 12,
      status: 'running',
    });
    expect(tools.logs({ pid: 12 })).toEqual({ stdout: 'ok', stderr: '' });
    expect(registry.list).toHaveBeenCalledOnce();
    expect(registry.get).toHaveBeenCalledWith(12);
    expect(registry.getLogs).toHaveBeenCalledWith(12);
  });

  it('routes process start through the shared MCP approval service', async () => {
    const execution = {
      start: vi.fn().mockResolvedValue({ pid: 123 }),
    };
    const approval = {
      run: vi.fn((_scope, _reason, _input, _context, execute) => execute()),
    };
    const tools = new ProcessTools(
      execution as unknown as ProcessExecutionService,
      {} as unknown as ProcessRegistryService,
      approval as unknown as McpApprovalService,
    );
    const context = { authInfo: { clientId: 'test-client' } } as McpContext;
    const input = {
      command: 'sleep',
      args: ['10'],
      workingDirectory: '/tmp',
      clientId: 'test-client',
    };

    await expect(tools.start(input, context)).resolves.toEqual({ pid: 123 });
    expect(approval.run).toHaveBeenCalledWith(
      'process',
      expect.any(String),
      input,
      context,
      expect.any(Function),
    );
    expect(execution.start).toHaveBeenCalledWith(input);
  });

  it('routes process stop through the shared MCP approval service', async () => {
    const execution = { stop: vi.fn().mockResolvedValue({ stopped: true }) };
    const approval = {
      run: vi.fn((_scope, _reason, _input, _context, execute) => execute()),
    };
    const tools = new ProcessTools(
      execution as unknown as ProcessExecutionService,
      {} as unknown as ProcessRegistryService,
      approval as unknown as McpApprovalService,
    );
    const context = { authInfo: { clientId: 'test-client' } } as McpContext;
    const input = { pid: 123, clientId: 'test-client' };

    await expect(tools.stop(input, context)).resolves.toEqual({
      stopped: true,
    });
    expect(approval.run).toHaveBeenCalledWith(
      'process',
      expect.any(String),
      input,
      context,
      expect.any(Function),
    );
    expect(execution.stop).toHaveBeenCalledWith(123);
  });
});
