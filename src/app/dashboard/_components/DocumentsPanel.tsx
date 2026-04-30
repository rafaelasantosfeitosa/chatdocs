'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Trash2, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Doc {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  num_pages: number | null;
  bytes: number | null;
  created_at: string;
}

export default function DocumentsPanel({ initialDocuments }: { initialDocuments: Doc[] }) {
  const router = useRouter();
  const [documents, setDocuments] = useState<Doc[]>(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/documents/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Upload failed (${res.status})`);
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this document and all its embeddings?')) return;
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setDocuments((curr) => curr.filter((d) => d.id !== id));
    } else {
      alert('Delete failed');
    }
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Documents</h2>
        <label className="btn-primary text-sm cursor-pointer">
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? 'Uploading…' : 'Upload PDF'}
          <input
            type="file"
            accept="application/pdf"
            disabled={uploading}
            onChange={handleUpload}
            className="hidden"
          />
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">{error}</div>
      )}

      {documents.length === 0 ? (
        <p className="text-sm text-slate-500">No documents yet. Upload a PDF to start.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {documents.map((d) => (
            <li key={d.id} className="py-3 flex items-center gap-3">
              <FileText size={18} className="text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{d.filename}</div>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                  <StatusBadge status={d.status} />
                  {d.num_pages && <span>{d.num_pages} pages</span>}
                  {d.bytes && <span>{(d.bytes / 1024 / 1024).toFixed(1)} MB</span>}
                </div>
              </div>
              <button
                onClick={() => handleDelete(d.id)}
                className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: Doc['status'] }) {
  if (status === 'ready')   return <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 size={12} /> ready</span>;
  if (status === 'failed')  return <span className="inline-flex items-center gap-1 text-red-700"><AlertTriangle size={12} /> failed</span>;
  return <span className="inline-flex items-center gap-1 text-slate-600"><Loader2 size={12} className="animate-spin" /> {status}</span>;
}
