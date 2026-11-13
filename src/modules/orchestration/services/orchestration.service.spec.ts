import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrchestrationService } from './orchestration.service.js';

describe('OrchestrationService', () => {
  let service: OrchestrationService;
  let data: Array<Record<string, any>>;
  const registry = {
    tools: [
      {
        name: 'filesystem_write_file',
        options: {
          description: 'Write a file',
          annotations: { readOnlyHint: false, destructiveHint: true },
        },
      },
      {
        name: 'terminal_run',
        options: {
          description: 'Run a command',
          annotations: { readOnlyHint: true },
        },
      },
    ],
  };
  const storage = {
    exists: vi.fn(),
    read: vi.fn(),
    write: vi.fn(),
  };

  beforeEach(() => {
    data = [];
    vi.clearAllMocks();
    storage.exists.mockImplementation(async () => data.length > 0);
    storage.read.mockImplementation(async () => data);
    storage.write.mockImplementation(
      async (_path: string, value: typeof data) => {
        data = value;
      },
    );
    service = new OrchestrationService(storage as any, registry as any);
  });

  it('lists registered tools', () => {
    expect(service.listAvailableTools()).toEqual([
      { name: 'filesystem_write_file', description: 'Write a file' },
      { name: 'terminal_run', description: 'Run a command' },
    ]);
  });

  it('creates a plan with dependencies and approval gates', async () => {
    const task = await service.createPlan({
      goal: 'Create a project',
      steps: [
        {
          id: 'create',
          title: 'Create files',
          toolName: 'filesystem_write_file',
        },
        {
          id: 'install',
          title: 'Install dependencies',
          toolName: 'terminal_run',
          dependsOn: ['create'],
          requiresApproval: true,
        },
      ],
    });
    expect(task.status).toBe('planned');
    expect(task.steps[0].status).toBe('awaiting_approval');
    expect(task.steps[1].status).toBe('awaiting_approval');
  });

  it('rejects unknown tools and cyclic dependencies', async () => {
    await expect(
      service.createPlan({
        goal: 'Bad tool',
        steps: [{ id: 'a', title: 'A', toolName: 'missing' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.createPlan({
        goal: 'Cycle',
        steps: [
          { id: 'a', title: 'A', toolName: 'terminal_run', dependsOn: ['b'] },
          { id: 'b', title: 'B', toolName: 'terminal_run', dependsOn: ['a'] },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires completed dependencies before a step can run', async () => {
    const task = await service.createPlan({
      goal: 'Ordered work',
      steps: [
        { id: 'first', title: 'First', toolName: 'terminal_run' },
        {
          id: 'second',
          title: 'Second',
          toolName: 'terminal_run',
          dependsOn: ['first'],
        },
      ],
    });
    await expect(
      service.updateStep({
        taskId: task.id,
        stepId: 'second',
        status: 'running',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not allow a step to bypass its explicit approval gate', async () => {
    const task = await service.createPlan({
      goal: 'Approval required',
      steps: [
        { id: 'write', title: 'Write', toolName: 'filesystem_write_file' },
      ],
    });

    await expect(
      service.updateStep({
        taskId: task.id,
        stepId: 'write',
        status: 'running',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('tracks step completion and derives task completion', async () => {
    const task = await service.createPlan({
      goal: 'Single step',
      steps: [{ id: 'one', title: 'Run', toolName: 'terminal_run' }],
    });
    await service.updateStep({
      taskId: task.id,
      stepId: 'one',
      status: 'running',
    });
    const updated = await service.updateStep({
      taskId: task.id,
      stepId: 'one',
      status: 'completed',
      result: { ok: true },
    });
    expect(updated.status).toBe('completed');
    expect(updated.steps[0].result).toEqual({ ok: true });
  });

  it('forces approval for non-read-only tools even when a plan asks to skip it', async () => {
    const task = await service.createPlan({
      goal: 'Write a file',
      steps: [
        {
          id: 'write',
          title: 'Write',
          toolName: 'filesystem_write_file',
          requiresApproval: false,
        },
      ],
    });
    expect(task.steps[0].requiresApproval).toBe(true);
    expect(task.steps[0].status).toBe('awaiting_approval');
  });

  it('stores bounded retry policy and records attempt history', async () => {
    const task = await service.createPlan({
      goal: 'Retry work',
      steps: [
        { id: 'one', title: 'Run', toolName: 'terminal_run', maxAttempts: 2 },
      ],
    });
    expect(task.steps[0].maxAttempts).toBe(2);
    expect(task.steps[0].attempts).toEqual([]);
    await service.updateStep({
      taskId: task.id,
      stepId: 'one',
      status: 'running',
    });
    const failed = await service.updateStep({
      taskId: task.id,
      stepId: 'one',
      status: 'failed',
      error: 'temporary',
    });
    expect(failed.status).toBe('in_progress');
    expect(failed.steps[0].attempts?.[0]).toMatchObject({
      attempt: 1,
      status: 'failed',
      error: 'temporary',
    });
    await service.updateStep({
      taskId: task.id,
      stepId: 'one',
      status: 'queued',
    });
    const retry = await service.updateStep({
      taskId: task.id,
      stepId: 'one',
      status: 'running',
    });
    expect(retry.steps[0].attempts).toHaveLength(2);
  });

  it('cancels a task with no active running step', async () => {
    const task = await service.createPlan({
      goal: 'Cancel work',
      steps: [{ id: 'one', title: 'Run', toolName: 'terminal_run' }],
    });
    const cancelled = await service.cancelTask(task.id);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.steps[0].status).toBe('skipped');
  });

  it('rejects cancellation while a step is running', async () => {
    const task = await service.createPlan({
      goal: 'Running work',
      steps: [{ id: 'one', title: 'Run', toolName: 'terminal_run' }],
    });
    await service.updateStep({
      taskId: task.id,
      stepId: 'one',
      status: 'running',
    });
    await expect(service.cancelTask(task.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects missing tasks', async () => {
    await expect(service.getTask('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
