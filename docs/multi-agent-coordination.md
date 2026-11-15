# Multi-Agent Coordination

Projectron provides an in-process coordination layer for independent AI execution sessions sharing one Projectron server.

## Client identity vs. session identity

A client identifies the connected application or integration (for example, ChatGPT). A session identifies one independent execution context (for example, one browser tab or one task).

- Multiple sessions may share the same `clientId`.
- Each tab/task must call `agent_register` independently and omit `sessionId` to receive a new unique session ID.
- The returned `sessionId` must be retained by that tab/task and supplied to every subsequent coordination operation.
- Reconnect the same tab/session by passing its existing `sessionId` to `agent_register`.
- Do not share a session ID between independent tabs. Doing so intentionally makes them the same coordination owner.

## MCP tools

- `agent_register`: create a new session or reconnect an existing session. Returns `sessionId`.
- `agent_heartbeat`: renew one session lease and only that session's locks.
- `agent_acquire_resource_lock`: acquire a shared read lock or exclusive write lock using `sessionId`.
- `agent_release_resource_lock`: release a lock owned by the requesting session.
- `agent_get_coordination_state`: inspect active sessions, parent client identities, locks, and tasks.
- `agent_create_task`: create a task assigned to a registered session using `ownerSessionId`.
- `agent_update_task`: update or explicitly take over a task using `sessionId`.

## Read/write behavior

- Multiple sessions may hold read locks for the same resource.
- A write lock is exclusive across all sessions, including sibling sessions with the same `clientId`.
- A write lock is denied while any other session holds a read or write lock.
- A read lock is denied while another session holds a write lock.
- A session must release its read lock before requesting an exclusive write lock.
- A denied lock response includes the current owning session IDs.
- Session leases expire automatically; heartbeat renews only the matching session and its locks.
- Task ownership and takeover are session-scoped.

Use a stable resource key such as `project:<project-id>:file:<normalized-relative-path>` so every session addresses the same resource consistently.

## Important scope and limitations

Coordination state is currently stored in process memory. It is shared by MCP sessions connected to the same running Projectron process, but it is not durable across restarts and is not coordinated across multiple Projectron server processes.

**Filesystem enforcement is still a separate integration step.** The filesystem write/edit/delete tools do not yet require a session ID or verify a coordination lock automatically. Until that integration is implemented, clients must acquire and release locks themselves around file operations; the lock service alone cannot prevent a caller from bypassing it. The next hardening step is to enforce session-owned locks and expected file revisions inside filesystem mutations, then move leases to shared persistent storage before running multiple server instances.

Clients should read the latest committed file contents before editing. This module does not expose uncommitted editor buffers; it only coordinates access to workspace resources.
