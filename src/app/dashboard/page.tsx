import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { UserButton } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import { FileText, MessageSquare, Crown } from 'lucide-react';
import { pool, ensureUser } from '@/db/client';
import { getUserUsage } from '@/lib/usage';
import DocumentsPanel from './_components/DocumentsPanel';
import UpgradeButton from './_components/UpgradeButton';

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/');
  await ensureUser(userId, null);

  const usage = await getUserUsage(userId);
  const docsRes = await pool.query(
    `SELECT id, filename, status, num_pages, bytes, created_at, ready_at
     FROM documents WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  const documents = docsRes.rows;

  const convsRes = await pool.query(
    `SELECT id, title, created_at FROM conversations
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [userId]
  );
  const conversations = convsRes.rows;

  return (
    <main className="min-h-screen px-6 py-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-violet-600 flex items-center justify-center">
            <FileText size={18} className="text-white" />
          </div>
          <span className="font-bold text-lg">ChatDocs</span>
        </Link>
        <UserButton />
      </header>

      <section className="grid sm:grid-cols-3 gap-3 mb-8">
        <div className="card p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">Plan</div>
          <div className="text-2xl font-bold mt-1.5 capitalize flex items-center gap-2">
            {usage.plan} {usage.plan === 'pro' && <Crown size={18} className="text-amber-500" />}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">Queries this month</div>
          <div className="text-2xl font-bold mt-1.5">
            {usage.monthlyQueries}
            <span className="text-base font-normal text-slate-500"> / {usage.limit ?? '∞'}</span>
          </div>
        </div>
        <div className="card p-5 flex items-center justify-center">
          {usage.plan === 'free' ? <UpgradeButton /> : (
            <Link href="/api/billing/portal" className="text-sm text-slate-600 hover:underline">
              Manage subscription →
            </Link>
          )}
        </div>
      </section>

      <DocumentsPanel initialDocuments={documents} />

      <section className="card p-5 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Conversations</h2>
          <Link href="/chat" className="btn-primary text-sm">
            <MessageSquare size={14} /> New chat
          </Link>
        </div>
        {conversations.length === 0 ? (
          <p className="text-sm text-slate-500">No conversations yet. Upload a document and start chatting.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link href={`/chat/${c.id}`} className="block py-3 hover:bg-slate-50/60 px-2 rounded">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{new Date(c.created_at).toLocaleString()}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
