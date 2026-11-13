import { BadGatewayException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiPlannerService } from './ai-planner.service.js';

describe('AiPlannerService', () => {
  const provider = { completeJson: vi.fn() };
  const orchestration = {
    listAvailableTools: vi.fn(),
    createPlan: vi.fn(),
  };
  let service: AiPlannerService;

  beforeEach(() => {
    vi.clearAllMocks();
    orchestration.listAvailableTools.mockReturnValue([
      { name: 'filesystem_read_file', description: 'Read a file' },
      { name: 'terminal_run', description: 'Run a command' },
    ]);
    orchestration.createPlan.mockImplementation(async (input) => input);
    service = new AiPlannerService(provider as any, orchestration as any);
  });

  it('turns a natural-language goal into a persisted plan and gates mutations', async () => {
    provider.completeJson.mockResolvedValue(
      JSON.stringify({
        steps: [
          {
            id: 'inspect',
            title: 'Read project file',
            toolName: 'filesystem_read_file',
            input: { path: 'README.md' },
          },
          {
            id: 'build',
            title: 'Build project',
            toolName: 'terminal_run',
            input: { command: 'pnpm build' },
            dependsOn: ['inspect'],
          },
        ],
      }),
    );

    const result = await service.plan('Inspect and build the project');
    expect(result.steps[0].requiresApproval).toBe(false);
    expect(result.steps[1].requiresApproval).toBe(true);
    expect(orchestration.createPlan).toHaveBeenCalledOnce();
  });

  it('rejects model output that references an unknown tool', async () => {
    provider.completeJson.mockResolvedValue(
      JSON.stringify({
        steps: [{ id: 'bad', title: 'Bad', toolName: 'unknown_tool' }],
      }),
    );
    await expect(service.plan('Do something')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(orchestration.createPlan).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON from the provider', async () => {
    provider.completeJson.mockResolvedValue('not json');
    await expect(service.plan('Do something')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
