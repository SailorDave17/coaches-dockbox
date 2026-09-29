# ADR 012 — The roster comes from Clubspot's API, with a CSV fallback from 2027-02-01
- Status: accepted 2026-09-29 (charter ratified) · Phase 3
- **Context**: the owner chose the API (3.3); the key must be requested by another HSC admin (3.5).
- **Options** (*measured* api.theclubspot.com, 2026-09-29): **API** — key by request, club-scoped,
  server-side only; `GET camp-registrations` read-only; participant names, email, mobile, primary +
  secondary guardian contacts; no medical, no birthdate, no webhooks. **CSV import** — manual per
  season; the export carries medical, insurance and address columns. **Hand entry**.
- **Decision**: the API via a scheduled Edge Function; CSV import with a column whitelist if no key by
  2027-02-01.
- **Consequences**: the API is privacy-favourable (it cannot carry the sensitive columns); parents supply
  birth year and medical flags.
- **Ceiling and next move**: undocumented rate limits → poll no more than hourly.
- **Kill condition**: no key by 2027-02-01 → CSV import becomes the pilot's path.
