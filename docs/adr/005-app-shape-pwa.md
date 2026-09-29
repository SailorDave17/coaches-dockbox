# ADR 005 — A PWA for the pilot; a native coach app is the named move
- Status: accepted 2026-09-29 (charter ratified) · Phases 5, 6
- **Context**: cards cached on the coach's device (5.1); iOS web push needs Add to Home Screen
  (*measured*); the owner builds on Windows.
- **Options** (*measured* 2026-09-29): **PWA** — no stores, no Mac, $0. **PWA for families + Capacitor 8
  (8.5.2) for coaches** — Keychain storage, Face ID, APNs / FCM push; $99/yr Apple (nonprofit waiver
  possible) + $25 Google; iOS builds need a Mac or a cloud Mac. **Store apps for all** — organisation
  enrolment needs a D-U-N-S number.
- **Decision**: PWA; cached cards unlocked by a passkey with `userVerification: "required"`.
- **Consequences**: the device passcode is enforced only indirectly; onboarding asks iPhone families to
  install and verifies a test push.
- **Ceiling and next move**: family reachability under 70%, or the passkey gate failing on real devices
  → Capacitor coach app.
- **Kill condition**: the passkey-gated cache cannot work on iOS Safari → printed card pack for away
  regattas, and coaches move to Capacitor.
