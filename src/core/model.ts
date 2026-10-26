export type SnapshotSourceKind = "selection" | "clipboard" | "document";

export interface SnapshotInput {
  readonly text: string;
  readonly label: string;
  readonly languageId?: string;
  readonly sourceKind: SnapshotSourceKind;
}

export interface TextSnapshot extends SnapshotInput {
  readonly id: string;
  readonly createdAt: number;
}

export interface OffsetSelection {
  readonly anchor: number;
  readonly active: number;
}

export interface OffsetRange {
  readonly start: number;
  readonly end: number;
}

export type SelectionTextResult =
  | {
      readonly ok: true;
      readonly text: string;
      readonly ranges: readonly OffsetRange[];
    }
  | { readonly ok: false; readonly reason: "empty-selection" | "invalid-selection" };

export interface DocumentLabelInput {
  readonly key: string;
  readonly basename: string;
  readonly workspaceRelative?: string;
  readonly scheme: string;
}

export interface DocumentLabel {
  readonly key: string;
  readonly label: string;
  readonly description?: string;
}

export type QuickDiffRejection =
  | "no-editor"
  | "empty-selection"
  | "invalid-selection"
  | "empty-clipboard"
  | "missing-left"
  | "source-too-large"
  | "snapshot-capacity"
  | "not-enough-open-documents"
  | "invalid-command-arguments"
  | "operation-failed";
