import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';

/** Embed a batch of texts. Returns vectors aligned to the input order. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  // OpenAI accepts up to 2048 inputs per request; we batch defensively.
  const BATCH = 96;
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const r = await openai.embeddings.create({ model: MODEL, input: slice });
    for (const e of r.data) all.push(e.embedding);
  }
  return all;
}

export async function embedQuery(query: string): Promise<number[]> {
  const [v] = await embedTexts([query]);
  return v;
}

/** Format a number[] vector as the literal pgvector textual form. */
export function toPgVector(v: number[]): string {
  return `[${v.join(',')}]`;
}
