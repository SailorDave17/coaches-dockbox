# ADR 006 — Alerts go by Web Push and email; SMS arrives before LTS
- Status: accepted 2026-09-29 (charter ratified) · Phases 3, 6
- **Context**: "never push alone" (forge-idea); MAAPP copying rules; the ceiling.
- **Options**: **Web Push (VAPID) from an Edge Function** — free, no third party holds device tokens;
  **FCM** — free, one path for a later native app, adds a Google project; **OneSignal** — free,
  dashboard send, a third party holds the device list. SMS: **defer** vs **Twilio from day one**
  ($0.0083/segment + carrier fees, $1.15/month number, 10DLC registration — the 10DLC fees partly from
  secondary sources).
- **Decision**: Web Push + email for the pilot; Twilio SMS before LTS joins.
- **Consequences**: per-recipient delivery status is recorded so the health check sees failures.
- **Ceiling and next move**: ~2,500 deliveries per alert at design load → batched sends in the
  function; SMS added for urgent alerts.
- **Kill condition**: in the pilot, a weather alert fails to reach every family by push or email within
  15 minutes → bring SMS forward.
