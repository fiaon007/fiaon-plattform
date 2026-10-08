// ═══════════════════════════════════════════════════════════════════════════
// WANN IST EIN MENSCH WIEDER DRAN? — DIE EINE REGEL (E-IT-A, 08.10.2026)
//
// ── DER BEFUND (Produktion, nur lesend, 07.10.2026) ────────────────────────
// Die Pipeline drehte sich um dieselben Menschen. Drei Nachfass-Staffeln
// widersprachen sich (Ergebnis-Standard in fiaon-kontakt-ergebnis.ts, Streckung
// in fiaon-nicht-erreicht.ts, eigene Personen-Staffel im Ratenweg
// fiaon-inkasso.ts), die Standards lagen bei +1 bis +3 Tagen — genau im
// schlechtesten Bereich: Erreichquote nach einem Fehlversuch am Folgetag
// 12,8 %, nach 2–3 Tagen 18,5 %, nach 4–7 Tagen 19,9 %, nach 8–14 Tagen 34,1 %.
// „Zahlt sofort" stellte den Menschen morgen auf Platz 1; „zahlt am" schrieb
// wegen eines Datumsfehlers gar keine Wiedervorlage (nurDatum bekam eine Zahl).
//
// ── DIE ENTSCHEIDUNG (Justin, 08.10.2026) ──────────────────────────────────
//   · „Kunde zahlt (sofort)" → nach 3 Werktagen (Mo–Fr) wieder dran, falls bis
//     dahin kein Geld da ist (kommt es, fällt er als Stufe 0 von selbst raus).
//   · „Zahlt am X" → am Werktag nach X.
//   · Nicht erreicht: der Abstand wächst; ab dem 6. Fehlversuch 14 Kalender-
//     tage Pause; ab dem 9. ruhend (wie bisher).
//   · Stufe A (Zahlung gemeldet) pausiert jetzt auch, aber HÖCHSTENS
//     3 Werktage; ab dem 9. Fehlversuch zusätzlich an die Leitung (wie bisher).
//   · Doppelbuchungen (gleiches Ergebnis binnen Minuten) zählen nicht doppelt.
//
// ── WAS HIER STEHT UND WAS NICHT ──────────────────────────────────────────
// Diese Datei ist rein: keine Datenbank, keine Uhr (das heutige Datum kommt
// als Eingabe), kein Netz. Server UND Oberfläche lesen sie — der Server, um
// die Wiedervorlage zu schreiben, die Akte, um vor dem Klick zu zeigen, wann
// der Mensch wieder dran ist („→ Mi 15.10."). Eine Regel an einer Stelle kann
// nicht auseinanderlaufen; drei Staffeln konnten es, und sie taten es.
//
// Die Reihenfolge der rechten Spalte („wer zuerst?") steht als SQL in
// server/lib/fiaon-pipeline-reihung.ts; die Werte, die sie braucht
// (Frische, Tagespause), stehen hier.
// ═══════════════════════════════════════════════════════════════════════════
import type { Ergebnis } from "./fiaon-kontakt-ergebnis-liste";
import type { RatenErgebnis } from "./fiaon-raten-ergebnisse";

// ── DIE WERTE (oben, damit man sie findet) ────────────────────────────────
/** „Zahlt sofort": so viele Werktage später prüfen wir den Eingang. */
export const ZAHLT_SOFORT_WERKTAGE = 3;
/** „Zahlt am X": so viele Werktage NACH X (1 = der Werktag nach X). */
export const ZAHLT_AM_WERKTAGE_DANACH = 1;
/** „Erreicht – Sonstiges": nachfassen nach so vielen Werktagen. */
export const SONSTIGES_WERKTAGE = 3;
/** „Falsche Nummer": so lange hat der Kunde Zeit, auf die Nummern-Mail zu antworten. */
export const NUMMER_FALSCH_WERKTAGE = 3;
/** Ab diesem Fehlversuch pausiert der Mensch PAUSE_KALENDERTAGE. */
export const PAUSE_AB_FEHLVERSUCH = 6;
/** Die Pause nach vielen Fehlversuchen (Justin: 14 Kalendertage). */
export const PAUSE_KALENDERTAGE = 14;
/** Ab hier ruht der Fall (nicht Stufe A) — derselbe Wert wie SCHWELLE_RUHEND. */
export const RUHEND_AB_FEHLVERSUCH = 9;
/** Ab hier geht Stufe A an die Leitung — derselbe Wert wie SCHWELLE_LEITUNG. */
export const LEITUNG_AB_FEHLVERSUCH = 9;
/** Stufe A (Zahlung gemeldet) pausiert höchstens so viele Werktage. */
export const STUFE_A_HOECHSTENS_WERKTAGE = 3;
/** Der Satz dazu — für Meldung, Akte und den Hinweis an der Wahl von Hand. */
export const STUFE_A_HINWEIS = `Stufe A, Zahlung gemeldet: höchstens ${STUFE_A_HOECHSTENS_WERKTAGE} Werktage`;
/**
 * So alt darf das jüngste Ereignis (Antrag, Zahlungsmeldung, fällige Rate)
 * sein, damit ein Mensch als frisch gilt — wer zahlt, zahlt in den ersten drei
 * Tagen (E-251). Frische nicht erreichte kommen deshalb schon am nächsten
 * Werktag wieder in die Liste — dort aber HINTEN (Gegenprüfung 08.10.2026):
 * Wer am vorigen Werktag oder heute versucht wurde, steht nie im Frische-Band
 * und innerhalb seines Bandes hinter allen anderen (fiaon-pipeline-reihung.ts,
 * geradeBearbeitetSql). Justin: „gerade bearbeitet → nie am nächsten Tag wieder vorn".
 */
export const FRISCH_TAGE = 3;
/**
 * Wer frisch ist, wartet nach einem Fehlversuch höchstens so viele Werktage —
 * aber nur bis zum 5. Fehlversuch. Ab PAUSE_AB_FEHLVERSUCH gilt auch für ihn
 * die Pause (Gegenprüfung 08.10.2026: die Frische hob sie vorher auf).
 */
export const FRISCH_HOECHSTENS_WERKTAGE = 1;
/** Ein zweiter Fehlversuch derselben Person binnen so vieler Minuten ist dieselbe Buchung. */
export const ENTPRELLUNG_MINUTEN = 30;
/** Eine von Hand gewählte Wiedervorlage liegt höchstens so weit in der Zukunft. */
export const HANDWAHL_HOECHSTENS_TAGE = 60;
/**
 * Wer in diesen Stunden schon versucht wurde, steht nicht noch einmal in
 * „Wieder dran" (höchstens ein Versuch je Tag). Derselbe Wert wie die Pause
 * der Telefonkartei (fiaon-anrufversuche.ts liest ihn von hier).
 */
export const TAGESPAUSE_STUNDEN = 20;

/**
 * Die Staffel nach Fehlversuchen — Zählerstand NACH dem Hochzählen.
 * Gelesen von oben nach unten: die letzte Zeile, deren „ab" erreicht ist, gilt.
 */
export const FEHLVERSUCH_STAFFEL: readonly { ab: number; werktage?: number; kalendertage?: number }[] = [
  { ab: 1, werktage: 2 },
  { ab: 2, werktage: 3 },
  { ab: 3, werktage: 5 },
  { ab: 5, kalendertage: 7 },
  { ab: PAUSE_AB_FEHLVERSUCH, kalendertage: PAUSE_KALENDERTAGE },
] as const;

// ── DIE GRÜNDE ────────────────────────────────────────────────────────────
export type WiedervorlageGrund =
  | "zahlung_pruefen" | "zusage_pruefen" | "nachfassen" | "erneut_versuchen"
  | "pausiert" | "ruhend" | "leitung" | "rueckruf" | "nummer_pruefen"
  | "uebergabe" | "abgelehnt" | "von_hand" | "rate" | "termin" | "wiedervorlage";

/** Der Grund in drei Wörtern — für Karte, Meldung, Akte und die Liste „pausiert". */
export const GRUND_TEXT: Record<WiedervorlageGrund, string> = {
  zahlung_pruefen: "Zahlung prüfen",
  zusage_pruefen: "Zusage prüfen",
  nachfassen: "Nachfassen",
  erneut_versuchen: "Erneut anrufen",
  pausiert: "Pause nach vielen Fehlversuchen",
  ruhend: "Ruhend",
  leitung: "Leitung entscheidet mit",
  rueckruf: "Rückruf",
  nummer_pruefen: "Neue Nummer abwarten",
  uebergabe: "Übergabe an Kollegen",
  abgelehnt: "Abgelehnt",
  von_hand: "Von Hand gesetzt",
  rate: "Rate fällig",
  termin: "Termin",
  wiedervorlage: "Wiedervorlage",
};

// ── DATUMSRECHNUNG OHNE ZEITZONE ──────────────────────────────────────────
// Gerechnet wird auf Kalendertagen „JJJJ-MM-TT", die schon das BERLINER Datum
// sind (der Aufrufer liefert „heute" aus fiaon-time.ts bzw. der Browser aus
// Europe/Berlin). Mittags in UTC liegt jeder Tag sicher auf sich selbst.
const TAG_MS = 86_400_000;
function isoZuMs(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1, 12);
}
function msZuIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
/** Gültiges „JJJJ-MM-TT" (auch am Anfang eines Zeitstempels)? Sonst null. */
export function nurIsoDatum(v: unknown): string | null {
  const m = String(v ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  return msZuIso(isoZuMs(iso)) === iso ? iso : null;
}
export function plusKalendertage(iso: string, n: number): string {
  return msZuIso(isoZuMs(iso) + n * TAG_MS);
}
/** Mo–Fr. Feiertage zählen bewusst als Werktag (Justins Festlegung „Mo–Fr"). */
export function istWerktag(iso: string): boolean {
  const wt = new Date(isoZuMs(iso)).getUTCDay();
  return wt >= 1 && wt <= 5;
}
/** n Werktage NACH iso (Freitag + 2 = Dienstag). n ≤ 0 liefert iso selbst. */
export function plusWerktage(iso: string, n: number): string {
  let d = iso.slice(0, 10);
  let rest = Math.max(0, Math.floor(n));
  while (rest > 0) {
    d = plusKalendertage(d, 1);
    if (istWerktag(d)) rest--;
  }
  return d;
}
/** Der Tag selbst, wenn er ein Werktag ist, sonst der nächste. */
export function naechsterWerktag(iso: string): string {
  let d = iso.slice(0, 10);
  while (!istWerktag(d)) d = plusKalendertage(d, 1);
  return d;
}
export function tageZwischen(vonIso: string, bisIso: string): number {
  return Math.round((isoZuMs(bisIso) - isoZuMs(vonIso)) / TAG_MS);
}
const WOCHENTAG = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
/** „Mi 15.10." */
export function datumKurz(iso: string): string {
  const d = new Date(isoZuMs(iso));
  return `${WOCHENTAG[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.`;
}

// ── DIE STAFFEL ───────────────────────────────────────────────────────────
export interface StaffelEingabe {
  /** Zählerstand NACH diesem Fehlversuch (1 = der erste). */
  versuche: number;
  /** Stufe A — Zahlung gemeldet (priority_tier = 1). */
  stufeA?: boolean;
  /** Jüngstes Ereignis höchstens FRISCH_TAGE alt (nur Stufe A/B/Rate). */
  frisch?: boolean;
  heute: string;
}
export interface StaffelAusgang {
  datum: string | null;
  grund: WiedervorlageGrund;
  pausiert: boolean;
  ruhend: boolean;
  leitung: boolean;
  /** „+5 Werktage" — für Meldung und Rundgang. */
  abstand: string;
}

/** Wann nach einem Fehlversuch (nicht erreicht, Mailbox) wieder? */
export function staffelNachFehlversuch(e: StaffelEingabe): StaffelAusgang {
  const n = Math.max(1, Math.floor(Number(e.versuche) || 0));
  const stufeA = e.stufeA === true;
  // Ab dem 9. Fehlversuch: Stufe A an die Leitung (und höchstens 3 Werktage),
  // alle anderen ruhen — ohne Datum; der Kunde beendet die Ruhe, nicht der Kalender.
  if (stufeA && n >= LEITUNG_AB_FEHLVERSUCH) {
    return { datum: plusWerktage(e.heute, STUFE_A_HOECHSTENS_WERKTAGE), grund: "leitung", pausiert: false, ruhend: false, leitung: true, abstand: `+${STUFE_A_HOECHSTENS_WERKTAGE} Werktage` };
  }
  if (!stufeA && n >= RUHEND_AB_FEHLVERSUCH) {
    return { datum: null, grund: "ruhend", pausiert: false, ruhend: true, leitung: false, abstand: "ruhend" };
  }
  let stufe = FEHLVERSUCH_STAFFEL[0];
  for (const s of FEHLVERSUCH_STAFFEL) if (n >= s.ab) stufe = s;
  let datum = stufe.werktage != null ? plusWerktage(e.heute, stufe.werktage) : naechsterWerktag(plusKalendertage(e.heute, stufe.kalendertage ?? 1));
  let abstand = stufe.werktage != null ? `+${stufe.werktage} Werktage` : `+${stufe.kalendertage} Tage`;
  let pausiert = n >= PAUSE_AB_FEHLVERSUCH;
  // Stufe A: höchstens 3 Werktage — es hängt Geld daran, das unterwegs ist oder fehlt.
  if (stufeA) {
    const deckel = plusWerktage(e.heute, STUFE_A_HOECHSTENS_WERKTAGE);
    if (datum > deckel) { datum = deckel; abstand = `+${STUFE_A_HOECHSTENS_WERKTAGE} Werktage (Stufe A)`; pausiert = false; }
  }
  // Frisch (Antrag, Zahlungsmeldung oder fällige Rate ≤ 3 Tage): höchstens der
  // nächste Werktag — NICHT ab dem 6. Fehlversuch. Wer sechsmal nicht rangeht,
  // bekommt die 14 Tage Pause, auch wenn sein Antrag von vorgestern ist
  // (Gegenprüfung 08.10.2026: vorher ergab „frisch, 6. Fehlversuch" +1 Werktag).
  if (e.frisch === true && n < PAUSE_AB_FEHLVERSUCH) {
    const deckel = plusWerktage(e.heute, FRISCH_HOECHSTENS_WERKTAGE);
    if (datum > deckel) { datum = deckel; abstand = `+${FRISCH_HOECHSTENS_WERKTAGE} Werktag (frisch)`; pausiert = false; }
  }
  return { datum, grund: pausiert ? "pausiert" : "erneut_versuchen", pausiert, ruhend: false, leitung: false, abstand };
}

// ── DIE EINE FUNKTION: WANN WIEDER? ───────────────────────────────────────
export interface VersuchEingabe {
  ergebnis: Ergebnis;
  /** Heute in Berlin, „JJJJ-MM-TT". */
  heute: string;
  /** Nur bei nicht erreicht/Mailbox: Zählerstand NACH diesem Versuch. */
  versucheNachher?: number;
  stufeA?: boolean;
  frisch?: boolean;
  /** „Zahlt am": der genannte Tag. */
  zusageDatum?: string | null;
  /** „Rückruf": der vereinbarte Tag (oder Zeitpunkt). */
  terminDatum?: string | null;
  /** Von Hand gewählte Wiedervorlage — gewinnt, höchstens 60 Tage. */
  gewaehlt?: string | null;
}
export interface VersuchAusgang {
  /** Die neue Wiedervorlage; null = löschen (abgelehnt, ruhend). */
  datum: string | null;
  grund: WiedervorlageGrund;
  pausiert: boolean;
  ruhend: boolean;
  leitung: boolean;
  /** „Wieder dran am Mi 15.10. · Zahlung prüfen" */
  text: string;
  /** E-IT-A (Gegenprüfung 08.10.2026): Die Wahl von Hand lag weiter als Stufe A erlaubt und wurde gekürzt. */
  gedeckelt?: boolean;
}

/** Fehlversuche: Sie zählen den Zähler hoch und laufen über die Staffel. */
export const FEHLVERSUCH_ERGEBNISSE: readonly Ergebnis[] = ["nicht_erreicht", "mailbox"];
export function istFehlversuch(ergebnis: string): boolean {
  return (FEHLVERSUCH_ERGEBNISSE as readonly string[]).includes(ergebnis);
}

/** Ergebnisse, bei denen eine Wahl von Hand („in 1 Woche") Sinn ergibt. */
export const HANDWAHL_ERGEBNISSE: readonly Ergebnis[] = [
  "erreicht_zahlt_gleich", "erreicht_sonstiges", "nicht_erreicht", "mailbox", "nummer_falsch",
];
export function handwahlErlaubt(ergebnis: string): boolean {
  return (HANDWAHL_ERGEBNISSE as readonly string[]).includes(ergebnis);
}

/** Eine von Hand gewählte Wiedervorlage prüfen: Vergangenheit → null, zu weit → gedeckelt. */
export function handwahlPruefen(gewaehlt: unknown, heute: string): string | null {
  const iso = nurIsoDatum(gewaehlt);
  if (!iso || iso < heute) return null;
  const grenze = plusKalendertage(heute, HANDWAHL_HOECHSTENS_TAGE);
  return iso > grenze ? grenze : iso;
}

// ── STUFE A: HÖCHSTENS 3 WERKTAGE — AUCH VON HAND (Gegenprüfung 08.10.2026) ──
// Vorher übernahm naechsterVersuch die Wahl „in 2 Wochen" ungedeckelt — bei
// Stufe A wartete ein Kunde, der seine Zahlung gemeldet hat, dann 14 Tage, auch
// mit Aufgabe an die Leitung. Justin: Stufe A pausiert HÖCHSTENS 3 Werktage.
// Der Deckel gilt für jede Wiedervorlage, die WIR setzen (Regel und Wahl von
// Hand, in naechsterVersuch und in der Route „Wiedervorlage von Hand").
// NICHT gedeckelt: ein mit dem Kunden VEREINBARTER Tag — „Rückruf am …" und
// „zahlt am …". Das ist keine Pause, sondern sein Wort; eine Zusage in der
// Zukunft hält ihn ohnehin aus der Arbeitsliste (Basisregel der Liste).
/** Der späteste Tag, an dem ein Mensch auf Stufe A wieder dran ist. */
export function stufeADeckel(heute: string): string {
  return plusWerktage(heute.slice(0, 10), STUFE_A_HOECHSTENS_WERKTAGE);
}
/** Ein Datum für Stufe A kürzen (andere Stufen unverändert). */
export function stufeADeckeln(datum: string | null, heute: string, stufeA: boolean | undefined): { datum: string | null; gedeckelt: boolean } {
  if (!datum || stufeA !== true) return { datum, gedeckelt: false };
  const deckel = stufeADeckel(heute);
  return datum > deckel ? { datum: deckel, gedeckelt: true } : { datum, gedeckelt: false };
}
/** Gründe, deren Tag mit dem Kunden vereinbart ist — kein Deckel. */
const VEREINBART: readonly WiedervorlageGrund[] = ["rueckruf", "zusage_pruefen"];

/** Die Knöpfe der Wahl von Hand — eine Liste für Akte, Kartei und Server. */
export const HANDWAHL: readonly { schluessel: "regel" | "heute" | "woche" | "zwei_wochen"; text: string; kalendertage: number | null }[] = [
  { schluessel: "regel", text: "nach Regel", kalendertage: null },
  { schluessel: "woche", text: "in 1 Woche", kalendertage: 7 },
  { schluessel: "zwei_wochen", text: "in 2 Wochen", kalendertage: 14 },
];
/** Das Datum einer Wahl von Hand („heute" = sofort wieder in der Liste). */
export function handwahlDatum(schluessel: string, heute: string): string | null {
  if (schluessel === "heute") return heute;
  const w = HANDWAHL.find((h) => h.schluessel === schluessel);
  if (!w || w.kalendertage == null) return null;
  return naechsterWerktag(plusKalendertage(heute, w.kalendertage));
}
/** Ist dieser Knopf der Wahl von Hand für den Menschen sinnvoll? Bei Stufe A nur bis zum Deckel. */
export function handwahlMoeglich(schluessel: string, heute: string, stufeA: boolean | undefined): boolean {
  if (stufeA !== true) return true;
  const d = handwahlDatum(schluessel, heute);
  return d == null || d <= stufeADeckel(heute);
}

export function naechsterVersuch(e: VersuchEingabe): VersuchAusgang {
  const heute = e.heute.slice(0, 10);
  const gewaehlt = handwahlPruefen(e.gewaehlt, heute);
  const ohne = { pausiert: false, ruhend: false, leitung: false };
  let aus: Omit<VersuchAusgang, "text">;
  switch (e.ergebnis) {
    case "erreicht_zahlt_gleich":
      aus = { datum: plusWerktage(heute, ZAHLT_SOFORT_WERKTAGE), grund: "zahlung_pruefen", ...ohne };
      break;
    case "erreicht_zahlt_am": {
      const x = nurIsoDatum(e.zusageDatum);
      const basis = x && x >= heute ? x : heute;
      aus = { datum: plusWerktage(basis, ZAHLT_AM_WERKTAGE_DANACH), grund: "zusage_pruefen", ...ohne };
      break;
    }
    case "erreicht_abgelehnt":
      return { datum: null, grund: "abgelehnt", ...ohne, text: "Aus allen Anruflisten." };
    case "erreicht_sonstiges":
      aus = { datum: plusWerktage(heute, SONSTIGES_WERKTAGE), grund: "nachfassen", ...ohne };
      break;
    case "nicht_erreicht":
    case "mailbox": {
      const s = staffelNachFehlversuch({ versuche: e.versucheNachher ?? 1, stufeA: e.stufeA, frisch: e.frisch, heute });
      // Ruhend schlägt die Wahl von Hand: Ab dem 9. Fehlversuch entscheidet der
      // Kunde (Termin, Rückmeldung), nicht ein Datum — wie seit 19.08.2026.
      if (s.ruhend) {
        return { datum: null, grund: "ruhend", pausiert: false, ruhend: true, leitung: false, text: wiederDranText(null, "ruhend", heute) };
      }
      aus = { datum: s.datum, grund: s.grund, pausiert: s.pausiert, ruhend: false, leitung: s.leitung };
      break;
    }
    case "rueckruf_termin": {
      const t = nurIsoDatum(e.terminDatum);
      aus = { datum: t && t >= heute ? t : (gewaehlt ?? plusWerktage(heute, 1)), grund: "rueckruf", ...ohne };
      return { ...aus, text: wiederDranText(aus.datum, aus.grund, heute) };
    }
    case "nummer_falsch":
      aus = { datum: plusWerktage(heute, NUMMER_FALSCH_WERKTAGE), grund: "nummer_pruefen", ...ohne };
      break;
    case "nummer_blockiert":
      // Heute: Der neue Betreuer soll noch am selben Tag anrufen (fiaon-uebergabe.ts).
      aus = { datum: heute, grund: "uebergabe", ...ohne };
      break;
    default:
      aus = { datum: plusWerktage(heute, 1), grund: "wiedervorlage", ...ohne };
  }
  // Die Wahl von Hand gewinnt (höchstens 60 Tage) — bei Stufe A ab dem 9.
  // Fehlversuch bleibt die Aufgabe an die Leitung trotzdem bestehen.
  if (gewaehlt && handwahlErlaubt(e.ergebnis)) {
    aus = { ...aus, datum: gewaehlt, grund: aus.leitung ? "leitung" : "von_hand", pausiert: false };
  }
  // Stufe A: höchstens 3 Werktage — für Regel UND Wahl von Hand, auch beim
  // Grund „leitung" (Gegenprüfung 08.10.2026). Vereinbarte Tage bleiben.
  let gedeckelt = false;
  if (e.stufeA === true && !VEREINBART.includes(aus.grund)) {
    const d = stufeADeckeln(aus.datum, heute, true);
    if (d.gedeckelt) { aus = { ...aus, datum: d.datum, pausiert: false }; gedeckelt = true; }
  }
  const text = wiederDranText(aus.datum, aus.grund, heute);
  return { ...aus, text: gedeckelt ? `${text} (${STUFE_A_HINWEIS})` : text, gedeckelt };
}

/** „Wieder dran am Mi 15.10. · Zahlung prüfen" (heute/morgen beim Namen genannt). */
export function wiederDranText(datum: string | null, grund: WiedervorlageGrund, heute: string): string {
  if (grund === "abgelehnt") return "Aus allen Anruflisten.";
  if (grund === "ruhend" || !datum) {
    return "Ruhend — kommt zurück, sobald der Kunde einen Termin bucht oder sich meldet.";
  }
  const g = GRUND_TEXT[grund] ?? GRUND_TEXT.wiedervorlage;
  const tage = tageZwischen(heute, datum);
  const wann = tage <= 0 ? "heute" : tage === 1 ? `morgen (${datumKurz(datum)})` : `am ${datumKurz(datum)}`;
  return `Wieder dran ${wann} · ${g}`;
}

// ── LESESEITE: WARUM WARTET DIESER MENSCH? ────────────────────────────────
/**
 * Der Grund einer bestehenden Wiedervorlage, abgeleitet aus dem jüngsten
 * Gesprächsergebnis — die Karte, die Akte und die Liste „pausiert" sagen
 * damit dasselbe, ohne dass ein zweites Feld gepflegt werden muss.
 */
export function grundAusLetztemErgebnis(outcome: string | null | undefined, versuche: number): WiedervorlageGrund {
  const o = String(outcome ?? "");
  if (o === "erreicht_zahlt_gleich" || o === "rate_ueberwiesen_beleg") return "zahlung_pruefen";
  if (o === "erreicht_zahlt_am" || o === "rate_zahlt_am") return "zusage_pruefen";
  if (o === "erreicht_sonstiges" || o === "rate_ratenpause") return "nachfassen";
  if (o === "nicht_erreicht" || o === "mailbox" || o === "rate_nicht_erreicht") {
    if (!(versuche > 0)) return "erneut_versuchen";
    return versuche >= PAUSE_AB_FEHLVERSUCH ? "pausiert" : "erneut_versuchen";
  }
  if (o === "rueckruf_termin") return "rueckruf";
  if (o === "nummer_falsch") return "nummer_pruefen";
  if (o === "nummer_blockiert" || o === "rate_nummer_blockiert") return "uebergabe";
  return "wiedervorlage";
}

// ── DER RATENWEG FÄHRT DIESELBE REGEL ─────────────────────────────────────
/**
 * Ein Ergebnis des Forderungsmanagements als Vertriebsergebnis — für die
 * Wiedervorlage der PERSON (die Rate behält ihre eigene inkasso_wiedervorlage
 * für Collections). null: Die Person übernimmt die Frist der Rate
 * (Nummer blockiert, Härtefall an den Vorgesetzten).
 */
export function ratenErgebnisAlsKontakt(art: RatenErgebnis): Ergebnis | null {
  switch (art) {
    case "zahlt_am": return "erreicht_zahlt_am";
    case "ueberwiesen_beleg": return "erreicht_zahlt_gleich";
    case "nicht_erreicht": return "nicht_erreicht";
    case "ratenpause": return "erreicht_sonstiges";
    default: return null;
  }
}
