# Compatibility evidence — 0.1.0

Captured locally on Windows on 2026-09-02.

| Target | Evidence | Result |
| --- | --- | --- |
| VS Code 1.136.0 desktop | Full Extension Host integration suite | Pass |
| VS Code 1.134.0 desktop | Same five-command integration suite | Pass |
| VS Code stable web | Browser bundle in writable `vscode-test-web:` workspace | Pass |
| Packaged VSIX | Installed into a clean temporary profile, then exercised by the desktop suite | Pass |
| Virtual documents | Writable non-`file:` provider selection and `quickdiff:` content provider | Pass |
| Restricted Mode | Packaged manifest declares support; production code has no trust-sensitive execution | Pass by contract and inspection |
| Remote extension hosts | `extensionKind` allows UI/workspace placement; clipboard uses the VS Code abstraction | Supported by contract; direct SSH/Codespaces session not run locally |
| Linux, macOS, Insiders | Defined in the hosted CI matrix | Pending the pushed PR's hosted run |

The minimum version is VS Code 1.134.0 because the extension compiles against that API surface and the complete desktop integration suite passes on the released 1.134.0 host.
