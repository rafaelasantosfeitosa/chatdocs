const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.EMBEDDING_MODEL || 'gemini-embedding-001';
const DIM = 768;

type TaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

async function embedOne(text: string, taskType: TaskType): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: DIM,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini embed ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { embedding: { values: number[] } };
  return json.embedding.values;
}

export async function embedTexts(
  texts: string[],
  taskType: TaskType = 'RETRIEVAL_DOCUMENT'
): Promise<number[][]> {
  if (!texts.length) return [];
  const CONCURRENCY = 5;
  const out: number[][] = new Array(texts.length);
  for (let i = 0; i < texts.length; i += CONCURRENCY) {
    const slice = texts.slice(i, i + CONCURRENCY);
    const results = await Promise.all(slice.map((t) => embedOne(t, taskType)));
    for (let j = 0; j < results.length; j++) out[i + j] = results[j];
  }
  return out;
}

export async function embedQuery(query: string): Promise<number[]> {
  const [v] = await embedTexts([query], 'RETRIEVAL_QUERY');
  return v;
}

/** Format a number[] vector as the literal pgvector textual form. */
export function toPgVector(v: number[]): string {
  return `[${v.join(',')}]`;
}
