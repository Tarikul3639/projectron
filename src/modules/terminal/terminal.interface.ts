// Describes the bounded output returned after a child process exits.
export interface CommandExecutionResult {
  command: string;
  args: string[];
  workingDirectory: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  timedOut: boolean;
  durationMs: number;
}
