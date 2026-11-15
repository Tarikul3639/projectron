import { Module } from '@nestjs/common';
import { CoordinationService } from './services/coordination.service.js';

// Internal coordination primitives shared by resource-owning feature modules.
@Module({
  providers: [CoordinationService],
  exports: [CoordinationService],
})
export class CoordinationModule {}
