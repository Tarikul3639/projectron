import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentExecutionService } from './agent-execution.service.js';

describe('AgentExecutionService', () => {
  const taskId = 'c6e0a02e-bb4c-4d4e-8e1b-7d4c33e09d12';
  const orchestration = { getTask: vi.fn(), updateStep: vi.fn() };
  const registry = { tools: [] as any[] };
  const context = { kind: 'tool', name: 'orchestration_execute_next' } as any;
  let service: AgentExecutionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AgentExecutionService(orchestration as any, registry as any);
  });

  it('executes a destructive registered tool directly', async () => {
    const step = {
      id: 'write',
      title: 'Write file',
      toolName: 'filesystem_write',
      input: { path: 'note.txt', content: 'hello' },
      dependsOn: [],
      status: 'queued',
    };
    const task = { id: taskId, status: 'planned', steps: [step] };
    orchestration.getTask.mockResolvedValue(task);
    orchestration.updateStep
      .mockResolvedValueOnce({
        ...task,
        steps: [{ ...step, status: 'running' }],
      })
      .mockResolvedValueOnce({
        ...task,
        status: 'completed',
        steps: [{ ...step, status: 'completed', result: { success: true } }],
      });
    const handler = vi.fn().mockResolvedValue({ success: true });
    registry.tools = [
      {
        name: 'filesystem_write',
        handler,
        options: {
          annotations: { readOnlyHint: false, destructiveHint: true },
        },
        inputSchema: {
          '~standard': {
            validate: vi.fn().mockResolvedValue({ value: step.input }),
          },
        },
      },
    ];

    const result = await service.executeNext({ taskId }, context);
    expect(handler).toHaveBeenCalledWith(
      step.input,
      expect.objectContaining({ name: 'filesystem_write' }),
    );
    expect(orchestration.updateStep).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'completed' }),
    );
    expect(result).toMatchObject({ status: 'completed' });
  });

  it('does not invoke a tool when schema validation fails', async () => {
    const step = {
      id: 'read',
      title: 'Read',
      toolName: 'filesystem_read',
      input: {},
      dependsOn: [],
      status: 'queued',
    };
    orchestration.getTask.mockResolvedValue({
      id: taskId,
      status: 'planned',
      steps: [step],
    });
    orchestration.updateStep.mockResolvedValue({
      id: taskId,
      status: 'in_progress',
      steps: [{ ...step, status: 'running' }],
    });
    const handler = vi.fn();
    registry.tools = [
      {
        name: 'filesystem_read',
        handler,
        options: { annotations: { readOnlyHint: true } },
        inputSchema: {
          '~standard': {
            validate: vi
              .fn()
              .mockResolvedValue({ issues: [{ message: 'missing path' }] }),
          },
        },
      },
    ];

    await expect(service.executeNext({ taskId }, context)).rejects.toThrow();
    expect(handler).not.toHaveBeenCalled();
    expect(orchestration.updateStep).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
  });
});
