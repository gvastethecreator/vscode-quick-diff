# Quick Diff — additional quality and competitive review

Review date: 2026-09-06. Baseline: `b97994816109ea71794946ffb024c4b3f11d2a04` (`main`).

## Status and evidence boundaries

This is a review and proposed acceptance contract, not an implementation or a claim that new capabilities have shipped. Live implementation state belongs in GitHub Issues/PRs, not in this document. The shipped `docs/PDR.md` is unchanged. When behavior changes, update that contract and its portfolio counterpart together.

The current main ref was read through authenticated GitHub access. The controller and manifest examined in the initial review remain the relevant implementation at this baseline. The release workflow was additionally inspected. Repository cloning failed because the execution environment could not resolve github.com; pnpm was unavailable. No Extension Host, browser, build, VSIX or runtime benchmark was executed. Existence of test scripts is not evidence of passing tests.

## Preserve the existing implementation

`src/editor.ts` uses `vscode.diff`, immutable virtual snapshots, bounded source sizes, retained left-side captures and explicit cleanup scheduling. It already handles multiple selections and unsaved document contents. Keep `SnapshotStore`, the content provider and existing label disambiguation rather than adding a second diff engine, file-backed history or clipboard watcher.

Source references: [controller](https://github.com/gvastethecreator/vscode-quick-diff/blob/b97994816109ea71794946ffb024c4b3f11d2a04/src/editor.ts), [manifest](https://github.com/gvastethecreator/vscode-quick-diff/blob/b97994816109ea71794946ffb024c4b3f11d2a04/package.json), [release workflow](https://github.com/gvastethecreator/vscode-quick-diff/blob/b97994816109ea71794946ffb024c4b3f11d2a04/.github/workflows/release.yml).

## Competitive decision

[Partial Diff](https://marketplace.visualstudio.com/items?itemName=ryu1kn.partial-diff), rechecked on the review date, documents one-action comparison of two visible editors and optional normalization. The useful gap is fewer steps, not a new rendering surface. Its broader normalization configurability is not a requirement to copy.

### Compare the two visible documents

Add an explicit `Compare Visible Editors` command. Resolve exactly two distinct eligible text-document URIs from visible editors, order them deterministically by editor column, and reuse the existing snapshot/open-comparison path. Exclude Quick Diff virtual documents and ambiguous diff/notebook/custom-editor contexts. Two panes displaying the same URI are not two different sources. With fewer or more than two eligible sources, reuse the existing picker rather than silently picking a pair.

The first release compares whole documents, including unsaved buffers. Selection-aware behavior already has separate commands and should not be guessed from incidental selections. Capture each document's text once when the operation is confirmed. Preserve existing labels, language IDs, capacity limits and soft/hard size approvals.

Touchpoints: `src/commands.ts`, `src/editor.ts`, `package.json`, existing core and host test suites. No new runtime dependency or persistent state is justified.

### Make the retained left side understandable and releasable

Add contextual inspection and clearing of the retained left capture, including origin and size without content previews. Use context keys to disable comparison when no left side exists. Clearing must release only the owner's retention, not invalidate snapshots that an open diff still retains. Provide an explicit swap action only when both snapshots of a known comparison are available; do not infer sources from unrelated active tabs. Retain language and label metadata after swapping. Do not add a permanent status-bar item or disk history.

### Conditional normalization

Keep normalization after the simpler workflow improvements. Establish concrete log examples first, then use a small set of fixed transformations on derived snapshots. Every transformed comparison must be labelled and have a path back to the untouched originals. Native whitespace options should not be duplicated. Arbitrary regex execution, eval, general AST comparison and lossy JSON-number canonicalization are out of scope. This is conditional work, not an accepted promise for the next release.

## Additional publication findings

The reviewed `github-release` job downloads an artifact but does not check out the repository, pass `--repo`, or set `GH_REPO` before invoking `gh release`. It also does not bind automatic tag creation to the verified source SHA. The CLI documentation states that repository context can be supplied with `GH_REPO` and that a missing tag otherwise defaults to the latest default-branch commit.

Required release contract: an explicit repository; an immutable source SHA exported by the verified preparation job; checksum verification at every publication consumer; a tag/ref check distinct from a release-existence check; and fail-closed handling of permission/network failures. An existing tag must not be moved or silently reused for another SHA. A partially completed publication must require deliberate recovery, not automatic deletion/recreation. Do not dispatch publication while testing this change.

The checked-in SHA256 sidecar currently provides a useful artifact but the shown consumer jobs do not explicitly verify it before publishing. Adding a checksum is not a substitute for binding the tag, package metadata and source revision to the same build. Keep the existing environment protections, artifact-only default and single verified VSIX flow.

References: [gh release create](https://cli.github.com/manual/gh_release_create), [GH_REPO](https://cli.github.com/manual/gh_help_environment).

## Required regression evidence

| Scenario | Observable outcome |
| --- | --- |
| Exactly two distinct visible text documents | One native diff, no selection dialog, deterministic left/right order. |
| Three visible sources or one URI in two panes | Explicit selection; no guessed pair. |
| Unsaved document edits | Snapshot contains the current buffer, not stale disk content. |
| Source warning/hard limit | Existing approvals and refusal boundaries remain effective. |
| Clear left with an open comparison | Owner retention is released; the open diff still renders. |
| Repeated capture, close, clear and reopen | Store count and retained entries return to their intended bounded state. |
| Normalized comparison | Label indicates transformation; literal originals remain available. |
| Missing tag, existing tag, mismatched tag, denied API, changed default branch | Release either uses the verified SHA or aborts; never retags. |
| Modified VSIX after checksum creation | Publication stops before calling a registry. |

Run the existing quality, desktop, web, VSIX inspection and installed-package suites on the intended toolchain. Record commit, editor version, fixture and artifact SHA256. Benchmark real cold activation and first action separately from module-load microbenchmarks, with a documented sample count and p50/p95. Measure runtime bundle bytes separately from screenshots and other distribution assets. No numerical performance result is asserted here.

## Deliberate exclusions

No custom diff renderer, webview, clipboard polling, content telemetry, cloud service, persistent source history, Git client, settings framework or mandatory shared portfolio runtime. Keep product UI text in English and pnpm as the package manager. Do not change engine requirements merely to broaden marketing claims without minimum-version tests.
