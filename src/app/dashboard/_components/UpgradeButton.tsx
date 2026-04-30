'use client';

import { useState } from 'react';
import { Crown } from 'lucide-react';

export default function UpgradeButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      else alert(json.error || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={handleClick} disabled={loading} className="btn-primary text-sm">
      <Crown size={14} /> {loading ? 'Redirecting…' : 'Upgrade to Pro — $19/mo'}
    </button>
  );
}
