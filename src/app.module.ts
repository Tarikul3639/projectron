import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module.js';
import { FilesystemModule } from './modules/filesystem/filesystem.module.js';
import { SecurityModule } from './modules/security/security.module.js';
import { StorageModule } from './modules/storage/storage.module.js';

// Root module that composes application-wide configuration and core feature modules.
@Module({
  imports: [AppConfigModule, SecurityModule, StorageModule, FilesystemModule],
})
export class AppModule {}
