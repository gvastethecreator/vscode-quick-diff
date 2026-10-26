export const WARNING_SOURCE_BYTES = 2 * 1024 * 1024;
export const MAXIMUM_SOURCE_BYTES = 16 * 1024 * 1024;

export interface SourceSizeAssessment {
  readonly bytes: number;
  readonly level: "safe" | "warning" | "blocked";
}

export function assessSourceSize(text: string): SourceSizeAssessment {
  const bytes = utf8ByteLength(text);
  const level = bytes > MAXIMUM_SOURCE_BYTES
    ? "blocked"
    : bytes > WARNING_SOURCE_BYTES
      ? "warning"
      : "safe";
  return { bytes, level };
}

export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const low = text.charCodeAt(index + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) bytes += 3;
    else bytes += 3;
  }
  return bytes;
}
