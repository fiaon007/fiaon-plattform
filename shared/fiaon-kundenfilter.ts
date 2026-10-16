// ═══════════════════════════════════════════════════════════════════════════
// DIE FILTER DER BETREUUNG — EINE LISTE FÜR ZWEI ANSICHTEN (16.10.2026, E-389)
//
// Florentine: „Könnte man die Filter im Chefbüro bei Betreuung auch bei Alle
// Kunden einfügen? Da mich das jedesmal rüber schiebt und dann komm ich
// durcheinander.“ Stufe, Zuständiger und die Arbeitsfilter (KYC, Kündigungen …)
// gab es nur in der Kunden-Zentrale (Raum „Betreuung“); wer in „Alle Kunden“
// arbeitete, musste dafür den Raum wechseln.
//
// Hier stehen Schlüssel (Adresse, Server) und Titel (Knopf) der Filter, die
// BEIDE Ansichten anbieten. Die SQL-Bedingungen stehen weiter an EINER Stelle:
// filterBedingungen() in server/lib/fiaon-kundenzentrale.ts. Die Titel sind
// wortgleich mit der Kunden-Zentrale (client/src/pages/admin-kunden.tsx) —
// scripts/pruef-e389.ts hält das fest.
// ═══════════════════════════════════════════════════════════════════════════

/** Stufen A/B/C und „Bezahlt“ (priority_tier 1/2/3/0) — mehrfach wählbar. `zahl` = Schlüssel in den Zählern. */
export const KUNDEN_STUFEN = [
  { wert: "A", titel: "Stufe A", zahl: "stufe_a" },
  { wert: "B", titel: "Stufe B", zahl: "stufe_b" },
  { wert: "C", titel: "Stufe C", zahl: "stufe_c" },
  { wert: "bezahlt", titel: "Bezahlt", zahl: "bezahlt" },
] as const;

export interface KundenSpezialFilter {
  schluessel: KundenSpezialSchluessel;
  titel: string;
  /** Schlüssel in den Zählern; `null` = nicht zählbar. */
  zahl: string | null;
  erklaerung?: string;
}

export const KUNDEN_SPEZIAL_SCHLUESSEL = [
  "ohneAgent", "kycOffen", "zahlungUnbestaetigt", "kuendigungen", "kuendigungUngebucht", "ruhend",
  "ohneTelefon", "dubletten", "anonyme",
] as const;
export type KundenSpezialSchluessel = typeof KUNDEN_SPEZIAL_SCHLUESSEL[number];

/** Die Schalter hinter dem Knopf „Filter“, in den Gruppen der Kunden-Zentrale. */
export const KUNDEN_SPEZIAL_GRUPPEN: { titel: string; optionen: KundenSpezialFilter[] }[] = [
  {
    titel: "Arbeitslage",
    optionen: [
      { schluessel: "ohneAgent", titel: "Ohne Agent", zahl: "ohne_agent", erklaerung: "Niemand ist zuständig — die teuerste Lücke im Haus." },
      { schluessel: "kycOffen", titel: "KYC zu prüfen", zahl: "kyc_offen", erklaerung: "Unterlagen liegen vor, geprüft ist nichts." },
      { schluessel: "zahlungUnbestaetigt", titel: "Zahlung über 7 Tage offen", zahl: "zahlung_unbestaetigt", erklaerung: "Gemeldet, aber nicht gebucht." },
      { schluessel: "kuendigungen", titel: "Kündigungen", zahl: "kuendigungen" },
      { schluessel: "kuendigungUngebucht", titel: "Kündigung nicht gebucht", zahl: "kuendigung_ungebucht",
        erklaerung: "Antrag liegt vor, die Kündigung ist nicht gebucht — in der Akte „Jetzt buchen“." },
      { schluessel: "ruhend", titel: "Ruhend", zahl: "ruhend" },
    ],
  },
  {
    titel: "Datenqualität",
    optionen: [
      { schluessel: "ohneTelefon", titel: "Ohne Telefon", zahl: "ohne_telefon", erklaerung: "Nicht anrufbar — nur per Mail erreichbar." },
      { schluessel: "dubletten", titel: "Dubletten-Verdacht", zahl: null, erklaerung: "Gleiche Nummer oder Adresse wie jemand anderes." },
      { schluessel: "anonyme", titel: "Anonyme Abbrecher", zahl: "anonyme", erklaerung: "Weder Mail noch Nummer hinterlegt." },
    ],
  },
];

export const KUNDEN_SPEZIAL_TITEL: Record<KundenSpezialSchluessel, string> = Object.fromEntries(
  KUNDEN_SPEZIAL_GRUPPEN.flatMap((g) => g.optionen.map((o) => [o.schluessel, o.titel])),
) as Record<KundenSpezialSchluessel, string>;

/** Was aus der Adresse kommt — nur bekannte Schlüssel, Stufen nur A/B/C/bezahlt, Zuständiger nur als Zahl. */
export interface KundenZusatzFilter {
  stufe?: string[];
  agent?: number | null;
  spezial: Partial<Record<KundenSpezialSchluessel, true>>;
}

export function kundenZusatzAus(q: URLSearchParams | Record<string, unknown>): KundenZusatzFilter {
  const lies = (k: string): string | null => {
    if (q instanceof URLSearchParams) return q.get(k);
    const v = (q as Record<string, unknown>)[k];
    return v == null ? null : String(Array.isArray(v) ? v[0] : v);
  };
  const erlaubt = new Set<string>(KUNDEN_STUFEN.map((s) => s.wert));
  const stufe = String(lies("stufe") ?? "").split(",").map((s) => s.trim()).filter((s) => erlaubt.has(s));
  const agentRoh = Number(lies("agent"));
  const spezial: KundenZusatzFilter["spezial"] = {};
  for (const k of KUNDEN_SPEZIAL_SCHLUESSEL) { const v = lies(k); if (v === "1" || v === "true") spezial[k] = true; }
  return { stufe: stufe.length ? Array.from(new Set(stufe)) : undefined, agent: Number.isInteger(agentRoh) && agentRoh > 0 ? agentRoh : null, spezial };
}

/** Zurück in die Adresse (ohne leere Teile) — für die Liste und das Blättern in der Akte. */
export function kundenZusatzAlsSuche(f: KundenZusatzFilter): string {
  const p = new URLSearchParams();
  if (f.stufe?.length) p.set("stufe", f.stufe.join(","));
  if (f.agent) p.set("agent", String(f.agent));
  for (const k of KUNDEN_SPEZIAL_SCHLUESSEL) if (f.spezial[k]) p.set(k, "1");
  return p.toString();
}

/** Wie viele Zusatzfilter sind gesetzt? */
export function kundenZusatzAnzahl(f: KundenZusatzFilter): number {
  return (f.stufe?.length ? 1 : 0) + (f.agent ? 1 : 0) + Object.keys(f.spezial).length;
}
