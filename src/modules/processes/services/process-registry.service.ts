import { Injectable, NotFoundException } from '@nestjs/common';
import type { ChildProcess } from 'node:child_process';
import type { ManagedProcess } from '../interfaces/processes.interface.js';

/**
 * Tracks child processes created by Projectron and exposes safe snapshots of
 * their lifecycle metadata and captured output to the process tools.
 */
@Injectable()
export class ProcessRegistryService {
  private readonly children = new Map<number, ChildProcess>();
  private readonly records = new Map<number, ManagedProcess>();

  /** Returns the number of child processes currently tracked by this registry. */
  get size(): number {
    return this.records.size;
  }

  /**
   * Registers a newly spawned child process together with the metadata used by
   * status, log, and stop operations.
   */
  register(record: ManagedProcess, child: ChildProcess): void {
    this.records.set(record.pid, record);
    this.children.set(record.pid, child);
  }

  /**
   * Resolves the live child-process handle for a managed PID. Returns
   * undefined when the PID is not currently registered.
   */
  getChild(pid: number): ChildProcess | undefined {
    return this.children.get(pid);
  }

  /**
   * Removes the child-process handle after the process has stopped or exited.
   * The public record is retained so callers can still inspect its final state.
   */
  removeChild(pid: number): void {
    this.children.delete(pid);
  }

  /**
   * Retrieves the managed process record for a PID. Throws NotFoundException
   * when the process does not belong to this Projectron instance.
   */
  getRecord(pid: number): ManagedProcess {
    const record = this.records.get(pid);
    if (!record) throw new NotFoundException('Managed process not found');
    return record;
  }

  /** Lists snapshots of all processes managed by this Projectron instance. */
  list(): ManagedProcess[] {
    return [...this.records.values()].map((record) => this.snapshot(record));
  }

  /**
   * Returns the current status and metadata for a Projectron-managed process,
   * using a detached snapshot so callers cannot mutate the registry record.
   */
  get(pid: number): ManagedProcess {
    return this.snapshot(this.getRecord(pid));
  }

  /**
   * Returns the captured stdout and stderr buffers for a managed process,
   * including truncation flags so clients can identify incomplete output.
   */
  getLogs(pid: number) {
    const record = this.getRecord(pid);
    return {
      pid,
      stdout: record.stdout,
      stderr: record.stderr,
      stdoutTruncated: record.stdoutTruncated,
      stderrTruncated: record.stderrTruncated,
    };
  }

  /**
   * Creates a serializable copy of a process record and clones its argument
   * list to keep external consumers from mutating registry-owned state.
   */
  private snapshot(record: ManagedProcess): ManagedProcess {
    return { ...record, args: [...record.args] };
  }
}
