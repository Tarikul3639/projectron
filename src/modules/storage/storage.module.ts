import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/config.module.js';
import { FileStorageService } from './file-storage.service.js';
import { JsonStorageService } from './json-storage.service.js';

// Provides filesystem and JSON storage services to application modules.
@Module({
  imports: [AppConfigModule],
  providers: [FileStorageService, JsonStorageService],
  exports: [FileStorageService, JsonStorageService],
})
export class StorageModule {}
