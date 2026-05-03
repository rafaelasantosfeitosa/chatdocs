# Custom Domain Setup — ChatDocs on Vercel

Guide for connecting a custom domain to the ChatDocs Next.js app deployed on Vercel (Hobby plan, project `prj_4y0zRCpo2mbHJF3CPwqimE32Ru6S`).

## 1. Domain naming suggestions

Short, brandable, RAG-flavored. Check live availability before buying — these are ideas, not reservations.

| Idea | Length | Vibe |
|---|---|---|
| `chatdocs.app` | 12 | exact match, dev-friendly TLD |
| `askpdf.app` | 10 | clear value prop |
| `docq.app` | 7 | minimalist, memorable |
| `pdfchat.io` | 10 | startup classic |
| `lerai.app` | 9 | "ler" = read in PT-BR, bilingual hook |

Tip: `.app` and `.dev` force HTTPS (HSTS preload) — good signal for a portfolio piece.

## 2. Where to buy

| Registrar | .com (yr 1 / renew) | .app (yr 1 / renew) | WHOIS privacy | Notes |
|---|---|---|---|---|
| **Porkbun** | ~$10 / ~$11 | ~$14 / ~$14 | Free | No bait pricing. Best value. |
| Namecheap | ~$6 / ~$15 | ~$15 / ~$20 | Free | Cheap year 1, painful renewal. |
| Vercel Domains | ~$20 / ~$20 | ~$18 / ~$18 | Free | Auto-configures DNS, costs more. |

**Recommendation: Porkbun.** Honest renewal pricing, free WHOIS privacy, clean DNS UI. Vercel Domains is convenient but ~2x the price over 3 years.

## 3. DNS setup on Porkbun

Buy domain → Porkbun dashboard → **Domain Management** → **DNS** for your domain.

### a) Apex (`chatdocs.app`)

| Type | Host | Answer | TTL |
|---|---|---|---|
| A | (blank or `@`) | `76.76.21.21` | 600 |
| AAAA *(optional)* | (blank or `@`) | `2606:4700:90:0:f22e:fbec:5bed:a9b9` | 600 |

Delete any default `ALIAS`/`A` records Porkbun added.

### b) `www` subdomain

| Type | Host | Answer | TTL |
|---|---|---|---|
| CNAME | `www` | `cname.vercel-dns.com.` | 600 |

**Propagation:** typically <1 hour for fresh records, up to 48h worst case. Check with `nslookup chatdocs.app` or `dig chatdocs.app`.

## 4. Vercel side config

1. Vercel dashboard → project **chatdocs** → **Settings** → **Domains**.
2. Click **Add**, type `chatdocs.app`, submit.
3. Repeat for `www.chatdocs.app`. Vercel will ask which one is primary — pick apex (`chatdocs.app`), it auto-redirects `www` → apex.
4. Vercel polls DNS; once it resolves, status flips to **Valid Configuration** and Let's Encrypt SSL provisions automatically (1–5 min). No manual cert work.

## 5. Post-setup tasks

- Update env var: `NEXT_PUBLIC_APP_URL=https://chatdocs.app` in Vercel → Settings → Environment Variables (Production + Preview), then redeploy.
- Update Clerk allowed origins / redirect URLs to include the new domain.
- Update Stripe webhook endpoint URL.
- Decide canonical URL: keep custom domain primary, let `*.vercel.app` 308-redirect (Vercel default).
- Add `chatdocs.app` to Google Search Console for SEO.

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Vercel shows "Invalid Configuration" | DNS not propagated yet | Wait 15 min, recheck. Use `dig +short chatdocs.app` to confirm `76.76.21.21`. |
| SSL stuck on "Misconfigured" | Cert can't issue until DNS resolves to Vercel | Same as above — DNS first, cert follows. |
| Site loads on `www` but not apex | Missing or wrong A record | Confirm A record on `@`, not `www`. |
| 526/525 errors via Cloudflare | CF proxy (orange cloud) intercepting | Set CF record to **DNS Only** (grey cloud). Vercel handles SSL — don't double-proxy. |
| Browser shows old IP | Local DNS cache | `ipconfig /flushdns` (Windows) or restart browser. |
| Email broken after switching | DNS migration killed MX records | Re-add MX records at new registrar before flipping nameservers. |

---

Saved to `C:/Users/rafae/git/chatdocs/docs/CUSTOM_DOMAIN.md`.
