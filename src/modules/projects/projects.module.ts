import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/config.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { ProjectsService } from './services/projects.service.js';
import { ProjectsTools } from './projects.tools.js';

/** Standalone project catalog module; no execution or filesystem module dependencies. */
@Module({
  imports: [AppConfigModule, StorageModule],
  providers: [ProjectsService, ProjectsTools],
  exports: [],
})
export class ProjectsModule {}
