# Logging and Error Reporting

Projectron uses NestJS logging and a global `LoggingInterceptor` for Nest-managed handlers, including MCP tool handlers.

## Operation lifecycle

For each intercepted operation, Projectron writes:

- **Started:** the provider and handler being invoked.
- **Succeeded:** emitted when the handler completes successfully, including elapsed milliseconds.
- **Failed:** includes the error message, error code when available, and stack trace.
- **Partial failure:** batch results containing a non-empty `failed` array are reported as warnings with item-level error messages.

Known NestJS `HttpException` and MCP `ProtocolError` instances are passed through unchanged. Unexpected runtime errors are logged and then surfaced as an HTTP 500 exception whose message contains the original diagnostic and error code when available. The original exception is retained as the cause. This is important because the installed `@nestjs/mcp` adapter masks non-`HttpException` tool failures as `Internal server error`. Batch operations that return per-item results are not converted into thrown exceptions; their `succeeded` and `failed` entries are preserved.

## Sensitive data

Operation inputs and complete return payloads are not written to logs. Batch failure details and exception messages are logged for diagnosis; they may contain filesystem paths or other runtime details, so review logs before sharing them externally.

## Filesystem roots

The filesystem services initialize their configured allowed roots during Nest module initialization. On Linux, `FILESYSTEM_ALLOWED_ROOTS` is split using the platform path delimiter (`:`). Relative roots are resolved against the process working directory.

For a missing-root error such as `ENOENT: realpath .../workspace`, inspect:

1. The process working directory shown by the runtime or service manager.
2. The effective `FILESYSTEM_ALLOWED_ROOTS` value (do not paste secret environment values into logs).
3. Whether the configured directory exists and is writable by the Projectron process.
4. Whether the server was restarted after changing its environment configuration.

The default `./workspace` therefore points to a directory under the process working directory, not necessarily the source-code directory when Projectron is launched by a service manager.
