import { BadRequestException, Injectable } from '@nestjs/common';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

/** Shared hostname normalization and public-address validation for network operations. */
@Injectable()
export class NetworkAddressService {
  /** Resolves the host once and rejects the whole result if any answer is non-public. */
  async resolvePublicAddresses(hostname: string) {
    const addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await lookup(hostname, { all: true, verbatim: true }).catch((error) => {
          throw new BadRequestException(
            `Unable to resolve destination: ${this.errorMessage(error)}`,
          );
        });

    if (
      !addresses.length ||
      addresses.some(({ address }) => !this.isPublicAddress(address))
    ) {
      throw new BadRequestException(
        'Requests to private, local, reserved, or otherwise non-public network addresses are blocked',
      );
    }

    return addresses;
  }

  /** Restricts outbound requests to globally routable IPv4 and IPv6 destinations. */
  isPublicAddress(address: string) {
    if (address.includes(':')) {
      const value = address.toLowerCase();
      // Only global-unicast IPv6 (2000::/3) is accepted; mapped and special ranges are rejected.
      const first = Number.parseInt(value.split(':')[0] || '0', 16);
      return (
        first >= 0x2000 && first <= 0x3fff && !value.startsWith('2001:db8:')
      );
    }

    const parts = address.split('.').map(Number);
    if (
      parts.length !== 4 ||
      parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    ) {
      return false;
    }
    const [a, b] = parts;
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51) ||
      (a === 203 && b === 0)
    );
  }

  /** Normalizes and rejects empty, whitespace-containing, or URL-like host values. */
  normalizeHostname(value: string) {
    const hostname = value
      .trim()
      .replace(/^\[|\]$/g, '')
      .toLowerCase();
    if (!hostname || /[\s/@?#]/.test(hostname)) {
      throw new BadRequestException('A hostname or IP address is required');
    }
    return hostname;
  }

  /** Converts unknown errors into safe, concise diagnostic text. */
  errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown network error';
  }
}
