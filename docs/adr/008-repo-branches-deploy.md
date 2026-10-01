# ADR 008 — New repo `coaches-dockbox`; develop / release / main; auto-deploy on release
- Status: accepted 2026-09-29 (charter ratified) · Phases 6, 8
- **Context**: cohssa-attendance's Sheet architecture and names-only policy cannot carry this.
- **Options**: **new repo** (clean; salvage copied in); **evolve cohssa-attendance** (keeps history, but
  every settled decision inverts).
- **Decision**: new repo; the workspace branch model (owner directive 2026-09-01) with the house
  `githooks/pre-push`; CI deploys the Worker and applies migrations on merge to `release`.
  cohssa-attendance is **archived** at its own gate, and `policies/cohssa-minor-data-handling.md` moves
  to superseded in the same pass.
- **Consequences**: COHSSA runs spring 2027 on paper.
- **Ceiling and next move**: not applicable.
- **Kill condition**: reopen only if the repo must hold a second deployable.
