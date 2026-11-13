import type { z } from 'zod';
import type {
  connectivitySchema,
  dnsLookupSchema,
  httpRequestSchema,
  portCheckSchema,
} from './network.schemas.js';

// Keeps network service contracts inferred from the MCP-facing schemas.
export type DnsLookupInput = z.infer<typeof dnsLookupSchema>;
export type ConnectivityInput = z.infer<typeof connectivitySchema>;
export type PortCheckInput = z.infer<typeof portCheckSchema>;
export type HttpRequestInput = z.infer<typeof httpRequestSchema>;
