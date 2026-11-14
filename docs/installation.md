# Installation and Running

## Requirements

- Node.js **20.19 or newer**
- pnpm
- Chromium dependencies supported by Playwright for browser automation

## Install

```bash
pnpm install
```

## Configure

Create a local environment file:

```bash
cp .env.example .env
```

Review the values in `.env`. In particular, set the host, port, and filesystem allowed roots for your environment.

For AI-generated plans, configure `AI_API_KEY`. The provider URL and model can be changed with `AI_BASE_URL` and `AI_MODEL`.

## Start the HTTP server

Development:

```bash
pnpm start:dev
```

Build and production:

```bash
pnpm build
pnpm start:prod
```

The HTTP MCP endpoint is available at:

```text
http://127.0.0.1:3639/mcp
```

Use the host and port configured in `.env`.

## Start through STDIO

Build first, then launch the dedicated stdio process:

```bash
pnpm build
pnpm start:mcp:stdio
```

Configure the MCP client to launch this command as a local process. STDIO is the protocol channel: do not write application logs or other text to stdout. Projectron uses `McpStdioLogger` for this entry point.

## Quality checks

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm test:e2e
pnpm build
```

## Important notes

- Keep real credentials in `.env`; never commit them.
- `FILESYSTEM_ALLOWED_ROOTS` defines the roots that filesystem and related file operations may access.
- Browser automation requires a working Playwright Chromium installation.
- AI planning is unavailable when `AI_API_KEY` is not configured; the rest of the application can still run.
