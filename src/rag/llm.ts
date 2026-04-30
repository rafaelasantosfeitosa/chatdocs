import OpenAI from 'openai';
import type { RetrievedChunk } from './retriever';

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': 'ChatDocs',
  },
});

const MODEL = process.env.LLM_MODEL || 'anthropic/claude-3.5-sonnet';
const FALLBACK = process.env.LLM_FALLBACK_MODEL || 'openai/gpt-4o-mini';

const SYSTEM_PROMPT = `You are ChatDocs, an assistant that answers questions strictly based on the provided document chunks.

Rules:
1. Use ONLY the chunks below. If the answer is not in them, say "I don't see this in your documents."
2. Cite chunks inline using the format [^chunk-N] right after the claim, where N is the chunk number.
3. Multiple citations: [^chunk-1][^chunk-2]. Be precise — only cite chunks that actually support the claim.
4. Be concise. No preamble. No "Based on the documents..." filler.`;

interface BuildPromptInput {
  question: string;
  chunks: RetrievedChunk[];
  history: { role: 'user' | 'assistant'; content: string }[];
}

export function buildMessages({ question, chunks, history }: BuildPromptInput) {
  const context = chunks
    .map((c, i) => `[chunk-${i + 1}] (source: "${c.filename}"${c.page ? `, p.${c.page}` : ''})\n${c.content}`)
    .join('\n\n');

  return [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'system' as const, content: `Document chunks:\n\n${context}` },
    ...history,
    { role: 'user' as const, content: question },
  ];
}

/**
 * Streams completion. Falls back to a cheaper model on 5xx/429 from primary.
 */
export async function streamCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
) {
  try {
    return await client.chat.completions.create({
      model: MODEL,
      messages,
      stream: true,
      temperature: 0.2,
    });
  } catch (err: any) {
    const code = err?.status;
    if (code === 429 || (code && code >= 500)) {
      console.warn(`Primary model ${MODEL} failed (${code}), falling back to ${FALLBACK}`);
      return await client.chat.completions.create({
        model: FALLBACK,
        messages,
        stream: true,
        temperature: 0.2,
      });
    }
    throw err;
  }
}

/** Parse [^chunk-N] markers from model output to resolve citations. */
export function extractCitedIndices(text: string): number[] {
  const matches = text.matchAll(/\[\^chunk-(\d+)\]/g);
  const set = new Set<number>();
  for (const m of matches) set.add(parseInt(m[1], 10));
  return [...set].sort((a, b) => a - b);
}
