import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { NetworkAddressService } from './network-address.service.js';

describe('NetworkAddressService', () => {
  const service = new NetworkAddressService();

  it('rejects malformed host values', () => {
    expect(() => service.normalizeHostname('')).toThrow(BadRequestException);
    expect(() => service.normalizeHostname('bad host')).toThrow(
      BadRequestException,
    );
  });

  it('blocks loopback, private, and reserved IPv4 destinations', () => {
    expect(service.isPublicAddress('127.0.0.1')).toBe(false);
    expect(service.isPublicAddress('10.0.0.1')).toBe(false);
    expect(service.isPublicAddress('192.168.1.1')).toBe(false);
    expect(service.isPublicAddress('8.8.8.8')).toBe(true);
  });
});
