# Projectron — Local MCP Server for AI-Powered Computer Automation

<p align="center">
  <a href="logo/projectron_256x256_10KB.png">
    <img src="logo/projectron_256x256_10KB.png" width="160" alt="Projectron local MCP server logo for AI-powered computer automation" />
  </a>
</p>

<p align="center">
  <strong>Your AI-Powered Project Companion</strong><br />
  Connect MCP-compatible AI clients to tools and workflows on your local computer.
</p>

Projectron is a local **Model Context Protocol (MCP) server** built with **NestJS** and **TypeScript**. It gives compatible AI assistants a structured way to interact with your computer through tools for filesystem access, terminal commands, browser automation, document handling, process management, network information, and system inspection. Tools execute directly after input validation and domain-specific restrictions pass; destructive-operation annotations remain impact metadata for MCP clients.

## Features

- **MCP transports:** Connect through Streamable HTTP or STDIO.
- **Filesystem tools:** Work with files and directories within configured allowed roots.
- **Terminal tools:** Run supported commands in permitted working directories.
- **Browser automation:** Control browser workflows with Playwright-powered tools.
- **Document tools:** Work with local documents and conversions.
- **Process management:** Inspect and manage processes started through Projectron.
- **System and network tools:** Inspect system information and network details.
- **Orchestration:** Plan and execute multi-step workflows through registered MCP tools.
- **Local storage:** Store application data in local JSON files without requiring a database.

## Requirements

- Node.js
- pnpm

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Tarikul3639/Projectron.git
cd Projectron
pnpm install
cp .env.example .env
```

Review the `.env` file before starting. Configure the allowed filesystem roots and enable the MCP transports you intend to use.

## Connect an MCP Client

### Streamable HTTP

Start the development server:

```bash
pnpm start:dev
```

Use this MCP endpoint in an MCP-compatible client:

```text
http://127.0.0.1:3639/mcp
```

Adjust the host or port if you changed the corresponding environment settings.

### STDIO

Build Projectron:

```bash
pnpm build
```

Configure your local MCP client to launch this command from the Projectron directory:

```bash
node /absolute/path/to/Projectron/dist/modules/mcp/transports/stdio.transport.js
```

The STDIO process should run from the Projectron directory so it can load the project's environment configuration.

## Development

```bash
pnpm start:dev   # Start in watch mode
pnpm build       # Build the application
pnpm lint        # Run lint checks
pnpm test        # Run unit tests
pnpm test:e2e    # Run end-to-end tests
```

## Security

Configure filesystem roots carefully. Projectron retains domain-specific restrictions such as workspace boundaries, path traversal and symlink checks, protected environment-file handling, bounded command execution, blocked interactive shells and interpreters, and public-destination validation for outbound network requests. These controls are not an operating-system-level sandbox; run Projectron with an account whose OS permissions are appropriately limited.

## Technology

NestJS 12 · TypeScript · Model Context Protocol (MCP) · Playwright · Zod · pnpm

## Author

**Tarikul Islam**  
Portfolio: [tarikul-islam.me](https://tarikul-islam.me/)  
GitHub: [github.com/Tarikul3639](https://github.com/Tarikul3639)
