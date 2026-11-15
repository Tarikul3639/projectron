import { describe, expect, it, vi } from 'vitest';
import { ActivityCollectorService } from './activity-collector.service.js';

describe('ActivityCollectorService', () => {
  it('delegates start, step, complete and failure events', async () => {
    const logs = {
      startToolExecution: vi.fn().mockResolvedValue('id-1'),
      recordExecutionStep: vi.fn().mockResolvedValue(undefined),
      completeToolExecution: vi.fn().mockResolvedValue(undefined),
      failToolExecution: vi.fn().mockResolvedValue(undefined),
    };
    const service = new ActivityCollectorService(logs as never);
    const id = await service.start('tool', { arg: 1 }, 'task-1');
    await service.step(id, { name: 'validate', status: 'completed' });
    await service.complete(id, { ok: true });
    await service.fail(id, new Error('failure'));
    expect(logs.startToolExecution).toHaveBeenCalledWith({
      tool: 'tool',
      input: { arg: 1 },
      taskId: 'task-1',
    });
    expect(logs.recordExecutionStep).toHaveBeenCalled();
    expect(logs.completeToolExecution).toHaveBeenCalledWith(id, { ok: true });
    expect(logs.failToolExecution).toHaveBeenCalled();
  });
});
