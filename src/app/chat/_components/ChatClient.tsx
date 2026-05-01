'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Send, ArrowLeft, FileText, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export interface Citation {
  ref: number;
  chunk_id: string;
  document_id: string;
  filename: string;
  page: number | null;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
}

interface Props {
  initialConversationId: string | null;
  initialMessages: ChatMessage[];
}

export default function ChatClient({ initialConversationId, initialMessages }: Props) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCitation, setOpenCitation] = useState<Citation | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;
    setError(null);
    setInput('');

    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();
    setMessages((curr) => [
      ...curr,
      { id: userMsgId, role: 'user', content: text, citations: [] },
      { id: assistantMsgId, role: 'assistant', content: '', citations: [] },
    ]);
    setStreaming(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, message: text }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events: event: <name>\ndata: <json>\n\n
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const evt of events) {
          const eventMatch = evt.match(/^event:\s*(\S+)/m);
          const dataMatch = evt.match(/^data:\s*(.+)$/m);
          if (!eventMatch || !dataMatch) continue;
          const name = eventMatch[1];
          let data: any;
          try { data = JSON.parse(dataMatch[1]); } catch { continue; }

          if (name === 'meta') {
            if (data.conversation_id && !conversationId) {
              setConversationId(data.conversation_id);
              window.history.replaceState(null, '', `/chat/${data.conversation_id}`);
            }
            const citations: Citation[] = data.chunks || [];
            setMessages((curr) => curr.map((m) => m.id === assistantMsgId ? { ...m, citations } : m));
          } else if (name === 'token') {
            setMessages((curr) => curr.map((m) =>
              m.id === assistantMsgId ? { ...m, content: m.content + (data.delta || '') } : m
            ));
          } else if (name === 'error') {
            throw new Error(data.error || 'Stream error');
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Chat failed');
      // Strip the empty assistant placeholder if request failed before any tokens.
      setMessages((curr) => curr.filter((m) => m.id !== assistantMsgId || m.content));
    } finally {
      setStreaming(false);
      router.refresh();
    }
  }, [input, streaming, conversationId, router]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-4 border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <div className="text-sm text-slate-500">{streaming ? 'Thinking…' : 'Ready'}</div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="card p-8 text-center">
              <h1 className="text-2xl font-bold mb-2">Ask a question</h1>
              <p className="text-slate-600">
                I'll search your uploaded documents and answer with inline citations.
              </p>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} onCitationClick={setOpenCitation} />
          ))}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white/80 backdrop-blur p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about your documents…"
            disabled={streaming}
            className="input"
          />
          <button type="submit" disabled={streaming || !input.trim()} className="btn-primary">
            {streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </form>

      {openCitation && <CitationDialog citation={openCitation} onClose={() => setOpenCitation(null)} />}
    </div>
  );
}

function MessageBubble({ message, onCitationClick }: {
  message: ChatMessage; onCitationClick: (c: Citation) => void;
}) {
  const isUser = message.role === 'user';

  // Replace [^chunk-N] markers with clickable spans rendered inline.
  const rendered = renderWithCitations(message.content, message.citations, onCitationClick);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${isUser ? 'bg-brand-600 text-white' : 'card'} rounded-2xl px-5 py-3`}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none">{rendered}</div>
        )}
      </div>
    </div>
  );
}

const CITE_REGEX = /\[\^(?:chunk-)?(\d+)\]/g;

function renderWithCitations(
  text: string,
  citations: Citation[],
  onClick: (c: Citation) => void
): React.ReactNode {
  const lookup = new Map<number, Citation>(citations.map((c) => [c.ref, c]));
  const transformed = text.replace(CITE_REGEX, (_, n) =>
    lookup.has(Number(n)) ? `[${n}](#cite-${n})` : ''
  );
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        a: ({ href, children }) => {
          const m = href?.match(/^#cite-(\d+)$/);
          if (!m) return <a href={href}>{children}</a>;
          const c = lookup.get(Number(m[1]));
          if (!c) return null;
          return (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); onClick(c); }}
              className="citation"
              aria-label={`Citation ${m[1]}: ${c.filename}${c.page ? `, page ${c.page}` : ''}`}
            >
              {m[1]}
            </button>
          );
        },
      }}
    >
      {transformed}
    </ReactMarkdown>
  );
}

function CitationDialog({ citation, onClose }: { citation: Citation; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-6 z-50" onClick={onClose}>
      <div className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <FileText size={18} className="text-brand-600" />
          <h3 className="font-bold">{citation.filename}</h3>
        </div>
        {citation.page && <p className="text-xs text-slate-500 mb-3">Page {citation.page}</p>}
        {citation.snippet && (
          <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded border border-slate-200 italic">
            …{citation.snippet}…
          </p>
        )}
        <button onClick={onClose} className="btn-secondary mt-4 w-full">Close</button>
      </div>
    </div>
  );
}
