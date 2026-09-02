# Security

Quick Diff is local-first. Compared text stays in extension-host memory and is never written to disk, sent over the network, included in virtual URIs, or logged. The extension has no telemetry and does not watch the clipboard.

Snapshots are bounded to 16 entries, expire 30 minutes after they become unreferenced, and are cleared on deactivation. Each source is blocked above 16 MiB.

Report vulnerabilities through a [private GitHub security advisory](https://github.com/gvastethecreator/vscode-quick-diff/security/advisories/new). Do not open a public issue with exploit details or sample secrets.
