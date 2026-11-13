import { Module } from '@nestjs/common';
import { ApprovalModule } from '../approval/approval.module.js';
import { NetworkAddressService } from './services/network-address.service.js';
import { NetworkDnsService } from './services/network-dns.service.js';
import { NetworkConnectivityService } from './services/network-connectivity.service.js';
import { NetworkHttpService } from './services/network-http.service.js';
import { NetworkTools } from './network.tools.js';

// Registers focused network services and the shared MCP approval infrastructure.
@Module({
  imports: [ApprovalModule],
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
