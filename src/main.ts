import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AppConfigService } from './config/config.service.js';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);

  app.enableShutdownHooks();

  await app.listen(config.port, config.host);

  logger.log(`Projectron is running at http://${config.host}:${config.port}`);
}

await bootstrap();
