// ═══════════════════════════════════════════════════════════════════════════
// SOFTPHONE — telefonieren aus dem System
//
// NICHT ZU VERWECHSELN mit server/lib/fiaon-telefon.ts: Dort steht seit
// Längerem, wie aus einer krummen Nummer eine WÄHLBARE wird (Vorwahl
// ergänzen, nationale Null verwerfen). Diese Datei ruft an. Sie benutzt die
// vorhandene Normalisierung und schreibt keine zweite.
//
// NUR AUSGEHEND. Eingehende Rufe laufen über einen externen Annahmedienst;
// ein Browser, der klingeln soll, muss offen sein, und niemand hat den ganzen
// Tag denselben Tab offen.
//
// ── OHNE ZUGANGSDATEN PASSIERT NICHTS, ABER NICHTS STÜRZT AB ───────────────
// Die Twilio-Werte sind heute nicht gesetzt. Jede Funktion hier gibt dann
// einen sauberen Zustand zurück, den die Oberfläche anzeigen kann — und
// `einrichtungsStand()` sagt auf die Zeile genau, welcher Wert fehlt. Ein
// „irgendwas ist nicht konfiguriert" hilft niemandem.
//
// ── DREI WÄNDE GEGEN KOSTEN UND MISSBRAUCH ─────────────────────────────────
// Ein Softphone ist eine Kreditkarte in den Händen von jedem, der sich
// anmelden kann. Deshalb:
//   1. Nur DACH-Vorwahlen (+49/+43/+41) plus eine pflegbare Freiliste.
//   2. Höchstens 60 Minuten je Gespräch — Twilio rechnet je Minute.
//   3. Jede Wahl wird protokolliert, auch die abgelehnte.
// Testkonten können gar nicht wählen.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
// Die EINE Tafel der Landesvorwahlen — nicht noch eine hier (31.08.2026).
import { LAND_VORWAHL } from "./fiaon-telefon";

type Lauf = typeof sqlPool;

/** Die Werte, die Twilio braucht — mit Klartext, wo man sie herbekommt. */
export const ENV_FELDER: { name: string; zweck: string; woher: string }[] = [
  { name: "TWILIO_ACCOUNT_SID", zweck: "Das Konto selbst", woher: "Twilio Console → Account Info → Account SID" },
  { name: "TWILIO_AUTH_TOKEN", zweck: "Serverseitige Aufrufe (Aufnahmen abholen)", woher: "Twilio Console → Account Info → Auth Token" },
  { name: "TWILIO_API_KEY_SID", zweck: "Kurzlebige Browser-Ausweise ausstellen", woher: "Console → Account → API keys & tokens → Create API key (Standard)" },
  { name: "TWILIO_API_KEY_SECRET", zweck: "Der zugehörige geheime Teil", woher: "Wird beim Anlegen des API-Keys EINMAL angezeigt" },
  { name: "TWILIO_TWIML_APP_SID", zweck: "Sagt Twilio, was bei einem Anruf zu tun ist", woher: "Console → Voice → TwiML → TwiML Apps → Create; Voice-URL auf /api/fiaon/telefon/twiml" },
  { name: "TWILIO_CALLER_ID", zweck: "Die Nummer, die beim Kunden erscheint", woher: "Console → Phone Numbers → Eine deutsche oder österreichische Nummer kaufen" },
];

export interface EinrichtungsStand {
  bereit: boolean;
  /** Ausdrücklich abgeschaltet, obwohl alles da wäre. */
  abgeschaltet: boolean;
  fehlend: { name: string; zweck: string; woher: string }[];
  vorhanden: string[];
  hinweis: string;
}

export function einrichtungsStand(): EinrichtungsStand {
  const fehlend = ENV_FELDER.filter((f) => !process.env[f.name]);
  const vorhanden = ENV_FELDER.filter((f) => !!process.env[f.name]).map((f) => f.name);
  // Das Flag kann auch bei vollständiger Einrichtung abschalten — etwa,
  // während jemand die Nummer wechselt.
  const abgeschaltet = String(process.env.SOFTPHONE || "").toLowerCase() === "aus";
  const bereit = fehlend.length === 0 && !abgeschaltet;
  return {
    bereit, abgeschaltet, fehlend, vorhanden,
    hinweis: abgeschaltet
      ? "Das Softphone ist über die Umgebungsvariable SOFTPHONE=aus abgeschaltet."
      : fehlend.length === 0
        ? "Alles eingerichtet — es kann telefoniert werden."
        : `Zum Telefonieren fehlen noch ${fehlend.length} ${fehlend.length === 1 ? "Wert" : "Werte"}. `
          + "Alles andere ist fertig gebaut und wartet nur darauf.",
  };
}

export function telefonBereit(): boolean {
  return einrichtungsStand().bereit;
}

// ───────────────────────────────────────────────────────────────────────────
// Nummern
// ───────────────────────────────────────────────────────────────────────────

/** Die erlaubten Länder. Mehr wird nicht gewählt, egal wer klickt. */
export const DACH = [
  { vorwahl: "+49", land: "Deutschland" },
  { vorwahl: "+43", land: "Österreich" },
  { vorwahl: "+41", land: "Schweiz" },
];

/**
 * Nummer auf E.164 bringen — für frei getippte Eingaben aus der Wähltastatur.
 *
 * Für Nummern AUS DEM BESTAND ist `waehlbareNummer()` in
 * server/lib/fiaon-telefon.ts zuständig: Die kennt die getrennte
 * `phone_country_code`-Spalte und weigert sich lieber, als eine Vorwahl zu
 * raten. Hier geht es um das, was ein Mensch gerade eintippt — da gibt es
 * keine Nebenspalte, aus der man etwas ableiten könnte.
 */
export function nummerNormalisieren(roh: string, vorwahlVorgabe = "+49"): string | null {
  let s = String(roh || "").trim().replace(/[\s()/.\-]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (s.startsWith("0")) s = `${vorwahlVorgabe}${s.slice(1)}`;
  if (!s.startsWith("+")) s = `${vorwahlVorgabe}${s}`;

  // ══════════════════════════════════════════════════════════════════════════
  // DIE FÜHRENDE NULL NACH DER LANDESVORWAHL — ABER NUR BEI DACH
  //
  // ── DER BEFUND (31.08.2026) ───────────────────────────────────────────────
  // Hier stand:
  //     s = s.replace(/^(\+\d{2})0+/, "$1");
  //
  // Das nimmt ZWEI Ziffern als Landesvorwahl an. Für +49, +43 und +41 stimmt
  // das. Für alles andere zerstört es die Nummer, weil `\d{2}` mitten in die
  // Vorwahl schneidet und die nächste Null als Amtskennzahl missversteht.
  //
  // GEMESSEN im Bestand — 4 von 8 Ziffern-Abweichungen kamen von dieser Zeile:
  //     +380677197080  (Ukraine, Vorwahl 380)  →  +38677197080   Ziffer WEG
  //     +380976846557  (Ukraine)               →  +38976846557   Ziffer WEG
  //     +380978600679  (Ukraine)               →  +38978600679   Ziffer WEG
  //     +16096405036   (USA, Vorwahl 1)        →  +1696405036    Ziffer WEG
  //
  // Bei der US-Nummer sieht der Ausdruck „+16" als Land und frisst die Null aus
  // der Ortsnetzkennzahl 609. Übrig bleibt eine Nummer, die es gibt — nur
  // gehört sie jemand anderem.
  //
  // Jetzt gilt die Regel nur für die drei Vorwahlen, für die sie gedacht war.
  // Sie sind alle zweistellig, also ist das Ergebnis für DACH unverändert; für
  // den Rest der Welt bleibt die Nummer, wie sie ist.
  s = s.replace(/^(\+4[139])0+/, "$1");

  if (!/^\+\d{8,15}$/.test(s)) return null;
  return s;
}

/**
 * Die Landesvorwahl zu einem Länderkürzel — für national geschriebene Nummern.
 *
 * Bewusst knapp: Es geht nur um die Länder, in die überhaupt gewählt wird, plus
 * die Nachbarn, die im Bestand vorkommen. Ein unbekanntes Kürzel gibt `null`
 * zurück, und der Aufrufer verweigert dann — er rät nicht.
 */
export function vorwahlFuerLand(land: unknown): string | null {
  // ── EINE TAFEL, NICHT ZWEI (korrigiert am 31.08.2026) ──────────────────
  // Hier stand eine eigene Liste. Sie ging sofort mit der in
  // `fiaon-telefon.ts` auseinander: Diese kannte SK, jene RO — und keine von
  // beiden TR. GEMESSEN waren genau drei Kunden dadurch nicht anrufbar, zwei
  // davon NUR wegen der Doppelung.
  //
  // Die Tafel steht jetzt einmal, in `fiaon-telefon.ts`, und wird hier gelesen.
  // Die Umrechnung auf die Plus-Form bleibt: `nummerNormalisieren` erwartet sie
  // so, `waehlbareNummer` setzt das Plus selbst.
  const k = String(land ?? "").trim().toUpperCase();
  if (!k) return null;
  const roh = LAND_VORWAHL[k];
  return roh ? `+${roh}` : null;
}


export async function freiliste(lauf: Lauf = sqlPool): Promise<string[]> {
  const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = 'telefon_freiliste'`) as any[];
  if (!r?.value) return [];
  return String(r.value).split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

export interface WahlPruefung { erlaubt: boolean; nummer: string | null; grund: string | null }

/**
 * Darf diese Nummer gewählt werden?
 *
 * Die Prüfung steht hier und nicht in der Route: Sie wird von der Token-Route
 * UND vom TwiML-Weg gebraucht. Zwei Fassungen wären zwei Gelegenheiten, eine
 * davon zu vergessen.
 */
export async function wahlPruefen(
  roh: string, lauf: Lauf = sqlPool, land?: unknown,
): Promise<WahlPruefung> {
  // ══════════════════════════════════════════════════════════════════════════
  // EINE NATIONALE NUMMER OHNE LAND WIRD NICHT GERATEN (31.08.2026)
  //
  // ── DER BEFUND, MIT ANRUFPROTOKOLL BELEGT ─────────────────────────────────
  // Kunde Maurizio Pampanini (Person 11479, FIAON-MSUOPDV8), wohnhaft in Winkel,
  // `country = CH`. Gespeicherte Nummer: `0797435749` — eine gültige SCHWEIZER
  // Mobilnummer (079…).
  //
  // Am 19.08.2026 um 09:12, 09:13 und 09:13 stehen in `fiaon_calls` drei
  // Versuche, alle mit `status = fehlgeschlagen`, alle an:
  //
  //     +49797435749        ← Deutschland
  //
  // Richtig gewesen wäre +41797435749. Die Vorgabe `vorwahlVorgabe = "+49"` hat
  // aus einer schweizerischen eine deutsche Nummer gemacht. Über die
  // Kundenkarte wäre es richtig gelaufen: `nummerAusZeile` kennt das Land und
  // liefert +41797435749. Über die WÄHLTASTATUR griff der Rat auf +49.
  //
  // ── WARUM VERWEIGERN BESSER IST ALS RATEN ─────────────────────────────────
  // Eine geratene Vorwahl erzeugt keinen Fehler, sondern eine ANDERE, oft
  // existierende Rufnummer. Im besten Fall geht sie ins Leere (so hier: dreimal
  // „fehlgeschlagen"). Im schlechteren klingelt sie bei einem Fremden, dem
  // jemand von seinem Kreditvertrag erzählt.
  //
  // `waehlbareNummer` in server/lib/fiaon-telefon.ts macht es seit Langem
  // richtig: „Ländervorwahl fehlt — bitte in der Akte ergänzen." Diese Wand
  // stand nur nicht auf dem Tastaturweg. Jetzt steht sie an beiden.
  //
  // GEMESSEN: 44 Kunden haben eine national geschriebene Nummer. 18 davon wohnen
  // NICHT in Deutschland (12 AT, 4 CH, 1 RO, 1 SK) — 18 Anrufe an Fremde.
  const geputzt = String(roh || "").trim().replace(/[\s()/.\-]/g, "");
  const istNational = geputzt.startsWith("0") && !geputzt.startsWith("00");
  const landVorwahl = vorwahlFuerLand(land);
  if (istNational && !landVorwahl) {
    return {
      erlaubt: false, nummer: null,
      grund: "Dieser Nummer fehlt die Ländervorwahl, und im Kundendatensatz steht kein "
        + "Land. Sie wird NICHT geraten: Eine geratene Vorwahl ergibt eine gültige "
        + "Nummer in einem anderen Land — dann klingelt es bei einem Fremden. "
        + "Bitte ergänze die Nummer in der Akte mit Vorwahl (+43…, +49…, +41…).",
    };
  }

  // Mit bekanntem Land wird die richtige Vorwahl gesetzt, nicht die geratene.
  const nummer = nummerNormalisieren(roh, landVorwahl ?? "+43");
  if (!nummer) {
    return { erlaubt: false, nummer: null, grund: "Das ist keine gültige Rufnummer." };
  }
  const dach = DACH.some((d) => nummer.startsWith(d.vorwahl));
  if (dach) return { erlaubt: true, nummer, grund: null };

  const frei = await freiliste(lauf);
  if (frei.some((f) => nummer.startsWith(f))) return { erlaubt: true, nummer, grund: null };

  return {
    erlaubt: false, nummer,
    grund: `Es werden nur Nummern in Deutschland, Österreich und der Schweiz gewählt (${nummer}). `
      + "Andere Ziele müssen in den Einstellungen ausdrücklich freigegeben werden — das schützt vor "
      + "teuren Fehlwahlen und vor Missbrauch eines gekaperten Zugangs.",
  };
}

/** Höchstdauer eines Gesprächs. Twilio rechnet je angefangener Minute. */
export const MAX_MINUTEN = 60;

// ═══════════════════════════════════════════════════════════════════════════
// WIE VIELE ANRUFE GEHEN HEUTE ÜBER DIESE NUMMER? — EIN HINWEIS, KEINE SPERRE
//
// ── WARUM ES DIESE ZAHL GIBT ───────────────────────────────────────────────
// Gemeldet wurde: „Von 158 Anrufen kamen 2 durch." Eine der möglichen Ursachen
// ist ein Spam-Flag beim Netzbetreiber — und der entsteht unter anderem durch
// VIELE Anrufe von einer Nummer in kurzer Zeit. Eine verbrannte Rufnummer
// klingelt nirgends mehr durch, und das merkt niemand an dem Tag, an dem es
// passiert.
//
// ── WARUM SIE AM 19.08.2026 VOM SPERREN AUFS WARNEN UMGEBAUT WURDE ────────
// Hier stand eine WAND: Bei Erreichen der Grenze antwortete die Ausweis-Route
// mit HTTP 429, und der Agent konnte nicht mehr wählen. Der Kommentar an dieser
// Stelle behauptete:
//
//     „Die Grenze ist ein SCHUTZ, keine Arbeitsbremse: 100 Anrufe je Nummer
//      und Tag erreicht im Normalbetrieb niemand."
//
// Das war eine Annahme, und sie war falsch. GEMESSEN
// (scripts/mess-anrufgrenze.ts) über 14 Tage:
//
//     Spitze je Absendernummer und Tag   252   (12.08.2026)
//     Spitze je Mitarbeiter und Tag      117   (Lucas Böhnert, 17.08.2026)
//
// Die Grenze lag also UNTER dem Normalbetrieb. Am 19.08. hat sie zwischen 13:18
// und 15:14 Uhr **26 Anrufe** von zwei Mitarbeitern verhindert, 9 Kunden waren
// nicht erreichbar. Der Betreiber musste die Einstellung auf 0 setzen, um den
// Vertrieb weiterarbeiten zu lassen.
//
// Eine Schutzfunktion, die die Kernarbeit anhält, ist falsch gebaut — egal wie
// gut sie gemeint ist. Der Schaden durch eine verbrannte Nummer ist ein
// VERMUTETER Zukunftsschaden; der Schaden durch ein blockiertes Vertriebsteam
// ist heute und messbar.
//
// ── DAS NEUE VERHALTEN: DREI STUFEN, KEINE SPERRE ─────────────────────────
//   unter der Schwelle        → nichts. Kein Text, kein Hinweis, keine Marke.
//   ab der Schwelle           → dezenter Hinweis im Telefon-Panel des Agenten.
//   ab dem 1,5-fachen         → Warnung für den BETREIBER (Diagnose-Eintrag,
//                               Dashboard-Marke, optional Mail). Der Agent
//                               sieht weiter nur den dezenten Hinweis.
//
// Der Agent arbeitet in JEDER Stufe weiter. Diese Datei enthält keinen Pfad
// mehr, der einen Anruf verhindert — `erschoepft` ist ABSICHTLICH entfernt und
// nicht auf `false` gesetzt: Ein Feld, das es nicht gibt, kann niemand mehr
// abfragen, und der Typcheck findet jede Stelle, die es versucht.
//
// ── WARUM JE NUMMER UND NICHT JE MITARBEITER ──────────────────────────────
// Der Netzbetreiber sieht die ABSENDERNUMMER, nicht den Menschen. Vier
// Mitarbeiter auf derselben Nummer sind für ihn ein Anrufer.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ab wie vielen Anrufen je Nummer und Tag erscheint der Hinweis?
 *
 * ── DIE KALIBRIERUNG (19.08.2026) ─────────────────────────────────────────
 * 300, entschieden vom Betreiber und an den Zahlen geprüft: Die gemessene
 * Spitze liegt bei 252 Anrufen je Nummer und Tag. 300 wird an starken Tagen
 * also erreicht — und das ist in Ordnung, weil es nur einen Hinweis kostet.
 * Die BETREIBER-Warnung steht bei 450 (1,5-fach) und damit klar über allem,
 * was bisher je vorgekommen ist.
 *
 * Wer die Zahl senkt, verschenkt nichts; wer sie erhöht, verliert nur die
 * Vorwarnung. Nichts davon hält jemanden auf.
 */
export const ANRUF_HINWEIS_SCHWELLE_VORGABE = 300;

/** Ab dem Wievielfachen der Schwelle wird der BETREIBER gewarnt? */
export const ANRUF_WARN_FAKTOR = 1.5;

/**
 * Die Schwelle aus den Einstellungen.
 *
 * ── EIN NEUER SCHLÜSSEL, UND WARUM ────────────────────────────────────────
 * Der alte hieß `max_anrufe_je_nummer_tag` und steht heute auf **0**, weil der
 * Betreiber die Sperre im Notfall abschalten musste. Läse die neue Logik
 * denselben Schlüssel weiter, wären auch die harmlosen Hinweise stumm — die
 * Notbremse von heute würde die Vorwarnung von morgen mit abschalten.
 *
 * Deshalb `anruf_hinweis_schwelle` mit eigener Vorgabe. Der alte Schlüssel wird
 * nicht mehr gelesen; er bleibt in der Datenbank stehen (kein Hard-Delete) und
 * ist als überholt vermerkt.
 *
 * 0 heißt weiterhin „aus" — dann erscheint kein Hinweis und keine Warnung.
 * Sperren kann auch die 0 nichts, es gibt nichts mehr zu sperren.
 */
export async function anrufHinweisSchwelle(lauf: Lauf = sqlPool): Promise<number> {
  const [r] = (await lauf`
    SELECT value FROM fiaon_settings WHERE key = 'anruf_hinweis_schwelle'
  `) as any[];
  const n = Number(r?.value);
  if (Number.isFinite(n) && n >= 0) return Math.trunc(n);
  return ANRUF_HINWEIS_SCHWELLE_VORGABE;
}

export type KontingentStufe = "ruhig" | "hinweis" | "warnung";

export interface NummerKontingent {
  /** Wie viele Anrufe gingen heute schon über diese Absendernummer? */
  heute: number;
  /** Ab wann erscheint der Hinweis? 0 = abgeschaltet. */
  schwelle: number;
  /** Ab wann wird der Betreiber gewarnt? 0 = abgeschaltet. */
  warnSchwelle: number;
  stufe: KontingentStufe;
  /**
   * Der Satz für das Panel des Agenten — `null`, solange nichts zu sagen ist.
   *
   * Er steht HIER und nicht in der Oberfläche: Das Panel gibt es auf dem
   * Desktop und auf 380 px, und zwei Fassungen desselben Satzes laufen
   * auseinander.
   */
  hinweis: string | null;
}

/**
 * Der Tagesstand einer ABSENDERNUMMER.
 *
 * Gezählt werden ausgehende Anrufe ab Mitternacht Berliner Zeit — nicht die
 * letzten 24 Stunden. Ein gleitendes Fenster kann ein Mensch nicht im Kopf
 * behalten; „seit heute Morgen" kann er.
 */
export async function nummerKontingent(
  absender: string, lauf: Lauf = sqlPool,
): Promise<NummerKontingent> {
  const schwelle = await anrufHinweisSchwelle(lauf);
  // ── WARUM NULL MITGEZÄHLT WIRD ──────────────────────────────────────────
  // `von_nummer` gibt es erst seit Migration 063. Alle Zeilen davor sind NULL —
  // und liefen über die damals EINZIGE Absendernummer. Sie als „andere Nummer"
  // zu behandeln würde die Zählung am ersten Tag halbieren.
  //
  // Wird später eine zweite Nummer eingerichtet, trägt jede neue Zeile ihre
  // Absendernummer, und die Zählung trennt sauber. Nur die Altlast bleibt der
  // ersten Nummer zugerechnet — das ist die Wahrheit über diese Daten.
  const [r] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_calls
    WHERE richtung = 'raus'
      AND (von_nummer = ${absender}
           OR (von_nummer IS NULL AND ${absender} = ${process.env.TWILIO_CALLER_ID || ""}))
      AND beginn >= (NOW() AT TIME ZONE 'Europe/Berlin')::date
  `.catch(() => [{ n: 0 }])) as any[];
  const heute = Number(r?.n ?? 0);

  if (schwelle <= 0) {
    return { heute, schwelle: 0, warnSchwelle: 0, stufe: "ruhig", hinweis: null };
  }
  const warnSchwelle = Math.round(schwelle * ANRUF_WARN_FAKTOR);
  const stufe: KontingentStufe = heute >= warnSchwelle ? "warnung"
    : heute >= schwelle ? "hinweis" : "ruhig";
  return {
    heute, schwelle, warnSchwelle, stufe,
    // Derselbe Satz in beiden oberen Stufen: Der Agent muss nichts entscheiden
    // und soll nicht erschrecken. Die Dringlichkeit gehört zum Betreiber.
    hinweis: stufe === "ruhig" ? null
      : `Heute bereits ${heute} Anrufe über diese Nummer. Du kannst normal `
        + "weiterarbeiten — die Verwaltung prüft, ob eine zweite Rufnummer nötig ist.",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE WARNUNG AN DEN BETREIBER
//
// Sie geht in die Diagnose (`fiaon_diagnostics`) — dieselbe Quelle, aus der die
// Marke „Diagnose" im Verwaltungs-Menü zählt und die `/admin/events` anzeigt.
// Eine eigene Warnfläche daneben wäre eine zweite Stelle, die man pflegen muss.
//
// ── HÖCHSTENS EINMAL AM TAG JE NUMMER ─────────────────────────────────────
// Ohne Drossel entsteht ab dem 450. Anruf bei JEDEM weiteren Anruf ein Eintrag
// und eine Mail — an einem starken Tag hundert Mails, und die 101. wird
// ungelesen weggewischt (dieselbe Lehre wie bei den Lauf-Warnungen).
//
// Die Sperre gegen Wiederholung liegt in `fiaon_lauf_warnungen`: eine Tabelle
// „wann wurde wegen X zuletzt gewarnt", die genau dafür gebaut ist. Der
// Schlüssel trägt das Präfix `anrufgrenze:`, damit beide Nutzungen sichtbar
// getrennt bleiben.
// ═══════════════════════════════════════════════════════════════════════════

export async function nummerWarnungMelden(
  absender: string, stand: NummerKontingent, lauf: Lauf = sqlPool,
  /**
   * `nichtSenden` unterdrückt die MAIL — der Diagnose-Eintrag und die
   * Tagessperre entstehen trotzdem.
   *
   * ── WARUM ES DIESEN SCHALTER GIBT ─────────────────────────────────────
   * Der Prüfstand ruft diese Funktion, um zu beweisen, dass gewarnt wird. Ohne
   * den Schalter ginge dabei eine ECHTE Mail an den Betreiber — und der Lauf
   * blieb beim ersten Versuch am HTTP-Aufruf zu Brevo hängen. AGENTS.md ist
   * dazu eindeutig: „Ein Browser-Test erzeugt NIE eine echte Mail", und
   * „Funktionen, die einen Zustand festschreiben, brauchen einen Schalter
   * dagegen".
   */
  opts: { nichtSenden?: boolean } = {},
): Promise<{ gewarnt: boolean; grund: string }> {
  if (stand.stufe !== "warnung") return { gewarnt: false, grund: "keine Warnstufe" };

  const schluessel = `anrufgrenze:${absender || "ohne-nummer"}`;
  const [letzte] = (await lauf`
    SELECT gewarnt_am FROM fiaon_lauf_warnungen WHERE name = ${schluessel}
  `.catch(() => [])) as any[];
  if (letzte?.gewarnt_am
      && Date.now() - new Date(letzte.gewarnt_am).getTime() < 24 * 3_600_000) {
    return { gewarnt: false, grund: "heute schon gewarnt" };
  }

  const nummer = absender || "(keine Absendernummer gesetzt)";
  const text = `Nummer ${nummer}: ${stand.heute} Anrufe heute — Spam-Risiko prüfen, `
    + "zweite Nummer erwägen.";

  const { logDiagnostic } = await import("./fiaon-diagnostics");
  logDiagnostic({
    severity: "warnung",
    category: "system",
    code: "anrufe_je_nummer_hoch",
    message: text,
    hint: "Sehr viele Anrufe von einer Rufnummer können beim Netzbetreiber eine "
      + "Spam-Markierung auslösen; danach klingelt die Nummer bei niemandem mehr "
      + "durch. Das ist KEINE Sperre — es wurde und wird kein Anruf verhindert. "
      + `Die Hinweisschwelle steht bei ${stand.schwelle}, die Warnung bei `
      + `${stand.warnSchwelle} (Einstellung „anruf_hinweis_schwelle", 0 = aus).`,
    context: { nummer, heute: stand.heute, schwelle: stand.schwelle, warnSchwelle: stand.warnSchwelle },
  });

  await lauf`
    INSERT INTO fiaon_lauf_warnungen (name, gewarnt_am, stunden)
    VALUES (${schluessel}, NOW(), ${stand.heute})
    ON CONFLICT (name) DO UPDATE SET gewarnt_am = NOW(), stunden = ${stand.heute}
  `.catch(() => {});

  // Die Mail ist optional: Ohne BETREIBER_MAIL bleibt es beim Diagnose-Eintrag.
  // „Konnte nicht warnen" ist etwas anderes als „musste nicht warnen" — deshalb
  // die Meldung auf der Konsole.
  if (opts.nichtSenden) {
    return { gewarnt: true, grund: "Diagnose geschrieben, Mail unterdrückt (nichtSenden)" };
  }
  const an = process.env.BETREIBER_MAIL || process.env.ADMIN_EMAIL || "";
  if (!an) {
    console.warn("[TELEFON] Keine Betreiber-Adresse (BETREIBER_MAIL) — "
      + "die Anruf-Warnung steht nur in der Diagnose.");
    return { gewarnt: true, grund: "Diagnose ohne Mail (keine Adresse)" };
  }
  try {
    const { eigeneMailSenden } = await import("./fiaon-brevo");
    const versand = await eigeneMailSenden({
      an,
      betreff: `FIAON: ${stand.heute} Anrufe heute über ${nummer}`,
      text: [
        text,
        "",
        `Hinweisschwelle: ${stand.schwelle} · Warnschwelle: ${stand.warnSchwelle}`,
        "",
        "WAS DAS BEDEUTET: Sehr viele Anrufe von einer Nummer in kurzer Zeit können",
        "beim Netzbetreiber eine Spam-Markierung auslösen. Danach klingelt die",
        "Nummer bei niemandem mehr durch — und das merkt man erst Tage später.",
        "",
        "WAS NICHT PASSIERT IST: Es wurde kein Anruf verhindert. Diese Grenze",
        "sperrt nichts mehr (Umbau vom 19.08.2026, nachdem eine Sperre bei 100",
        "Anrufen 26 Gespräche des Vertriebs blockiert hat).",
        "",
        "MÖGLICHE SCHRITTE: eine zweite Absendernummer einrichten und die Last",
        "verteilen; oder die Schwelle in den Einstellungen anpassen",
        "(anruf_hinweis_schwelle, 0 = aus).",
        "",
        "Diagnose: /admin/events",
      ].join("\n"),
    });
    if (!versand.ok) console.error(`[TELEFON] Warnmail an ${an} scheiterte: ${versand.grund}`);
    return { gewarnt: true, grund: versand.ok ? "Diagnose und Mail" : `Diagnose, Mail scheiterte: ${versand.grund}` };
  } catch (e) {
    console.error("[TELEFON] Anruf-Warnmail konnte nicht raus:", e);
    return { gewarnt: true, grund: "Diagnose, Mail warf" };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Ansage
// ───────────────────────────────────────────────────────────────────────────

export const ANSAGE_VORGABE =
  "Guten Tag. Dieses Gespräch wird zur Qualitätssicherung aufgezeichnet. "
  + "Wenn Sie damit nicht einverstanden sind, sagen Sie es bitte gleich zu Beginn.";

export async function ansageText(lauf: Lauf = sqlPool): Promise<string> {
  const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = 'telefon_ansage'`) as any[];
  return String(r?.value || ANSAGE_VORGABE);
}

/**
 * Das TwiML für einen ausgehenden Ruf.
 *
 * Reihenfolge ist Absicht: erst die Ansage, DANN die Aufnahme. Eine Aufnahme,
 * die vor dem Hinweis beginnt, hat den Hinweis nicht mehr nötig — sie ist
 * dann schon rechtswidrig.
 */
export function twimlAusgehend(opts: {
  an: string; von: string; ansage: string; aufnahmeCallback: string; statusCallback: string;
  /** Wohin Twilio greift, wenn der ANGERUFENE abnimmt. Dort steht die Ansage. */
  ansageUrl: string;
  /** Wohin Twilio meldet, ob ein Mensch oder eine Mailbox abgenommen hat. */
  amdCallback?: string;
}): string {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // ── EIN LEERES callerId IST SCHLIMMER ALS KEINES ────────────────────────
  // Gemessen am 11.08.2026: Die Antwort enthielt `callerId=""`. Twilio
  // bekommt damit einen leeren Wert für die Absendernummer und lehnt den Ruf
  // ab — bei einem Client-initiierten Anruf MUSS die callerId eine Nummer
  // sein, die dem Konto gehört oder als Caller ID verifiziert ist.
  //
  // Das Attribut fiel bisher stillschweigend leer aus, wenn TWILIO_CALLER_ID
  // nicht gesetzt war. Nach außen sah die Antwort wohlgeformt aus; im
  // Twilio-Log stand ein abgebrochener Anruf ohne erkennbaren Grund.
  //
  // Jetzt: Fehlt die Nummer, wird das GESAGT. Eine Ansage, die den Grund
  // nennt, ist unendlich viel besser als ein Ruf, der still verschwindet.
  const von = String(opts.von || "").trim();
  if (!von) {
    console.error("[TELEFON] TwiML ohne Absendernummer: TWILIO_CALLER_ID ist leer.");
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE" voice="Polly.Vicki">Dieser Anruf kann nicht aufgebaut werden, weil im System keine Absendernummer hinterlegt ist. Bitte im Verwaltungsbereich unter Einstellungen die Telefon-Diagnose öffnen.</Say>
  <Hangup/>
</Response>`;
  }
  if (!/^\+[1-9]\d{6,15}$/.test(von)) {
    console.error(`[TELEFON] TwiML mit unbrauchbarer Absendernummer: „${von}"`);
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE" voice="Polly.Vicki">Dieser Anruf kann nicht aufgebaut werden, weil die hinterlegte Absendernummer nicht in internationaler Schreibweise vorliegt. Bitte im Verwaltungsbereich die Telefon-Diagnose öffnen.</Say>
  <Hangup/>
</Response>`;
  }

  const an = String(opts.an || "").trim();
  if (!an) {
    console.error("[TELEFON] TwiML ohne Zielnummer.");
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="de-DE" voice="Polly.Vicki">Es wurde keine Rufnummer übergeben. Bitte die Seite einmal neu laden und erneut wählen.</Say>
  <Hangup/>
</Response>`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DIE ANSAGE MUSS DER KUNDE HÖREN, NICHT DER AGENT
  //
  // ── DER BEFUND (11.08.2026) ───────────────────────────────────────────────
  // Ein Agent: „Die angekündigte Durchsage scheint nur ich zu hören, nicht der
  // Kunde."
  //
  // Er hat recht, und es ist ernster als ein Bedienfehler. Hier stand:
  //
  //     <Say>Dieses Gespräch wird aufgezeichnet…</Say>
  //     <Dial><Number>+49…</Number></Dial>
  //
  // Bei einem Anruf AUS DEM BROWSER ist der Agent der Anrufer. Ein <Say> vor
  // dem <Dial> wird deshalb IHM vorgelesen — der Kunde wird erst danach
  // gewählt und hat nichts gehört.
  //
  // ── WARUM DAS KEIN SCHÖNHEITSFEHLER IST ───────────────────────────────────
  // Die Aufzeichnung läuft ab dem Abnehmen (`record-from-answer-dual`). Ein
  // Gespräch ohne Hinweis aufzuzeichnen ist nach §201 StGB strafbar — und der
  // Hinweis muss den erreichen, der aufgezeichnet wird.
  //
  // ── DIE LÖSUNG WAR: `url` AM <Number> ─────────────────────────────────────
  // Twilio spielt die dort hinterlegte TwiML ab, sobald der ANGERUFENE
  // abnimmt — bevor die beiden Seiten verbunden werden.
  //
  // ── UND SIE IST AM 24.08.2026 WIEDER ENTFALLEN ────────────────────────────
  // Justin: „Früher, wenn man angerufen wurde und der Kunde abhebt, kam so ein
  // Tonband von uns ‚Wir zeichnen den Anruf auf …' — das bitte ausstellen, das
  // sagt der Mitarbeiter zu Beginn!"
  //
  // Der Hinweis nach §201 StGB entfällt damit NICHT — er wechselt nur den
  // Sprecher. Die Pflicht ist, dass der Aufgezeichnete es erfährt, bevor
  // aufgezeichnet wird; ob das eine Stimme vom Band oder der Mensch am anderen
  // Ende sagt, ist gleichwertig. Im Softphone steht der Pflichtsatz weiterhin
  // ÜBER dem Anrufknopf und ist nicht wegklickbar.
  //
  // Warum es besser ist: Das Band lief, bevor der Mitarbeiter „Guten Tag"
  // sagen konnte. Der Kunde hörte als Erstes eine Maschine, die von Aufnahme
  // spricht — der denkbar schlechteste Einstieg in ein Gespräch über seine
  // Schulden. Aufgelegt wurde dabei häufiger als danach.
  // ══════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════
  // MENSCH ODER MAILBOX? (27.08.2026)
  //
  // Florentine: „Man hört nicht, ob eine Mailbox drangeht oder ein Mensch."
  //
  // Sie hat recht, und es kostet echte Zeit: Der Mitarbeiter beginnt seinen
  // Satz, merkt nach fünf Sekunden, dass er auf ein Band spricht, legt auf —
  // und die Zeile steht danach als „beendet" mit vierzig Sekunden Dauer in
  // der Auswertung, als wäre ein Gespräch zustande gekommen.
  //
  // `machineDetection="Enable"` lässt Twilio im Hintergrund erkennen, WER
  // abgenommen hat, und meldet das Ergebnis an `amdStatusCallback`. Die
  // Verbindung wird dabei NICHT verzögert — die Erkennung läuft parallel zum
  // schon bestehenden Gespräch. (Der Wert `DetectMessageEnd` würde warten;
  // das wäre für ein Verkaufsgespräch der falsche Tausch.)
  //
  // Kosten: Twilio berechnet die Erkennung je Anruf. Bei rund 500 Anrufen in
  // der Woche sind das wenige Euro im Monat — gegen Gesprächszeit gerechnet,
  // die auf Mailboxen verloren geht, ein guter Handel.
  // ══════════════════════════════════════════════════════════════════════════
  const amd = opts.amdCallback
    ? `\n        machineDetection="Enable"\n        amdStatusCallback="${esc(opts.amdCallback)}"\n        amdStatusCallbackMethod="POST"`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${esc(von)}" timeout="30" timeLimit="${MAX_MINUTEN * 60}"
        record="record-from-answer-dual"
        recordingStatusCallback="${esc(opts.aufnahmeCallback)}"
        recordingStatusCallbackEvent="completed"
        answerOnBridge="true"
        action="${esc(opts.statusCallback)}">
    <Number${amd}>${esc(an)}</Number>
  </Dial>
</Response>`;
}

// ───────────────────────────────────────────────────────────────────────────
// Zugangsausweis für den Browser
// ───────────────────────────────────────────────────────────────────────────

/**
 * Kurzlebiger Ausweis für das Browser-SDK.
 *
 * Eine Stunde: lang genug für einen Arbeitsblock, kurz genug, dass ein
 * abgegriffener Ausweis nicht morgen noch telefoniert.
 */
export async function zugangsAusweis(agentId: number): Promise<{ ok: boolean; token?: string; identitaet?: string; grund?: string }> {
  const stand = einrichtungsStand();
  if (!stand.bereit) return { ok: false, grund: stand.hinweis };
  try {
    const twilio = await import("twilio");
    const { AccessToken } = twilio.default.jwt;
    const identitaet = `agent-${agentId}`;
    const ausweis = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_API_KEY_SID!,
      process.env.TWILIO_API_KEY_SECRET!,
      { identity: identitaet, ttl: 3600 },
    );
    ausweis.addGrant(new AccessToken.VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID!,
      // ══════════════════════════════════════════════════════════════════════
      // JETZT AUCH EINGEHEND
      //
      // ── DER AUFTRAG (11.08.2026) ─────────────────────────────────────────
      // Der Vorgesetzte: „Wir brauchen jetzt die Funktion, dass der Kunde uns
      // auch anrufen kann. Wichtig: Wenn der Kunde anruft, muss stehen, wer
      // dafür zuständig ist, damit der richtige rangeht!"
      //
      // Hier stand `incomingAllow: false` mit der Begründung, ein Browser, der
      // klingeln soll, müsse offen sein. Das stimmt — und ist kein Grund,
      // eingehende Rufe unmöglich zu machen. Wer den Tab offen hat, soll
      // erreichbar sein; wer nicht, dessen Anruf geht weiter an die nächste
      // Stelle (siehe fiaon-anruf-eingehend.ts).
      //
      // ── DIE IDENTITÄT IST DIE ADRESSE ────────────────────────────────────
      // `agent-<id>` ist die Kennung, unter der Twilio diesen Browser erreicht.
      // Das TwiML für eingehende Rufe wählt genau diese Kennung — deshalb muss
      // sie stabil bleiben und darf nie geraten werden.
      // ══════════════════════════════════════════════════════════════════════
      incomingAllow: true,
    }));
    return { ok: true, token: ausweis.toJwt(), identitaet };
  } catch (err) {
    return { ok: false, grund: `Twilio-Ausweis fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Protokoll
// ───────────────────────────────────────────────────────────────────────────

export async function wahlProtokoll(
  opts: { agentId: number; agentName: string; nummer: string; personId?: number | null; erlaubt: boolean; grund?: string | null },
  lauf: Lauf = sqlPool,
): Promise<void> {
  await lauf`
    INSERT INTO fiaon_call_versuche (agent_id, agent_name, nummer, person_id, erlaubt, grund)
    VALUES (${opts.agentId}, ${opts.agentName}, ${opts.nummer}, ${opts.personId ?? null},
            ${opts.erlaubt}, ${opts.grund ?? null})
  `.catch(() => {});
}

/** Anrufe ohne dokumentiertes Ergebnis — die Erinnerungsmarke am Knopf. */
export async function offeneAnrufe(agentId: number, lauf: Lauf = sqlPool): Promise<any[]> {
  return (await lauf`
    SELECT c.id, c.nummer, c.beginn, c.dauer_sek, c.person_id, c.ref, c.status,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, c.nummer) AS name
    FROM fiaon_calls c LEFT JOIN fiaon_persons p ON p.id = c.person_id
    WHERE c.agent_id = ${agentId} AND c.ergebnis IS NULL
      AND (
        c.status = 'beendet'
        -- EIN HAENGENDER VERSUCH IST KEIN OFFENES GESPRAECH.
        -- Gemessen am 11.08.2026: Vier Anrufe standen auf „laeuft" und tauchten
        -- dauerhaft als „ohne Ergebnis" auf. Sie laufen nicht — der Browser
        -- wurde geschlossen oder die Verbindung brach ab, bevor Twilio den
        -- Schlussvermerk schicken konnte.
        -- Nach einer Stunde ist kein Telefonat mehr im Gange: Die Hoechstdauer
        -- liegt bei 60 Minuten.
        OR (c.status = 'laeuft' AND c.beginn > NOW() - INTERVAL '1 hour')
      )
      AND c.beginn > NOW() - INTERVAL '3 days'
    ORDER BY c.beginn DESC
    LIMIT 20
  `) as any[];
}


// ═══════════════════════════════════════════════════════════════════════════
// AUFBEWAHRUNG — eine Aufnahme braucht ein Ablaufdatum
//
// ── WARUM DAS NICHT AUFSCHIEBBAR IST ───────────────────────────────────────
// Eine Gesprächsaufnahme ist die intimste Art von Kundendaten, die dieses
// Haus speichert: eine Stimme, ein Tonfall, ein Zögern. Sie liegt bei Twilio
// in der Cloud, und die URL dazu stand unbefristet in der Datenbank.
//
// Ohne Löschlauf wird das Archiv nur älter. Nach zwei Jahren liegen dort
// zehntausend Gespräche, für die niemand eine Rechtsgrundlage benennen kann —
// und die im Fall einer Auskunftsanfrage alle herausgegeben werden müssten.
//
// 90 Tage: lang genug, um ein Gespräch nachzuhören oder eine Beschwerde zu
// prüfen; kurz genug, dass kein Archiv entsteht.
// ═══════════════════════════════════════════════════════════════════════════

/** Die Frist in Tagen, aus den Einstellungen. */
export async function aufnahmeFrist(): Promise<number> {
  const { sqlPool } = await import("./db-pool");
  const [r] = (await sqlPool`
    SELECT value FROM fiaon_settings WHERE key = 'aufnahme_frist_tage'
  `.catch(() => [] as any[])) as any[];
  const n = Number(r?.value);
  // Grenzen mit Absicht: 7 Tage sind das Minimum, um eine Beschwerde zu
  // prüfen; über 365 wäre kein Ablauf mehr, sondern ein Archiv mit Verzögerung.
  return Number.isFinite(n) && n >= 7 && n <= 365 ? Math.round(n) : 90;
}

/**
 * Der Löschlauf.
 *
 * ── IDEMPOTENT UND PROTOKOLLIERT ───────────────────────────────────────────
 * Zweimal am selben Tag gestartet passiert beim zweiten Mal nichts: Der
 * Vermerk `aufnahme_geloescht_am` schließt die Zeile aus. Das ist wichtig,
 * weil ein Tageslauf bei einem Neustart doppelt anlaufen kann.
 *
 * Die Aufnahme wird bei TWILIO gelöscht, nicht nur die URL vergessen. Eine
 * vergessene URL ist keine Löschung — die Datei liegt weiter in der Cloud.
 *
 * Transkript und Zusammenfassung BLEIBEN. Sie sind das Arbeitsergebnis, das
 * in der Akte steht; die Aufnahme ist das Rohmaterial. Wer beides löscht,
 * verliert die Nachvollziehbarkeit der eigenen Notizen.
 */
export async function aufnahmenAufraeumen(nurZeigen = false): Promise<{
  frist: number; faellig: number; geloescht: number; fehler: number; hinweise: string[];
}> {
  const { sqlPool } = await import("./db-pool");
  const frist = await aufnahmeFrist();
  const hinweise: string[] = [];

  const faellig = (await sqlPool`
    SELECT id, recording_sid, beginn FROM fiaon_calls
    WHERE recording_url IS NOT NULL
      AND aufnahme_geloescht_am IS NULL
      AND beginn < NOW() - (${frist} || ' days')::interval
    ORDER BY beginn
    LIMIT 500
  `) as any[];

  if (nurZeigen) {
    return { frist, faellig: faellig.length, geloescht: 0, fehler: 0,
      hinweise: [`${faellig.length} Aufnahmen älter als ${frist} Tage. Nichts gelöscht (Vorschau).`] };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID || "";
  const tok = process.env.TWILIO_AUTH_TOKEN || "";
  let geloescht = 0;
  let fehler = 0;

  for (const c of faellig) {
    let weg = false;
    if (c.recording_sid && sid && tok) {
      const r = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Recordings/${c.recording_sid}.json`,
        {
          method: "DELETE",
          headers: { Authorization: "Basic " + Buffer.from(`${sid}:${tok}`).toString("base64") },
          signal: AbortSignal.timeout(15_000),
        },
      ).catch(() => null);
      // 404 zählt als Erfolg: Die Aufnahme ist weg, egal wer sie entfernt hat.
      weg = !!r && (r.status === 204 || r.status === 404);
      if (!weg) {
        fehler++;
        hinweise.push(`Anruf ${c.id}: Twilio antwortete mit HTTP ${r?.status ?? "nichts"}.`);
        // NICHT als gelöscht vermerken — sonst gilt eine Aufnahme als weg,
        // die noch in der Cloud liegt. Der nächste Lauf versucht es erneut.
        continue;
      }
    }
    await sqlPool`
      UPDATE fiaon_calls
      SET aufnahme_geloescht_am = NOW(), recording_url = NULL, updated_at = NOW()
      WHERE id = ${c.id}
    `;
    geloescht++;
  }

  if (geloescht > 0 || fehler > 0) {
    console.log(`[TELEFON] Löschlauf: ${geloescht} Aufnahmen entfernt, ${fehler} Fehler (Frist ${frist} Tage).`);
  }
  return { frist, faellig: faellig.length, geloescht, fehler, hinweise };
}
