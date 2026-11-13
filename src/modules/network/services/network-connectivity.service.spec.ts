import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { NetworkAddressService } from './network-address.service.js';
import { NetworkConnectivityService } from './network-connectivity.service.js';

describe('NetworkConnectivityService', () => {
  const service = new NetworkConnectivityService(new NetworkAddressService());

  it('blocks loopback destinations before opening a TCP connection', async () => {
    await expect(
      service.checkPort({
        hostname: '127.0.0.1',
        port: 80,
        timeoutMs: 500,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
