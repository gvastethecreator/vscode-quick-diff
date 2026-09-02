import { type DocumentLabel, type DocumentLabelInput } from "./model.ts";

const MAX_LABEL_LENGTH = 96;

export function buildDocumentLabels(inputs: readonly DocumentLabelInput[]): readonly DocumentLabel[] {
  const prepared = inputs.map((input) => ({
    ...input,
    basename: cleanLabel(input.basename) || "Untitled",
    relative: cleanRelative(input.workspaceRelative),
    scheme: cleanLabel(input.scheme) || "document",
  }));
  const basenameCounts = new Map<string, number>();
  for (const item of prepared) {
    const key = item.basename.toLocaleLowerCase("en-US");
    basenameCounts.set(key, (basenameCounts.get(key) ?? 0) + 1);
  }

  const preliminary = prepared.map((item) => {
    const duplicate = (basenameCounts.get(item.basename.toLocaleLowerCase("en-US")) ?? 0) > 1;
    const label = duplicate && item.relative && item.relative !== item.basename
      ? item.relative
      : item.basename;
    const description = item.relative && item.relative !== label
      ? item.relative
      : item.scheme !== "file"
        ? item.scheme
        : undefined;
    return { key: item.key, label, description };
  });

  const labelCounts = new Map<string, number>();
  for (const item of preliminary) {
    const key = item.label.toLocaleLowerCase("en-US");
    labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1);
  }
  const occurrences = new Map<string, number>();
  return preliminary.map((item) => {
    const key = item.label.toLocaleLowerCase("en-US");
    if ((labelCounts.get(key) ?? 0) <= 1) return item;
    const occurrence = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, occurrence);
    return { ...item, label: `${item.label} (${occurrence})` };
  });
}

export function buildDiffTitle(left: string, right: string): string {
  return `${cleanLabel(left) || "Left"} ↔ ${cleanLabel(right) || "Right"}`;
}

function cleanLabel(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, MAX_LABEL_LENGTH);
}

function cleanRelative(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.replaceAll("\\", "/");
  if (normalized.startsWith("/") || /^[A-Za-z]:\//u.test(normalized) || normalized.includes("://")) {
    return undefined;
  }
  const cleaned = cleanLabel(normalized);
  return cleaned || undefined;
}
