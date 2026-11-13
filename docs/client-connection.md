# MCP Client Connection

This guide explains how to connect an MCP client to Projectron locally or through a Control Plane tunnel.

## 1. Start Projectron with STDIO

Build the project and start its STDIO MCP server:

```bash
pnpm build
pnpm start:mcp:stdio
```

Use this launch command when your MCP client runs Projectron as a local STDIO process.

## 2. Configure the Control Plane Tunnel

For a remote MCP client, configure the Control Plane tunnel with these environment variables:

```bash
export CONTROL_PLANE_API_KEY="<your-control-plane-api-key>"
export CONTROL_PLANE_TUNNEL_ID="<your-tunnel-id>"
export MCP_SERVER_URL="http://127.0.0.1:3639/mcp"
```

Replace the placeholders with the credentials and tunnel ID supplied by your Control Plane.

## 3. Start the HTTP MCP Endpoint

The tunnel URL above points to Projectron's Streamable HTTP endpoint. STDIO and HTTP are separate transports, so the STDIO process does not provide this HTTP endpoint.

Keep the HTTP server running in a separate terminal:

```bash
pnpm start:dev
```

Projectron's local HTTP MCP endpoint is:

```text
http://127.0.0.1:3639/mcp
```

## 4. Connect the Remote MCP Client

Start your Control Plane tunnel client/service using the environment variables from step 2. Configure the remote MCP client with the public MCP URL provided by your Control Plane tunnel.

The exact tunnel-client launch command and public URL depend on your Control Plane provider's setup.

## Security

- Keep `CONTROL_PLANE_API_KEY` secret.
- Do not commit real credentials or paste them into source files.
- Keep Projectron's HTTP server running while the tunnel is forwarding requests.
