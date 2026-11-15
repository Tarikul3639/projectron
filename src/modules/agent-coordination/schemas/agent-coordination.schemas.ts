import * as z from 'zod';

const clientId = z.string().min(1).max(128);
const sessionId = z.string().min(1).max(128);
const resource = z.string().min(1).max(2048);

export const registerAgentSchema = z
  .object({
    clientId,
    clientName: z.string().min(1).max(128),
    /** Reuse this value only when reconnecting the same tab/session. Omit to create a new session. */
    sessionId: sessionId.optional(),
    leaseSeconds: z.number().int().min(10).max(3600).optional(),
  })
  .strict();

export const heartbeatAgentSchema = z
  .object({
    sessionId,
    leaseSeconds: z.number().int().min(10).max(3600).optional(),
  })
  .strict();

export const acquireResourceLockSchema = z
  .object({
    sessionId,
    resource,
    mode: z.enum(['read', 'write']),
    leaseSeconds: z.number().int().min(10).max(3600).optional(),
  })
  .strict();

export const releaseResourceLockSchema = z
  .object({
    sessionId,
    resource,
  })
  .strict();

export const listCoordinationStateSchema = z
  .object({
    projectId: z.string().min(1).max(128).optional(),
  })
  .strict();

export const createCoordinationTaskSchema = z
  .object({
    taskId: z.string().min(1).max(128),
    projectId: z.string().min(1).max(128),
    title: z.string().min(1).max(256),
    description: z.string().max(4000).optional(),
    ownerSessionId: sessionId,
  })
  .strict();

export const updateCoordinationTaskSchema = z
  .object({
    taskId: z.string().min(1).max(128),
    sessionId,
    status: z
      .enum(['pending', 'in_progress', 'blocked', 'completed'])
      .optional(),
    takeover: z.boolean().optional(),
  })
  .strict();
