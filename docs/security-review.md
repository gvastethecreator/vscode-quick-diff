# Security review — 0.1.0

Reviewed: 2026-09-02

| Boundary | Result |
| --- | --- |
| Selection and clipboard text | Stored only as in-memory strings; never logged or persisted. |
| Virtual URIs | Contain a random identifier only; no labels, paths, hashes, or source text. |
| Snapshot lifetime | Maximum 16; unreferenced TTL 30 minutes; cleared on deactivation. |
| Large input | Warning above 2 MiB; hard rejection above 16 MiB; no truncation. |
| Commands | Reject arguments and return generic, content-free user messages. |
| Filesystem | No production reads, writes, temporary files, watchers, or workspace scans. |
| Network | No production HTTP, WebSocket, or fetch calls. |
| Telemetry | None. |
| Workspace trust | No code execution or privileged workspace access; Restricted Mode supported. |
| Web/remote | Browser-safe bundle; clipboard access goes through `vscode.env.clipboard`. |

Archive inspection rejects source, tests, build scripts, dependencies, source maps, network surfaces, and Node process-spawning surfaces in the shipped bundles.
