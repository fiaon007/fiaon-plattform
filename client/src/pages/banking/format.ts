// ═══════════════════════════════════════════════════════════════════════════
// FIAON BANKING — Zahlen, Tage, IBAN (E-228)
// Alles Europe/Berlin, alles de-DE. Eine fehlende Zahl ist „—", nie 0.
// ═══════════════════════════════════════════════════════════════════════════

const EUR = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1.234,56 — ohne Währungszeichen, für Spalten. */
export const zahl = (cents: number | null | undefined) => (cents == null ? "—" : EUR.format(cents / 100));
/** 1.234,56 € */
export const geld = (cents: number | null | undefined) => (cents == null ? "—" : `${EUR.format(cents / 100)} €`);
/** +1.234,56 € / −1.234,56 € */
export const geldVz = (cents: number) => `${cents < 0 ? "−" : "+"}${EUR.format(Math.abs(cents) / 100)} €`;

const TZ = "Europe/Berlin";
export const heute = () => new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
export const gestern = () => new Date(Date.now() - 86_400_000).toLocaleDateString("sv-SE", { timeZone: TZ });

const alsDatum = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso));

export const tag = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ }).format(alsDatum(iso)) : "—";
export const tagLang = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(alsDatum(iso)) : "—";
export const zeit = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso)) : "—";
export const uhr = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso)) : "—";
export const monatName = (monat: string) =>
  new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${monat}-15T12:00:00Z`));
export const monatKurz = (monat: string) =>
  new Intl.DateTimeFormat("de-DE", { month: "short", timeZone: "UTC" }).format(new Date(`${monat}-15T12:00:00Z`)).replace(".", "");

/** „Heute", „Gestern" oder der lange Tagesname — wie in einer Banking-App. */
export function tagesKopf(iso: string): string {
  if (iso === heute()) return "Heute";
  if (iso === gestern()) return "Gestern";
  return tagLang(iso);
}

/** „1.234,56" / „1234.56" / „1234" → Cent. NaN, wenn es keine Zahl ist. */
export function centsAus(eingabe: string): number {
  const s = String(eingabe || "").trim().replace(/\s|€/g, "");
  if (!s) return NaN;
  const norm = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  if (!/^-?\d+(\.\d{1,2})?$/.test(norm)) return NaN;
  return Math.round(Number(norm) * 100);
}

export const betragText = (cents: number) => EUR.format(cents / 100);

// ── IBAN ────────────────────────────────────────────────────────────────────
export const ibanSauber = (s: string) => String(s || "").replace(/\s+/g, "").toUpperCase();
export const ibanHuebsch = (s: string) => ibanSauber(s).replace(/(.{4})/g, "$1 ").trim();
export const ibanMaske = (s: string) => {
  const x = ibanSauber(s);
  return x.length < 8 ? x : `${x.slice(0, 4)} •••• •••• ${x.slice(-4)}`;
};

export function ibanGueltig(roh: string): boolean {
  const s = ibanSauber(roh);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const um = s.slice(4) + s.slice(0, 4);
  let rest = 0;
  for (const z of um) {
    const w = /\d/.test(z) ? z : String(z.charCodeAt(0) - 55);
    for (const d of w) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

const LAENDER: Record<string, { name: string; laenge: number }> = {
  DE: { name: "Deutschland", laenge: 22 }, AT: { name: "Österreich", laenge: 20 }, CH: { name: "Schweiz", laenge: 21 },
  LT: { name: "Litauen", laenge: 20 }, BE: { name: "Belgien", laenge: 16 }, NL: { name: "Niederlande", laenge: 18 },
  FR: { name: "Frankreich", laenge: 27 }, IT: { name: "Italien", laenge: 27 }, ES: { name: "Spanien", laenge: 24 },
  LU: { name: "Luxemburg", laenge: 20 }, IE: { name: "Irland", laenge: 22 }, GB: { name: "Vereinigtes Königreich", laenge: 22 },
  PL: { name: "Polen", laenge: 28 }, HR: { name: "Kroatien", laenge: 21 }, RO: { name: "Rumänien", laenge: 24 },
  RS: { name: "Serbien", laenge: 22 }, BA: { name: "Bosnien und Herzegowina", laenge: 20 }, SI: { name: "Slowenien", laenge: 19 },
};

/** Was die IBAN gerade ist — für die Anzeige unter dem Feld. */
export function ibanZustand(roh: string): { art: "leer" | "tippt" | "gut" | "falsch"; text: string } {
  const s = ibanSauber(roh);
  if (!s) return { art: "leer", text: "" };
  const land = LAENDER[s.slice(0, 2)];
  if (land && s.length < land.laenge) return { art: "tippt", text: `${land.name} · noch ${land.laenge - s.length} Zeichen` };
  if (ibanGueltig(s)) return { art: "gut", text: `${land?.name ?? s.slice(0, 2)} · Prüfziffer stimmt` };
  if (s.length < 15) return { art: "tippt", text: land ? land.name : "" };
  return { art: "falsch", text: "Die Prüfziffer stimmt nicht — bitte jede Stelle ansehen." };
}

/** Initialen für den Kreis vor einem Umsatz. */
export function initialen(name: string): string {
  const teile = String(name || "").replace(/[0-9_.,;:!?()[\]{}"'/\\|@#$%^&*+=<>~`]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!teile.length) return "?";
  return (teile[0][0] + (teile.length > 1 ? teile[teile.length - 1][0] : "")).toUpperCase();
}
