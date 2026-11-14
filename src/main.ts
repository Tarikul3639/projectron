import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AppConfigService } from './config/config.service.js';

const logger = new Logger('Bootstrap');

/** Creates and starts the Projectron application. */
async function bootstrap(): Promise<void> {
  // Create the NestJS application using the root application module.
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);

  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  logger.log(
    `Configuration loaded host=${config.host} port=${config.port} environment=${config.nodeEnv}`,
  );

  await app.listen(config.port, config.host);

  logger.log(`Projectron is running at http://${config.host}:${config.port}`);
  logger.log(
    `MCP endpoint is available at http://${config.host}:${config.port}/mcp`,
  );
}

// Start the application.
await bootstrap();
