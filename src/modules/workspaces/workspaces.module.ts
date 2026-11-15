import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/config.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { WorkspacesService } from './services/workspaces.service.js';
import { WorkspacesTools } from './tools/workspaces.tools.js';

/** Standalone workspace registry module; no execution or filesystem module dependencies. */
@Module({
  imports: [AppConfigModule, StorageModule],
  providers: [WorkspacesService, WorkspacesTools],
  exports: [],
})
export class WorkspacesModule { }
