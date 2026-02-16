export function createBlobUrl(blob: Blob): string | undefined {
  try {
    if (typeof URL === "undefined") return undefined;
    if (typeof URL.createObjectURL !== "function") return undefined;
    return URL.createObjectURL(blob);
  } catch {
    return undefined;
  }
}

