import { Injectable } from '@nestjs/common';
import { Tool } from '@nestjs/mcp';
import { executeCommandInputSchema } from '../schemas/terminal.schemas.js';
import type { ExecuteCommandInput } from '../types/terminal.type.js';
import { TerminalService } from '../services/terminal.service.js';

/** Exposes bounded local program execution to MCP clients. */
@Injectable()
export class TerminalTools {
  /** Injects the command execution service. */
  constructor(private readonly terminal: TerminalService) {}

  /** Executes one program directly and returns its captured output. */
  @Tool({
    name: 'terminal_execute',
    description:
      'Execute one local program inside a configured workspace. Pass the executable and each argument separately; shell syntax and interactive interpreters are blocked. Output is limited to 1 MiB per stream and execution to 120 seconds.',
    inputSchema: executeCommandInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  execute(input: ExecuteCommandInput) {
    return this.terminal.execute(input);
  }
}
