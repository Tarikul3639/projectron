import { Injectable, NotFoundException } from '@nestjs/common';
import type { ChildProcess } from 'node:child_process';
import type { ManagedProcess } from '../processes.interface.js';

@Injectable()
export class ProcessRegistryService {
  private readonly children = new Map<number, ChildProcess>();
  private readonly records = new Map<number, ManagedProcess>();
  get size(): number {
    return this.records.size;
  }
  register(record: ManagedProcess, child: ChildProcess): void {
    this.records.set(record.pid, record);
    this.children.set(record.pid, child);
  }
  getChild(pid: number): ChildProcess | undefined {
    return this.children.get(pid);
  }
  removeChild(pid: number): void {
    this.children.delete(pid);
  }
  getRecord(pid: number): ManagedProcess {
    const record = this.records.get(pid);
    if (!record) throw new NotFoundException('Managed process not found');
    return record;
  }
  list(): ManagedProcess[] {
    return [...this.records.values()].map((record) => this.snapshot(record));
  }
  get(pid: number): ManagedProcess {
    return this.snapshot(this.getRecord(pid));
  }
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
  private snapshot(record: ManagedProcess): ManagedProcess {
    return { ...record, args: [...record.args] };
  }
}
