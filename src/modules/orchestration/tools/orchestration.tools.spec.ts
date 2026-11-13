import type { McpContext } from '@nestjs/mcp';
import { describe, expect, it, vi } from 'vitest';
import { AiPlannerService } from '../services/ai-planner.service.js';
import { AgentExecutionService } from '../services/agent-execution.service.js';
import { OrchestrationService } from '../services/orchestration.service.js';
import { OrchestrationTools } from './orchestration.tools.js';

describe('OrchestrationTools', () => {
  it('delegates tool discovery and goal planning to their services', async () => {
    const orchestration = {
      listAvailableTools: vi
        .fn()
        .mockReturnValue([{ name: 'filesystem_read' }]),
    };
    const planner = {
      plan: vi.fn().mockResolvedValue({ taskId: 'task-1' }),
    };
    const tools = new OrchestrationTools(
      orchestration as unknown as OrchestrationService,
      planner as unknown as AiPlannerService,
      {} as unknown as AgentExecutionService,
    );

    expect(tools.listAvailableTools()).toEqual([{ name: 'filesystem_read' }]);
    await expect(
      tools.planFromGoal({ goal: 'Read the project README' }),
    ).resolves.toEqual({
      taskId: 'task-1',
    });
    expect(orchestration.listAvailableTools).toHaveBeenCalledOnce();
    expect(planner.plan).toHaveBeenCalledWith('Read the project README');
  });

  it('passes the typed MCP context to approval-aware execution methods', async () => {
    const context = { authInfo: { clientId: 'test-client' } } as McpContext;
    const executor = {
      approveStep: vi.fn().mockResolvedValue({ status: 'approved' }),
      executeNext: vi.fn().mockResolvedValue({ status: 'completed' }),
    };
    const tools = new OrchestrationTools(
      {} as unknown as OrchestrationService,
      {} as unknown as AiPlannerService,
      executor as unknown as AgentExecutionService,
    );
    const approvalInput = {
      taskId: 'task-1',
      stepId: 'step-1',
      clientId: 'test-client',
    };
    const executionInput = { taskId: 'task-1', clientId: 'test-client' };

    await expect(tools.approveStep(approvalInput, context)).resolves.toEqual({
      status: 'approved',
    });
    await expect(tools.executeNext(executionInput, context)).resolves.toEqual({
      status: 'completed',
    });
    expect(executor.approveStep).toHaveBeenCalledWith(approvalInput, context);
    expect(executor.executeNext).toHaveBeenCalledWith(executionInput, context);
  });

  it('delegates task cancellation to the orchestration service', async () => {
    const orchestration = {
      cancelTask: vi.fn().mockResolvedValue({ status: 'cancelled' }),
    };
    const tools = new OrchestrationTools(
      orchestration as unknown as OrchestrationService,
      {} as unknown as AiPlannerService,
      {} as unknown as AgentExecutionService,
    );

    await expect(tools.cancelTask({ taskId: 'task-1' })).resolves.toEqual({
      status: 'cancelled',
    });
    expect(orchestration.cancelTask).toHaveBeenCalledWith('task-1');
  });
});
