import * as z from 'zod';

/**
 * Validates the client identifier used to scope the approval inbox.
 * The ApprovalService uses this identifier to return only that client's requests.
 */
export const listPendingInputSchema = z.object({
  clientId: z.string().trim().min(1).max(128),
});

/**
 * Validates an explicit decision for one approval request.
 * UUID validation prevents malformed request identifiers from reaching the service.
 */
export const decideInputSchema = z.object({
  approvalRequestId: z.string().uuid(),
  clientId: z.string().trim().min(1).max(128),
  decision: z.enum(['approve', 'reject']),
});
