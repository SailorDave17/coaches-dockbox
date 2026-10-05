// The passkey ceremonies. There is no server: each challenge is random bytes made here and nothing is
// verified remotely, because the question is what this phone's authenticator does, not whether a
// relying party can check it. The card-cache stories need the server half; this does not.

const RP_NAME = 'Dockbox device probe'
// Invented, and fixed, so creating again replaces the probe's passkey on platforms that key a passkey
// by its user handle instead of piling up entries. A phone's passkey list shows this, never a person.
const USER_ID = new TextEncoder().encode('dockbox-device-probe')
const USER_NAME = 'device-probe'
const USER_DISPLAY_NAME = 'Device probe (invented user)'
const TIMEOUT_MS = 120_000

export interface AuthData {
  userPresent: boolean
  userVerified: boolean
  backupEligible: boolean
  backupState: boolean
  signCount: number
  // Present only in the data a creation returns.
  aaguid: string | null
}

export interface Created {
  credentialId: ArrayBuffer
  authData: AuthData | null
  authenticatorAttachment: string | null
  transports: string[]
  publicKeyAlgorithm: number | null
  prfEnabled: boolean | null
  residentKey: boolean | null
}

export interface Asserted {
  credentialId: ArrayBuffer
  authData: AuthData
  authenticatorAttachment: string | null
  // null when the authenticator returned no PRF output, whatever the reason.
  prfOutput: ArrayBuffer | null
}

// WebAuthn authenticator data: rpIdHash (32), flags (1), signCount (4), then attested credential data
// (AAGUID first) when the AT flag is set.
export function parseAuthData(data: ArrayBuffer): AuthData {
  const bytes = new Uint8Array(data)
  if (bytes.length < 37) throw new Error(`authenticator data is ${bytes.length} bytes; at least 37 expected`)
  const flags = bytes[32] ?? 0
  const attested = (flags & 0x40) !== 0
  return {
    userPresent: (flags & 0x01) !== 0,
    userVerified: (flags & 0x04) !== 0,
    backupEligible: (flags & 0x08) !== 0,
    backupState: (flags & 0x10) !== 0,
    signCount: new DataView(data).getUint32(33),
    aaguid: attested && bytes.length >= 53 ? formatUuid(bytes.subarray(37, 53)) : null,
  }
}

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length))
}

function toArrayBuffer(source: BufferSource | undefined): ArrayBuffer | null {
  if (source === undefined) return null
  if (source instanceof ArrayBuffer) return source
  const view = new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
  return view.slice().buffer
}

export async function createPasskey(): Promise<Created> {
  const credential = await navigator.credentials.create({
    publicKey: {
      rp: { name: RP_NAME },
      user: { id: USER_ID, name: USER_NAME, displayName: USER_DISPLAY_NAME },
      challenge: randomBytes(32),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'required',
      },
      attestation: 'none',
      timeout: TIMEOUT_MS,
      extensions: { prf: {}, credProps: true },
    },
  })
  if (!(credential instanceof PublicKeyCredential))
    throw new Error('create() returned no public-key credential')
  const response = credential.response as AuthenticatorAttestationResponse
  const extensions = credential.getClientExtensionResults()
  return {
    credentialId: credential.rawId,
    authData: 'getAuthenticatorData' in response ? parseAuthData(response.getAuthenticatorData()) : null,
    authenticatorAttachment: credential.authenticatorAttachment,
    transports: 'getTransports' in response ? response.getTransports() : [],
    publicKeyAlgorithm: 'getPublicKeyAlgorithm' in response ? response.getPublicKeyAlgorithm() : null,
    prfEnabled: extensions.prf?.enabled ?? null,
    residentKey: extensions.credProps?.rk ?? null,
  }
}

// With no stored credential (a home-screen app has its own storage on iOS) the assertion is
// discoverable, and the phone offers whichever probe passkey it holds.
export async function assertPasskey(
  credentialId: ArrayBuffer | null,
  prfSalt?: BufferSource,
): Promise<Asserted> {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      ...(credentialId ? { allowCredentials: [{ type: 'public-key', id: credentialId }] } : {}),
      userVerification: 'required',
      timeout: TIMEOUT_MS,
      ...(prfSalt ? { extensions: { prf: { eval: { first: prfSalt } } } } : {}),
    },
  })
  if (!(credential instanceof PublicKeyCredential)) throw new Error('get() returned no public-key credential')
  const response = credential.response as AuthenticatorAssertionResponse
  return {
    credentialId: credential.rawId,
    authData: parseAuthData(response.authenticatorData),
    authenticatorAttachment: credential.authenticatorAttachment,
    prfOutput: toArrayBuffer(credential.getClientExtensionResults().prf?.results?.first),
  }
}
