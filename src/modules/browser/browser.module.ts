import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/config.module.js';

import { BrowserTools } from './tools/browser.tools.js';
import { BrowserSessionService } from './services/browser-session.service.js';
import { BrowserPageService } from './services/browser-page.service.js';
import { BrowserArtifactService } from './services/browser-artifact.service.js';
import { BrowserDownloadService } from './services/browser-download.service.js';
import { BrowserContextService } from './services/browser-context.service.js';
import { BrowserInfoService } from './services/browser-info.service.js';

// Registers focused browser services and the single MCP tools provider.
@Module({
  imports: [AppConfigModule],
  providers: [
    BrowserSessionService,
    BrowserPageService,
    BrowserArtifactService,
    BrowserDownloadService,
    BrowserContextService,
    BrowserInfoService,
    BrowserTools,
  ],
  exports: [
    BrowserSessionService,
    BrowserPageService,
    BrowserArtifactService,
    BrowserDownloadService,
    BrowserContextService,
    BrowserInfoService,
    BrowserTools,
  ],
})
export class BrowserModule {}
