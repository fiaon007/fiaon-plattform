// ═══════════════════════════════════════════════════════════════════════════
// FIRMENSUCHE — FORMATE (17.09.2026, E-188)
//
// Eine Stelle für alles, was ein festes Muster hat: Registernummern,
// Firmenbuchnummern, Schweizer UID, USt-IdNr., Postleitzahlen. Das Impressum-
// Modul prüft damit, was die KI liefert; die Route prüft damit, was der
// Besucher eintippt. Ein Wert, der das Muster nicht trägt, wird verworfen —
// nie „repariert".
// ═══════════════════════════════════════════════════════════════════════════
import type { Land } from "./typen";

// ── Deutschland: Registerart + Nummer ───────────────────────────────────────
// HRB 12345 · HRB 12345 B (Berlin) · HRA 1234 · GnR 123 · PR 45 · VR 6789
export const REGISTERARTEN = ["HRB", "HRA", "GnR", "PR", "VR"] as const;
const RE_REGISTER_DE = /^(HRB|HRA|GnR|PR|VR) (\d{1,6})(?: ([A-Z]{1,3}))?$/;

/** „hrb12345", „HRB-Nr. 12345", „HRB: 12345 B" → „HRB 12345" / „HRB 12345 B"; sonst null. */
export function registerDE(roh: unknown): string | null {
  const s = String(roh ?? "").replace(/\s+/g, " ").trim();
  const m = s.match(/^(HRB|HRA|GnR|PR|VR)\s*(?:[-–]?\s*(?:Nr\.?|Nummer))?\s*[:.]?\s*(\d{1,6})(?:\s?([A-Z]{1,3}))?$/i);
  if (!m) return null;
  const art = REGISTERARTEN.find((a) => a.toLowerCase() === m[1].toLowerCase());
  if (!art) return null;
  const fertig = `${art} ${String(Number(m[2]))}${m[3] ? ` ${m[3].toUpperCase()}` : ""}`;
  return RE_REGISTER_DE.test(fertig) ? fertig : null;
}

// ── Österreich: Firmenbuchnummer ────────────────────────────────────────────
// Höchstens sechs Ziffern und ein Prüfbuchstabe: „FN 123456a", „FN 5h".
export function firmenbuchnummer(roh: unknown): string | null {
  const m = String(roh ?? "").trim().match(/^(?:FN\s*)?(\d{1,6})\s?([a-zA-Z])$/);
  return m ? `FN ${String(Number(m[1]))}${m[2].toLowerCase()}` : null;
}

// ── Schweiz: UID ────────────────────────────────────────────────────────────
// CHE-123.456.789 (auch „CHE123456789", „CHE-123.456.789 MWST"). Die letzte
// Ziffer ist eine Prüfziffer (Modulo 11, Gewichte 5 4 3 2 7 6 5 4).
export function uidCH(roh: unknown): string | null {
  const m = String(roh ?? "").toUpperCase().match(/^\s*CHE[-\s]?(\d{3})\.?(\d{3})\.?(\d{3})(?:\s*(?:MWST|TVA|IVA|HR))?\s*$/);
  if (!m) return null;
  const z = `${m[1]}${m[2]}${m[3]}`;
  const gewichte = [5, 4, 3, 2, 7, 6, 5, 4];
  const summe = gewichte.reduce((s, g, i) => s + g * Number(z[i]), 0);
  const pruef = (11 - (summe % 11)) % 11;
  if (pruef === 10 || pruef !== Number(z[8])) return null;
  return `CHE-${m[1]}.${m[2]}.${m[3]}`;
}
export const uidZiffern = (uid: string): string => uid.replace(/\D/g, "");
/** Neun Ziffern aus einem Register in die amtliche Schreibweise — ohne Prüfziffer-Probe, das Register hat recht. */
export function uidAusZiffern(roh: unknown): string | null {
  const z = String(roh ?? "").replace(/\D/g, "");
  return z.length === 9 ? `CHE-${z.slice(0, 3)}.${z.slice(3, 6)}.${z.slice(6)}` : null;
}

// ── USt-IdNr. ───────────────────────────────────────────────────────────────
export function ustIdDE(roh: unknown): string | null {
  const s = String(roh ?? "").toUpperCase().replace(/[\s.\-/]/g, "");
  return /^DE\d{9}$/.test(s) ? s : null;
}
export function ustIdAT(roh: unknown): string | null {
  const s = String(roh ?? "").toUpperCase().replace(/[\s.\-/]/g, "");
  return /^ATU\d{8}$/.test(s) ? s : null;
}
/** Land + Nummer aus einer freien Eingabe — für GET /ustid. */
export function ustIdErkennen(roh: unknown): { land: "DE" | "AT" | "CH"; nummer: string } | null {
  const de = ustIdDE(roh); if (de) return { land: "DE", nummer: de };
  const at = ustIdAT(roh); if (at) return { land: "AT", nummer: at };
  const ch = uidCH(roh); if (ch) return { land: "CH", nummer: ch };
  return null;
}

// ── Postleitzahlen ──────────────────────────────────────────────────────────
export function plzGueltig(plz: unknown, land: Land): boolean {
  const s = String(plz ?? "").trim();
  if (land === "DE") return /^\d{5}$/.test(s) && s !== "00000";
  // AT 1010–9992, CH 1000–9658: vier Ziffern, keine führende Null.
  return /^[1-9]\d{3}$/.test(s);
}

export function telefonGueltig(tel: unknown): boolean {
  const s = String(tel ?? "").trim();
  return /^\+?[\d\s()\/.\-–]{6,28}$/.test(s) && s.replace(/\D/g, "").length >= 6 && s.replace(/\D/g, "").length <= 16;
}

export function emailGueltig(mail: unknown): boolean {
  return /^[^\s@<>()]+@[^\s@<>()]+\.[A-Za-z]{2,}$/.test(String(mail ?? "").trim());
}

// ── Die Kantone — für das Handelsregisteramt der Schweiz ────────────────────
export const KANTONE: Record<string, string> = {
  AG: "Aargau", AI: "Appenzell Innerrhoden", AR: "Appenzell Ausserrhoden", BE: "Bern", BL: "Basel-Landschaft",
  BS: "Basel-Stadt", FR: "Freiburg", GE: "Genf", GL: "Glarus", GR: "Graubünden", JU: "Jura", LU: "Luzern",
  NE: "Neuenburg", NW: "Nidwalden", OW: "Obwalden", SG: "St. Gallen", SH: "Schaffhausen", SO: "Solothurn",
  SZ: "Schwyz", TG: "Thurgau", TI: "Tessin", UR: "Uri", VD: "Waadt", VS: "Wallis", ZG: "Zug", ZH: "Zürich",
};
export function handelsregisteramt(kanton: unknown): string | undefined {
  const name = KANTONE[String(kanton ?? "").trim().toUpperCase()];
  return name ? `Handelsregisteramt des Kantons ${name}` : undefined;
}
