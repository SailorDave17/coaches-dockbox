// The throwaway device probe (#31): one page that measures, on the phone running it, what the coach app's
// shape rests on — passkeys with user verification, a PRF-derived card-cache key (or its fallback),
// offline service, the screen wake lock, and tel:/sms: tap targets. The real-phone reading is #37.
// Nothing here is the app, and nothing under src/ imports it.
import { registerSW } from 'virtual:pwa-register'
import {
  checkKey,
  keyFromPrf,
  keyIsSealed,
  makeFallbackKey,
  openSealed,
  PRF_SALT,
  seal,
  type Opened,
  type Sealed,
} from './card.ts'
import { fromBase64Url, idbDelete, idbGet, idbPut, readLocal, toBase64Url, writeLocal } from './store.ts'
import './style.css'
import { assertPasskey, createPasskey } from './webauthn.ts'

declare const __PROBE_BUILT_AT__: string

type Status = 'pending' | 'running' | 'pass' | 'fail' | 'unsupported' | 'skipped' | 'not-yet' | 'info'
type Detail = Record<string, unknown>
type RowId =
  | 'env'
  | 'passkey-create'
  | 'passkey-assert'
  | 'prf-seal'
  | 'prf-open'
  | 'fallback-seal'
  | 'fallback-open'
  | 'offline'
  | 'wake-lock'
  | 'links'

interface RowResult {
  status: Status
  at: string
  detail: Detail
}

interface Action {
  label: string
  run: () => Promise<void>
}

interface RowDef {
  id: RowId
  title: string
  proves: string
  actions: Action[]
  body?: () => HTMLElement
}

interface SealedRecord {
  sealed: Sealed
  loadId: string
  sealedAt: string
}

// The passkey that sealed the card, kept so opening asks for that one and not whichever was created
// last. Stored in IndexedDB only; it never enters the report.
interface PrfRecord extends SealedRecord {
  credentialId: string
}

interface FallbackRecord extends SealedRecord {
  key: CryptoKey
}

const OPENED_REASON: Record<Opened, string> = {
  matches: 'the invented card, byte for byte',
  'wrong-key': 'decryption refused: not the key that sealed this card (was the passkey created again?)',
  'different-text': 'decrypted, but not to the invented card',
}

const RESULTS_KEY = 'device-probe:results'
const CREDENTIAL_KEY = 'device-probe:credential'
const LOADS_KEY = 'device-probe:loads'
const STATUS_LABEL: Record<Status, string> = {
  pending: 'Not run',
  running: 'Running…',
  pass: 'PASS',
  fail: 'FAIL',
  unsupported: 'UNSUPPORTED',
  skipped: 'SKIPPED',
  'not-yet': 'NOT YET',
  info: 'INFO',
}

// A fresh id per page load, stored beside each sealed card. Opening a card under a different id is
// what proves it survived a reload rather than sitting in this page's memory.
const LOAD_ID = crypto.randomUUID()
const LOAD_NUMBER = Number(readLocal(LOADS_KEY) ?? '0') + 1
writeLocal(LOADS_KEY, String(LOAD_NUMBER))
const CONTROLLED_AT_LOAD = 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null

let results: Partial<Record<RowId, RowResult>> = loadResults()
// Held apart from `results`, which a re-check marks "running" before it reads anything.
let offlineProof = results.offline?.status === 'pass' ? results.offline : undefined
let offlineReady = CONTROLLED_AT_LOAD
let serviceWorkerError: string | null = null
let lastReachable: boolean | null = null

function loadResults(): Partial<Record<RowId, RowResult>> {
  try {
    return JSON.parse(readLocal(RESULTS_KEY) ?? '{}') as Partial<Record<RowId, RowResult>>
  } catch {
    return {}
  }
}

function describe(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'name' in error && 'message' in error) {
    return `${String(error.name)}: ${String(error.message)}`
  }
  return String(error)
}

function displayMode(): string {
  if (matchMedia('(display-mode: standalone)').matches) return 'standalone'
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return 'standalone (iOS)'
  return 'browser tab'
}

// Where a crypto row ran: the offline criterion asks that they still run with the network off.
function where(): Detail {
  return {
    networkReachable: lastReachable,
    controlledByServiceWorker: 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null,
  }
}

function storedCredential(): ArrayBuffer | null {
  const stored = readLocal(CREDENTIAL_KEY)
  return stored ? fromBase64Url(stored) : null
}

function rememberCredential(id: ArrayBuffer): void {
  writeLocal(CREDENTIAL_KEY, toBase64Url(id))
}

function setResult(id: RowId, status: Status, detail: Detail): void {
  results[id] = { status, at: new Date().toISOString(), detail }
  writeLocal(RESULTS_KEY, JSON.stringify(results))
  renderRow(id)
  renderReport()
}

// A row a real run has settled is not overwritten by a later "not needed here" note.
function skipUnlessRun(id: RowId, reason: string): void {
  const current = results[id]?.status
  if (current === undefined || current === 'pending' || current === 'skipped')
    setResult(id, 'skipped', { reason })
}

// ---- Rows -------------------------------------------------------------------------------------------

async function checkEnvironment(): Promise<void> {
  const hasWebAuthn = typeof PublicKeyCredential !== 'undefined'
  const detail: Detail = {
    secureContext: isSecureContext,
    displayMode: displayMode(),
    serviceWorkerApi: 'serviceWorker' in navigator,
    publicKeyCredential: hasWebAuthn,
    indexedDB: typeof indexedDB !== 'undefined',
    subtleCrypto: typeof crypto.subtle !== 'undefined',
    wakeLockApi: 'wakeLock' in navigator,
  }
  if (hasWebAuthn) {
    detail.platformAuthenticator =
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(describe)
    detail.clientCapabilities =
      'getClientCapabilities' in PublicKeyCredential
        ? await PublicKeyCredential.getClientCapabilities().catch(describe)
        : 'not available'
  }
  setResult('env', 'info', detail)
}

async function runCreate(): Promise<void> {
  const created = await createPasskey()
  rememberCredential(created.credentialId)
  const auth = created.authData
  if (!auth) {
    setResult('passkey-create', 'unsupported', {
      reason: 'this browser has no getAuthenticatorData(), so the flags and AAGUID cannot be read',
      ...where(),
    })
    return
  }
  setResult('passkey-create', auth.userVerified ? 'pass' : 'fail', {
    userVerified: auth.userVerified,
    userPresent: auth.userPresent,
    aaguid: auth.aaguid,
    // attestation 'none' lets a browser zero the AAGUID; all zeros means hidden, not absent.
    aaguidHidden: auth.aaguid === '00000000-0000-0000-0000-000000000000',
    backupEligible: auth.backupEligible,
    backupState: auth.backupState,
    authenticatorAttachment: created.authenticatorAttachment,
    transports: created.transports,
    publicKeyAlgorithm: created.publicKeyAlgorithm,
    prfEnabledAtCreate: created.prfEnabled,
    residentKey: created.residentKey,
    ...where(),
  })
}

async function runAssert(): Promise<void> {
  const discoverable = storedCredential() === null
  const asserted = await assertPasskey(storedCredential())
  rememberCredential(asserted.credentialId)
  setResult('passkey-assert', asserted.authData.userVerified ? 'pass' : 'fail', {
    userVerified: asserted.authData.userVerified,
    userPresent: asserted.authData.userPresent,
    backupState: asserted.authData.backupState,
    signCount: asserted.authData.signCount,
    authenticatorAttachment: asserted.authenticatorAttachment,
    discoverable,
    ...where(),
  })
}

async function runPrfSeal(): Promise<void> {
  const asserted = await assertPasskey(storedCredential(), PRF_SALT)
  rememberCredential(asserted.credentialId)
  if (!asserted.authData.userVerified) {
    setResult('prf-seal', 'fail', {
      userVerified: false,
      reason: 'the authenticator did not verify the user',
    })
    return
  }
  if (!asserted.prfOutput) {
    setResult('prf-seal', 'unsupported', {
      reason: 'the assertion returned no PRF output, so the fallback row runs instead',
      prfEnabledAtCreate:
        results['passkey-create']?.detail.prfEnabledAtCreate ?? 'create not run on this load',
      ...where(),
    })
    // Nothing was sealed, so there is nothing for row 4 to open; it says why rather than "Not run".
    setResult('prf-open', 'unsupported', { reason: 'PRF is unsupported here (row 3), so no PRF card exists' })
    await guarded('fallback-seal', runFallbackSeal)
    return
  }
  const key = await keyFromPrf(asserted.prfOutput)
  const check = await checkKey(key)
  if (!keyIsSealed(check)) {
    setResult('prf-seal', 'fail', { ...check, reason: 'the derived key can be exported' })
    return
  }
  const sealed = await seal(key)
  await idbPut('prf-card', {
    sealed,
    loadId: LOAD_ID,
    sealedAt: new Date().toISOString(),
    credentialId: toBase64Url(asserted.credentialId),
  } satisfies PrfRecord)
  setResult('prf-seal', 'pass', {
    userVerified: true,
    prfOutputBytes: asserted.prfOutput.byteLength,
    ...check,
    ciphertextBytes: sealed.ciphertext.byteLength,
    storedIn: 'IndexedDB',
    next: 'reload, then open the card',
    ...where(),
  })
  skipUnlessRun('fallback-seal', 'PRF works here, so the fallback is not needed')
  skipUnlessRun('fallback-open', 'PRF works here, so the fallback is not needed')
}

async function runPrfOpen(): Promise<void> {
  const record = await idbGet<PrfRecord>('prf-card')
  if (!record) {
    const prfUnsupported = results['prf-seal']?.status === 'unsupported'
    setResult('prf-open', prfUnsupported ? 'unsupported' : 'fail', {
      reason: prfUnsupported
        ? 'PRF is unsupported here (row 3), so no PRF card exists'
        : 'no sealed card in IndexedDB: seal one first',
    })
    return
  }
  const asserted = await assertPasskey(fromBase64Url(record.credentialId), PRF_SALT)
  if (!asserted.authData.userVerified) {
    setResult('prf-open', 'fail', {
      userVerified: false,
      reason: 'the authenticator did not verify the user',
    })
    return
  }
  if (!asserted.prfOutput) {
    setResult('prf-open', 'unsupported', { reason: 'the assertion returned no PRF output', ...where() })
    return
  }
  const opened = await openSealed(await keyFromPrf(asserted.prfOutput), record.sealed)
  const matches = opened === 'matches'
  const afterReload = record.loadId !== LOAD_ID
  setResult('prf-open', matches && afterReload ? 'pass' : matches ? 'not-yet' : 'fail', {
    userVerified: true,
    matchesInventedCard: matches,
    opened: OPENED_REASON[opened],
    afterReload,
    sealedAt: record.sealedAt,
    ...(afterReload ? {} : { next: 'reload the page, then open the card again' }),
    ...where(),
  })
}

async function runFallbackSeal(): Promise<void> {
  const key = await makeFallbackKey()
  const check = await checkKey(key)
  if (!keyIsSealed(check)) {
    setResult('fallback-seal', 'fail', { ...check, reason: 'the generated key can be exported' })
    return
  }
  const sealed = await seal(key)
  await idbPut('fallback-card', {
    sealed,
    key,
    loadId: LOAD_ID,
    sealedAt: new Date().toISOString(),
  } satisfies FallbackRecord)
  setResult('fallback-seal', 'pass', {
    ...check,
    keyStoredIn: 'IndexedDB, as a non-extractable CryptoKey',
    gate: 'released by this page only after a user-verified assertion; weaker than PRF',
    next: 'reload, then unlock and open the card',
    ...where(),
  })
}

async function runFallbackOpen(): Promise<void> {
  // The gate: nothing reads the stored key until an assertion comes back with the user verified.
  const asserted = await assertPasskey(storedCredential())
  rememberCredential(asserted.credentialId)
  // A spare, not the load-bearing half: with verification required and failing, the browser refuses
  // the ceremony itself (Chrome, measured: NotAllowedError) before this line. It stays for a platform
  // that hands back an unverified assertion anyway.
  if (!asserted.authData.userVerified) {
    setResult('fallback-open', 'fail', { userVerified: false, keyReleased: false })
    return
  }
  const record = await idbGet<FallbackRecord>('fallback-card')
  if (!record) {
    setResult('fallback-open', 'fail', { reason: 'no sealed card in IndexedDB: seal one first' })
    return
  }
  const check = await checkKey(record.key)
  const opened = await openSealed(record.key, record.sealed)
  const matches = opened === 'matches'
  const afterReload = record.loadId !== LOAD_ID
  const ok = matches && afterReload && keyIsSealed(check)
  setResult('fallback-open', ok ? 'pass' : matches && keyIsSealed(check) ? 'not-yet' : 'fail', {
    userVerified: true,
    keyReleased: true,
    keyStillNonExtractable: keyIsSealed(check),
    matchesInventedCard: matches,
    opened: OPENED_REASON[opened],
    afterReload,
    sealedAt: record.sealedAt,
    ...(afterReload ? {} : { next: 'reload the page, then unlock and open the card again' }),
    ...where(),
  })
}

// A request for a path nothing precaches. The service worker passes it to the network, so it fails
// only when the network is really gone; navigator.onLine can say "online" with no route anywhere.
async function networkReachable(): Promise<boolean> {
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), 4000)
  try {
    await fetch(`/network-check-${Date.now()}`, { cache: 'no-store', signal: abort.signal })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

async function checkOffline(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    setResult('offline', 'unsupported', { reason: 'no service worker API' })
    return
  }
  lastReachable = await networkReachable()
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  const detail: Detail = {
    controlledAtLoad: CONTROLLED_AT_LOAD,
    controlledNow: navigator.serviceWorker.controller !== null,
    offlineReady,
    networkReachable: lastReachable,
    navigatorOnLine: navigator.onLine,
    navigationTransferSize: navigation?.transferSize ?? null,
    serviceWorkerError,
  }
  if (CONTROLLED_AT_LOAD && !lastReachable) {
    setResult('offline', 'pass', {
      ...detail,
      meaning: 'opened with the network off; the service worker served it',
    })
    offlineProof = results.offline
    return
  }
  if (offlineProof) {
    // Proven on an earlier load; going back online does not unprove it.
    setResult('offline', 'pass', { ...offlineProof.detail, latestCheck: detail })
    return
  }
  const next = offlineReady
    ? 'ready: turn the network off (airplane mode), then close and reopen the probe'
    : 'wait for "Offline ready: yes" before turning the network off'
  setResult('offline', serviceWorkerError ? 'fail' : 'not-yet', { ...detail, next })
}

const wake = {
  wanted: false,
  sentinel: null as WakeLockSentinel | null,
  since: 0,
  heldMs: 0,
  acquisitions: 0,
  reacquisitions: 0,
  releases: 0,
  lastError: null as string | null,
}

async function acquireWakeLock(): Promise<void> {
  const sentinel = await navigator.wakeLock.request('screen')
  wake.sentinel = sentinel
  wake.since = performance.now()
  wake.acquisitions += 1
  sentinel.addEventListener('release', () => {
    wake.heldMs += performance.now() - wake.since
    wake.releases += 1
    wake.sentinel = null
    reportWakeLock()
  })
  reportWakeLock()
}

// The browser drops a screen wake lock whenever the page is hidden; this is the re-acquire the
// criterion asks for.
document.addEventListener('visibilitychange', () => {
  if (!wake.wanted || document.visibilityState !== 'visible' || wake.sentinel !== null) return
  acquireWakeLock()
    .then(() => {
      wake.reacquisitions += 1
      reportWakeLock()
    })
    .catch((error: unknown) => {
      wake.lastError = describe(error)
      reportWakeLock()
    })
})

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function heldTimes(): { current: number; total: number } {
  const current = wake.sentinel ? performance.now() - wake.since : 0
  return { current, total: wake.heldMs + current }
}

// Every second, the clock only: rewriting the stored result that often would also rewrite the JSON box
// under the thumb of someone selecting it to copy.
function tickWakeClock(): void {
  const { current, total } = heldTimes()
  const clock = document.getElementById('wake-clock')
  if (!clock) return
  clock.textContent = wake.sentinel
    ? `Screen lock held for ${formatDuration(current)} (total ${formatDuration(total)})`
    : `Not holding a screen lock (total held ${formatDuration(total)})`
}

function reportWakeLock(): void {
  tickWakeClock()
  const { current, total } = heldTimes()
  const status: Status = wake.acquisitions > 0 ? 'pass' : wake.lastError ? 'fail' : 'pending'
  setResult('wake-lock', status, {
    holding: wake.sentinel !== null,
    currentHoldSeconds: Math.round(current / 1000),
    totalHeldSeconds: Math.round(total / 1000),
    acquisitions: wake.acquisitions,
    reacquiredOnVisibilityChange: wake.reacquisitions,
    releases: wake.releases,
    lastError: wake.lastError,
  })
}

async function toggleWakeLock(): Promise<void> {
  if (!('wakeLock' in navigator)) {
    setResult('wake-lock', 'unsupported', { reason: 'no Screen Wake Lock API' })
    return
  }
  if (wake.wanted) {
    wake.wanted = false
    await wake.sentinel?.release()
    reportWakeLock()
    return
  }
  wake.wanted = true
  try {
    await acquireWakeLock()
  } catch (error) {
    wake.wanted = false
    wake.lastError = describe(error)
    reportWakeLock()
  }
}

setInterval(() => {
  if (wake.sentinel) tickWakeClock()
}, 1000)

function measureLinks(): void {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('a.contact')]
  const rects = links.map((link) => link.getBoundingClientRect())
  const each = links.map((link) => {
    const rect = link.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const inView = x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight
    return {
      scheme: link.protocol,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      atLeast56px: rect.width >= 56 && rect.height >= 56,
      // The element a tap on the link's centre reaches: the link itself, or something covering it.
      centreTapReachesLink: inView ? document.elementFromPoint(x, y)?.closest('a') === link : null,
      nestedControls: link.querySelectorAll('a, button, input, select, textarea, [tabindex]').length,
    }
  })
  const overlapping = rects.some((a, i) =>
    rects.some(
      (b, j) => i < j && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom,
    ),
  )
  const detail = { links: each, overlapping }
  if (each.some((link) => link.centreTapReachesLink === null)) {
    setResult('links', 'not-yet', { ...detail, next: 'scroll the links into view, then measure again' })
    return
  }
  const pass =
    each.length === 2 &&
    !overlapping &&
    each.every((link) => link.atLeast56px && link.centreTapReachesLink === true && link.nestedControls === 0)
  setResult('links', pass ? 'pass' : 'fail', detail)
}

// ---- Page -------------------------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [name, value] of Object.entries(props)) if (value !== undefined) node.setAttribute(name, value)
  node.append(...children)
  return node
}

async function guarded(id: RowId, run: () => Promise<void>): Promise<void> {
  setResult(id, 'running', {})
  try {
    await run()
  } catch (error) {
    const hint =
      error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'the passkey prompt was cancelled, timed out or refused, or the passkey it asked for is gone'
        : undefined
    setResult(id, 'fail', { error: describe(error), ...(hint ? { hint } : {}), ...where() })
  }
}

function contactLinks(): HTMLElement {
  // An invented number in the range reserved for fiction; nobody answers it.
  return el(
    'div',
    { class: 'contacts' },
    el('a', { class: 'contact', href: 'tel:+12055550142' }, 'Call 205-555-0142'),
    el('a', { class: 'contact', href: 'sms:+12055550142' }, 'Text 205-555-0142'),
  )
}

function wakeClock(): HTMLElement {
  return el('p', { id: 'wake-clock', class: 'clock', 'aria-live': 'off' }, 'Not holding a screen lock')
}

const ROWS: RowDef[] = [
  {
    id: 'env',
    title: 'This device',
    proves:
      'What the browser offers before anything runs: secure context, platform authenticator, PRF capability.',
    actions: [{ label: 'Check again', run: checkEnvironment }],
  },
  {
    id: 'passkey-create',
    title: '1. Create a passkey',
    proves:
      'A platform passkey is created with user verification required; reports the UV flag and the AAGUID. Create once: creating again replaces it, and a card sealed under the old one will not open.',
    actions: [{ label: 'Create passkey', run: runCreate }],
  },
  {
    id: 'passkey-assert',
    title: '2. Use the passkey',
    proves: 'An assertion with user verification required comes back with the UV flag set.',
    actions: [{ label: 'Use passkey', run: runAssert }],
  },
  {
    id: 'prf-seal',
    title: '3. PRF key: seal a card',
    proves:
      'A key derived from the passkey’s PRF output (non-extractable AES-GCM) encrypts an invented card into IndexedDB.',
    actions: [{ label: 'Seal the card', run: runPrfSeal }],
  },
  {
    id: 'prf-open',
    title: '4. PRF key: open it after a reload',
    proves: 'After a reload, the passkey gives the same PRF output and the card decrypts.',
    actions: [{ label: 'Open the card', run: runPrfOpen }],
  },
  {
    id: 'fallback-seal',
    title: '5. Fallback key: seal a card',
    proves:
      'Runs when PRF is unsupported: a random non-extractable key, kept in IndexedDB, encrypts the card.',
    actions: [{ label: 'Seal with fallback key', run: runFallbackSeal }],
  },
  {
    id: 'fallback-open',
    title: '6. Fallback key: unlock and open after a reload',
    proves: 'The stored key is used only after a user-verified passkey assertion (a gate in the UI, weaker).',
    actions: [{ label: 'Unlock and open', run: runFallbackOpen }],
  },
  {
    id: 'offline',
    title: '7. Offline',
    proves:
      'With the network off after the first load, the service worker serves the probe and rows 1–6 still run.',
    actions: [{ label: 'Check again', run: checkOffline }],
  },
  {
    id: 'wake-lock',
    title: '8. Screen wake lock',
    proves:
      'A screen wake lock is requested, re-acquired when the page is shown again, and its held time shown.',
    actions: [{ label: 'Hold / release the screen lock', run: toggleWakeLock }],
    body: wakeClock,
  },
  {
    id: 'links',
    title: '9. Call and text links',
    proves: 'tel: and sms: links to an invented 555 number are each one tap target, at least 56 px.',
    actions: [
      {
        label: 'Measure again',
        run: async () => {
          document.querySelector('.contacts')?.scrollIntoView({ block: 'center' })
          await new Promise((resolve) => requestAnimationFrame(resolve))
          measureLinks()
        },
      },
    ],
    body: contactLinks,
  },
]

function renderRow(id: RowId): void {
  const section = document.querySelector<HTMLElement>(`[data-row="${id}"]`)
  if (!section) return
  const result = results[id]
  const status = result?.status ?? 'pending'
  const badge = section.querySelector('.badge')
  if (badge) {
    badge.textContent = STATUS_LABEL[status]
    badge.setAttribute('data-status', status)
  }
  const detail = section.querySelector('.detail')
  if (detail) detail.textContent = result ? JSON.stringify(result.detail, null, 2) : ''
  for (const button of section.querySelectorAll('button')) button.disabled = status === 'running'
}

function report(): Detail {
  const uaData = (
    navigator as Navigator & { userAgentData?: { brands: unknown; mobile: boolean; platform: string } }
  ).userAgentData
  return {
    probe: 'coaches-dockbox spikes/device-probe (#31)',
    builtAt: __PROBE_BUILT_AT__,
    reportedAt: new Date().toISOString(),
    loadNumber: LOAD_NUMBER,
    userAgent: navigator.userAgent,
    userAgentData: uaData
      ? { brands: uaData.brands, mobile: uaData.mobile, platform: uaData.platform }
      : null,
    displayMode: displayMode(),
    // Row details carry flags, sizes and states only: no credential id, user handle or card content.
    rows: Object.fromEntries(ROWS.map((row) => [row.id, results[row.id] ?? { status: 'pending' }])),
  }
}

function renderReport(): void {
  const output = document.querySelector<HTMLTextAreaElement>('#report')
  if (output) output.value = JSON.stringify(report(), null, 2)
  const ready = document.querySelector('#offline-ready')
  if (ready) ready.textContent = offlineReady ? 'yes' : 'not yet'
}

async function copyReport(): Promise<void> {
  const output = document.querySelector<HTMLTextAreaElement>('#report')
  const note = document.querySelector('#copy-note')
  if (!output || !note) return
  // Brings the held time up to this second before it is copied.
  if (wake.acquisitions > 0) reportWakeLock()
  renderReport()
  try {
    await navigator.clipboard.writeText(output.value)
    note.textContent = 'Copied.'
  } catch (error) {
    output.select()
    note.textContent = `Copy refused (${describe(error)}); the text is selected, copy it by hand.`
  }
}

async function clearProbeData(): Promise<void> {
  writeLocal(RESULTS_KEY, null)
  writeLocal(CREDENTIAL_KEY, null)
  await idbDelete()
  results = {}
  offlineProof = undefined
  for (const row of ROWS) renderRow(row.id)
  renderReport()
}

function render(root: HTMLElement): void {
  root.append(
    el(
      'header',
      { class: 'top' },
      el('h1', {}, 'Dockbox device probe'),
      el(
        'p',
        {},
        'Throwaway (#31). Not the app. Every name and number on this page is invented. ',
        `Build ${__PROBE_BUILT_AT__}, load ${LOAD_NUMBER}. Offline ready: `,
        el('strong', { id: 'offline-ready' }, 'not yet'),
        '.',
      ),
      el('button', { type: 'button', id: 'reload' }, 'Reload page'),
    ),
  )
  for (const row of ROWS) {
    const actions = row.actions.map((action) => {
      const button = el('button', { type: 'button' }, action.label)
      button.addEventListener('click', () => void guarded(row.id, action.run))
      return button
    })
    root.append(
      el(
        'section',
        { class: 'row', 'data-row': row.id, 'aria-labelledby': `h-${row.id}` },
        el(
          'div',
          { class: 'row-head' },
          el('h2', { id: `h-${row.id}` }, row.title),
          el('span', { class: 'badge', role: 'status', 'data-status': 'pending' }, STATUS_LABEL.pending),
        ),
        el('p', { class: 'proves' }, row.proves),
        ...(row.body ? [row.body()] : []),
        el('div', { class: 'actions' }, ...actions),
        el('pre', { class: 'detail' }),
      ),
    )
  }
  const copy = el('button', { type: 'button' }, 'Copy results as JSON')
  copy.addEventListener('click', () => void copyReport())
  const clear = el('button', { type: 'button', class: 'secondary' }, 'Clear probe data')
  clear.addEventListener('click', () => void clearProbeData())
  root.append(
    el(
      'section',
      { class: 'row', 'aria-labelledby': 'h-report' },
      el('h2', { id: 'h-report' }, 'Results'),
      el(
        'p',
        { class: 'proves' },
        'Paste this into the reading issue. It holds the user agent and each row’s result, nothing personal. ',
        'Clearing removes what the probe stored; the passkey stays on the phone until deleted in its settings.',
      ),
      el('div', { class: 'actions' }, copy, clear),
      el('p', { id: 'copy-note', 'aria-live': 'polite' }),
      el('textarea', { id: 'report', readonly: '', rows: '12', 'aria-label': 'Results as JSON' }),
    ),
  )
  document.querySelector('#reload')?.addEventListener('click', () => location.reload())
  for (const row of ROWS) renderRow(row.id)
  renderReport()
}

const root = document.getElementById('probe')
if (!root) throw new Error('index.html has no #probe element')
render(root)

if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onOfflineReady() {
      offlineReady = true
      void checkOffline()
    },
    onRegisterError(error: unknown) {
      serviceWorkerError = describe(error)
      void checkOffline()
    },
  })
  navigator.serviceWorker.addEventListener('controllerchange', () => void checkOffline())
}
window.addEventListener('online', () => void checkOffline())
window.addEventListener('offline', () => void checkOffline())

// The links are measured once they are fully on screen, since a tap test needs them in view.
const contacts = document.querySelector('.contacts')
if (contacts) {
  new IntersectionObserver(
    (entries, observer) => {
      if (entries.some((entry) => entry.intersectionRatio === 1)) {
        measureLinks()
        observer.disconnect()
      }
    },
    { threshold: 1 },
  ).observe(contacts)
}

void checkEnvironment()
void checkOffline()
