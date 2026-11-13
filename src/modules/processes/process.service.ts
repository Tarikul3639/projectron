import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { spawn, type ChildProcess } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { AppConfigService } from '../../config/config.service.js';
import type { ManagedProcess } from './processes.interface.js';
import type { StartProcessInput } from './processes.type.js';

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

/** Starts and supervises only processes launched by this Projectron instance. */
@Injectable()
export class ProcessService implements OnModuleInit {
  private readonly logger = new Logger(ProcessService.name);
  private readonly roots: string[];
  private readonly children = new Map<number, ChildProcess>();
  private readonly records = new Map<number, ManagedProcess>();

  constructor(config: AppConfigService) {
    this.roots = config.filesystemAllowedRoots
      .split(/[:;]/)
      .map((item) => resolve(item.trim()))
      .filter(Boolean);
  }

  /** Creates configured roots before process tools are used. */
  async onModuleInit(): Promise<void> {
    await Promise.all(
      this.roots.map((root) =>
        import('node:fs/promises').then(({ mkdir }) =>
          mkdir(root, { recursive: true }),
        ),
      ),
    );
  }

  /** Starts a detached, non-interactive child and returns its managed PID. */
  async start(input: StartProcessInput): Promise<ManagedProcess> {
    if (this.records.size >= MAX_MANAGED_PROCESSES) {
      throw new ForbiddenException('Projectron process limit reached');
    }
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
    const cwd = await this.resolveWorkingDirectory(input.workingDirectory);
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
    this.records.set(child.pid, record);
    this.children.set(child.pid, child);

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
      this.children.delete(child.pid!);
      this.logger.log(
        `Process ${child.pid} exited (code: ${code}, signal: ${signal})`,
      );
    });
    this.logger.log(`Started process ${child.pid}: ${input.command}`);
    return this.snapshot(record);
  }

  /** Lists processes started by this Projectron instance, not unrelated system processes. */
  list(): ManagedProcess[] {
    return [...this.records.values()].map((record) => this.snapshot(record));
  }

  /** Returns current metadata for a process managed by this instance. */
  get(pid: number): ManagedProcess {
    const record = this.records.get(pid);
    if (!record) throw new NotFoundException('Managed process not found');
    return this.snapshot(record);
  }

  /** Returns captured stdout and stderr for a managed process. */
  getLogs(pid: number) {
    const record = this.records.get(pid);
    if (!record) throw new NotFoundException('Managed process not found');
    return {
      pid,
      stdout: record.stdout,
      stderr: record.stderr,
      stdoutTruncated: record.stdoutTruncated,
      stderrTruncated: record.stderrTruncated,
    };
  }

  /** Stops only a child process that this Projectron instance started. */
  async stop(pid: number): Promise<ManagedProcess> {
    const record = this.records.get(pid);
    const child = this.children.get(pid);
    if (!record) throw new NotFoundException('Managed process not found');
    if (pid === process.pid)
      throw new ForbiddenException('Projectron cannot terminate itself');
    if (!child || record.status !== 'running') return this.snapshot(record);
    try {
      if (process.platform !== 'win32' && child.pid)
        process.kill(-child.pid, 'SIGTERM');
      else child.kill('SIGTERM');
    } catch (error) {
      throw new BadRequestException(
        `Unable to stop process: ${(error as Error).message}`,
      );
    }
    return this.snapshot(record);
  }

  /** Resolves a working directory and rejects paths outside configured workspace roots. */
  private async resolveWorkingDirectory(path: string): Promise<string> {
    const requested = isAbsolute(path)
      ? resolve(path)
      : resolve(this.roots[0] ?? '.', path);
    let actual: string;
    try {
      actual = await realpath(requested);
    } catch {
      throw new BadRequestException(
        'Working directory does not exist or cannot be accessed',
      );
    }
    const roots = await Promise.all(
      this.roots.map((root) => realpath(root).catch(() => '')),
    );
    const allowed = roots.some((root) => {
      if (!root) return false;
      const rel = relative(root, actual);
      return (
        rel === '' ||
        (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
      );
    });
    if (!allowed)
      throw new ForbiddenException(
        'Working directory is outside configured filesystem roots',
      );
    return actual;
  }

  /** Copies a record so callers cannot mutate the process registry. */
  private snapshot(record: ManagedProcess): ManagedProcess {
    return { ...record, args: [...record.args] };
  }
}
