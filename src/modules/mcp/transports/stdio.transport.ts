import { NestFactory } from '@nestjs/core';
import { McpStdioLogger, McpStdioServer } from '@nestjs/mcp';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppModule } from '../../../app.module.js';

/** Starts the same Projectron MCP registry over stdio for locally launched clients. */
export async function bootstrapMcpStdio(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: new McpStdioLogger(),
  });

  try {
    const server = app.get(McpStdioServer);
    await server.listen();
  } finally {
    await app.close();
  }
}

const isMainModule =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMainModule) {
  await bootstrapMcpStdio();
}
