import { BadRequestException, Injectable } from '@nestjs/common';
import { Socket } from 'node:net';
import { NetworkAddressService } from './network-address.service.js';
import type { ConnectivityInput, PortCheckInput } from '../network.type.js';

/** Performs TCP connectivity and port checks against public destinations. */
@Injectable()
export class NetworkConnectivityService {
  constructor(private readonly addresses: NetworkAddressService) {}

  /** Tests whether a public host accepts a TCP connection on the requested port. */
  async checkConnectivity(input: ConnectivityInput) {
    return this.checkPort({
      hostname: input.hostname,
      port: input.port,
      timeoutMs: input.timeoutMs,
    });
  }

  /** Checks one TCP port; private and loopback destinations are deliberately blocked. */
  async checkPort(input: PortCheckInput) {
    const hostname = this.addresses.normalizeHostname(input.hostname);
    const addresses = await this.addresses.resolvePublicAddresses(hostname);
    const startedAt = Date.now();

    return new Promise<{
      hostname: string;
      port: number;
      reachable: boolean;
      latencyMs: number | null;
      address: string;
      checkedAt: string;
    }>((resolvePromise) => {
      const socket = new Socket();
      let settled = false;

      const finish = (reachable: boolean) => {
        if (settled) return;
        settled = true;
        const latencyMs = reachable ? Date.now() - startedAt : null;
        socket.destroy();
        resolvePromise({
          hostname,
          port: input.port,
          reachable,
          latencyMs,
          address: addresses[0].address,
          checkedAt: new Date().toISOString(),
        });
      };

      socket.setTimeout(input.timeoutMs);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));
      socket.connect(input.port, addresses[0].address);
    });
  }
}
