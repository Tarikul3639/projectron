import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../config/config.service.js';

/** Reports browser engine capabilities and configured filesystem boundaries. */
@Injectable()
export class BrowserInfoService {
  constructor(private readonly config: AppConfigService) {}

  /** Returns the supported browser features and operational restrictions. */
  capabilities() {
    return {
      engine: 'Chromium',
      sessions: 'isolated browser contexts',
      downloads: true,
      screenshots: true,
      pdf: true,
      tracing: true,
      maxUploadFiles: 20,
      privateNetworkAccess: 'blocked by default',
      allowedFileRoots: this.config.filesystemAllowedRoots,
    };
  }
}
