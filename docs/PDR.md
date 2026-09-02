# PDR — Quick Diff

- Repo: `X:\vscode-extensions\vscode-quick-diff`
- Remote: private (`gvastethecreator/vscode-quick-diff`)

## Status

Release candidate · Priority P1 · QDF-001 through QDF-020 implemented · QDF-021 publication gated

## Product summary

Quick Diff makes common text comparisons immediate while keeping VS Code's native diff editor as the only rendering surface. It is a quiet command utility, not a custom diff product.

## Release boundary

Version 0.1.0 includes:

- exact active selection versus clipboard text;
- an immutable selection captured as Left versus a later selection;
- the complete current in-memory buffer versus clipboard text;
- two current open text-document buffers chosen through native Quick Picks;
- Node and browser extension-host bundles.

Comparing the current buffer with its saved version remains post-0.1.0.

## Commands

| Command | Contract |
| --- | --- |
| `Quick Diff: Compare Selection with Clipboard` | Compare exact non-empty selections with current plain clipboard text. |
| `Quick Diff: Use Selection as Left Side` | Capture an immutable in-memory left snapshot and show one brief status message. |
| `Quick Diff: Compare Selection with Left Side` | Compare the current selection with the last captured left snapshot. |
| `Quick Diff: Compare File with Clipboard` | Compare the complete active in-memory text buffer, including unsaved edits. |
| `Quick Diff: Compare Open Files...` | Pick a left and right open text document, then compare current buffers. |

Only selection-versus-clipboard appears in the editor context menu. All five commands appear in the Command Palette. Version 0.1.0 has no default keybindings or settings.

## Selection and clipboard semantics

- Empty selections are rejected; the current line is never substituted.
- Multiple selections are ordered by document position and joined with the document's EOL.
- Overlaps are united without duplicate text; adjacent selections remain separate.
- Captures use text at invocation time and never mutate with the source document.
- Clipboard access uses `vscode.env.clipboard.readText()` only.
- Empty clipboard text is rejected. Binary clipboard data is outside scope.
- Clipboard behavior, including platform handling of embedded NUL characters, follows VS Code and the host OS.

## Architecture

`src/core/` owns VS Code-independent models, selection normalization, UTF-8 limits, safe labels, virtual URI validation, and the bounded snapshot store. `QuickDiffController` owns native commands and lifecycle. `QuickDiffContentProvider` serves exact immutable text to `vscode.diff`.

```text
selection / clipboard / current buffer
                 │
                 ▼
     bounded memory-only snapshot
                 │
                 ▼
       quickdiff:/snapshot/<id>
                 │
                 ▼
        VS Code native diff editor
```

There is no temporary-file or custom-renderer fallback.

## State and limits

- Snapshot identifiers are content-independent and collision-resistant.
- URIs contain identifiers only, never source text, labels, paths, or content hashes.
- At most 16 snapshots are retained.
- Unreferenced snapshots expire after 30 minutes.
- Referenced virtual documents are not evicted.
- Deactivation clears all snapshots and timers.
- Each source warns above 2 MiB and is rejected above 16 MiB.
- Text is measured as UTF-8 and is never silently truncated.

## Labels

Diff titles use cleaned basenames. Duplicate filenames receive compact workspace-relative disambiguation. Absolute paths and control characters are rejected from labels.

Examples:

```text
Selection: editor.ts ↔ Clipboard
Left Selection: README.md ↔ Selection: notes.md
one/same.ts ↔ two/same.ts
```

## Privacy and security

Selections and clipboard text may contain secrets. Production code has:

- no persistence;
- no filesystem reads or writes;
- no network access;
- no telemetry;
- no clipboard watcher;
- no content or path logging;
- no accepted command arguments.

User-facing failures are concise and content-free. See `docs/security-review.md`.

## UX

Use native VS Code primitives only: Command Palette, one scoped editor context action, two-stage Quick Pick, a brief status-bar confirmation for left capture, and the native diff editor. No webviews, tree views, persistent status items, onboarding screens, or settings are allowed in 0.1.0.

## Compatibility

| Environment | Contract |
| --- | --- |
| VS Code desktop 1.134+ | Full command and native diff support. |
| Current desktop stable | Full support. |
| VS Code web | Browser bundle and writable virtual-workspace support. |
| Virtual workspace | Full support through VS Code APIs. |
| Restricted Mode | Full support; no workspace execution or trust requirement. |
| Remote extension host | Full support; clipboard semantics follow VS Code's environment abstraction. |

`extensionKind: ["ui", "workspace"]` prefers the local UI host while retaining workspace-host compatibility.

## Verification contract

- focused unit tests cover selection, labels, limits, URI safety, snapshot lifecycle, and eviction;
- desktop Extension Host tests cover lazy activation, immutable capture, clipboard, dirty buffers, rejected inputs, writable non-file documents, duplicate filenames, native diff tabs, and URI privacy;
- web tests exercise the browser bundle in a writable virtual workspace;
- performance checks bound selection preparation, UTF-8 sizing, snapshot operations, and bundle size;
- media checks prove deterministic downsampling, dimensions, and native alpha;
- VSIX inspection enforces the allowlist and rejects source, tests, scripts, dependencies, maps, and forbidden runtime surfaces;
- a clean-profile installed-VSIX smoke test runs the real packaged extension.

## Acceptance criteria

- all five commands use the native diff editor;
- current unsaved buffers and selections are captured exactly;
- comparison text stays memory-only;
- no source content appears in virtual URIs;
- no temporary files or background scans exist;
- snapshot and source-size bounds are enforced;
- Node, browser, virtual, Restricted Mode, and remote contracts are declared;
- README, icon, and preview describe and show real behavior;
- the product and portfolio PDR copies remain byte-identical.

## Non-goals

- custom diff algorithms or rendering;
- binary or image diff;
- Git client, patch, or three-way merge features;
- persistent history, named slots, cloud sync, or clipboard watching;
- automatic workspace scanning;
- AI summaries;
- public command arguments.

## Delivery status

QDF-001 through QDF-020 define the implemented and locally verifiable release candidate. QDF-021 covers Marketplace/Open VSX publication, tag/release creation, and post-publication installation checks. It remains open until the user separately authorizes those remote mutations.

## Definition of done

Implementation is complete when final source and media bytes pass unit, type, dual-bundle, performance, desktop minimum/current, web, VSIX inspection, and clean-profile installed-VSIX checks. Publication is complete only after QDF-021 receives explicit authorization and both public listings are verified.
