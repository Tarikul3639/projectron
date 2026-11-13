import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { spawn, type ChildProcess } from 'node:child_process';
import type { ManagedProcess } from '../interfaces/processes.interface.js';
import type { StartProcessInput } from '../types/processes.type.js';
import { ProcessRegistryService } from './process-registry.service.js';
import { ProcessWorkspaceService } from './process-workspace.service.js';

const MAX_MANAGED_PROCESSES = 20;
const MAX_LOG_BYTES = 256 * 1024;
const BLOCKED_EXECUTABLES = new Set([
  'sh',
  'bash',
  'dash',
  'zsh',
  'fish',
  'cmd',
  'powershell',
  'pwsh',
  'node',
  'nodejs',
  'bun',
  'deno',
  'python',
  'python2',
  'python3',
  'ruby',
  'perl',
  'php',
]);

/** Provides the process execution functionality for this module. */
@Injectable()
export class ProcessExecutionService {
  private readonly logger = new Logger(ProcessExecutionService.name);
  /** Creates the service and initializes its dependencies. */
  constructor(
    private readonly workspace: ProcessWorkspaceService,
    private readonly registry: ProcessRegistryService,
  ) {}

  /** Handles start for the component. */
  async start(input: StartProcessInput): Promise<ManagedProcess> {
    if (this.registry.size >= MAX_MANAGED_PROCESSES)
      throw new ForbiddenException('Projectron process limit reached');
    const executableName =
      input.command.split(/[\\/]/).pop()?.toLowerCase() ?? '';
    if (
      BLOCKED_EXECUTABLES.has(executableName) ||
      /[;&|<>\n\r]/.test(input.command)
    ) {
      throw new ForbiddenException(
        'Interactive shells and code interpreters are not allowed',
      );
    }
    const cwd = await this.workspace.resolveWorkingDirectory(
      input.workingDirectory,
    );
    const child = spawn(input.command, input.args, {
      cwd,
      shell: false,
      detached: process.platform !== 'win32',
      windowsHide: true,
      env: {
        PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
        HOME: process.env.HOME ?? '',
        USER: process.env.USER ?? '',
        LANG: process.env.LANG ?? 'C.UTF-8',
        LC_ALL: process.env.LC_ALL ?? 'C.UTF-8',
        TMPDIR: process.env.TMPDIR ?? '/tmp',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (!child.pid) throw new BadRequestException('Unable to start process');
    const record: ManagedProcess = {
      pid: child.pid,
      command: input.command,
      args: [...input.args],
      workingDirectory: cwd,
      startedAt: Date.now(),
      status: 'running',
      exitCode: null,
      signal: null,
      stdout: '',
      stderr: '',
      stdoutTruncated: false,
      stderrTruncated: false,
    };
    this.registry.register(record, child);
    const capture = (stream: 'stdout' | 'stderr', chunk: Buffer) => {
      const current = record[stream];
      const remaining = MAX_LOG_BYTES - Buffer.byteLength(current, 'utf8');
      if (remaining <= 0) {
        if (stream === 'stdout') record.stdoutTruncated = true;
        else record.stderrTruncated = true;
        return;
      }
      const data = chunk.toString('utf8');
      if (Buffer.byteLength(data, 'utf8') > remaining) {
        record[stream] += Buffer.from(data)
          .subarray(0, remaining)
          .toString('utf8');
        if (stream === 'stdout') record.stdoutTruncated = true;
        else record.stderrTruncated = true;
      } else record[stream] += data;
    };
    child.stdout?.on('data', (chunk: Buffer) => capture('stdout', chunk));
    child.stderr?.on('data', (chunk: Buffer) => capture('stderr', chunk));
    child.once('error', (error) =>
      this.logger.error(`Process ${child.pid} error: ${error.message}`),
    );
    child.once('close', (code, signal) => {
      record.status = 'exited';
      record.exitCode = code;
      record.signal = signal;
      this.registry.removeChild(child.pid!);
      this.logger.log(
        `Process ${child.pid} exited (code: ${code}, signal: ${signal})`,
      );
    });
    this.logger.log(`Started process ${child.pid}: ${input.command}`);
    return { ...record, args: [...record.args] };
  }

  /** Handles stop for the component. */
  async stop(pid: number): Promise<ManagedProcess> {
    const record = this.registry.getRecord(pid);
    const child: ChildProcess | undefined = this.registry.getChild(pid);
    if (pid === process.pid)
      throw new ForbiddenException('Projectron cannot terminate itself');
    if (!child || record.status !== 'running')
      return { ...record, args: [...record.args] };
    try {
      if (process.platform !== 'win32' && child.pid)
        process.kill(-child.pid, 'SIGTERM');
      else child.kill('SIGTERM');
    } catch (error) {
      throw new BadRequestException(
        `Unable to stop process: ${(error as Error).message}`,
      );
    }
    return { ...record, args: [...record.args] };
  }
}
