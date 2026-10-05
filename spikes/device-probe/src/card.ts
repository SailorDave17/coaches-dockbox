// The two card-cache key paths the real-phone reading (#37) chooses between, each proved end to end on
// one invented card: encrypt, store in IndexedDB, reload, decrypt.
//
// - PRF: the key is derived from the passkey's PRF output every time, so it exists only while the
//   authenticator is releasing that output after user verification.
// - Fallback: a random non-extractable key is stored in IndexedDB, and only this page's code decides
//   to use it after a user-verified assertion. The gate is in the UI, not in the key, which is why it
//   is documented as the weaker path.

// Invented, every field. The 555-01xx numbers are reserved for fiction.
export const INVENTED_CARD = {
  sailor: 'Casey Example',
  program: 'JRT (invented)',
  guardian: 'Jordan Example',
  guardianPhone: '+1 205 555 0142',
  emergencyContact: 'Riley Example, +1 205 555 0143',
  medical: 'Invented flag: none',
} as const

// The PRF input. The browser hashes it with WebAuthn's own context string before the authenticator
// sees it, so this only has to be stable, not secret.
export const PRF_SALT = new TextEncoder().encode('dockbox card cache probe v1')

export interface Sealed {
  iv: Uint8Array<ArrayBuffer>
  ciphertext: ArrayBuffer
}

export interface KeyCheck {
  extractable: boolean
  // The error a raw export raised: a non-extractable key must refuse it.
  exportRefusedWith: string | null
}

export async function keyFromPrf(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', prfOutput, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32),
      info: new TextEncoder().encode('dockbox card cache v1'),
    },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function makeFallbackKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function checkKey(key: CryptoKey): Promise<KeyCheck> {
  try {
    await crypto.subtle.exportKey('raw', key)
    return { extractable: key.extractable, exportRefusedWith: null }
  } catch (error) {
    return {
      extractable: key.extractable,
      exportRefusedWith: error instanceof Error ? error.name : String(error),
    }
  }
}

export function keyIsSealed(check: KeyCheck): boolean {
  return !check.extractable && check.exportRefusedWith !== null
}

export async function seal(key: CryptoKey): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(JSON.stringify(INVENTED_CARD))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return { iv, ciphertext }
}

export type Opened = 'matches' | 'wrong-key' | 'different-text'

// 'matches' only when the decrypted text is the invented card, byte for byte. AES-GCM refuses with an
// OperationError when the key is not the one that sealed the card, which is what a passkey created
// again after sealing produces: a new passkey has a new PRF secret.
export async function openSealed(key: CryptoKey, sealed: Sealed): Promise<Opened> {
  let plaintext: ArrayBuffer
  try {
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv }, key, sealed.ciphertext)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'OperationError') return 'wrong-key'
    throw error
  }
  return new TextDecoder().decode(plaintext) === JSON.stringify(INVENTED_CARD) ? 'matches' : 'different-text'
}
