# Logging and Error Reporting

Projectron records MCP tool executions in an append-only event log under storage/logs/.

## Active log files

- active/execution-records.jsonl: one JSON event per line. Each execution produces a start event containing the complete sanitized input, zero or more trace-step events, and a completion/failure event containing the complete sanitized output or error details.
- active/runtime-trace.log: readable timestamped lifecycle lines for terminal-friendly inspection.
- active/task-context.json: reserved for task-level recovery context.
- active/activities.json: separate user-level activity history. It does not replace tool execution telemetry.

Every execution event carries the same execution ID so start, trace, and completion events can be correlated. The query service reconstructs a complete execution record from those events, including the full input, output, status, duration, and trace steps.

## Terminal output

The terminal displays compact start/completion summaries by default to avoid flooding the console. Set PROJECTRON_LOG_DETAILS=true to print sanitized input, output, and trace details as well.

The complete event stream is always persisted regardless of this terminal verbosity setting. The terminal detail flag changes presentation only; it does not change what is stored.

## Input/output capture and redaction

The Activity Logging module registers the global Nest interceptor and records intercepted MCP tool handler arguments and returned values.

- Ordinary input and output payloads are preserved in full; strings and collections are not truncated by the logging redactor.
- Secret-like property names (password, token, API key, authorization, cookies, credentials, and similar) are replaced with [REDACTED].
- Common bearer and provider API-key-like strings are redacted even when embedded in text.
- Circular references are represented as [CIRCULAR]; binary buffers are stored as base64.
- Error name, message, and stack are retained after redaction.

Redaction is best-effort. Keep the storage directory private and do not intentionally pass secrets through tools.

## Archive layout

    storage/logs/
    ├── active/
    │   ├── execution-records.jsonl
    │   ├── runtime-trace.log
    │   ├── task-context.json
    │   └── activities.json
    └── archive/
        └── YYYY-MM-DD/
            ├── execution-records.jsonl
            ├── runtime-trace.log
            └── activities.json

Manual rotation merges into the date-specific archive and verifies that records were copied before clearing active files. The append-only JSONL format also preserves a started event if the process stops before a tool call completes; such an execution remains visibly in the running state when reconstructed.

## Service responsibilities

- ActivityLoggingInterceptor: captures the tool handler lifecycle.
- ActivityCollectorService: lets internal operations add named trace steps.
- ActivityLoggingService: persists events and reconstructs execution records.
- ActivityQueryService, ActivitySummaryService, and ActivityReportService: query and summarize persisted executions.
- LogRedactionService: redacts credentials without truncating ordinary payloads.
- LogRotationService: archives active log files.

Only calls passing through Nest's global interceptor are captured automatically. Deeper internal service operations must call ActivityCollectorService.step() (or ActivityLoggingService.recordExecutionStep()) to appear as individual trace steps.


## MCP observability tools

These tools are registered for connected MCP clients so an AI model can inspect what Projectron has done and explain it to the user:

| Tool | Purpose |
| --- | --- |
| `activity_get_recent_executions` | List recent executions with IDs, tool names, sanitized input/output, status, timing, and steps. |
| `activity_get_execution_details` | Retrieve the full reconstructed record for one execution ID. |
| `activity_search_executions` | Filter recent executions by execution ID, partial tool name, and status. |
| `activity_get_execution_steps` | Inspect the chronological lifecycle events and internal trace for one execution. |
| `activity_get_summary` | Get compact running/succeeded/failed counts and duration totals. |
| `activity_create_report` | Produce a structured activity report with records and aggregates. |
| `activity_archive_logs` | Explicitly archive active logs; this is a state-changing maintenance operation. |

Recommended client workflow: call `activity_get_recent_executions` for a status overview; use the returned `id` as `executionId` with the details/steps tools when a user asks what happened or why. Use `activity_search_executions` to locate a failed or named operation. Do not call the archive tool unless the user explicitly requests log maintenance.

The listing and search tools query the active recent execution history (up to the latest 500 reconstructed executions); they do not search date-based archive folders yet. All returned payloads are subject to the same secret redaction rules as stored logs.
