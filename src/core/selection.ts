import {
  type OffsetRange,
  type OffsetSelection,
  type SelectionTextResult,
} from "./model.ts";

export function collectSelectionText(
  source: string,
  selections: readonly OffsetSelection[],
  eol: "\n" | "\r\n",
): SelectionTextResult {
  if (selections.length === 0) return { ok: false, reason: "empty-selection" };

  const ordered: OffsetRange[] = [];
  for (const selection of selections) {
    const start = Math.min(selection.anchor, selection.active);
    const end = Math.max(selection.anchor, selection.active);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end > source.length) {
      return { ok: false, reason: "invalid-selection" };
    }
    if (start === end) return { ok: false, reason: "empty-selection" };
    ordered.push({ start, end });
  }
  ordered.sort((left, right) => left.start - right.start || left.end - right.end);

  const normalized: OffsetRange[] = [];
  for (const range of ordered) {
    const previous = normalized.at(-1);
    if (previous && range.start < previous.end) {
      normalized[normalized.length - 1] = {
        start: previous.start,
        end: Math.max(previous.end, range.end),
      };
    } else {
      normalized.push(range);
    }
  }

  return {
    ok: true,
    ranges: normalized,
    text: normalized.map((range) => source.slice(range.start, range.end)).join(eol),
  };
}
