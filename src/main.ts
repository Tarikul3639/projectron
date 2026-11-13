import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AppConfigService } from './config/config.service.js';

// Logger used for application startup messages.
const logger = new Logger('Bootstrap');

/**
 * Creates and starts the Projectron application.
 */
async function bootstrap(): Promise<void> {
  // Create the NestJS application using the root application module.
  const app = await NestFactory.create(AppModule);

  // Load validated application settings from the configuration service.
  const config = app.get(AppConfigService);

  // Enable graceful shutdown when the process receives termination signals.
  app.enableShutdownHooks();

  // Apply validation to incoming HTTP request payloads.
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Transform plain request objects into DTO instances.
      whitelist: true, // Remove properties that are not declared in the DTO.
      forbidNonWhitelisted: true, // Reject requests containing unknown properties.
    }),
  );

  // Start the HTTP server on the configured host and port.
  await app.listen(config.port, config.host);

  // Log the address where the application is listening.
  logger.log(`Projectron is running at http://${config.host}:${config.port}`);
  logger.log(`MCP connection url: http://${config.host}:${config.port}/mcp`);
}

// Start the application.
await bootstrap();
