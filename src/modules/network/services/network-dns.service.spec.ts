import { describe, expect, it } from 'vitest';
import { NetworkAddressService } from './network-address.service.js';
import { NetworkDnsService } from './network-dns.service.js';

describe('NetworkDnsService', () => {
  const service = new NetworkDnsService(new NetworkAddressService());

  it('resolves localhost DNS records without executing shell commands', async () => {
    const result = await service.dnsLookup({
      hostname: 'localhost',
      recordType: 'ANY',
    });
    expect(result.hostname).toBe('localhost');
    expect(result.records).toHaveProperty('A');
    expect(result.records).toHaveProperty('AAAA');
    expect(result.resolvedAt).toBeTruthy();
  });
});
