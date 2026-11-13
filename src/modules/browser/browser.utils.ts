import { BadRequestException } from '@nestjs/common';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

// Rejects browser targets that can expose machine-local services or cloud metadata.
export async function assertSafeBrowserUrl(value: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BadRequestException('A valid absolute URL is required');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new BadRequestException('Only HTTP and HTTPS navigation is allowed');
  }
  if (url.username || url.password) {
    throw new BadRequestException(
      'URLs containing embedded credentials are blocked',
    );
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  // Loopback is intentionally available for local development servers; private LAN and metadata ranges remain blocked.
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true }).catch(() => []);
  if (!addresses.length)
    throw new BadRequestException(
      'The browser target hostname could not be resolved',
    );
  for (const entry of addresses) {
    const ip = entry.address.toLowerCase();
    const blocked =
      ip === '0.0.0.0' ||
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      ip.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip) ||
      ip.startsWith('::ffff:10.') ||
      ip.startsWith('::ffff:192.168.') ||
      ip.startsWith('::ffff:169.254.') ||
      ip.startsWith('fc') ||
      ip.startsWith('fd') ||
      ip.startsWith('fe80:');
    if (blocked)
      throw new BadRequestException(
        'Private and link-local network targets are blocked',
      );
  }
  return url;
}

// Converts browser errors into stable, readable tool responses without leaking internal stacks.
export function describeBrowserError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown browser error';
}
