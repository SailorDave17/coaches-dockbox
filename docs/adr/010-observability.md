# ADR 010 — Sentry free for exceptions, a scheduled health check for silent failures
- Status: accepted 2026-09-29 (charter ratified) · Phase 5
- **Options** (*measured* 2026-09-29): **Sentry Developer** — 1 user, 5k errors/month, 30-day lookback,
  email alerts; **health check only** — no third party, crashes unseen.
- **Decision**: both; Sentry receives nothing personal (scrubbed before send).
- **Ceiling and next move**: 5k errors/month → sample, or Team $26 once HSC pays.
- **Kill condition**: the scrubbing cannot be verified to strip medical fields → drop Sentry, keep the
  health check.
