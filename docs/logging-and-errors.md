# Activity Logging

New MCP tool executions are stored as one JSONL record per tool call in
`database/logs/tool-executions.jsonl`.

Each record contains only:

- Tool name
- Validated tool input
- Tool output, or a compact error name/message
- Start timestamp, completion timestamp, status, and duration

The global interceptor checks the MCP context and records only handlers whose
context kind is `tool`. It reads arguments from `McpExecutionContext.getInput()`;
HTTP request, response, socket, headers, and other transport internals are never
captured. Each MCP tool call produces exactly one record.

## Data limits and privacy

- Credential-like keys and bearer/provider tokens are redacted.
- Strings are limited to 8 KiB; arrays and objects to 50 entries; nesting to 8 levels.
- Binary buffers, functions, and symbols are omitted.
- Each persisted record is limited to approximately 64 KiB.
- Only the latest 500 records are retained in the new log.
- Error stack traces and internal lifecycle steps are not stored.
- Logging failures do not change the result returned by the underlying tool.

## Existing logs

The previous `execution-records.jsonl`, `runtime-trace.log`,
`task-context.json`, and date-based archive files are legacy data. They are
left untouched and are not read, queried, or appended to by the new logger.
The new logger writes only to `tool-executions.jsonl`. Historical files can be
reviewed or removed separately after deciding whether they are still needed.

## MCP tools

| Tool                             | Purpose                                        |
| -------------------------------- | ---------------------------------------------- |
| `activity_get_recent_executions` | List recent tool calls and their input/output. |
| `activity_get_execution_details` | Retrieve one record by execution ID.           |
| `activity_search_executions`     | Filter recent records by ID, tool, or status.  |
