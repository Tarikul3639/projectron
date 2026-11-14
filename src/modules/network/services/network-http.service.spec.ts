import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { NetworkAddressService } from './network-address.service.js';
import { NetworkHttpService } from './network-http.service.js';

describe('NetworkHttpService', () => {
  const service = new NetworkHttpService(new NetworkAddressService());

  it('rejects non-HTTP URL schemes', async () => {
    await expect(
      service.request({
        url: 'file:///etc/passwd',
        method: 'GET',
        headers: {},
        timeoutMs: 1000,
        maxResponseBytes: 1024,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects URL credentials', async () => {
    await expect(
      service.request({
        url: 'https://user:password@example.com/',
        method: 'GET',
        headers: {},
        timeoutMs: 1000,
        maxResponseBytes: 1024,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
