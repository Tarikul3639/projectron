import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, realpath } from 'node:fs/promises';
import { delimiter, isAbsolute, relative, resolve, sep } from 'node:path';
import { AppConfigService } from '../../config/config.service.js';
import { ApprovalService } from '../approval/services/approval.service.js';
import type { ExecuteCommandInput } from './terminal.type.js';
import type { CommandExecutionResult } from './terminal.interface.js';

// Bounds captured output so long-running build tools cannot exhaust application memory.
const MAX_OUTPUT_BYTES = 1_048_576;

// These programs can directly interpret arbitrary code or provide an interactive shell.
const BLOCKED_EXECUTABLES = new Set([
  'sh',
  'bash',
  'dash',
  'zsh',
  'fish',
  'ash',
  'ksh',
  'csh',
  'tcsh',
  'cmd',
  'powershell',
  'pwsh',
  'env',
  'printenv',
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
  'lua',
  'awk',
  'osascript',
]);

/** Executes approved local programs without invoking a command shell. */
@Injectable()
export class TerminalService {
  private readonly logger = new Logger(TerminalService.name);
  private readonly allowedRoots: string[];
  private readonly approvalRequired: boolean;
  private readonly usedApprovalIds = new Set<string>();

  constructor(
    config: AppConfigService,
    private readonly approvals: ApprovalService,
  ) {
    // Resolve configured roots once so every command uses the same workspace boundary.
    this.allowedRoots = config.filesystemAllowedRoots
      .split(delimiter)
      .map((root) => resolve(root.trim()))
      .filter(Boolean);
    this.approvalRequired = config.approvalRequired;
  }

  /** Creates configured workspace roots before terminal tools are available. */
  async onModuleInit(): Promise<void> {
    await Promise.all(
      this.allowedRoots.map((root) => mkdir(root, { recursive: true })),
    );
  }

  /** Runs one executable with bounded output, timeout, workspace cwd, and approval. */
  async execute(input: ExecuteCommandInput): Promise<CommandExecutionResult> {
    const executable = input.command.trim();
    const executableName = executable.split(/[\\/]/).pop()?.toLowerCase() ?? '';

    if (BLOCKED_EXECUTABLES.has(executableName)) {
      throw new ForbiddenException(
        'Interactive shells and code interpreters are not available through this terminal tool',
      );
    }

    // Shell operators are ordinary argument text; reject them to avoid ambiguous requests.
    if (/[;&|<>\n\r]/.test(executable)) {
      throw new BadRequestException(
        'Provide an executable name and separate arguments; shell syntax is not supported',
      );
    }

    // Block explicit environment-file paths, including common --option=.env forms.
    for (const argument of [executable, ...input.args]) {
      const fragments = argument.split(/[=,:]/);
      const containsProtectedPath = fragments.some((fragment) => {
        const value = fragment.trim();
        const isEnvironmentFile =
          /(^|[\\/])\.env(?:\.[^\\/]+)?(?=$|[\\/\\s*?])/i.test(value);
        const isExampleTemplate = /(^|[\\/])\.env\.example(?=$|[\\/\\s])/i.test(
          value,
        );
        return isEnvironmentFile && !isExampleTemplate;
      });
      if (containsProtectedPath) {
        throw new ForbiddenException(
          'Terminal commands cannot access protected environment files',
        );
      }
    }

    const workingDirectory = await this.resolveWorkingDirectory(
      input.workingDirectory,
    );
    // Hash the complete command so the approval action remains within the security DTO limit.
    const commandFingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          executable,
          args: input.args,
          workingDirectory,
          timeoutMs: input.timeoutMs,
        }),
      )
      .digest('hex');
    const action = `terminal.execute:${commandFingerprint}`;

    // Command execution can change files or start arbitrary programs, so it always requires approval when enabled.
    if (this.approvalRequired) {
      if (!input.approvalRequestId) {
        const request = await this.approvals.createRequest({
          clientId: input.clientId,
          action,
          reason: `Execute local program: ${executable} (timeout ${input.timeoutMs} ms)`,
        });
        throw new ConflictException({
          message:
            'User approval is required before executing a terminal command',
          approvalRequestId: request.id,
        });
      }

      if (this.usedApprovalIds.has(input.approvalRequestId)) {
        throw new ForbiddenException(
          'This approval request has already been used',
        );
      }

      const request = await this.approvals.getRequest(input.approvalRequestId);
      if (
        !request ||
        request.status !== 'approved' ||
        request.clientId !== input.clientId ||
        request.action !== action
      ) {
        throw new ForbiddenException(
          'A matching approved terminal command is required',
        );
      }
      this.usedApprovalIds.add(input.approvalRequestId);
    }

    this.logger.log(
      `Executing command: ${executable} (cwd: ${workingDirectory})`,
    );
    return this.spawnCommand(
      executable,
      input.args,
      workingDirectory,
      input.timeoutMs,
    );
  }

  /** Ensures the requested working directory resolves inside a configured root. */
  private async resolveWorkingDirectory(path?: string): Promise<string> {
    const root = this.allowedRoots[0];
    if (!root) {
      throw new InternalServerErrorException(
        'No terminal working directory is configured',
      );
    }

    const requested = path
      ? isAbsolute(path)
        ? resolve(path)
        : resolve(root, path)
      : root;
    let actual: string;
    try {
      actual = await realpath(requested);
    } catch {
      throw new BadRequestException(
        'Working directory does not exist or cannot be accessed',
      );
    }

    const allowed = await Promise.all(
      this.allowedRoots.map((item) => realpath(item)),
    );
    const insideRoot = allowed.some((item) => {
      const relativePath = relative(item, actual);
      return (
        relativePath === '' ||
        (relativePath !== '..' &&
          !relativePath.startsWith(`..${sep}`) &&
          !isAbsolute(relativePath))
      );
    });

    if (!insideRoot) {
      throw new ForbiddenException(
        'Working directory is outside configured filesystem roots',
      );
    }
    return actual;
  }

  /** Spawns without a shell and captures bounded stdout/stderr until exit or timeout. */
  private spawnCommand(
    command: string,
    args: string[],
    cwd: string,
    timeoutMs: number,
  ): Promise<CommandExecutionResult> {
    return new Promise((resolveResult, reject) => {
      const startedAt = Date.now();
      let stdout = '';
      let stderr = '';
      let stdoutTruncated = false;
      let stderrTruncated = false;
      let timedOut = false;
      let settled = false;

      const child = spawn(command, args, {
        cwd,
        shell: false,
        detached: process.platform !== 'win32',
        windowsHide: true,
        // Do not expose application secrets or arbitrary parent-process variables to child programs.
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

      const capture = (
        current: string,
        chunk: Buffer,
        stream: 'stdout' | 'stderr',
      ) => {
        const remaining = MAX_OUTPUT_BYTES - Buffer.byteLength(current, 'utf8');
        if (remaining <= 0) {
          if (stream === 'stdout') stdoutTruncated = true;
          else stderrTruncated = true;
          return current;
        }
        const text = chunk.toString('utf8');
        const bytes = Buffer.from(text, 'utf8');
        if (bytes.length <= remaining) return current + text;
        const bounded = bytes.subarray(0, remaining).toString('utf8');
        if (stream === 'stdout') stdoutTruncated = true;
        else stderrTruncated = true;
        return current + bounded;
      };

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout = capture(stdout, chunk, 'stdout');
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr = capture(stderr, chunk, 'stderr');
      });

      const timeout = setTimeout(() => {
        timedOut = true;
        // Kill the whole process group on POSIX to avoid leaving spawned children behind.
        try {
          if (process.platform !== 'win32' && child.pid)
            process.kill(-child.pid, 'SIGKILL');
          else child.kill('SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      }, timeoutMs);

      child.once('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.logger.error(`Unable to start command: ${command}`, error.stack);
        reject(
          new BadRequestException(`Unable to start command: ${error.message}`),
        );
      });

      child.once('close', (exitCode, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.logger.log(
          `Command ${timedOut ? 'timed out' : `finished with exit code ${exitCode}`}: ${command} (${Date.now() - startedAt} ms)`,
        );
        resolveResult({
          command,
          args: [...args],
          workingDirectory: cwd,
          exitCode,
          signal,
          stdout,
          stderr,
          stdoutTruncated,
          stderrTruncated,
          timedOut,
          durationMs: Date.now() - startedAt,
        });
      });
    });
  }
}
