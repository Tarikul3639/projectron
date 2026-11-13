# Projectron

<p align="center">
  <a href="logo/projectron_256x256_10KB.png">
    <img src="logo/projectron_256x256_10KB.png" width="160" alt="Projectron logo" />
  </a>
</p>

<p align="center">
  <strong>Your AI-Powered Project Companion</strong><br />
  Connect MCP-compatible AI clients to tools on your local machine.
</p>

## Overview

Projectron is a local MCP server built with NestJS and TypeScript. It gives AI clients a controlled way to work with your computer through tools for filesystem, terminal, browser, documents, processes, network, and system operations.

## Features

- MCP over Streamable HTTP and STDIO.
- Local filesystem, terminal, browser, and document tools.
- Process and system inspection and management.
- Approval prompts for protected operations.
- Configurable filesystem access roots.
- Local JSON-based storage; no database required.

## Requirements

- Node.js
- pnpm

## Setup

```bash
pnpm install
cp .env.example .env
```

Review `.env` before starting. In particular, configure the allowed filesystem roots and choose the MCP transports you want to enable.

## Run

**HTTP server (development):**

```bash
pnpm start:dev
```

MCP endpoint: `http://127.0.0.1:3639/mcp` (adjust the host or port if changed in `.env`).

**STDIO server:**

```bash
pnpm build
pnpm start:mcp:stdio
```

For an MCP client that supports remote HTTP servers, add the HTTP endpoint above. For a local STDIO client, use the built entry point:

```text
node /absolute/path/to/Projectron/dist/modules/mcp/transports/stdio.transport.js
```

Run the STDIO process from the Projectron directory so it can load the project's environment configuration.

## Development

```bash
pnpm start:dev   # Start with watch mode
pnpm build       # Compile the application
pnpm lint        # Run lint checks
pnpm test        # Run unit tests
pnpm test:e2e    # Run end-to-end tests
```

Protected tools may request explicit approval. Review each prompt before allowing an operation.

## Author

**Tarikul Islam**  
GitHub / Portfolio: [github.com/Tarikul3639](https://github.com/Tarikul3639)
