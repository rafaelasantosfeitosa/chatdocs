import Link from 'next/link';
import { FileText, Zap, Quote, Lock, ArrowRight } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';

export default function Home() {
  return (
    <main className="min-h-screen">
      <nav className="px-6 py-5 max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-violet-600 flex items-center justify-center">
            <FileText size={18} className="text-white" />
          </div>
          <span className="font-bold text-lg">ChatDocs</span>
        </Link>
        <div className="flex items-center gap-3">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="text-sm text-slate-600 hover:text-slate-900">Sign in</button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900">Dashboard</Link>
            <UserButton />
          </SignedIn>
        </div>
      </nav>

      <section className="px-6 pt-12 pb-20 max-w-4xl mx-auto text-center">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-brand-50 text-brand-700 border border-brand-100 mb-6">
          RAG SaaS · streaming · cited answers
        </span>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight bg-gradient-to-br from-slate-900 to-slate-600 bg-clip-text text-transparent">
          Chat with your<br />documents.
        </h1>
        <p className="text-lg text-slate-600 mt-6 max-w-2xl mx-auto">
          Upload PDFs. Ask anything. Get answers grounded in your sources, with inline citations
          to the exact page. No hallucinations. No copy-paste.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-10">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn-primary">Get started free <ArrowRight size={16} /></button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="btn-primary">Open dashboard <ArrowRight size={16} /></Link>
          </SignedIn>
        </div>
        <p className="mt-6 text-sm text-slate-500">Free plan: 10 queries/month. Pro: $19/mo unlimited.</p>
      </section>

      <section className="px-6 pb-20 max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Feature icon={<Quote size={20} />}    title="Inline citations"     desc="Every answer cites the source chunk by document and page." />
        <Feature icon={<Zap size={20} />}      title="Streaming responses"  desc="Token-by-token via SSE. No 5-second wait staring at a spinner." />
        <Feature icon={<Lock size={20} />}     title="Tenant-isolated"      desc="Every chunk is scoped to your user_id at the database layer." />
        <Feature icon={<FileText size={20} />} title="pgvector at the core" desc="HNSW index on Postgres. Sub-100ms retrieval up to 1M vectors." />
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        Next.js · pgvector · Gemini · Stripe · Clerk
      </footer>
    </main>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card p-5">
      <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center mb-3">{icon}</div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-slate-600 mt-1">{desc}</p>
    </div>
  );
}
