# Orchestration

## Goal

Orchestration turns a goal into a validated, persisted task plan and executes it one step at a time. It coordinates registered MCP tools without importing domain services directly.

## Main operations

| MCP tool                       | Purpose                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------ |
| `orchestration_list_tools`     | Discover registered tools available to plans.                                  |
| `orchestration_create_plan`    | Save a plan with steps and dependencies.                                       |
| `orchestration_plan_from_goal` | Ask the configured AI provider to propose a plan from a natural-language goal. |
| `orchestration_list_tasks`     | List saved tasks.                                                              |
| `orchestration_get_task`       | Inspect a task, its steps, dependencies, and results.                          |
| `orchestration_update_step`    | Update a step when an external executor reports its outcome.                   |
| `orchestration_approve_step`   | Request explicit approval for a protected step.                                |
| `orchestration_execute_next`   | Execute or resume at most one dependency-ready step.                           |
| `orchestration_cancel_task`    | Cancel a task when no tool step is actively running.                           |

## Task and step states

Task states: `planned`, `in_progress`, `completed`, `failed`, `cancelled`.

Step states: `queued`, `awaiting_approval`, `running`, `completed`, `failed`, `skipped`.

A step cannot run until all declared dependencies are completed. Protected steps remain in `awaiting_approval` until explicitly approved.

## Execution flow

1. Discover registered tools and their descriptions.
2. Create a plan manually or generate one from a goal.
3. Validate tool names, unique step IDs, dependency references, and dependency cycles.
4. Persist the plan. Planning never runs a tool.
5. Request approval for protected steps.
6. Execute one eligible step per `orchestration_execute_next` call.
7. Inspect the task and continue with the next eligible step.

The dispatcher invokes handlers through `McpRegistry`. It validates tool inputs against the registered Standard Schema and validates outputs when an output schema exists. Domain modules remain responsible for their own validation and safety checks.

## AI planning

AI planning uses an OpenAI-compatible Chat Completions provider.

| Variable        | Default                     |
| --------------- | --------------------------- |
| `AI_BASE_URL`   | `https://api.openai.com/v1` |
| `AI_API_KEY`    | Not set                     |
| `AI_MODEL`      | `gpt-4.1-mini`              |
| `AI_TIMEOUT_MS` | `60000`                     |

The planner sends the goal and registered tool names/descriptions to the provider. It validates the returned plan and tool names before persistence. AI output is untrusted: non-read-only steps require approval. The planner itself never executes a tool.

## Retry, cancellation, and concurrency

- A failed step can be retried on a later execution call. Default maximum attempts: 3; maximum allowed: 5.
- Each attempt records its status, timestamps, and error.
- Cancellation is refused while a tool call is actively running.
- An in-process lock prevents overlapping execution of the same task within one Orchestration service process. It is not a distributed lock; multi-process deployments need an atomic shared lock or database coordination.

## Persistence

Task plans and execution state are stored through the Storage module under `storage/orchestration/tasks.json`.
