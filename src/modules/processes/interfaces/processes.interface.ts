// Describes a process started and owned by the current Projectron instance.
export interface ManagedProcess {
  pid: number;
  command: string;
  args: string[];
  workingDirectory: string;
  startedAt: number;
  status: 'running' | 'exited';
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
}
