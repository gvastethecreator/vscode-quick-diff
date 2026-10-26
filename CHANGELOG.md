# Changelog

## [Unreleased]

- Fixed: the editor context menu command no longer fails with an arguments error.
- Fixed: Escape closes the temporary diff only when the diff editor has focus and no selection, widget, or snippet is active.
- Fixed: closed diff tabs release their snapshots at once, so the snapshot limit no longer blocks new comparisons.
- Fixed: swapping a temporary comparison keeps it in the same editor group.
- Compare Visible Editors captures exactly two distinct whole text buffers, including unsaved edits. Only active plain text tabs in visible groups are eligible. Columns determine left and right; more than two candidates require an explicit two-document choice. Inspect Left Capture shows its origin label, UTF-8 size and capture time. Clear Left Capture releases it. Swap Comparison Sides operates only on a comparison whose snapshots belong to Quick Diff.

## 0.1.0 — 2026-09-02

- Added five native diff workflows for selections, clipboard text, in-memory buffers, and open text documents.
- Added bounded, expiring, memory-only virtual snapshots with content-independent URIs.
- Added exact multi-selection handling, safe labels, language propagation, and large-source safeguards.
- Added desktop, browser, minimum-version, packaged-VSIX, performance, media, and archive inspection gates.
- Replaced placeholder media with a transparent Imagegen icon and a real packaged-extension runtime preview.
