# MCP Tools

Projectron exposes feature capabilities as MCP tools. Tool names and input schemas are defined in each module's `tools/` provider and validated with Zod.

## Capability groups

| Module            | What it provides                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Browser**       | Launch and manage Chromium sessions, navigate pages, inspect text/DOM/accessibility/links, interact with elements, capture screenshots, and manage downloads. |
| **Documents**     | Read and write supported document files, convert document formats, and use document templates.                                                                |
| **Filesystem**    | Read, write, list, create, edit, move, copy, delete, and transfer files and directories within allowed roots.                                                 |
| **Network**       | Inspect local addresses, perform DNS lookups, test connectivity, and make controlled HTTP requests.                                                           |
| **Processes**     | Execute and supervise processes and manage their working directories.                                                                                         |
| **Projects**      | List, inspect, add, update, remove, and discover project directories.                                                                                         |
| **System**        | Read host information, CPU and memory metrics, disk I/O, temperatures, top processes, and performance diagnostics.                                            |
| **Terminal**      | Run approved terminal commands and retrieve execution results.                                                                                                |
| **Orchestration** | Discover tools, create plans, generate plans from goals, approve steps, execute one eligible step, inspect tasks, update steps, and cancel tasks.             |

## Discover available tools

The exact registered tool list is available at runtime through `orchestration_list_tools`. This reflects the tools actually discovered by the MCP registry and is the source of truth for a connected server.

## Safety and approvals

- Every tool validates its input against its declared schema.
- Read-only tools are identified with MCP annotations where appropriate.
- Protected actions use the Approval module and require an explicit user decision.
- Filesystem and browser operations enforce their own access and destination restrictions.
- A rejected or missing approval must not be treated as permission to execute.

## Orchestration usage

A typical controlled workflow is:

1. Call `orchestration_list_tools` to discover capabilities.
2. Create a plan with `orchestration_create_plan` or `orchestration_plan_from_goal`.
3. Inspect it with `orchestration_get_task`.
4. Approve protected steps with `orchestration_approve_step`.
5. Call `orchestration_execute_next` to execute at most one eligible step.
6. Inspect the result and repeat until the task is complete.

Creating a plan does not execute tools. Each execution call advances at most one step.
