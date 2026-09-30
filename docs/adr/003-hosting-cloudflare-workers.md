# ADR 003 — Cloudflare Workers static assets host the app
- Status: accepted 2026-09-29 (charter ratified) · Phase 6
- **Context**: HSC is not personal use; ceiling $40.
- **Options** (*measured* 2026-09-29): **Workers** — static-asset requests free and unlimited, 100k
  dynamic requests/day free, Paid from $5; no commercial restriction found; owner knows Cloudflare.
  **Pages** — known from madcowsailing but "legacy" (cairn note, 2026-09-27). **Vercel** — Hobby is
  "personal, non-commercial"; Pro $20 per seat breaks the ceiling.
- **Decision**: Workers static assets on a new owner-registered domain (8.1).
- **Consequences**: the domain must be a Cloudflare zone; passkeys and Resend bind to it — pick it once.
- **Domain** (#23, registered 2026-09-30): **`coachesdockbox.com`**, and it is **sticky**. It is the
  passkey RP ID and the Resend sending parent: a passkey made under it does not work under another
  name, and another name means verifying sending again. It is spelled *coaches*, unlike the product
  (Coach's Dockbox) and the slug (`coachs-dockbox`). That was the owner's choice, to match how the
  name is said aloud; neither spelling is a typo of the other. *Measured* 2026-09-30: registered
  through Cloudflare Registrar at cost ($10.46/yr, auto-renew on, expires 2027-09-30). Verisign RDAP
  names Cloudflare, Inc. and `dell`/`lars.ns.cloudflare.com`, and the zone is Active on the Free plan.
- **Handover**: the owner's Cloudflare account also holds unrelated domains, so this domain cannot
  go to HSC with the account. It moves alone, by Cloudflare's move between accounts: at least 10
  days after registration, with DNSSEC off, and after the zone is added to HSC's account. WHOIS
  contacts move with it; DNS records and zone settings do not, and a 30-day transfer lock follows
  (developers.cloudflare.com, `registrar/account-options/inter-account-transfer`, 2026-04-24).
- **Ceiling and next move**: 100k dynamic requests/day (the app is almost entirely static) → Workers Paid $5.
- **Kill condition**: Cloudflare restricts free-plan use by organisations, or Workers static assets
  cannot serve the PWA's service worker correctly.
