import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { CreateApprovalRequestDto } from './dto/create-approval-request.dto.js';
import type { ApprovalRequest } from './interfaces/approval-request.interface.js';
import type { ApprovalStatus } from './types/approval-status.type.js';

@Injectable()
export class ApprovalService {
  // Stores pending approval requests in memory.
  private readonly requests = new Map<string, ApprovalRequest>();

  /** Validates input and creates a request that expires after five minutes by default. */
  createRequest(input: CreateApprovalRequestDto): ApprovalRequest {
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
    return { ...request };
  }

  /** Returns a request and marks it expired when its deadline has passed. */
  getRequest(id: string): ApprovalRequest | undefined {
    const request = this.requests.get(id);
    if (!request) return undefined;

    this.expireIfNeeded(request);
    return { ...request };
  }

  /** Returns all pending requests, optionally filtered by client. */
  listPending(clientId?: string): ApprovalRequest[] {
    return [...this.requests.values()]
      .filter((request) => {
        this.expireIfNeeded(request);
        return (
          request.status === 'pending' &&
          (!clientId || request.clientId === clientId)
        );
      })
      .map((request) => ({ ...request }));
  }

  /** Approves or rejects a pending request. */
  decide(
    id: string,
    status: Extract<ApprovalStatus, 'approved' | 'rejected'>,
  ): ApprovalRequest {
    const request = this.requests.get(id);
    if (!request) throw new Error(`Approval request not found: ${id}`);

    this.expireIfNeeded(request);
    if (request.status !== 'pending') {
      throw new Error(`Approval request is already ${request.status}`);
    }

    request.status = status;
    request.decidedAt = Date.now();
    return { ...request };
  }

  /** Expires a request when its approval deadline has passed. */
  private expireIfNeeded(request: ApprovalRequest): void {
    if (request.status === 'pending' && Date.now() >= request.expiresAt) {
      request.status = 'expired';
      request.decidedAt = Date.now();
    }
  }
}
