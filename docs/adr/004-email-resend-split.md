# ADR 004 — Resend: custom SMTP for sign-in links, broadcasts for alerts
- Status: accepted 2026-09-29 (charter ratified) · Phases 6, 8
- **Context**: Supabase's built-in mailer sends 2 emails/hour (*measured*); $15 left after Supabase.
- **Options** (*measured* 2026-09-29): **Resend split** — transactional free 100/day, 3,000/month;
  broadcasts free and unlimited to ≤1,000 contacts, with dashboard compose (the 5.2 outage path).
  **Amazon SES** — $0.10 per 1,000, no minimum, no compose dashboard; sandbox exit is an AWS request
  (*reasoned*). **Resend Pro** — $20/month; breaks the ceiling.
- **Decision**: Resend split; alerts go as per-program broadcasts.
- **Consequences**: broadcasts carry an unsubscribe link, so a parent who unsubscribes still needs push;
  onboarding is staggered across days above ~50 families.
- **Ceiling and next move**: 100 transactional/day and 1,000 contacts → Resend Pro once HSC pays.
- **Kill condition**: broadcasts cannot be triggered by API for a segment, or deliverability to family
  inboxes proves poor in the pilot.
