import type { McpContext } from '@nestjs/mcp';
import { describe, expect, it, vi } from 'vitest';
import { AiPlannerService } from '../services/ai-planner.service.js';
import { AgentExecutionService } from '../services/agent-execution.service.js';
import { OrchestrationService } from '../services/orchestration.service.js';
import { OrchestrationTools } from './orchestration.tools.js';

describe('OrchestrationTools', () => {
  it('delegates discovery, planning, and task execution to their services', async () => {
    const context = { authInfo: { clientId: 'test-client' } } as McpContext;
    const orchestration = {
      listAvailableTools: vi
        .fn()
        .mockReturnValue([{ name: 'filesystem_read' }]),
      cancelTask: vi.fn().mockResolvedValue({ status: 'cancelled' }),
    };
    const planner = { plan: vi.fn().mockResolvedValue({ taskId: 'task-1' }) };
    const executor = {
      executeNext: vi.fn().mockResolvedValue({ status: 'completed' }),
    };
    const tools = new OrchestrationTools(
      orchestration as unknown as OrchestrationService,
      planner as unknown as AiPlannerService,
      executor as unknown as AgentExecutionService,
    );

    expect(tools.listAvailableTools()).toEqual([{ name: 'filesystem_read' }]);
    await expect(tools.planFromGoal({ goal: 'Read README' })).resolves.toEqual({
      taskId: 'task-1',
    });
    await expect(
      tools.executeNext({ taskId: 'task-1' }, context),
    ).resolves.toEqual({ status: 'completed' });
    await expect(tools.cancelTask({ taskId: 'task-1' })).resolves.toEqual({
      status: 'cancelled',
    });
    expect(executor.executeNext).toHaveBeenCalledWith(
      { taskId: 'task-1' },
      context,
    );
  });
});
