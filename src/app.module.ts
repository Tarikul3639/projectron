import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module.js';

@Module({
  imports: [AppConfigModule],
})
export class AppModule {}
