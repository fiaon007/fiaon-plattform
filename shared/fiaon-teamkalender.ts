// ═══════════════════════════════════════════════════════════════════════════
// DER TEAMKALENDER (E-516, 16.11.2026) — reine Regeln, ohne DB und ohne Uhr
//
// ── DER ANLASS ──────────────────────────────────────────────────────────────
// Florentine (16.11.): „Was ebenfalls sehr hilfreich wäre, ist ein
// übergreifender Kalender für das gesamte Team. Darin sollte man auf einen
// Blick sehen können, wann Florentine, Dani oder Justin Termine haben, mit
// welchem Kunden und zu welcher Uhrzeit." Dazu: wer gerade Kapazität hat,
// keine Doppelbuchungen, Anrufe übernehmen können.
//
// ── JUSTINS ENTSCHEIDUNGEN (16.11.2026) ─────────────────────────────────────
// · Alle aktiven Mitarbeiter sehen den Teamkalender MIT Kundennamen.
// · „Übernehmen" geht STILL: Nur der Termin wandert, der Kunde bekommt keine
//   Mail, der Betreuer des Kunden bleibt derselbe (Mandat und Provision
//   unberührt) — siehe server/lib/fiaon-teamkalender.ts.
//
// ── WAS HIER STEHT ──────────────────────────────────────────────────────────
// Die Datentypen der Antwort von GET /agent/calendar/team, die Farbe je
// Person und „Jetzt frei": Wer ist im Dienst, ohne Termin, ohne geblockte
// Zeit — und bis wann? Die Berliner Zeit kommt von außen (zerlege), damit die
// Regel ohne Uhr prüfbar bleibt (Prüfstand scripts/pruef-teamkalender-e516.ts).
// ═══════════════════════════════════════════════════════════════════════════

export interface TeamPerson {
  id: number;
  name: string;
  vorname: string;
  rolle: string;
  /** Gerade im Office (Präsenz jünger als 20 Minuten, „da" oder „am Telefon"). */
  anwesend: boolean;
  ich: boolean;
}

export interface TeamTermin {
  id: number;
  agentId: number;
  beginn: string;
  dauerMin: number;
  status: string;
  /** Die echte Gesprächsart (fiaon_termine.quelle). */
  quelle: string;
  personId: number;
  kunde: string;
  firma: string | null;
  /** Firmen-Cockpit-Karte zu diesem Kontakt (Global) — sonst null. */
  firmaId: number | null;
  abgesagt: boolean;
  /** Der Termin liegt (übernommen oder vertreten) nicht beim Betreuer des Kunden. */
  vertretung: boolean;
  /** Vom Kunden selbst gebucht (nicht vom Mitarbeiter eingetragen). */
  selbstGebucht: boolean;
  artText: string;
  artTon: string;
}

export interface TeamSperre {
  agentId: number;
  beginn: string;
  ende: string;
  /** Nur bei den EIGENEN Sperren — bei Kollegen steht nur „belegt". */
  grund: string | null;
}

export interface TeamDienst {
  agentId: number;
  /** ISO-Wochentag 1 = Montag … 7 = Sonntag. */
  wochentag: number;
  /** „HH:MM" Berliner Wandzeit. */
  von: string;
  bis: string;
}

export interface TeamKalenderAntwort {
  personen: TeamPerson[];
  termine: TeamTermin[];
  sperren: TeamSperre[];
  dienst: TeamDienst[];
}

/** Standarddauer eines Termins ohne eigene Dauer (wie überall im Haus). */
export const TEAM_STANDARD_DAUER = 30;

// ── DIE FARBE JE PERSON ─────────────────────────────────────────────────────
// Acht gut unterscheidbare Töne auf dunklem Glas. Die Reihenfolge der
// Personen ist fest (ich zuerst, dann Leitung, dann nach Name) — damit behält
// jede Person ihre Farbe, solange sich das Team nicht ändert.
export const TEAM_FARBEN = ["#5aa9ff", "#34d399", "#f5a524", "#c084fc", "#f472b6", "#22d3ee", "#a3e635", "#fb7185"] as const;
export function teamFarbe(index: number): string {
  const n = TEAM_FARBEN.length;
  return TEAM_FARBEN[((index % n) + n) % n];
}

/** Die Reihenfolge der Spalten: ich, dann Leitung, dann alle anderen — je nach Vorname. */
export function personenOrdnen<T extends { ich: boolean; rolle: string; vorname: string; id: number }>(liste: T[]): T[] {
  const rang = (p: T) => (p.ich ? 0 : ["vertriebsleiter", "admin"].includes(p.rolle) ? 1 : 2);
  return [...liste].sort((a, b) => rang(a) - rang(b) || a.vorname.localeCompare(b.vorname, "de") || a.id - b.id);
}

// ── „JETZT FREI" ────────────────────────────────────────────────────────────
export type FreiZustand = "frei" | "termin" | "belegt" | "ausser_dienst" | "ohne_zeiten";
export interface FreiStand {
  agentId: number;
  zustand: FreiZustand;
  /** Bis wann der Zustand gilt — Berliner Uhrzeit „HH:MM" (heute), sonst null. */
  bis: string | null;
  text: string;
}

/** Berliner Tag (JJJJ-MM-TT), Minuten seit Mitternacht und ISO-Wochentag eines Zeitpunkts. */
export type Zerleger = (d: Date) => { tag: string; min: number; wd: number };

const hm = (s: string): number => Number(String(s).slice(0, 2)) * 60 + Number(String(s).slice(3, 5));
/** Minuten seit Mitternacht → „HH:MM" (Mitternacht am Tagesende = „24:00"). */
export const uhrAusMinuten = (m: number): string => {
  const x = Math.max(0, Math.min(24 * 60, Math.round(m)));
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
};

/**
 * Wer ist JETZT frei? Je Person genau ein Zustand, in dieser Rangfolge:
 *   termin        ein nicht abgesagter Termin läuft gerade        → „im Termin bis 11:00"
 *   belegt        eine geblockte Zeit läuft gerade                → „geblockt bis 12:00"
 *   ohne_zeiten   keine Arbeitszeiten hinterlegt                  → „keine Zeiten hinterlegt"
 *   ausser_dienst laut Arbeitszeiten gerade nicht im Dienst       → „nicht im Dienst"
 *   frei          im Dienst, nichts läuft → bis zum nächsten Termin, zur nächsten
 *                 geblockten Zeit oder zum Dienstende, was zuerst kommt („frei bis 14:00")
 */
export function jetztFrei(a: TeamKalenderAntwort, jetzt: Date, zerlege: Zerleger): FreiStand[] {
  const nun = zerlege(jetzt);
  const jetztMs = jetzt.getTime();
  return a.personen.map((p): FreiStand => {
    const meine = a.termine.filter((t) => t.agentId === p.id && !t.abgesagt);
    // Läuft gerade ein Termin?
    const laufend = meine.find((t) => {
      const b = new Date(t.beginn).getTime();
      return b <= jetztMs && jetztMs < b + (t.dauerMin || TEAM_STANDARD_DAUER) * 60_000;
    });
    if (laufend) {
      const ende = new Date(new Date(laufend.beginn).getTime() + (laufend.dauerMin || TEAM_STANDARD_DAUER) * 60_000);
      const z = zerlege(ende);
      const bis = z.tag === nun.tag ? uhrAusMinuten(z.min) : null;
      return { agentId: p.id, zustand: "termin", bis, text: bis ? `im Termin bis ${bis}` : "im Termin" };
    }
    const sperren = a.sperren.filter((s) => s.agentId === p.id);
    const gesperrt = sperren.find((s) => new Date(s.beginn).getTime() <= jetztMs && jetztMs < new Date(s.ende).getTime());
    if (gesperrt) {
      const z = zerlege(new Date(gesperrt.ende));
      const bis = z.tag === nun.tag ? uhrAusMinuten(z.min) : null;
      return { agentId: p.id, zustand: "belegt", bis, text: bis ? `geblockt bis ${bis}` : "geblockt" };
    }
    const bloecke = a.dienst.filter((d) => d.agentId === p.id);
    if (!bloecke.length) return { agentId: p.id, zustand: "ohne_zeiten", bis: null, text: "keine Zeiten hinterlegt" };
    const heute = bloecke.filter((d) => d.wochentag === nun.wd).map((d) => [hm(d.von), hm(d.bis)] as [number, number]);
    const block = heute.find(([v, b]) => nun.min >= v && nun.min < b);
    if (!block) {
      const spaeter = heute.filter(([v]) => v > nun.min).sort((x, y) => x[0] - y[0])[0];
      return {
        agentId: p.id, zustand: "ausser_dienst", bis: spaeter ? uhrAusMinuten(spaeter[0]) : null,
        text: spaeter ? `im Dienst ab ${uhrAusMinuten(spaeter[0])}` : "heute nicht mehr im Dienst",
      };
    }
    // Frei — bis zum ersten Ereignis, das heute noch kommt.
    let bisMin = block[1];
    for (const t of meine) {
      const z = zerlege(new Date(t.beginn));
      if (z.tag === nun.tag && z.min > nun.min) bisMin = Math.min(bisMin, z.min);
    }
    for (const s of sperren) {
      const z = zerlege(new Date(s.beginn));
      if (z.tag === nun.tag && z.min > nun.min) bisMin = Math.min(bisMin, z.min);
    }
    const bis = uhrAusMinuten(bisMin);
    return { agentId: p.id, zustand: "frei", bis, text: `frei bis ${bis}` };
  });
}

// ── DER KUNDENNAME IM TEAMKALENDER ──────────────────────────────────────────
// „Privatperson · Max Muster", „GmbH", „Selbständig" sind keine Firmen —
// der Name kommt dann aus Vor- und Nachname, die Firma aus der Lead-Mappe.
const KEINE_FIRMA = /^(privatperson\b|gmbh$|ug$|ag$|selbst(ä|ae)ndig$|mehrere$|keine$|-$|—$)/i;
export function istEchteFirma(s: unknown): boolean {
  const t = String(s ?? "").trim();
  return t.length >= 2 && !KEINE_FIRMA.test(t) && !/\(firma offen\)/i.test(t);
}
export function kundeUndFirma(z: {
  first_name?: string | null; last_name?: string | null; contact_name?: string | null; company_name?: string | null;
  firmen_karte?: string | null; mappe_firma?: string | null;
}): { kunde: string; firma: string | null } {
  const name = [z.first_name, z.last_name].map((x) => String(x ?? "").trim()).filter(Boolean).join(" ")
    || String(z.contact_name ?? "").trim();
  const firma = [z.mappe_firma, z.company_name, z.firmen_karte].find(istEchteFirma) ?? null;
  const kunde = name || (firma ?? String(z.company_name ?? "").replace(/^privatperson\s*·\s*/i, "").trim()) || "Kunde";
  return { kunde, firma: firma && firma.toLowerCase() !== kunde.toLowerCase() ? String(firma).trim().slice(0, 120) : null };
}
