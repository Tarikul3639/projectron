import { describe, expect, it } from 'vitest';
import {
  processIdSchema,
  startProcessSchema,
  stopProcessSchema,
} from '../schemas/processes.schemas.js';

// Checks validation boundaries for MCP process-management inputs.
describe('Process schemas', () => {
  it('requires a command and workspace for process start', () => {
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
  });

  it('accepts only positive integer process IDs', () => {
    expect(processIdSchema.safeParse({ pid: 12 }).success).toBe(true);
    expect(processIdSchema.safeParse({ pid: -1 }).success).toBe(false);
  });

  it('requires a client identifier to stop a process', () => {
    expect(
      stopProcessSchema.safeParse({ pid: 12, clientId: 'test' }).success,
    ).toBe(true);
    expect(stopProcessSchema.safeParse({ pid: 12 }).success).toBe(false);
  });
});
