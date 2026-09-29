# ADR 009 — The first real test proves another program's coach is refused a medical card
- Status: accepted 2026-09-29 (charter ratified) · Phase 6
- **Context**: the bet (ADR 002) is the riskiest code, and a vacuous green here would be the worst kind.
- **Options**: **cross-program refusal test** against a local Supabase in CI; **salvaged grade/date
  unit tests** (fast, prove nothing about the risk).
- **Decision**: the refusal test, proven failable per `prove-tests`; Vitest for units.
- **Consequences**: CI needs Docker; `ghcr.io` throttling is solved by
  `SUPABASE_INTERNAL_IMAGE_REGISTRY: public.ecr.aws` (cairn note, 2026-09-23).
- **Ceiling and next move**: CI minutes on the free GitHub tier → cache the Supabase images.
- **Kill condition**: the test does not fail when the membership check is removed → it is not testing
  the function; rewrite it before anything else lands.
