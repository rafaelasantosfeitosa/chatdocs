import { GoogleGenerativeAI } from '@google/generative-ai';
import type { RetrievedChunk } from './retriever';

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const MODEL = process.env.LLM_MODEL || 'gemini-2.5-flash-lite';

const SYSTEM_PROMPT = `You are ChatDocs, an assistant that answers questions strictly based on the provided document chunks.

Rules:
1. Use ONLY the chunks below. If the answer is not in them, say "I don't see this in your documents."
2. Cite chunks inline using the format [^chunk-N] right after the claim, where N is the chunk number.
3. Multiple citations: [^chunk-1][^chunk-2]. Be precise — only cite chunks that actually support the claim.
4. Be concise. No preamble. No "Based on the documents..." filler.`;

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

interface BuildPromptInput {
  question: string;
  chunks: RetrievedChunk[];
  history: ChatMessage[];
}

interface PreparedPrompt {
  systemInstruction: string;
  history: { role: 'user' | 'model'; parts: { text: string }[] }[];
  userMessage: string;
}

export function buildMessages({ question, chunks, history }: BuildPromptInput): PreparedPrompt {
  const context = chunks
    .map((c, i) => `[chunk-${i + 1}] (source: "${c.filename}"${c.page ? `, p.${c.page}` : ''})\n${c.content}`)
    .join('\n\n');

  const systemInstruction = `${SYSTEM_PROMPT}\n\nDocument chunks:\n\n${context}`;

  const mappedHistory = history.map((m) => ({
    role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: m.content }],
  }));

  return { systemInstruction, history: mappedHistory, userMessage: question };
}

/** Streams completion from Gemini. Yields text deltas. */
export async function* streamCompletion(prepared: PreparedPrompt): AsyncGenerator<string> {
  const model = genai.getGenerativeModel({
    model: MODEL,
    systemInstruction: prepared.systemInstruction,
    generationConfig: { temperature: 0.2 },
  });
  const chat = model.startChat({ history: prepared.history });
  const result = await chat.sendMessageStream(prepared.userMessage);
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

/** Parse [^chunk-N] markers from model output to resolve citations. */
export function extractCitedIndices(text: string): number[] {
  const matches = text.matchAll(/\[\^chunk-(\d+)\]/g);
  const set = new Set<number>();
  for (const m of matches) set.add(parseInt(m[1], 10));
  return [...set].sort((a, b) => a - b);
}
