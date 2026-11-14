import { describe, expect, it, vi } from 'vitest';
import { NetworkDnsService } from '../services/network-dns.service.js';
import { NetworkConnectivityService } from '../services/network-connectivity.service.js';
import { NetworkHttpService } from '../services/network-http.service.js';
import { NetworkTools } from './network.tools.js';

describe('NetworkTools', () => {
  it('delegates diagnostic and HTTP requests to their services', async () => {
    const dns = {
      dnsLookup: vi.fn().mockResolvedValue({ hostname: 'example.com' }),
    };
    const connectivity = {
      checkConnectivity: vi.fn().mockResolvedValue({ reachable: true }),
      checkPort: vi.fn().mockResolvedValue({ reachable: false }),
    };
    const http = { request: vi.fn().mockResolvedValue({ statusCode: 200 }) };
    const tools = new NetworkTools(
      dns as unknown as NetworkDnsService,
      connectivity as unknown as NetworkConnectivityService,
      http as unknown as NetworkHttpService,
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
    const input = {
      url: 'https://example.com',
      method: 'GET' as const,
      headers: {},
      timeoutMs: 3000,
      maxResponseBytes: 1024,
    };
    await expect(tools.http(input)).resolves.toEqual({ statusCode: 200 });
    expect(http.request).toHaveBeenCalledWith(input);
  });
});
