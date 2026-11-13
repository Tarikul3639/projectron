import { BadRequestException, Injectable } from '@nestjs/common';
import {
  resolve4,
  resolve6,
  resolveMx,
  resolveNs,
  resolveTxt,
} from 'node:dns/promises';
import { NetworkAddressService } from './network-address.service.js';
import type { DnsLookupInput } from '../types/network.type.js';

/** Performs DNS record lookups. */
@Injectable()
export class NetworkDnsService {
  /** Creates the service and initializes its dependencies. */
  constructor(private readonly addresses: NetworkAddressService) {}

  /** Resolves DNS records and returns all supported records for the requested host. */
  async dnsLookup(input: DnsLookupInput) {
    const hostname = this.addresses.normalizeHostname(input.hostname);

    try {
      const [ipv4, ipv6, mx, ns, txt] = await Promise.all([
        resolve4(hostname).catch(() => []),
        resolve6(hostname).catch(() => []),
        input.recordType === 'ANY' ? resolveMx(hostname).catch(() => []) : [],
        input.recordType === 'ANY' ? resolveNs(hostname).catch(() => []) : [],
        input.recordType === 'ANY' ? resolveTxt(hostname).catch(() => []) : [],
      ]);

      return {
        hostname,
        records: {
          A: input.recordType === 'AAAA' ? [] : ipv4,
          AAAA: input.recordType === 'A' ? [] : ipv6,
          MX: mx,
          NS: ns,
          TXT: txt.map((record) => record.join('')),
        },
        resolvedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new BadRequestException(
        `DNS lookup failed: ${this.addresses.errorMessage(error)}`,
      );
    }
  }
}
