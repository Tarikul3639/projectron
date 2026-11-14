import { Module } from '@nestjs/common';
import { NetworkAddressService } from './services/network-address.service.js';
import { NetworkDnsService } from './services/network-dns.service.js';
import { NetworkConnectivityService } from './services/network-connectivity.service.js';
import { NetworkHttpService } from './services/network-http.service.js';
import { NetworkTools } from './tools/network.tools.js';

// Registers focused network services and their MCP tools.
@Module({
  imports: [],
  providers: [
    NetworkAddressService,
    NetworkDnsService,
    NetworkConnectivityService,
    NetworkHttpService,
    NetworkTools,
  ],
  exports: [
    NetworkAddressService,
    NetworkDnsService,
    NetworkConnectivityService,
    NetworkHttpService,
    NetworkTools,
  ],
})
export class NetworkModule {}
