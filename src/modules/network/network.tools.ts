import { Injectable } from '@nestjs/common';
import { Tool, type McpContext } from '@nestjs/mcp';
import * as z from 'zod';
import { McpApprovalService } from '../approval/services/mcp-approval.service.js';
import {
  connectivitySchema,
  dnsLookupSchema,
  httpRequestSchema,
  portCheckSchema,
} from './network.schemas.js';
import type { HttpRequestInput } from './network.type.js';
import { NetworkDnsService } from './services/network-dns.service.js';
import { NetworkConnectivityService } from './services/network-connectivity.service.js';
import { NetworkHttpService } from './services/network-http.service.js';

/** Publishes network diagnostics and approval-gated outbound HTTP tools. */
@Injectable()
export class NetworkTools {
  constructor(
    private readonly dnsService: NetworkDnsService,
    private readonly connectivityService: NetworkConnectivityService,
    private readonly httpService: NetworkHttpService,
    private readonly approvalHandler: McpApprovalService,
  ) {}

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

  @Tool({
    name: 'network_http_request',
    description:
      'Send a bounded HTTP request to a public URL. Requires explicit user approval; local and private network destinations are blocked.',
    inputSchema: httpRequestSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  http(input: HttpRequestInput, context: McpContext) {
    return this.approvalHandler.run(
      'network',
      `Send ${input.method} request to ${input.url} (timeout ${input.timeoutMs} ms)`,
      input,
      context,
      () => this.httpService.request(input),
    );
  }
}
