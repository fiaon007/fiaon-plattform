/**
 * ============================================================================
 * FIAON FAHRPLAN — Verschlüsselung sensibler Kontoauszüge (at rest)
 * ============================================================================
 * Kontoauszüge sind hochsensible Finanzdaten (GDPR Art. 9-nah). Sie werden
 * NIE im Klartext gespeichert. Wir verwenden AES-256-GCM (authentifiziert):
 * jede Datei bekommt eine eigene, zufällige IV; Ciphertext + AuthTag werden
 * zusammen abgelegt.
 *
 * Schlüssel:
 *  - Bevorzugt `STATEMENT_ENC_KEY` (64 Hex-Zeichen = 32 Byte) aus der Umgebung.
 *  - Fallback: deterministische Ableitung via scrypt aus DATABASE_URL + Salt,
 *    damit das Feature sofort läuft. FÜR PRODUKTION: dedizierten Key setzen.
 * ============================================================================
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function resolveKey(): Buffer {
  const raw = process.env.STATEMENT_ENC_KEY;
  if (raw && /^[0-9a-fA-F]{64}$/.test(raw.trim())) {
    return Buffer.from(raw.trim(), "hex");
  }
  // Deterministischer Fallback — an die Installation gebunden, aber stabil.
  const seed = process.env.SESSION_SECRET || process.env.DATABASE_URL || "fiaon-fallback-seed";
  return scryptSync(seed, "fiaon-statement-salt-v1", 32);
}

const KEY = resolveKey();

/** True, wenn ein dedizierter Produktions-Key gesetzt ist (nicht der Fallback). */
export function hasDedicatedKey(): boolean {
  const raw = process.env.STATEMENT_ENC_KEY;
  return !!(raw && /^[0-9a-fA-F]{64}$/.test(raw.trim()));
}

/** Verschlüsselt Klartext-Bytes → Buffer(iv | tag | ciphertext). */
export function encryptBuffer(plain: Buffer): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

/** Entschlüsselt Buffer(iv | tag | ciphertext) → Klartext-Bytes. */
export function decryptBuffer(blob: Buffer): Buffer {
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = blob.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}
