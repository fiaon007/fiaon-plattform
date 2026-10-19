// ═══════════════════════════════════════════════════════════════════════════
// „HEUTE DRAN“ — EINE LISTE JE MITARBEITER (E-406 A, 19.10.2026)
//
// Justin (Vorschlag 3 „Mara führt den Betrieb“, Etappe A): Jeder Mitarbeiter
// sieht auf seinem Schreibtisch, was heute dran ist — höchstens 25 Einträge,
// fair verteilt nach seiner Arbeitszeit. Was nicht hineinpasst, steht sichtbar
// als „Rückstau“ und geht nie still verloren.
//
// ── DER BEFUND (Aufgaben-Check 19.10., nur lesend) ─────────────────────────
// Die Arbeit steckte an acht Orten (Aufträge, Rückrufe, Termine, Inkasso,
// „Zahlung gemeldet“, KYC, Anliegen, Bonität) plus der Pipeline. Daniel hatte
// 563 Aufträge, Nikita 48; 737 Team-Aufträge waren nie geöffnet. Niemand sah,
// was HEUTE zuerst kommt.
//
// ── WAS HIER STEHT ─────────────────────────────────────────────────────────
// Nur die REGELN — rein, ohne Datenbank, im Prüfstand geprüft
// (scripts/pruef-heute-dran.ts): Reihenfolge nach Wirkung, eine Zeile je
// Kunde, Verteilung nach Arbeitszeit, Rückstau. Die Einträge sammelt der
// Server (server/lib/fiaon-heute-dran.ts) aus den bestehenden Quellen. Keine
// KI — die Liste läuft auch in der KI-Pause. Nur lesend: Niemand bekommt
// dadurch neue Rechte, nichts wird geschrieben, kein eigener Abhak-Speicher.
//
// ── DIE REIHENFOLGE NACH WIRKUNG ───────────────────────────────────────────
//   1  Termine und Rückrufe mit Uhrzeit heute, in Zeitfolge — und Rückruf-
//      Versprechen, die schon überfällig sind (höchstens 14 Tage alt), davor
//   2  Geld frisch: Rate seit höchstens 3 Tagen fällig; Zahlung gemeldet,
//      jünger als 72 Stunden (gestern fällig zahlt ~19 %, 60 Tage alt fast nie)
//   3  Fälle mit Frist: Kündigung, Widerruf, Beschwerde, Anwalt (frische zuerst)
//   4  frische A/B-Kunden aus der Hitze-Liste (E-162/E-251)
//   5  bezahlte Bonitätsauswertungen, die warten
//   6  der Rest — frisch vor alt
//   7  Inkasso-Altbestand (älter als 30 Tage) ganz unten
//
// ── „ERLEDIGT“ KOMMT AUS DER QUELLE ────────────────────────────────────────
// Rate bezahlt oder heute bearbeitet, Auftrag zu, Termin geführt, Anliegen
// beantwortet … Der Server liefert jeden Eintrag mit `erledigt`. Hier wird
// nur gezählt: „N von M erledigt“. M = erledigt + was heute sichtbar offen ist.
// Gegen die Tagesmenge zählt nur, was der Mensch SELBST getan hat — eine Rate,
// die per Bank kam, oder ein Auftrag, den die Automatik schloss, frisst keinen
// Platz (`vonAllein`, Prüfer-Fund 19.10.).
//
// ── NACHBESSERUNG (Prüfer-Funde 19.10.2026) ────────────────────────────────
//   · Überfällige Rückruf-Versprechen bleiben oben (Stufe 1), statt nach dem
//     Ablauf der Frist nach unten zu rutschen — aber nur 14 Tage lang. Gemessen
//     19.10.: alle 102 offenen Rückruf-Wünsche stammen vom 02.–09.09.; sie oben
//     anzuheften hätte jede Liste mit Wochen altem Rückstand gefüllt.
//   · Hat ein Kunde eine offene Kündigung, einen Widerruf oder eine Beschwerde,
//     ist DAS seine Zeile. Rate, Zahlungsmeldung und Pipeline-Anruf stehen nur
//     klein darunter: „erst klären, kein Druck“ (E-391/E-393).
//   · Wer heute keine Arbeitszeit hat, gibt Termine, überfällige Rückrufe und
//     Fristfälle ab: bei Team-Abwesenheit an den Vertreter (E-260), sonst an
//     die Rolle zur Lage. Der Rest bleibt in seinem Rückstau.
// ═══════════════════════════════════════════════════════════════════════════

/** Höchstens so viele Einträge stehen heute auf einer Liste. */
export const HEUTE_DRAN_HOECHSTENS = 25;
/** Ein voller Arbeitstag — wer so lange (oder länger) arbeitet, bekommt die volle Menge. */
export const VOLLER_TAG_MINUTEN = 8 * 60;
/** Eine Rate, die seit höchstens so vielen Tagen fällig ist, ist „Geld frisch“. */
export const GELD_FRISCH_TAGE = 3;
/** Eine Zahlungsmeldung, die höchstens so alt ist, ist „Geld frisch“. */
export const MELDUNG_FRISCH_STUNDEN = 72;
/** Älter als so viele Tage = Inkasso-Altbestand (ganz unten). */
export const ALTBESTAND_TAGE = 30;
/** Ältere Zahlungsmeldungen folgen der bestehenden 14-Tage-Regel und stehen nicht mehr hier. */
export const MELDUNG_HOECHSTENS_TAGE = 14;
/** Überfällige vereinbarte Rückrufe zählen so weit zurück; ältere sind keine Tagesarbeit mehr. */
export const RUECKRUF_RUECKBLICK_TAGE = 14;
/** Im Rückstau liefert der Server höchstens so viele Zeilen mit (die Zahl stimmt trotzdem). */
export const RUECKSTAU_ZEILEN = 60;

/**
 * Auftragsarten, bei denen niemand zum Zahlen oder Kaufen drängt, solange sie offen sind (E-391/E-393):
 * Kündigung, Widerruf, Beschwerde — auch die heiklen Übergaben aus Mail und WhatsApp. Nicht dabei: „Zahlung
 * verweigert“ (mara_eskalation, da geht es ums Geld) und der Löschantrag an die Auskunftei (Service).
 */
export const KEIN_DRUCK_ARTEN: readonly string[] = ["kuendigung", "beschwerde", "mara_mail_heikel", "mara_wa_heikel"];
/** Quellen, die zum Zahlen oder Kaufen drängen: Rate, Zahlungsmeldung, Pipeline-Anruf. */
export const DRUCK_QUELLEN: readonly string[] = ["inkasso", "zahlung", "hitze"];
/** So steht eine zurückgestellte Rate (o. ä.) unter der Kündigungs-Zeile. */
export const KEIN_DRUCK_ZUSATZ = "erst klären, kein Druck";

export type HeuteQuelle =
  | "termin" | "rueckruf" | "auftrag" | "inkasso" | "zahlung" | "kyc" | "anliegen" | "hitze" | "bonitaet";

/** Welche Rolle übernimmt einen Eintrag OHNE Zuständigen? (Rolle zur Lage, wie auftragEmpfaenger, E-116) */
export type HeuteRolle = "vertrieb" | "inkasso";

export type HeuteStufe = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const STUFE_TEXT: Record<HeuteStufe, string> = {
  1: "Mit Uhrzeit",
  2: "Geld frisch",
  3: "Frist",
  4: "Frisch: A/B",
  5: "Bonität bezahlt",
  6: "Weitere",
  7: "Altbestand",
};

/**
 * Die Rolle zur Lage — welche Mitarbeiter-Rollen einen Eintrag ohne Zuständigen bekommen, in dieser Reihenfolge.
 * Dieselbe Ableitung wie auftragEmpfaenger (server/routes/fiaon-betreiber-todo.ts): Rückstand → Forderungsmanagement,
 * sonst Vertriebsleitung. Nie ein beliebiger Bonitätsmanager (er darf fremde Kunden nicht öffnen), nie Justin.
 */
export const ROLLEN_FUER_LAGE: Record<HeuteRolle, readonly string[]> = {
  inkasso: ["inkasso", "vertriebsleiter"],
  vertrieb: ["vertriebsleiter"],
};

/** Ein Eintrag, wie der Server ihn aus einer Quelle liest. */
export interface HeuteEintrag {
  /** Eindeutig über alle Quellen, z. B. „termin:123“. */
  schluessel: string;
  quelle: HeuteQuelle;
  personId: number | null;
  /** Der Kunde (oder der Titel, wenn es keinen Kunden gibt). */
  name: string;
  /** Der Grund in 3–6 Wörtern. */
  grund: string;
  /** Betrag in Cent, wenn es um Geld geht. */
  betragCents: number | null;
  /** Wohin der Klick führt — immer eine bestehende Stelle im Office (/agent/…). */
  ziel: string;
  /** Feste Uhrzeit (ISO): Termin, vereinbarter Rückruf, Rückruf-Frist. */
  zeit: string | null;
  /** Das Ereignis, an dem „frisch“ gemessen wird (ISO): Fälligkeit, Meldung, Eingang. */
  seit: string | null;
  /** Wer zuständig ist (fiaon_agents.id) — null = niemand. */
  zustaendigId: number | null;
  rolle: HeuteRolle;
  /** Aus der Quelle abgeleitet: heute erledigt. */
  erledigt: boolean;
  /** Fall mit Frist (Kündigung, Widerruf, Beschwerde, Anwalt). */
  frist?: boolean;
  /** Frischer A/B-Kunde aus der Hitze-Liste. */
  hitzeFrisch?: boolean;
  /** Inkasso: seit so vielen Tagen fällig (die JÜNGSTE fällige Rate des Kunden). */
  tageFaellig?: number | null;
  /** Auftragsart (nur Quelle „auftrag“) — für KEIN_DRUCK_ARTEN. */
  art?: string | null;
  /**
   * Erledigt OHNE den Mitarbeiter: Geld kam per Bank, die Automatik hat den Auftrag geschlossen. Steht bei
   * „erledigt“ (gute Nachricht), frisst aber keinen Platz der Tagesmenge.
   */
  vonAllein?: boolean;
  /** Nie an einen anderen Menschen weitergeben: Gründer-Gespräch, FIAON Global (NIE_UMLEITEN_QUELLEN, E-260). */
  nieUmleiten?: boolean;
}

/** Ein Eintrag auf einer Liste: mit Stufe, weiteren Gründen desselben Kunden und der Marke „verteilt“. */
export interface HeuteZeile extends HeuteEintrag {
  stufe: HeuteStufe;
  /** Weitere offene Gründe desselben Kunden — eine Zeile je Kunde (höchstens drei). */
  weitere: string[];
  /** true = hatte keinen Zuständigen und wurde nach der Rolle zur Lage zugeteilt (nur in dieser Liste, nichts gespeichert). */
  verteilt: boolean;
  /** Gehört einem Kollegen, der heute keine Arbeitszeit hat — heute in Vertretung auf dieser Liste (sein Name). */
  vertretungFuer: string | null;
}

export interface TeamMitglied {
  id: number;
  name: string;
  /** fiaon_agents.rolle (agent | vertriebsleiter | inkasso | onboarding). */
  rolle: string;
  /** Arbeitszeit heute in Minuten (Verfügbarkeit, Abwesenheit schon abgezogen). */
  minuten: number;
  /** Team-Abwesenheit (E-260): Wer heute für ihn anruft. Nur gesetzt, solange er abwesend ist. */
  vertreterId?: number | null;
}

export interface PersonPlan {
  agentId: number;
  name: string;
  minuten: number;
  /** So viele Einträge passen heute (0–25). */
  kapazitaet: number;
  /** Was heute sichtbar offen ist, in Reihenfolge. */
  offen: HeuteZeile[];
  /** Was heute schon erledigt ist. */
  erledigt: HeuteZeile[];
  /** Was nicht mehr hineinpasst — sichtbar, aufklappbar. */
  rueckstau: HeuteZeile[];
  /** dringend = davon im Rückstau mit Uhrzeit oder Frist (bleibt nur liegen, wenn heute niemand übernehmen kann). */
  zahlen: { heuteDran: number; erledigt: number; rueckstau: number; dringend: number };
  /** So viele dringende Einträge (Uhrzeit, Frist) hat heute jemand anderes übernommen — er hat keine Arbeitszeit. */
  weitergegeben: number;
  /** Ein Satz, wenn die Liste leer ist, weil keine Arbeitszeit eingetragen ist. */
  hinweis: string | null;
}

export interface TeamPlan {
  personen: PersonPlan[];
  /** Einträge ohne Zuständigen, für die heute niemand der passenden Rolle arbeitet. */
  ohneZustaendigen: HeuteZeile[];
  /** Einträge, die bei der Geschäftsführung liegen (nie auf einer Mitarbeiterliste). */
  beiGeschaeftsfuehrung: number;
}

// ── Kleine Helfer ──────────────────────────────────────────────────────────

/** Der Berliner Kalendertag (JJJJ-MM-TT) eines Zeitpunkts. „sv-SE“ liefert genau diese Form. */
export function berlinTag(wann: string | Date | null | undefined): string | null {
  if (wann == null) return null;
  const d = typeof wann === "string" ? new Date(wann) : wann;
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

const ms = (iso: string | null | undefined): number => {
  if (!iso) return NaN;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
};

/** „HH:MM(:SS)“ → Minuten ab Mitternacht; null bei Unsinn. */
export function uhrMinuten(v: unknown): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(v ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 24 || mi > 59) return null;
  return h * 60 + mi;
}

/**
 * Arbeitszeit eines Tages in Minuten aus den Fenstern der Verfügbarkeit (fiaon_agent_verfuegbarkeit).
 * Überlappende Fenster zählen einmal; kaputte Fenster (bis ≤ von) zählen nicht.
 * `abMinute`: erst ab dieser Uhrzeit (Minuten ab Mitternacht) zählen — z. B. wenn eine Abwesenheit heute endet.
 */
export function arbeitsMinuten(fenster: readonly { von: unknown; bis: unknown }[], abMinute = 0): number {
  const teile = fenster
    .map((f) => [uhrMinuten(f.von), uhrMinuten(f.bis)] as const)
    .filter((t): t is readonly [number, number] => t[0] != null && t[1] != null && t[1] > t[0])
    .map(([von, bis]) => [Math.max(von, abMinute), bis] as const)
    .filter(([von, bis]) => bis > von)
    .sort((a, b) => a[0] - b[0]);
  let summe = 0, ende = -1;
  for (const [von, bis] of teile) {
    if (bis <= ende) continue;
    summe += bis - Math.max(von, ende);
    ende = bis;
  }
  return summe;
}

/**
 * Wie viele Einträge passen heute? Nach der Arbeitszeit: ein voller Tag (8 Std.) = 25, ein halber = 13,
 * keine Arbeitszeit = 0. Nie mehr als 25.
 */
export function kapazitaet(minuten: number): number {
  if (!Number.isFinite(minuten) || minuten <= 0) return 0;
  return Math.min(HEUTE_DRAN_HOECHSTENS, Math.ceil((HEUTE_DRAN_HOECHSTENS * minuten) / VOLLER_TAG_MINUTEN));
}

/** Höchstens sechs Wörter — der Grund bleibt kurz, auch wenn eine Quelle einen langen Titel liefert. */
export function kurzGrund(text: string, woerter = 6): string {
  const teile = String(text ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (teile.length <= woerter) return teile.join(" ");
  return `${teile.slice(0, woerter).join(" ").replace(/[,;:–-]+$/, "")} …`;
}

/** Jedes Klickziel ist eine bestehende Stelle im Office — nie das Chefbüro, nie eine fremde Seite. */
export function zielErlaubt(ziel: string): boolean {
  const z = String(ziel ?? "");
  return /^\/agent\/[a-z]/.test(z) && !z.includes("/chef/") && !z.includes("//") && !/^\/agent\/chef/.test(z);
}

// ── Die Reihenfolge ────────────────────────────────────────────────────────

/** Ein Kalendertag (JJJJ-MM-TT) so viele Tage früher — reine Datumsrechnung, ohne Sommerzeit-Falle. */
export function tagZurueck(tag: string, tage: number): string {
  const d = new Date(`${tag}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - tage);
  return d.toISOString().slice(0, 10);
}

/**
 * Ist ein Versprechen mit Uhrzeit (Termin, Rückruf, Rückruf-Frist) heute dran? Ja, wenn die Zeit heute ist —
 * oder schon vorbei, aber höchstens RUECKRUF_RUECKBLICK_TAGE alt. Ein Kunde, der schon zu lange wartet, rutscht
 * nicht nach unten (Prüfer-Fund 19.10.: Frist 10:00, um 10:05 stand er auf Stufe 6). Ältere sind keine
 * Tagesarbeit mehr — dieselbe Grenze wie bei den vereinbarten Rückrufen.
 */
export function versprechenHeuteDran(zeit: string | null | undefined, jetzt: Date = new Date()): boolean {
  const tag = berlinTag(zeit), heute = berlinTag(jetzt);
  if (!tag || !heute) return false;
  return tag <= heute && tag >= tagZurueck(heute, RUECKRUF_RUECKBLICK_TAGE);
}

/** Die Stufe eines Eintrags — die EINE Antwort auf „wie wichtig ist das heute?“. */
export function stufeVon(e: HeuteEintrag, jetzt: Date = new Date()): HeuteStufe {
  if ((e.quelle === "termin" || e.quelle === "rueckruf") && versprechenHeuteDran(e.zeit, jetzt)) return 1;
  if (e.quelle === "inkasso" && e.tageFaellig != null && e.tageFaellig > ALTBESTAND_TAGE) return 7;
  if (e.quelle === "inkasso" && e.tageFaellig != null && e.tageFaellig >= 0 && e.tageFaellig <= GELD_FRISCH_TAGE) return 2;
  if (e.quelle === "zahlung") {
    const alter = jetzt.getTime() - ms(e.seit);
    if (Number.isFinite(alter) && alter <= MELDUNG_FRISCH_STUNDEN * 3_600_000) return 2;
  }
  if (e.frist) return 3;
  if (e.quelle === "hitze" && e.hitzeFrisch) return 4;
  if (e.quelle === "bonitaet") return 5;
  return 6;
}

/**
 * Innerhalb einer Stufe: Uhrzeit aufsteigend (1); Bonität: wer am längsten wartet (5 — der Kunde hat bezahlt);
 * sonst frisch vor alt — auch bei den Fristen (3): Gemessen 19.10. lagen bei einem Mitarbeiter 253 Fristfälle,
 * die meisten Wochen alt und oft schon erledigt (Aufgaben-Check 2.3); ein frischer Widerruf hat seine Frist noch vor sich.
 */
export function vergleich(a: HeuteZeile, b: HeuteZeile): number {
  if (a.stufe !== b.stufe) return a.stufe - b.stufe;
  const aufsteigend = (x: number, y: number) => (Number.isNaN(x) ? (Number.isNaN(y) ? 0 : 1) : Number.isNaN(y) ? -1 : x - y);
  const absteigend = (x: number, y: number) => (Number.isNaN(x) ? (Number.isNaN(y) ? 0 : 1) : Number.isNaN(y) ? -1 : y - x);
  let r = 0;
  if (a.stufe === 1) r = aufsteigend(ms(a.zeit), ms(b.zeit));
  else if (a.stufe === 5) r = aufsteigend(ms(a.seit), ms(b.seit));
  else r = absteigend(ms(a.seit), ms(b.seit));
  return r || (a.schluessel < b.schluessel ? -1 : a.schluessel > b.schluessel ? 1 : 0);
}

export function zeileAus(e: HeuteEintrag, jetzt: Date = new Date()): HeuteZeile {
  return { ...e, stufe: stufeVon(e, jetzt), weitere: [], verteilt: false, vertretungFuer: null };
}

/** Kunden mit einem offenen Fall aus KEIN_DRUCK_ARTEN (Kündigung, Widerruf, Beschwerde) — über ALLE Listen hinweg. */
export function kundenOhneDruck(eintraege: readonly HeuteEintrag[]): Set<number> {
  const s = new Set<number>();
  for (const e of eintraege) {
    if (!e.erledigt && e.personId != null && e.quelle === "auftrag" && !!e.art && KEIN_DRUCK_ARTEN.includes(e.art)) s.add(Number(e.personId));
  }
  return s;
}

/**
 * Rate, Zahlungsmeldung oder Pipeline-Anruf eines Kunden mit offener Kündigung/Beschwerde: nach hinten (Stufe 6),
 * mit dem Zusatz „erst klären, kein Druck“ und mit der Akte als Ziel statt des Inkassos. Liegt die Kündigung auf
 * derselben Liste, ist sie die Zeile und dies steht klein darunter (E-391/E-393, Prüfer-Fund 19.10.).
 */
export function ohneDruck(z: HeuteZeile): HeuteZeile {
  if (z.erledigt || !DRUCK_QUELLEN.includes(z.quelle)) return z;
  return {
    ...z,
    stufe: (z.stufe < 6 ? 6 : z.stufe) as HeuteStufe,
    grund: `${z.grund} – ${KEIN_DRUCK_ZUSATZ}`,
    ziel: z.personId != null ? `/agent/kunden?person=${z.personId}` : z.ziel,
  };
}

/**
 * Eine Zeile je Kunde.
 *  · Offene Einträge desselben Kunden werden eine Zeile: Es bleibt der wichtigste, die anderen Gründe stehen in
 *    `weitere` — sonst ruft man denselben Menschen dreimal an.
 *  · Ist für denselben Kunden ein Eintrag DERSELBEN Quelle heute schon erledigt (Rate heute bearbeitet, Anruf
 *    heute geführt), zählt der offene nicht mehr — die Sache ist für heute getan. Das gilt nur für Quellen, die
 *    je Kunde EINE Sache kennen (PERSONEN_QUELLEN); ein zweites offenes Anliegen oder ein zweiter Auftrag
 *    desselben Kunden bleibt Arbeit, auch wenn das erste heute beantwortet wurde.
 *  · Erledigte desselben Kunden zählen einmal.
 * Einträge ohne Kunden bleiben, wie sie sind.
 */
/** Quellen mit EINER Sache je Kunde (Raten, Meldung, Pipeline-Karte, KYC, Auswertung) — anders als Termine, Rückrufe, Aufträge, Anliegen. */
export const PERSONEN_QUELLEN: readonly HeuteQuelle[] = ["inkasso", "zahlung", "hitze", "kyc", "bonitaet"];

export function zusammenfassen(zeilen: readonly HeuteZeile[]): HeuteZeile[] {
  const sortiert = [...zeilen].sort(vergleich);
  const erledigtQuelle = new Set<string>();
  for (const z of sortiert) {
    if (z.erledigt && z.personId != null && PERSONEN_QUELLEN.includes(z.quelle)) erledigtQuelle.add(`${z.personId}|${z.quelle}`);
  }
  const ergebnis: HeuteZeile[] = [];
  const offenJe = new Map<number, HeuteZeile>();
  const erledigtJe = new Map<number, HeuteZeile>();
  for (const z of sortiert) {
    if (z.personId == null) { ergebnis.push({ ...z, weitere: [...z.weitere] }); continue; }
    if (z.erledigt) {
      const schon = erledigtJe.get(z.personId);
      // Eine Zeile je Kunde — hat der Mensch selbst etwas getan, zählt sie als eigene Arbeit (nicht „von allein“).
      if (schon) { if (!z.vonAllein) schon.vonAllein = false; continue; }
      const neu = { ...z, weitere: [...z.weitere] };
      erledigtJe.set(z.personId, neu);
      ergebnis.push(neu);
      continue;
    }
    if (erledigtQuelle.has(`${z.personId}|${z.quelle}`)) continue;
    const da = offenJe.get(z.personId);
    if (!da) {
      const neu = { ...z, weitere: [...z.weitere] };
      offenJe.set(z.personId, neu);
      ergebnis.push(neu);
      continue;
    }
    // Derselbe Grund aus zwei Quellen („Zahlung gemeldet – …“ aus Meldung und Pipeline) steht nur einmal da.
    const kern = (g: string) => g.toLowerCase().replace(/[^a-zäöüß ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2).join(" ");
    for (const g of [z.grund, ...z.weitere]) {
      if (!g || da.weitere.length >= 3) continue;
      if (kern(g) === kern(da.grund) || da.weitere.some((w) => kern(w) === kern(g))) continue;
      da.weitere.push(g);
    }
    if (da.betragCents == null && z.betragCents != null) da.betragCents = z.betragCents;
    // Steckt ein Fristfall in der Zeile, ist die ganze Zeile dringend (Weitergabe bei Arbeitszeit 0, Zählung „dringend“).
    if (z.frist) da.frist = true;
  }
  return ergebnis.sort(vergleich);
}

// ── Die Verteilung ─────────────────────────────────────────────────────────

export interface PlanOptionen {
  jetzt?: Date;
  /** Konten der Geschäftsführung (Justin, Prüf- und Testkonten): was dort liegt, bleibt dort — nie auf einer Mitarbeiterliste. */
  betreiberIds?: readonly number[];
}

/**
 * Der Tagesplan für das ganze Team. Rein — dieselben Einträge geben denselben Plan.
 *
 *  1. Ein Eintrag gehört seinem Zuständigen, wenn der heute zum Team gehört.
 *  2. Liegt er bei der Geschäftsführung, bleibt er dort (gezählt, nie verteilt).
 *  3. Sonst (kein Zuständiger, oder gesperrt/inaktiv) geht er an die Rolle zur Lage mit der geringsten Last —
 *     Last = offene Einträge je Platz der Tagesmenge. Wer heute keine Arbeitszeit hat, bekommt nichts dazu;
 *     arbeitet niemand der Rolle, steht er unter „ohne Zuständigen“ (sichtbar für die Leitung).
 *  4. Wer heute keine Arbeitszeit hat, gibt das Dringende ab (Uhrzeit heute/überfällig, Fristfall): bei
 *     Team-Abwesenheit an den Vertreter (ist das die Geschäftsführung, bleibt es dort, gezählt), sonst an die
 *     Rolle zur Lage. Gründer- und Global-Termine nie (nieUmleiten). Der Rest bleibt in seinem Rückstau.
 *  5. Je Person: eine Zeile je Kunde, Reihenfolge nach Wirkung, dann die Tagesmenge. Termine und Rückrufe mit
 *     Uhrzeit stehen immer drin (bis 25); Erledigtes zählt nur mit, wenn der Mensch es selbst getan hat
 *     (nicht `vonAllein`). Der Rest ist der Rückstau.
 * Vorher: Rate, Zahlungsmeldung und Pipeline-Anruf eines Kunden mit offener Kündigung/Beschwerde gehen nach
 * hinten (ohneDruck) — egal, auf wessen Liste die Kündigung liegt.
 */
export function planen(eintraege: readonly HeuteEintrag[], team: readonly TeamMitglied[], opt: PlanOptionen = {}): TeamPlan {
  const jetzt = opt.jetzt ?? new Date();
  const betreiber = new Set((opt.betreiberIds ?? []).map(Number));
  const mitglieder = new Map(team.map((m) => [Number(m.id), m]));
  const eimer = new Map<number, HeuteZeile[]>(team.map((m) => [Number(m.id), []]));
  let beiGeschaeftsfuehrung = 0;
  const ohneZustaendigenRoh: HeuteZeile[] = [];
  const keinDruck = kundenOhneDruck(eintraege);

  for (const e of eintraege) {
    let z = zeileAus(e, jetzt);
    if (z.personId != null && keinDruck.has(Number(z.personId))) z = ohneDruck(z);
    const id = e.zustaendigId == null ? null : Number(e.zustaendigId);
    if (id != null && mitglieder.has(id)) { eimer.get(id)!.push(z); continue; }
    if (id != null && betreiber.has(id)) { if (!z.erledigt) beiGeschaeftsfuehrung++; continue; }
    // Erledigtes ohne Mitglied als Handelnden zählt bei niemandem — es war nicht die Arbeit eines Mitarbeiters.
    if (z.erledigt) continue;
    ohneZustaendigenRoh.push(z);
  }

  // Offene Last je Mitglied (eine Zeile je Kunde), damit „geringste Last“ ehrlich zählt.
  const last = new Map<number, number>();
  for (const [id, liste] of Array.from(eimer.entries())) last.set(id, zusammenfassen(liste).filter((z) => !z.erledigt).length);

  // Wer heute keine Arbeitszeit hat: Das Dringende geht an den Vertreter bzw. die Rolle zur Lage (Prüfer-Fund 19.10.:
  // vorher lag es nur im eigenen Rückstau — der Vertreter einer Team-Abwesenheit sah die Termine der Abwesenden nicht).
  const weitergegeben = new Map<number, number>();
  for (const m of team) {
    const id = Number(m.id);
    if (kapazitaet(m.minuten) > 0) continue;
    const bleibt: HeuteZeile[] = [];
    for (const z of zusammenfassen(eimer.get(id) ?? [])) {
      if (z.erledigt || z.nieUmleiten || !(z.stufe === 1 || z.frist)) { bleibt.push(z); continue; }
      const vertreter = m.vertreterId != null ? Number(m.vertreterId) : null;
      let ziel: number | null = null;
      let zurGeschaeftsfuehrung = false;
      if (vertreter != null && vertreter !== id) {
        const v = mitglieder.get(vertreter);
        if (v && kapazitaet(v.minuten) > 0) ziel = vertreter;
        else if (betreiber.has(vertreter)) zurGeschaeftsfuehrung = true;
      }
      if (ziel == null && !zurGeschaeftsfuehrung) ziel = waehleFuerLage(z.rolle, team, last);
      if (zurGeschaeftsfuehrung) beiGeschaeftsfuehrung++;
      else if (ziel != null) {
        eimer.get(ziel)!.push({ ...z, verteilt: true, vertretungFuer: m.name });
        last.set(ziel, (last.get(ziel) ?? 0) + 1);
      } else { bleibt.push(z); continue; }
      weitergegeben.set(id, (weitergegeben.get(id) ?? 0) + 1);
    }
    eimer.set(id, bleibt);
  }

  const ohneZustaendigen: HeuteZeile[] = [];
  for (const z of zusammenfassen(ohneZustaendigenRoh)) {
    const ziel = waehleFuerLage(z.rolle, team, last);
    if (ziel == null) { ohneZustaendigen.push(z); continue; }
    eimer.get(ziel)!.push({ ...z, verteilt: true });
    last.set(ziel, (last.get(ziel) ?? 0) + 1);
  }

  const personen: PersonPlan[] = team.map((m) => {
    const alle = zusammenfassen(eimer.get(Number(m.id)) ?? []);
    const erledigt = alle.filter((z) => z.erledigt);
    // Gegen die Tagesmenge zählt nur eigene Arbeit — nicht die Rate, die per Bank kam (Prüfer-Fund 19.10.).
    const eigeneErledigt = erledigt.filter((z) => !z.vonAllein).length;
    const offenAlle = alle.filter((z) => !z.erledigt);
    const kap = kapazitaet(m.minuten);
    const offen: HeuteZeile[] = [];
    const rueckstau: HeuteZeile[] = [];
    if (kap === 0) {
      rueckstau.push(...offenAlle);
    } else {
      // Eine feste Uhrzeit ist ein Versprechen an den Kunden — sie steht immer drin, auch wenn die
      // Tagesmenge mit Erledigtem schon voll ist (höchstens 25 solcher Einträge).
      let mitUhrzeit = 0;
      for (const z of offenAlle) {
        if (z.stufe === 1 && mitUhrzeit < HEUTE_DRAN_HOECHSTENS) { offen.push(z); mitUhrzeit++; }
        else if (eigeneErledigt + offen.length < kap) offen.push(z);
        else rueckstau.push(z);
      }
    }
    const abgegeben = weitergegeben.get(Number(m.id)) ?? 0;
    return {
      agentId: Number(m.id), name: m.name, minuten: m.minuten, kapazitaet: kap,
      offen, erledigt, rueckstau,
      zahlen: {
        heuteDran: erledigt.length + offen.length, erledigt: erledigt.length, rueckstau: rueckstau.length,
        dringend: rueckstau.filter((z) => z.stufe === 1 || z.frist === true).length,
      },
      weitergegeben: abgegeben,
      hinweis: kap === 0
        ? `Heute ist keine Arbeitszeit eingetragen — deshalb ist die Liste leer.${abgegeben ? ` ${abgegeben} dringende ${abgegeben === 1 ? "Sache übernimmt" : "Sachen übernimmt"} heute jemand anderes.` : ""}`
        : null,
    };
  });

  return { personen, ohneZustaendigen, beiGeschaeftsfuehrung };
}

/** Wer aus der Rolle zur Lage bekommt den nächsten Eintrag? Nur wer heute arbeitet; die geringste Last je Platz gewinnt. */
function waehleFuerLage(rolle: HeuteRolle, team: readonly TeamMitglied[], last: Map<number, number>): number | null {
  for (const r of ROLLEN_FUER_LAGE[rolle] ?? ROLLEN_FUER_LAGE.vertrieb) {
    const kandidaten = team.filter((m) => m.rolle === r && kapazitaet(m.minuten) > 0);
    if (!kandidaten.length) continue;
    kandidaten.sort((a, b) => {
      const la = (last.get(Number(a.id)) ?? 0) / kapazitaet(a.minuten);
      const lb = (last.get(Number(b.id)) ?? 0) / kapazitaet(b.minuten);
      return (la - lb) || ((last.get(Number(a.id)) ?? 0) - (last.get(Number(b.id)) ?? 0)) || (Number(a.id) - Number(b.id));
    });
    return Number(kandidaten[0].id);
  }
  return null;
}

/**
 * Der Satz, wenn nichts Offenes mehr sichtbar ist. „Alles erledigt“ nur, wenn auch der Rückstau leer ist
 * (Prüfer-Fund 19.10.: vorher stand „Alles für heute erledigt“ über fünf Kündigungen im Rückstau).
 */
export function leerSatz(z: { offen: number; erledigt: number; rueckstau: number }): string | null {
  if (z.offen > 0) return null;
  if (z.rueckstau > 0) return `Deine Tagesmenge ist geschafft. Stark! Im Rückstau warten noch ${z.rueckstau} — nimm dir davon, wenn du Zeit hast.`;
  if (z.erledigt > 0) return "Alles für heute erledigt. Stark!";
  return "Heute steht nichts an. Schau in die Pipeline.";
}

// ── Die Gründe in 3–6 Wörtern ──────────────────────────────────────────────

/** Je Auftragsart ein kurzer Grund (shared/fiaon-auftrag-arten.ts); fehlt die Art, gilt der Titel gekürzt. */
export const AUFTRAG_GRUND: Record<string, string> = {
  mara_mail: "Kunde hat geschrieben",
  mara_mail_heikel: "Beschwerde oder Widerruf klären",
  mara_rueckruf: "Rückruf oder Klärung",
  mara_aufgabe: "Aufgabe von Mara erledigen",
  mara_hinweis: "Hinweis von Mara lesen",
  mara_auskunft: "Bonitätsauskunft fehlt",
  auskunft_lieferung: "Auskunft: Lieferung oder Zahlung klären",
  mara_eskalation: "Zahlung verweigert – anrufen",
  mara_wa_anliegen: "WhatsApp-Anliegen beantworten",
  mara_wa_rueckruf: "WhatsApp: Rückruf gewünscht",
  mara_wa_pruefung: "WhatsApp: Mara war unsicher",
  mara_wa_heikel: "WhatsApp: Kündigung oder Beschwerde",
  mara_wa_geld: "WhatsApp: Frage zum Geld",
  stufe_a_klaeren: "Zahlung gemeldet, nicht da",
  vier_augen: "Bonitätsauswertung prüfen",
  unzustellbar_erstzahlung: "E-Mail unzustellbar – Adresse klären",
  unzustellbar_rate: "E-Mail unzustellbar – Adresse klären",
  einladung_fehlt: "Einladung Startgespräch fehlt",
  unterlage: "Unterlage anfordern",
  konto_karte: "Konto & Karte",
  kontakt: "Kontaktanfrage beantworten",
  loeschantrag: "Löschantrag an die Auskunftei",
  kuendigung: "Kündigung oder Widerruf bearbeiten",
  beschwerde: "Beschwerde oder Erstattung bearbeiten",
  vorgang: "Vorgang im Kundenbereich",
  zahlung: "Zahlung prüfen",
  auskunft: "Bonitätsauskunft beschaffen",
  auswertung: "Auswertung erzeugen",
  auskunft_bestaetigung: "Auskunft: Auftrag bestätigen lassen",
  global: "FIAON Global",
  bewerbung: "Bewerbung bearbeiten",
};

/** Heikle Mail-Übergaben (Beschwerde, Widerruf, Anwalt) zählen als Fall mit Frist — wie die Arten mit `frist`. */
export const FRIST_ARTEN_ZUSAETZLICH: readonly string[] = ["mara_mail_heikel"];

export function auftragGrund(art: string | null | undefined, titel: string | null | undefined): string {
  const g = art ? AUFTRAG_GRUND[art] : undefined;
  return kurzGrund(g ?? (String(titel ?? "").replace(/^[^:]{1,60}:\s*/, "") || "Auftrag"));
}

/** „seit 5 Tagen“, „heute“, „gestern“ — für Raten. */
export function rateGrund(tage: number | null | undefined, anzahl = 1): string {
  const t = Number(tage);
  const wort = anzahl > 1 ? `${anzahl} Raten` : "Rate";
  if (!Number.isFinite(t) || t <= 0) return `${wort} heute fällig`;
  if (t === 1) return `${wort} seit gestern offen`;
  return `${wort} seit ${t} Tagen offen`;
}
