# Configuration

Projectron validates environment variables at startup with Zod. Invalid values prevent the application from starting.

Create `.env` from `.env.example` and set only the values needed for your environment.

| Variable                   | Default                     | Purpose                                                                                                   |
| -------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                 | `development`               | Runtime environment: `development`, `production`, or `test`.                                              |
| `HOST`                     | `127.0.0.1`                 | Network interface used by the HTTP server.                                                                |
| `PORT`                     | `3639`                      | HTTP server port; valid range is 1–65535.                                                                 |
| `MCP_HTTP_ENABLED`         | `true`                      | Declared MCP HTTP setting. The current HTTP bootstrap does not yet use this flag to disable the endpoint. |
| `MCP_STDIO_ENABLED`        | `true`                      | Declared MCP STDIO setting. The current stdio entry point is controlled by the separate launch command.   |
| `AI_BASE_URL`              | `https://api.openai.com/v1` | OpenAI-compatible API base URL for AI planning.                                                           |
| `AI_API_KEY`               | unset                       | Provider credential. AI planning is unavailable without it.                                               |
| `AI_MODEL`                 | `gpt-4.1-mini`              | Model identifier sent to the provider.                                                                    |
| `AI_TIMEOUT_MS`            | `60000`                     | AI request timeout; valid range is 1,000–300,000 ms.                                                      |
| `FILESYSTEM_ALLOWED_ROOTS` | `./workspace`               | Allowed root path configuration for filesystem operations.                                                |
| `LOG_LEVEL`                | `debug`                     | Minimum log level: `error`, `warn`, `log`, `debug`, or `verbose`.                                         |

## Example

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=3639
MCP_HTTP_ENABLED=true
MCP_STDIO_ENABLED=false
FILESYSTEM_ALLOWED_ROOTS=./workspace
LOG_LEVEL=debug
```

## Storage location

Projectron currently uses `./storage` for persisted application data. This path is defined by `AppConfigService.storagePath`; it is not currently an environment variable.
