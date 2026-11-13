import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentExecutionService } from './agent-execution.service.js';

describe('AgentExecutionService', () => {
  const taskId = 'c6e0a02e-bb4c-4d4e-8e1b-7d4c33e09d12';
  const orchestration = {
    getTask: vi.fn(),
    updateStep: vi.fn(),
    approveStep: vi.fn(),
  };
  const registry = { tools: [] as any[] };
  const approvals = { run: vi.fn() };
  const context = { kind: 'tool', name: 'orchestration_execute_next' } as any;
  let service: AgentExecutionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AgentExecutionService(
      orchestration as any,
      registry as any,
      approvals as any,
    );
  });

  it('requests a scoped approval and only queues the step inside the approved callback', async () => {
    const task = {
      id: taskId,
      status: 'planned',
      steps: [
        {
          id: 'write',
          title: 'Write file',
          toolName: 'filesystem_write_file',
          requiresApproval: true,
          status: 'awaiting_approval',
        },
      ],
    };
    orchestration.getTask.mockResolvedValue(task);
    approvals.run.mockImplementation(
      async (_scope, _reason, _input, _context, execute) => execute(),
    );
    orchestration.approveStep.mockResolvedValue({
      ...task,
      steps: [{ ...task.steps[0], requiresApproval: false, status: 'queued' }],
    });

    const result = await service.approveStep(
      { taskId, stepId: 'write', clientId: 'test-client' },
      context,
    );
    expect(approvals.run).toHaveBeenCalledOnce();
    expect(orchestration.approveStep).toHaveBeenCalledWith(taskId, 'write');
    expect(result).toMatchObject({
      steps: [{ status: 'queued' }],
    });
  });

  it('validates registered tool input and records one successful step', async () => {
    const step = {
      id: 'read',
      title: 'Read',
      toolName: 'filesystem_read_file',
      input: { path: 'README.md' },
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
        steps: [{ ...step, status: 'completed', result: { text: 'ok' } }],
      });
    const handler = vi.fn().mockResolvedValue({ text: 'ok' });
    registry.tools = [
      {
        name: 'filesystem_read_file',
        handler,
        options: { annotations: { readOnlyHint: true } },
        inputSchema: {
          '~standard': {
            validate: vi.fn().mockResolvedValue({ value: step.input }),
          },
        },
      },
    ];

    const result = await service.executeNext(
      { taskId, clientId: 'test-client' },
      context,
    );
    expect(handler).toHaveBeenCalledWith(
      step.input,
      expect.objectContaining({ name: 'filesystem_read_file' }),
    );
    expect(orchestration.updateStep).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'completed', result: { text: 'ok' } }),
    );
    expect(result).toMatchObject({ status: 'completed' });
  });

  it('retries a failed step on a later call within maxAttempts', async () => {
    const step = {
      id: 'read',
      title: 'Read',
      toolName: 'filesystem_read_file',
      input: { path: 'README.md' },
      dependsOn: [],
      status: 'queued',
      maxAttempts: 2,
      attempts: [],
    };
    const task = { id: taskId, status: 'planned', steps: [step] };
    orchestration.getTask.mockResolvedValueOnce(task).mockResolvedValueOnce({
      ...task,
      status: 'in_progress',
      steps: [
        {
          ...step,
          status: 'failed',
          attempts: [{ attempt: 1, status: 'failed' }],
        },
      ],
    });
    orchestration.updateStep
      .mockResolvedValueOnce({
        ...task,
        steps: [{ ...step, status: 'running' }],
      })
      .mockResolvedValueOnce({
        ...task,
        status: 'in_progress',
        steps: [
          {
            ...step,
            status: 'failed',
            attempts: [{ attempt: 1, status: 'failed' }],
          },
        ],
      })
      .mockResolvedValueOnce({
        ...task,
        steps: [{ ...step, status: 'queued' }],
      })
      .mockResolvedValueOnce({
        ...task,
        steps: [{ ...step, status: 'running' }],
      })
      .mockResolvedValueOnce({
        ...task,
        status: 'completed',
        steps: [{ ...step, status: 'completed' }],
      });
    const handler = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({ text: 'ok' });
    registry.tools = [
      {
        name: 'filesystem_read_file',
        handler,
        options: { annotations: { readOnlyHint: true } },
        inputSchema: {
          '~standard': {
            validate: vi.fn().mockResolvedValue({ value: step.input }),
          },
        },
      },
    ];

    await expect(
      service.executeNext({ taskId, clientId: 'test-client' }, context),
    ).rejects.toThrow('temporary failure');
    const result = await service.executeNext(
      { taskId, clientId: 'test-client' },
      context,
    );
    expect(handler).toHaveBeenCalledTimes(2);
    expect(orchestration.updateStep).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'queued' }),
    );
    expect(result).toMatchObject({ status: 'completed' });
  });

  it('does not invoke a tool when schema validation fails', async () => {
    const step = {
      id: 'read',
      title: 'Read',
      toolName: 'filesystem_read_file',
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
        name: 'filesystem_read_file',
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

    await expect(
      service.executeNext({ taskId, clientId: 'test-client' }, context),
    ).rejects.toThrow();
    expect(handler).not.toHaveBeenCalled();
    expect(orchestration.updateStep).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
  });
});
