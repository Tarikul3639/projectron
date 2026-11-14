import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validateEnv } from './app.config.js';
import { AppConfigService } from './config.service.js';

// Loads and validates environment configuration once for the whole application.
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      // Load local/prod overrides first, then fall back to the standard .env file.
      envFilePath: ['.env.local', '.env.prod', '.env'],
      validate: validateEnv,
    }),
  ],
  // Provides the typed wrapper around NestJS ConfigService.
  providers: [AppConfigService],
  // Makes application configuration available to every feature module.
  exports: [AppConfigService],
})
export class AppConfigModule {}
