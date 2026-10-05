// ═══════════════════════════════════════════════════════════════════════════
// DAS LIMIT-GESPRÄCH — WER DARF WANN BUCHEN? (05.10.2026, E-283)
//
// Justin (05.10.2026): „Limit-Gespräch muss der Kunde buchen in der App, also
// sowas wie ‚Limit-Erhöhung anfragen', das geht aber nur alle 3 Monate."
//
// Die Leistung steht in den Paketen Pro, Ultra und High-End des neuen Antrags
// („Alle drei Monate ein Limit-Gespräch", shared/fiaon-antrag-neu.ts). Bis heute
// gab es keinen Weg, sie zu buchen: Die Termin-Art fehlte, und der Kunde kam
// nur über den öffentlichen Terminlink an einen Kalender — dort leitet der
// Server die Gesprächsart aus dem Zustand ab (Support, Zahlung, Startgespräch),
// ein Limit-Gespräch konnte so nie entstehen.
//
// ── DIESE DATEI IST REIN ──────────────────────────────────────────────────
// Keine Datenbank, keine Uhr. Der Server (server/lib/fiaon-limit-gespraech.ts)
// sammelt die Tatsachen und ruft `limitAnspruchAus`; die App zeichnet nur, was
// zurückkommt. Das Demo-Konto ruft dieselbe Funktion mit seinen festen Daten,
// und scripts/pruef-limit-gespraech.ts prüft sie ohne Netz und ohne Datenbank.
//
// ── DIE REGEL (Entscheidung Justin über den Auftrag vom 05.10.2026) ───────
//   Berechtigt: bezahltes Paket Pro, Ultra oder High-End — alter und neuer
//   Antragsweg gleich (dieselben Paketschlüssel). FIAON Start nicht.
//   Global-Kunden nie (Regel E-272, server/lib/fiaon-global-kunde.ts).
//   Dazu: Startgespräch geführt, keine überfällige Rate, Vertrag nicht beendet
//   (gekündigt, aber noch laufend = buchbar), kein gebuchtes offenes
//   Limit-Gespräch.
//
//   Frühester Tag = der SPÄTERE von
//     (a) Abo-Anker (Eingang der ersten Monatsrate, aboAnker) + 3 Kalendermonate
//     (b) letztes GEZÄHLTES Limit-Gespräch + 3 Kalendermonate.
//   Fehlt der Monatstag im Zielmonat, gilt der letzte Tag des Monats — dieselbe
//   Rechnung wie die Ratenfälligkeit (faelligkeit, server/lib/fiaon-abo-zyklus.ts;
//   der Prüfstand hält beide gegeneinander).
//
//   GEZÄHLT wird nur ein GEFÜHRTES Limit-Gespräch („erledigt") — so steht es im
//   Vertrag § 3 („drei Monate nach dem letzten geführten“). Verpasst (automatisch
//   oder vom Mitarbeiter bestätigt) und abgesagt zählen nie: Der Kunde bucht neu,
//   wie es die Mail „Wir haben Sie verpasst“ sagt (Entscheidung 05.10.2026).
//
//   Mitarbeiter buchen ein Limit-Gespräch jederzeit, ohne diese Prüfung
//   (Kalender, Art „Limit-Gespräch") — die Sperrfrist gilt nur für den Kunden.
//
// ── KALENDERTAGE ALS TEXT ─────────────────────────────────────────────────
// Alle Tage sind Zeichenketten „JJJJ-MM-TT" in Berliner Zeit. Gerechnet wird
// auf den Ziffern, nie über Date-Objekte und nie über Number(Intl.format()) —
// die Zeit-Falle vom 04.09.2026 (NaN aus einer formatierten Stunde).
// ═══════════════════════════════════════════════════════════════════════════

/** Die Pakete mit Limit-Gespräch — dieselben Schlüssel im alten und im neuen Antrag. */
export const LIMIT_PAKETE: readonly string[] = ["pro", "ultra", "highend"];
/** Abstand zwischen zwei Limit-Gesprächen und vom Abo-Anker bis zum ersten. */
export const LIMIT_SPERRFRIST_MONATE = 3;
/** Die Termin-Art (fiaon_termine.quelle). */
export const LIMIT_QUELLE = "limit_gespraech";
/** Die Herkunft einer Buchung aus dem Kundenbereich (fiaon_termine.herkunft). */
export const LIMIT_HERKUNFT = "kundenbereich_limit";
/** Der Bildschirm im Kundenbereich — Ziel aller Folgelinks (Absage, Mail „verpasst", neu buchen). */
export const LIMIT_PFAD = "/app/mehr/limit";

export type LimitGrund =
  | "global"          // Global-Kunde (E-272) — kein Privat-Ablauf
  | "kein_paket"      // Paket ohne Limit-Gespräch (FIAON Start, Auskunft, …)
  | "nicht_bezahlt"   // Paket noch nicht bezahlt
  | "beendet"         // Vertrag beendet
  | "gebucht"         // es gibt schon ein gebuchtes, offenes Limit-Gespräch
  | "rueckstand"      // eine Rate ist überfällig
  | "start_fehlt"     // Startgespräch noch nicht geführt
  | "sperrfrist"      // frühester Tag noch nicht erreicht
  | "frei";           // jetzt buchbar

export interface LimitTermin {
  /** ISO-Zeitpunkt (mit Zone). */
  beginn: string;
  /** „TT.MM.JJJJ" in Berlin. */
  datumText: string;
  /** „HH:MM" in Berlin. */
  uhrzeit: string;
  /** Der Gesprächspartner im Dativ („Herrn Stripling") — für „mit …". */
  mit: string | null;
}

export interface LimitGebucht extends LimitTermin {
  /** Der Zeitpunkt ist vorbei, das Gespräch aber noch nicht vermerkt. */
  vorbei: boolean;
  /** Absage-Seite (Sie-Form) — nur für kommende Gespräche. */
  absageLink: string | null;
}

export interface LimitAnspruch {
  grund: LimitGrund;
  buchbar: boolean;
  /** Frühester Tag nach der Sperrfrist („JJJJ-MM-TT") — null ohne Anker und ohne gezähltes Gespräch. */
  abIso: string | null;
  /** Derselbe Tag als „TT.MM.JJJJ". */
  abText: string | null;
  /** Das gebuchte, offene Limit-Gespräch. */
  gebucht: LimitGebucht | null;
  /** Das letzte gezählte Limit-Gespräch. */
  letztes: LimitTermin | null;
  /** Nummer der ältesten überfälligen Rate — null ohne Rückstand. */
  rueckstandNr: number | null;
}

export interface LimitEingabe {
  paketKey: string | null | undefined;
  /** Ist das Paket bezahlt (payment_status 'paid')? */
  bezahlt: boolean;
  /** Global-Kunde nach E-272? */
  globalKunde?: boolean;
  /** Startgespräch geführt — dieselbe Tatsache wie onboardingGelaufen im Bereich. */
  startGefuehrt: boolean;
  /** Abo-Anker („JJJJ-MM-TT", Berlin) — Eingang der ersten Monatsrate (aboAnker). */
  ankerIso: string | null;
  /** Nummer der ältesten überfälligen Rate, sonst null. */
  rueckstandNr: number | null;
  /** Vertrag beendet (gekündigt UND Vertragsende erreicht). */
  beendet: boolean;
  /** Tag („JJJJ-MM-TT", Berlin) des letzten GEZÄHLTEN Limit-Gesprächs. */
  letztesGezaehltIso: string | null;
  /** Das gebuchte, offene Limit-Gespräch, falls es eines gibt. */
  gebucht: LimitGebucht | null;
  /** Anzeige des letzten gezählten Gesprächs (Datum, Gesprächspartner). */
  letztes?: LimitTermin | null;
  /** Heute („JJJJ-MM-TT", Berlin). */
  heuteIso: string;
}

const TAG = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Ist das ein Kalendertag „JJJJ-MM-TT"? */
export function istTag(wert: unknown): wert is string {
  const m = TAG.exec(String(wert ?? ""));
  if (!m) return false;
  const monat = Number(m[2]), tag = Number(m[3]);
  return monat >= 1 && monat <= 12 && tag >= 1 && tag <= tageImMonat(Number(m[1]), monat);
}

/** Tage im Monat (Monat 1–12) — ohne Zeitzone, ohne Uhr. */
export function tageImMonat(jahr: number, monat: number): number {
  if (monat === 2) return (jahr % 4 === 0 && jahr % 100 !== 0) || jahr % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(monat) ? 30 : 31;
}

/**
 * Ein Kalendertag plus n Kalendermonate. Fehlt der Tag im Zielmonat, gilt der
 * letzte Tag des Monats: 2026-11-30 + 3 → 2027-02-28, 2027-11-30 + 3 → 2028-02-29.
 * Kein gültiger Tag → null (nie ein geratenes Datum).
 */
export function plusMonate(isoTag: string, n: number): string | null {
  if (!istTag(isoTag) || !Number.isInteger(n)) return null;
  const jahr = Number(isoTag.slice(0, 4)), monat = Number(isoTag.slice(5, 7)), tag = Number(isoTag.slice(8, 10));
  const index = jahr * 12 + (monat - 1) + n;
  const zJahr = Math.floor(index / 12), zMonat = (index % 12) + 1;
  const zTag = Math.min(tag, tageImMonat(zJahr, zMonat));
  return `${String(zJahr).padStart(4, "0")}-${String(zMonat).padStart(2, "0")}-${String(zTag).padStart(2, "0")}`;
}

/** „JJJJ-MM-TT" → „TT.MM.JJJJ" (ohne Datum: null). */
export function tagText(isoTag: string | null | undefined): string | null {
  return istTag(isoTag) ? `${isoTag.slice(8, 10)}.${isoTag.slice(5, 7)}.${isoTag.slice(0, 4)}` : null;
}

/** „JJJJ-MM-TT" → „TT.MM." — für die Zeile in „Mehr". */
export function tagKurz(isoTag: string | null | undefined): string | null {
  return istTag(isoTag) ? `${isoTag.slice(8, 10)}.${isoTag.slice(5, 7)}.` : null;
}

/** Der spätere von zwei Tagen (Zeichenkettenvergleich ist bei „JJJJ-MM-TT" ein Datumsvergleich). */
function spaeter(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

/**
 * Zählt dieses Limit-Gespräch für die Sperrfrist? Nur „erledigt" (geführt).
 * Die EINE Fassung der Regel — der Server filtert seine Termine mit genau dieser Funktion.
 */
export function limitGezaehlt(t: { status: unknown; erledigtAm?: unknown }): boolean {
  // Nur ein GEFÜHRTES Gespräch zählt (Vertrag § 3: „drei Monate nach dem letzten geführten“).
  // Ein verpasstes — auch ein vom Mitarbeiter bestätigtes — sperrt nicht: Der Kunde bucht neu,
  // genau wie es die Mail „Wir haben Sie verpasst“ sagt (Entscheidung 05.10.2026).
  return String(t.status ?? "") === "erledigt";
}

/** Hat dieses Paket das Limit-Gespräch? */
export function paketMitLimit(paketKey: unknown): boolean {
  return LIMIT_PAKETE.includes(String(paketKey ?? "").trim().toLowerCase());
}

/**
 * Der früheste Tag nach der Sperrfrist: der spätere von Anker + 3 Monate und
 * letztes gezähltes Gespräch + 3 Monate. Ohne Anker UND ohne Gespräch: null —
 * dann gibt es keine Frist, die sich belegen ließe (aboAnker hat vier
 * Rückfälle; null heißt, keiner davon trägt).
 */
export function limitAbIso(ankerIso: string | null, letztesGezaehltIso: string | null): string | null {
  const ausAnker = ankerIso ? plusMonate(ankerIso, LIMIT_SPERRFRIST_MONATE) : null;
  const ausLetztem = letztesGezaehltIso ? plusMonate(letztesGezaehltIso, LIMIT_SPERRFRIST_MONATE) : null;
  return spaeter(ausAnker, ausLetztem);
}

/**
 * Der Anspruch. Reihenfolge der Gründe: Global → Paket → bezahlt → beendet →
 * gebucht → Rückstand → Startgespräch → Sperrfrist. Ein gebuchtes Gespräch
 * steht vor Rückstand und Startgespräch: Was gebucht ist, soll der Kunde sehen
 * (auch, wenn ein Mitarbeiter es eingetragen hat). Der Rückstand geht dem
 * Startgespräch vor — dieselbe Reihenfolge wie bei der Zuständigkeit
 * („Rückstand zuerst", fiaon-zustaendigkeit.ts).
 */
export function limitAnspruchAus(e: LimitEingabe): LimitAnspruch {
  const abIso = limitAbIso(istTag(e.ankerIso) ? e.ankerIso : null, istTag(e.letztesGezaehltIso) ? e.letztesGezaehltIso : null);
  const grund: LimitGrund =
    e.globalKunde ? "global"
    : !paketMitLimit(e.paketKey) ? "kein_paket"
    : !e.bezahlt ? "nicht_bezahlt"
    : e.beendet ? "beendet"
    : e.gebucht ? "gebucht"
    : e.rueckstandNr != null ? "rueckstand"
    : !e.startGefuehrt ? "start_fehlt"
    // Ein unlesbares „heute" schaltet nichts frei — dann gilt die Frist weiter.
    : abIso && (!istTag(e.heuteIso) || e.heuteIso < abIso) ? "sperrfrist"
    : "frei";
  return {
    grund,
    buchbar: grund === "frei",
    abIso,
    abText: tagText(abIso),
    gebucht: e.gebucht ?? null,
    letztes: e.letztes ?? null,
    rueckstandNr: e.rueckstandNr ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE SÄTZE — eine Stelle für App, Demo und Prüfstand (Wortwand: wandPruefen)
//
// Sie-Form, wahr nach der Regel oben. Bewusst KEIN „über den Rahmen
// entscheidet unsere Partnerbank" (E-281: nur, wo ein Limit genannt wird) und
// keine Rückruf-Zusage bei leerem Kalender: Niemand legt dafür eine Aufgabe an.
// ═══════════════════════════════════════════════════════════════════════════
export const LIMIT_TEXTE = {
  titel: "Limit-Erhöhung anfragen",
  knopf: "Limit-Gespräch buchen",
  /** {Ansprechpartner} im Dativ („Herrn Stripling"); ohne Namen „Ihrem Ansprechpartner". */
  unterzeile: (mitDativ: string | null | undefined) =>
    `Alle drei Monate besprechen Sie mit ${String(mitDativ ?? "").trim() || "Ihrem Ansprechpartner"} den nächsten Schritt zu einem höheren Limit.`,
  bank: "Über Ihr Limit entscheidet die Bank – im Gespräch bereiten wir Ihren nächsten Schritt vor.",
  sperrfrist: (abText: string) => `Ihr nächstes Limit-Gespräch können Sie ab dem ${abText} buchen.`,
  rueckstand: "Sobald Ihre offene Rate beglichen ist, können Sie Ihr Limit-Gespräch buchen.",
  keinPaket: "Das Limit-Gespräch gehört zu FIAON Pro, Ultra und High-End.",
  startFehlt: "Zuerst führen Sie Ihr Startgespräch – danach können Sie hier Ihr Limit-Gespräch buchen.",
  nichtBezahlt: "Ihr erstes Limit-Gespräch können Sie drei Monate nach Eingang Ihrer ersten Monatsrate buchen.",
  beendet: "Ihr Vertrag ist beendet – ein Limit-Gespräch lässt sich nicht mehr buchen.",
  /** Die Karte auf Heute, wenn jetzt gebucht werden kann. */
  heuteFrei: "Ihr Limit-Gespräch ist jetzt buchbar.",
  keineZeit: "Gerade ist keine Zeit frei. Schauen Sie morgen wieder vorbei – oder schreiben Sie uns an support@fiaon.com.",
  waehlen: "Wählen Sie eine Zeit – das Gespräch dauert rund 20 Minuten und findet am Telefon statt.",
  gebucht: (t: { datumText: string; uhrzeit: string; mit: string | null }) =>
    `Ihr Limit-Gespräch: ${t.datumText}, ${t.uhrzeit} Uhr am Telefon${t.mit ? ` mit ${t.mit}` : ""}.`,
  gebuchtVorbei: (t: { datumText: string; uhrzeit: string }) =>
    `Ihr Limit-Gespräch war für den ${t.datumText}, ${t.uhrzeit} Uhr angesetzt. Sobald es in Ihrer Akte vermerkt ist, steht hier, wie es weitergeht.`,
  letztes: (t: { datumText: string; mit: string | null }) =>
    `Ihr letztes Limit-Gespräch: ${t.datumText}${t.mit ? ` mit ${t.mit}` : ""}.`,
  gebuchtErfolg: (t: { datumText: string; uhrzeit: string }, mitMail: boolean) =>
    `Ihr Limit-Gespräch ist gebucht: ${t.datumText}, ${t.uhrzeit} Uhr.${mitMail ? " Die Bestätigung kommt per E-Mail." : ""}`,
  schonGebucht: "Für Sie ist schon ein Limit-Gespräch gebucht – Sie sehen es hier oben. Ein zweites lässt sich erst danach buchen.",
  nurAnsicht: "In dieser Ansicht lässt sich kein Termin buchen.",
} as const;

/** Der Satz zum Grund — für die App und die Demo. `null` bei „frei" und „gebucht" (eigene Darstellung). */
export function limitGrundSatz(a: LimitAnspruch): string | null {
  switch (a.grund) {
    case "global":
    case "kein_paket": return LIMIT_TEXTE.keinPaket;
    case "nicht_bezahlt": return LIMIT_TEXTE.nichtBezahlt;
    case "beendet": return LIMIT_TEXTE.beendet;
    case "rueckstand": return LIMIT_TEXTE.rueckstand;
    case "start_fehlt": return LIMIT_TEXTE.startFehlt;
    case "sperrfrist": return a.abText ? LIMIT_TEXTE.sperrfrist(a.abText) : null;
    default: return null;
  }
}

/** Der Zusatz in „Mehr": „jetzt buchbar" / „ab TT.MM." / „gebucht TT.MM., HH:MM Uhr" — sonst leer. */
export function limitZusatz(a: LimitAnspruch | null | undefined): string {
  if (!a) return "";
  if (a.grund === "frei") return "jetzt buchbar";
  if (a.grund === "gebucht" && a.gebucht && !a.gebucht.vorbei) return `gebucht ${a.gebucht.datumText.slice(0, 6)}, ${a.gebucht.uhrzeit} Uhr`;
  if (a.grund === "sperrfrist" && a.abIso) return `ab ${tagKurz(a.abIso)}`;
  return "";
}

/** Die Zeile für die Kundenakte der Mitarbeiter („Limit-Gespräch: …"). */
export function limitStandText(a: LimitAnspruch | null | undefined): string | null {
  if (!a) return null;
  const ab = a.abText ? ` (frühestens ab ${a.abText})` : "";
  switch (a.grund) {
    case "frei": return "Limit-Gespräch: jetzt buchbar";
    case "gebucht": return a.gebucht ? `Limit-Gespräch: gebucht ${a.gebucht.datumText}, ${a.gebucht.uhrzeit} Uhr` : "Limit-Gespräch: gebucht";
    case "sperrfrist": return `Limit-Gespräch: ab ${a.abText ?? "—"}`;
    case "rueckstand": return `Limit-Gespräch: erst nach Ausgleich von Rate ${a.rueckstandNr ?? "?"}${ab}`;
    case "start_fehlt": return `Limit-Gespräch: nach dem Startgespräch${ab}`;
    case "nicht_bezahlt": return "Limit-Gespräch: Paket noch nicht bezahlt";
    case "beendet": return "Limit-Gespräch: Vertrag beendet";
    case "kein_paket": return null; // FIAON Start und Auskunft haben die Leistung nicht — keine Zeile.
    case "global": return null;     // E-272: kein Privat-Ablauf.
    default: return null;
  }
}
