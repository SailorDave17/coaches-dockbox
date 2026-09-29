# ADR 002 — Medical flags are reachable only through one Edge Function, encrypted in the app — THE BET
- Status: accepted 2026-09-29 (charter ratified) · Phases 4, 6
- **Context**: the owner chose field encryption + DB-enforced access + a view log (4.2). Supabase "does
  not recommend" pgsodium / TCE ("high level of operational complexity and misconfiguration risk") and
  says at-rest encryption "likely is sufficient"; Vault is for secrets, not columns (*measured* 2026-09-29).
- **Options**: **one Edge Function** (RLS denies the table to all client roles; the function checks
  membership, logs, decrypts); **at-rest only + RLS + log** (simpler; a stolen backup or leaked
  service-role key exposes the flags); **keep medical out** (the fallback).
- **Decision**: one Edge Function, app-level encryption, key in Edge Function secrets.
- **Consequences**: the view log and the device-cache feed come from the same function; a client bug
  cannot reach the table; the function is the single dependency of every emergency card.
- **Ceiling and next move**: not load-bound at this scale. Key rotation is manual for a solo operator →
  written into the runbook.
- **Kill condition — the bet**: `security-audit` or the second reviewer finds an unresolved access gap
  on medical data before go-live, or consent is not confirmed. **Fallback**: ship the pilot with
  contacts only; medical stays in Clubspot / paper cards.
