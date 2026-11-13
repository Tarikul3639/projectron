import type { McpContext } from '@nestjs/mcp';
import { describe, expect, it, vi } from 'vitest';
import { McpApprovalService } from '../../approval/services/mcp-approval.service.js';
import { NetworkDnsService } from '../services/network-dns.service.js';
import { NetworkConnectivityService } from '../services/network-connectivity.service.js';
import { NetworkHttpService } from '../services/network-http.service.js';
import { NetworkTools } from './network.tools.js';

describe('NetworkTools', () => {
  it('delegates diagnostic tools to their focused services', async () => {
    const dns = {
      dnsLookup: vi.fn().mockResolvedValue({ hostname: 'example.com' }),
    };
    const connectivity = {
      checkConnectivity: vi.fn().mockResolvedValue({ reachable: true }),
      checkPort: vi.fn().mockResolvedValue({ reachable: false }),
    };
    const tools = new NetworkTools(
      dns as unknown as NetworkDnsService,
      connectivity as unknown as NetworkConnectivityService,
      {} as unknown as NetworkHttpService,
      {} as unknown as McpApprovalService,
    );

    await expect(
      tools.dns({ hostname: 'example.com', recordType: 'ANY' }),
    ).resolves.toEqual({ hostname: 'example.com' });
    await expect(
      tools.connectivity({
        hostname: 'example.com',
        port: 443,
        timeoutMs: 3000,
      }),
    ).resolves.toEqual({ reachable: true });
    await expect(
      tools.port({ hostname: 'example.com', port: 22, timeoutMs: 3000 }),
    ).resolves.toEqual({ reachable: false });

    expect(dns.dnsLookup).toHaveBeenCalledOnce();
    expect(connectivity.checkConnectivity).toHaveBeenCalledOnce();
    expect(connectivity.checkPort).toHaveBeenCalledOnce();
  });

  it('routes outbound HTTP through the shared approval service', async () => {
    const http = {
      request: vi.fn().mockResolvedValue({ statusCode: 200 }),
    };
    const approval = {
      run: vi.fn((_scope, _reason, _input, _context, execute) => execute()),
    };
    const tools = new NetworkTools(
      {} as unknown as NetworkDnsService,
      {} as unknown as NetworkConnectivityService,
      http as unknown as NetworkHttpService,
      approval as unknown as McpApprovalService,
    );
    const context = { authInfo: { clientId: 'test-client' } } as McpContext;
    const input = {
      url: 'https://example.com',
      method: 'GET' as const,
      headers: {},
      timeoutMs: 3000,
      maxResponseBytes: 1024,
      clientId: 'test-client',
    };

    await expect(tools.http(input, context)).resolves.toEqual({
      statusCode: 200,
    });
    expect(approval.run).toHaveBeenCalledWith(
      'network',
      expect.any(String),
      input,
      context,
      expect.any(Function),
    );
    expect(http.request).toHaveBeenCalledWith(input);
  });
});
