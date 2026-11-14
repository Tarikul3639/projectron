import { describe, expect, it, vi } from 'vitest';
import { TerminalService } from '../services/terminal.service.js';
import { TerminalTools } from './terminal.tools.js';

describe('TerminalTools', () => {
  it('delegates command execution directly to TerminalService', async () => {
    const result = { exitCode: 0, stdout: 'ok' };
    const execute = vi.fn().mockResolvedValue(result);
    const tools = new TerminalTools({ execute } as unknown as TerminalService);
    const input = { command: 'echo', args: ['ok'], timeoutMs: 1000 };

    await expect(tools.execute(input)).resolves.toEqual(result);
    expect(execute).toHaveBeenCalledWith(input);
  });
});
