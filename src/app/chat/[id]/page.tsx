import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { pool } from '@/db/client';
import ChatClient, { type ChatMessage } from '../_components/ChatClient';

export default async function ChatPage({ params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) redirect('/');

  const conv = await pool.query('SELECT id FROM conversations WHERE id = $1 AND user_id = $2', [params.id, userId]);
  if (!conv.rows[0]) notFound();

  const msgs = await pool.query<{
    id: string; role: 'user' | 'assistant'; content: string; citations: any;
  }>(
    `SELECT id, role, content, citations FROM messages
       WHERE conversation_id = $1 AND role IN ('user','assistant')
       ORDER BY created_at ASC`,
    [params.id]
  );
  const initialMessages: ChatMessage[] = msgs.rows.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    citations: m.citations || [],
  }));

  return <ChatClient initialConversationId={params.id} initialMessages={initialMessages} />;
}
