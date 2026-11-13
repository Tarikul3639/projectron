import { Injectable, NotFoundException } from '@nestjs/common';
import type { ChildProcess } from 'node:child_process';
import type { ManagedProcess } from '../interfaces/processes.interface.js';

/** Provides the process registry functionality for this module. */
@Injectable()
export class ProcessRegistryService {
  private readonly children = new Map<number, ChildProcess>();
  private readonly records = new Map<number, ManagedProcess>();
  get size(): number {
    return this.records.size;
  }
  /** Handles register for the component. */
  register(record: ManagedProcess, child: ChildProcess): void {
    this.records.set(record.pid, record);
    this.children.set(record.pid, child);
  }
  /** Returns child from the service. */
  getChild(pid: number): ChildProcess | undefined {
    return this.children.get(pid);
  }
  /** Removes child after validating the request. */
  removeChild(pid: number): void {
    this.children.delete(pid);
  }
  /** Returns record from the service. */
  getRecord(pid: number): ManagedProcess {
    const record = this.records.get(pid);
    if (!record) throw new NotFoundException('Managed process not found');
    return record;
  }
  /** Lists active browser sessions and their open pages. */
  list(): ManagedProcess[] {
    return [...this.records.values()].map((record) => this.snapshot(record));
  }
  /** Handles get for the component. */
  get(pid: number): ManagedProcess {
    return this.snapshot(this.getRecord(pid));
  }
  /** Returns logs from the service. */
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
  /** Handles snapshot for the component. */
  private snapshot(record: ManagedProcess): ManagedProcess {
    return { ...record, args: [...record.args] };
  }
}
