# Configuration

Projectron validates environment variables at startup with Zod. Invalid values prevent the application from starting.

Create `.env` from `.env.example` and set only the values needed for your environment.

| Variable                   | Default       | Purpose                                                    |
| -------------------------- | ------------- | ---------------------------------------------------------- |
| `NODE_ENV`                 | `development` | Runtime environment: development, production, or test.     |
| `HOST`                     | `127.0.0.1`   | Network interface used by the HTTP server.                 |
| `PORT`                     | `3639`        | HTTP server port; valid range is 1–65535.                  |
| `MCP_HTTP_ENABLED`         | `true`        | Declared MCP HTTP setting.                                 |
| `MCP_STDIO_ENABLED`        | `true`        | Declared MCP STDIO setting.                                |
| `FILESYSTEM_ALLOWED_ROOTS` | `./workspace` | Allowed root path configuration for filesystem operations. |
| `LOG_LEVEL`                | `debug`       | Minimum application log level.                             |

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

## Database location

Projectron currently uses `./database` for persisted application data. This path is defined by `AppConfigService.databasePath`; it is not currently an environment variable.
