export interface Chunk {
  page: number | null;
  position: number;
  content: string;
}

interface ChunkOpts {
  /** Approximate target size in characters (~750 chars ≈ 200 tokens). */
  targetSize?: number;
  /** Overlap between chunks in characters. */
  overlap?: number;
}

/**
 * Splits raw text into chunks, preserving page boundaries when possible.
 * Input may be a single string or array of pages (one entry per page).
 */
export function chunkText(input: string | string[], opts: ChunkOpts = {}): Chunk[] {
  const targetSize = opts.targetSize ?? 750;
  const overlap = opts.overlap ?? 100;

  const pages: string[] = Array.isArray(input) ? input : [input];
  const chunks: Chunk[] = [];
  let position = 0;

  pages.forEach((pageText, pageIdx) => {
    const normalized = pageText.replace(/\s+/g, ' ').trim();
    if (!normalized) return;

    let i = 0;
    while (i < normalized.length) {
      const end = Math.min(i + targetSize, normalized.length);
      // Try to end on a sentence boundary if we're not at the very end.
      let cut = end;
      if (end < normalized.length) {
        const lastPeriod = normalized.lastIndexOf('. ', end);
        if (lastPeriod > i + targetSize / 2) cut = lastPeriod + 1;
      }
      const slice = normalized.slice(i, cut).trim();
      if (slice) {
        chunks.push({
          page: Array.isArray(input) ? pageIdx + 1 : null,
          position: position++,
          content: slice,
        });
      }
      if (cut >= normalized.length) break;
      i = Math.max(cut - overlap, i + 1);
    }
  });

  return chunks;
}
