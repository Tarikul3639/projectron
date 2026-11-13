import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { JsonStorageService } from '../../storage/json-storage.service.js';
import { CreateApprovalRequestDto } from '../dto/create-approval-request.dto.js';
import type { ApprovalRequest } from '../interfaces/approval-request.interface.js';
import type { ApprovalStatus } from '../types/approval-status.type.js';

const APPROVALS_FILE = 'approvals/requests.json';

/** Persists approval requests locally and manages their lifecycle. */
@Injectable()
export class ApprovalService implements OnModuleInit {
  private readonly logger = new Logger(ApprovalService.name);

  // Keeps the active request index in memory while JSON storage remains the source of persistence.
  private readonly requests = new Map<string, ApprovalRequest>();
  private persistenceQueue: Promise<void> = Promise.resolve();

  constructor(private readonly storage: JsonStorageService) {}

  /** Restores approval history and expires pending requests whose deadlines passed while offline. */
  async onModuleInit(): Promise<void> {
    if (await this.storage.exists(APPROVALS_FILE)) {
      const stored = await this.storage.read<ApprovalRequest[]>(APPROVALS_FILE);
      if (
        !Array.isArray(stored) ||
        !stored.every((request) => this.isApprovalRequest(request))
      ) {
        throw new Error('Stored approval data is invalid');
      }

      for (const request of stored) {
        this.requests.set(request.id, request);
      }
      this.logger.log(`Restored ${stored.length} approval request(s)`);
    }

    let expired = false;
    for (const request of this.requests.values()) {
      expired = this.expireIfNeeded(request) || expired;
    }
    if (expired) {
      await this.persist();
    }
  }

  /** Validates input and creates a request that expires after five minutes by default. */
  async createRequest(
    input: CreateApprovalRequestDto,
  ): Promise<ApprovalRequest> {
    // MCP inputs bypass NestJS's HTTP ValidationPipe, so validate the DTO here.
    const data = plainToInstance(CreateApprovalRequestDto, input);
    const errors = validateSync(data);
    if (errors.length) {
      throw new BadRequestException(
        errors.flatMap((error) => Object.values(error.constraints ?? {})),
      );
    }

    const now = Date.now();
    const request: ApprovalRequest = {
      id: randomUUID(),
      clientId: data.clientId.trim(),
      action: data.action.trim(),
      reason: data.reason.trim(),
      createdAt: now,
      expiresAt: now + (data.ttlMs ?? 5 * 60 * 1000),
      status: 'pending',
    };

    this.requests.set(request.id, request);
    await this.persist();
    this.logger.log(`Approval requested: ${request.id} (${request.action})`);
    return { ...request };
  }

  /** Returns a request and marks it expired when its deadline has passed. */
  async getRequest(id: string): Promise<ApprovalRequest | undefined> {
    const request = this.requests.get(id);
    if (!request) {
      return undefined;
    }

    if (this.expireIfNeeded(request)) {
      await this.persist();
    }
    return { ...request };
  }

  /** Returns all pending requests, optionally filtered by client. */
  async listPending(clientId?: string): Promise<ApprovalRequest[]> {
    let changed = false;
    for (const request of this.requests.values()) {
      changed = this.expireIfNeeded(request) || changed;
    }
    if (changed) {
      await this.persist();
    }

    return [...this.requests.values()]
      .filter(
        (request) =>
          request.status === 'pending' &&
          (!clientId || request.clientId === clientId),
      )
      .map((request) => ({ ...request }));
  }

  /** Approves or rejects a pending request exactly once. */
  async decide(
    id: string,
    status: Extract<ApprovalStatus, 'approved' | 'rejected'>,
  ): Promise<ApprovalRequest> {
    const request = this.requests.get(id);
    if (!request) {
      throw new NotFoundException('Approval request not found');
    }

    if (this.expireIfNeeded(request)) {
      await this.persist();
    }
    if (request.status !== 'pending') {
      throw new ConflictException(
        `Approval request is already ${request.status}`,
      );
    }

    request.status = status;
    request.decidedAt = Date.now();
    await this.persist();
    this.logger.log(`Approval ${status}: ${request.id} (${request.action})`);
    return { ...request };
  }

  /** Serializes writes so concurrent lifecycle changes cannot overwrite newer snapshots. */
  private persist(): Promise<void> {
    this.persistenceQueue = this.persistenceQueue
      .catch(() => undefined)
      .then(() =>
        this.storage.write(
          APPROVALS_FILE,
          [...this.requests.values()].map((request) => ({ ...request })),
        ),
      );
    return this.persistenceQueue;
  }

  /** Expires a request when its approval deadline has passed. */
  private expireIfNeeded(request: ApprovalRequest): boolean {
    if (request.status !== 'pending' || Date.now() < request.expiresAt) {
      return false;
    }

    request.status = 'expired';
    request.decidedAt = Date.now();
    this.logger.warn(`Approval expired: ${request.id} (${request.action})`);
    return true;
  }

  /** Rejects malformed records before loading persisted approval history. */
  private isApprovalRequest(value: unknown): value is ApprovalRequest {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const request = value as Record<string, unknown>;
    return (
      typeof request.id === 'string' &&
      typeof request.clientId === 'string' &&
      typeof request.action === 'string' &&
      typeof request.reason === 'string' &&
      typeof request.createdAt === 'number' &&
      typeof request.expiresAt === 'number' &&
      ['pending', 'approved', 'rejected', 'expired'].includes(
        String(request.status),
      ) &&
      (request.decidedAt === undefined || typeof request.decidedAt === 'number')
    );
  }
}
