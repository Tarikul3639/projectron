import { Injectable } from '@nestjs/common';
import { Tool } from '@nestjs/mcp';
import * as z from 'zod';
import {
  connectivitySchema,
  dnsLookupSchema,
  httpRequestSchema,
  portCheckSchema,
} from '../schemas/network.schemas.js';
import type { HttpRequestInput } from '../types/network.type.js';
import { NetworkDnsService } from '../services/network-dns.service.js';
import { NetworkConnectivityService } from '../services/network-connectivity.service.js';
import { NetworkHttpService } from '../services/network-http.service.js';

/** Publishes network diagnostics and bounded outbound HTTP tools. */
@Injectable()
export class NetworkTools {
  /** Initializes the network tool handlers. */
  constructor(
    private readonly dnsService: NetworkDnsService,
    private readonly connectivityService: NetworkConnectivityService,
    private readonly httpService: NetworkHttpService,
  ) {}

  /** Resolves DNS records for a hostname. */
  @Tool({
    name: 'network_dns_lookup',
    description: 'Resolve A, AAAA, MX, NS, and TXT DNS records for a hostname.',
    inputSchema: dnsLookupSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  dns(input: z.infer<typeof dnsLookupSchema>) {
    return this.dnsService.dnsLookup(input);
  }

  /** Checks whether a public hostname accepts a TCP connection. */
  @Tool({
    name: 'network_connectivity_check',
    description:
      'Check whether a public hostname accepts a TCP connection on a port.',
    inputSchema: connectivitySchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  connectivity(input: z.infer<typeof connectivitySchema>) {
    return this.connectivityService.checkConnectivity(input);
  }

  /** Checks one TCP port on a public host. */
  @Tool({
    name: 'network_port_check',
    description:
      'Check one TCP port on a public host; private and local addresses are blocked.',
    inputSchema: portCheckSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  port(input: z.infer<typeof portCheckSchema>) {
    return this.connectivityService.checkPort(input);
  }

  /** Sends a bounded HTTP request to a public URL. */
  @Tool({
    name: 'network_http_request',
    description:
      'Send a bounded HTTP request to a public URL. Local and private network destinations are blocked.',
    inputSchema: httpRequestSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  http(input: HttpRequestInput) {
    return this.httpService.request(input);
  }
}
