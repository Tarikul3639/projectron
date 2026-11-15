import { Global, Module } from '@nestjs/common';
import { CoordinationModule } from './coordination/coordination.module.js';

// Exposes shared internal infrastructure to feature modules without barrel imports.
@Global()
@Module({
  imports: [CoordinationModule],
  exports: [CoordinationModule],
})
export class CoreModule {}
