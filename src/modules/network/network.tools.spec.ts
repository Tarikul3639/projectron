import { describe, expect, it, vi } from 'vitest';
import { NetworkTools } from './network.tools.js';

describe('NetworkTools', () => {
  it('delegates each diagnostic tool to its focused service', async () => {
    const dns = {
      dnsLookup: vi.fn().mockResolvedValue({ hostname: 'example.com' }),
    };
    const connectivity = {
      checkConnectivity: vi.fn().mockResolvedValue({ reachable: true }),
      checkPort: vi.fn().mockResolvedValue({ reachable: false }),
    };
    const http = { request: vi.fn() };
    const approvalHandler = { run: vi.fn() };
    const tools = new NetworkTools(
      dns as never,
      connectivity as never,
      http as never,
      approvalHandler as never,
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

  it('routes outbound HTTP through the common approval handler', async () => {
    const dns = { dnsLookup: vi.fn() };
    const connectivity = { checkConnectivity: vi.fn(), checkPort: vi.fn() };
    const http = { request: vi.fn().mockResolvedValue({ statusCode: 200 }) };
    const approvalHandler = {
      run: vi.fn((_scope, _reason, _input, _context, execute) => execute()),
    };
    const tools = new NetworkTools(
      dns as never,
      connectivity as never,
      http as never,
      approvalHandler as never,
    );
    const input = {
      url: 'https://example.com',
      method: 'GET' as const,
      headers: {},
      timeoutMs: 3000,
      maxResponseBytes: 1024,
      clientId: 'test-client',
    };

    await expect(
      tools.http(input, { era: 'legacy' } as never),
    ).resolves.toEqual({ statusCode: 200 });
    expect(approvalHandler.run).toHaveBeenCalledOnce();
    expect(approvalHandler.run.mock.calls[0]?.[0]).toBe('network');
    expect(http.request).toHaveBeenCalledWith(input);
  });
});
