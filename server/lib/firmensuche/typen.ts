// ═══════════════════════════════════════════════════════════════════════════
// FIRMENSUCHE — GEMEINSAME TYPEN UND HANDGRIFFE (17.09.2026, E-188)
//
// Justin: „Wenn man seine Firma eingibt, soll sich ein Register öffnen, der
// Kunde klickt auf seine Firma und alle Daten füllen sich aus."
//
// Jedes Land hat eine REIHENFOLGE von Anbietern (siehe index.ts). Ein Anbieter
// ist ein Modul in diesem Ordner und erfüllt die Schnittstelle „Anbieter"
// unten. Ein Anbieter ohne Schlüssel ist schlicht „nicht aktiv" — kein Fehler,
// kein Log, die Reihenfolge rückt einfach weiter.
//
// WAS HIER BEWUSST NICHT STEHT: die Datenbank. Dieser Ordner importiert
// db-pool nirgends — der Cache liegt in der Route. So läuft der Prüfstand
// (scripts/pruef-firmensuche.ts) ohne DATABASE_URL und kann die Produktion
// gar nicht erst berühren.
// ═══════════════════════════════════════════════════════════════════════════

export type Land = "DE" | "AT" | "CH";
export const LAENDER: readonly Land[] = ["DE", "AT", "CH"];

export function alsLand(roh: unknown): Land | null {
  const l = String(roh ?? "").trim().toUpperCase();
  return (LAENDER as readonly string[]).includes(l) ? (l as Land) : null;
}

/** Eine Zeile der Trefferliste — genau das, was die Oberfläche anzeigt. */
export interface Treffer {
  id: string;
  name: string;
  rechtsform?: string;
  ort?: string;
  plz?: string;
  /** „HRB 12345, AG München" / „FN 123456a" / „CHE-123.456.789" */
  register?: string;
  /** „aktiv" | „in Liquidation" | „gelöscht" — nur wenn die Quelle es sagt. */
  status?: string;
}

export interface Vertreter {
  vorname?: string;
  nachname?: string;
  /** Der Name, wie ihn die Quelle schreibt — immer gesetzt, auch wenn er sich nicht sicher teilen lässt. */
  name?: string;
  funktion?: string;
}

/** Der ausgefüllte Firmenbogen. Jedes Feld außer name/land ist freiwillig: Was die Quelle nicht sagt, bleibt leer. */
export interface Firma {
  name: string;
  rechtsform?: string;
  registergericht?: string;
  registernummer?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land: string;
  ustId?: string;
  website?: string;
  telefon?: string;
  email?: string;
  zweck?: string;
  vertreter?: Vertreter[];
  quelleRegister: string;
  quelleText: string;
  abgerufenAm: string;
}

export interface Anbieter {
  /** Kennung in der Schnittstelle (quelle=…), klein und ohne Leerzeichen. */
  kennung: string;
  land: Land;
  /** Pflicht-Quellenangabe, wie sie unter der Trefferliste steht. */
  quelleText: string;
  /** Aufrufe je Minute, die wir uns selbst erlauben (Token-Eimer). */
  proMinute: number;
  /**
   * Wie lange EIN Aufruf höchstens laufen darf. Liegt der Wert über der
   * Gesamtfrist der Suche, darf der Aufruf im Hintergrund zu Ende laufen und
   * füllt den Cache für den nächsten Tastendruck (LINDAS braucht 4–6 s).
   */
  zeitMs: number;
  aktiv(): boolean;
  suchen(q: string, signal: AbortSignal): Promise<Treffer[]>;
  detail(id: string, signal: AbortSignal): Promise<Firma | null>;
  /** Passt diese id zu diesem Anbieter? (CH: eine UID verstehen alle drei.) */
  kenntId(id: string): boolean;
}

export type FehlerArt = "drossel" | "zeit" | "netz" | "antwort" | "schluessel" | "eingabe";

export class AnbieterFehler extends Error {
  art: FehlerArt;
  constructor(art: FehlerArt, text: string) {
    super(text);
    this.art = art;
  }
}

/** Der Anbieter-Agent nennt sich ehrlich — überall derselbe Satz. */
export const AGENT_KENNUNG = "FIAON-Firmensuche (+https://fiaon.com)";

// ── Eingabe säubern ─────────────────────────────────────────────────────────
// Steuerzeichen raus, Leerraum glätten, Länge deckeln. Sonderzeichen bleiben:
// Firmennamen tragen „&", „+", Anführungszeichen und Punkte. Entschärft wird
// erst dort, wo es zählt — im SPARQL-Literal und im SOAP-XML.
export const SUCHE_MIN = 3;
export const SUCHE_MAX = 80;

export function sucheSaeubern(roh: unknown): string {
  return String(roh ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SUCHE_MAX);
}

// ── Der Token-Eimer je Anbieter ─────────────────────────────────────────────
// Füllt sich gleichmäßig nach; ein leerer Eimer heißt „dieser Anbieter setzt
// aus", nicht „die Suche scheitert".
export class Eimer {
  private stand: number;
  private zuletzt: number;
  constructor(private proMinute: number, private uhr: () => number = Date.now) {
    this.stand = proMinute;
    this.zuletzt = uhr();
  }
  nehmen(): boolean {
    const jetzt = this.uhr();
    this.stand = Math.min(this.proMinute, this.stand + ((jetzt - this.zuletzt) / 60_000) * this.proMinute);
    this.zuletzt = jetzt;
    if (this.stand < 1) return false;
    this.stand -= 1;
    return true;
  }
}

// ── Abruf mit Frist ─────────────────────────────────────────────────────────
// Für die FESTEN Adressen der Register-Anbieter. Frei eingegebene Adressen
// (Impressum) gehen NIE hier durch, sondern durch netzschutz.ts.
export async function holen(url: string, init: RequestInit, fristMs: number, aussen?: AbortSignal): Promise<globalThis.Response> {
  const abbruch = new AbortController();
  const wecker = setTimeout(() => abbruch.abort(), fristMs);
  const weiter = () => abbruch.abort();
  if (aussen) {
    if (aussen.aborted) abbruch.abort();
    else aussen.addEventListener("abort", weiter, { once: true });
  }
  try {
    return await fetch(url, {
      ...init,
      signal: abbruch.signal,
      headers: { "User-Agent": AGENT_KENNUNG, ...(init.headers as Record<string, string> | undefined) },
    });
  } catch (e: any) {
    if (abbruch.signal.aborted) throw new AnbieterFehler("zeit", "Zeit abgelaufen");
    throw new AnbieterFehler("netz", String(e?.message || e).slice(0, 120));
  } finally {
    clearTimeout(wecker);
    aussen?.removeEventListener("abort", weiter);
  }
}

/** HTTP-Status eines Anbieters in unsere Fehlerarten übersetzen. */
export function statusPruefen(res: globalThis.Response, wer: string): void {
  if (res.ok) return;
  if (res.status === 429) throw new AnbieterFehler("drossel", `${wer}: 429`);
  if (res.status === 401 || res.status === 402 || res.status === 403) throw new AnbieterFehler("schluessel", `${wer}: ${res.status}`);
  throw new AnbieterFehler("antwort", `${wer}: HTTP ${res.status}`);
}

export const sauber = (v: unknown, max = 200): string | undefined => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return s ? s : undefined;
};

/** Leere Felder fallen aus der Antwort — die Oberfläche soll „fehlt" von „leer" nicht unterscheiden müssen. */
export function ohneLeere<T extends object>(o: T): T {
  const raus: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    raus[k] = v;
  }
  return raus as T;
}

/**
 * Einen Personennamen nur dann teilen, wenn es nichts zu raten gibt: genau
 * zwei Wörter. „Anna Maria von der Heide" bleibt ganz im Feld name — die
 * Oberfläche zeigt ihn an, der Kunde teilt ihn selbst.
 */
/**
 * Register und Anbieter schreiben Funktionen teils mit Gender-Zeichen („Geschäftsführer:in",
 * „Inhaber/in", „Vorstand*in"). Die Funktion landet im Vertrag neben einem Namen — dort steht
 * sie in der Grundform; der Unterzeichner kann sie im Auftrag ändern (17.09.2026, Live-Test).
 */
export function funktionSauber(roh: unknown): string | undefined {
  const f = sauber(roh, 120);
  return f ? f.replace(/\s*[:*\/_]\s*in(nen)?\b/gi, "").replace(/\(in\)/gi, "").trim() || undefined : undefined;
}

export function vertreterAus(name: string | undefined, funktion?: string, vorname?: string, nachname?: string): Vertreter | null {
  const v = sauber(vorname, 80), n = sauber(nachname, 80);
  const ganz = sauber(name, 160) ?? sauber([v, n].filter(Boolean).join(" "), 160);
  if (!ganz) return null;
  if (v || n) return ohneLeere({ vorname: v, nachname: n, name: ganz, funktion: funktionSauber(funktion) });
  const teile = ganz.split(" ");
  if (teile.length === 2 && !/[.,]/.test(ganz)) return ohneLeere({ vorname: teile[0], nachname: teile[1], name: ganz, funktion: funktionSauber(funktion) });
  return ohneLeere({ name: ganz, funktion: funktionSauber(funktion) });
}
