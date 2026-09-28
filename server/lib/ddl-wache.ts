// ═══════════════════════════════════════════════════════════════════════════
// DIE DDL-WACHE (E-254, 28.09.2026)
//
// Der Ausfall: Am 28.09. stand das Agentenportal von 14:53 bis 15:20. Florentine:
// „Gibt es gerade ein Update oder so? Bei Nikita und mir geht nichts mehr."
//
// Was dahinter lag: Eine lange Lesung (seit 13:55, ohne Zeitlimit) hielt die
// Tabellen der WA-Zentrale. Beim Deploy um 14:52 schickte der neue Server seine
// Tabellen-Prüfungen los — `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, `ALTER
// COLUMN … DROP NOT NULL`. Jede davon will die STÄRKSTE Sperre (ACCESS
// EXCLUSIVE), und zwar AUCH DANN, wenn die Spalte längst da ist: Postgres nimmt
// die Sperre, bevor es nachsieht. Die Anweisung stellte sich hinter die Lesung —
// und hinter sie jede weitere Abfrage auf derselben Tabelle. `requireAgent`
// (347 Routen) ruft bei JEDER Anfrage `ensureAgentTables()` auf; bis zum ersten
// Erfolg schickte jede Anfrage ihren eigenen ALTER. Nach Sekunden waren alle 12
// Plätze des Pools belegt, danach stand jede Abfrage des Servers. Gelöst hat es
// erst das Abbrechen der Lesung von Hand.
//
// Im Code stehen rund 500 solcher Stellen in 96 Dateien. Statt jede einzeln
// umzuschreiben, legt sich diese Wache EINMAL um `sqlPool` (db-pool.ts) und um
// den drizzle-`client` (db.ts). Jede Tabellen-Anweisung, die dort als Tagged
// Template oder über `unsafe(…)` ankommt, läuft so:
//
//   1. Gedächtnis    — war dieselbe Anweisung in diesem Prozess schon erfolgreich
//                      (nur bei „IF NOT EXISTS"-Formen): sofort fertig.
//   2. Einmal-Flug   — läuft dieselbe Anweisung gerade: auf DIESE warten, statt
//                      eine zweite, dritte, zwölfte loszuschicken.
//   3. Vorabprüfung  — im Katalog (pg_attribute, to_regclass, pg_trigger), das
//                      nimmt KEINE Tabellensperre. Ist alles schon da: nichts
//                      ausführen. Auf der Produktion traf das am 28.09. auf 762
//                      von 768 Prüfungen zu.
//   4. Nur wenn wirklich etwas fehlt: eigene Transaktion mit kurzem
//      `lock_timeout` (Versuche à 0,5 s, zusammen höchstens 3 s). Wer dahinter
//      wartet, wartet nie länger als einen Versuch. Ist die Tabelle nach 3 s
//      nicht frei: aufgeben, Log-Zeile mit dem, der sie hält, und
//   5. Abkühlzeit    — kurz nach dem Aufgeben (3 s, bei jedem weiteren Aufgeben
//                      doppelt so lang) wirft jeder weitere Aufruf derselben
//                      Anweisung sofort denselben Fehler, ohne Sperrversuch.
//                      Danach sieht die Wache im Katalog nach, ob der Halter
//                      noch da ist (pg_locks, sperrt nichts): Ist er weg, läuft
//                      der nächste Aufruf sofort durch. Nur solange er bleibt,
//                      weist sie weiter ab — höchstens 60 s, dann neuer Versuch.
//                      (E-254-Nachprüfung: vorher 60 s fest nach der Uhr — aus
//                      4 s Sperre wurden 63 s Fehler.) Im Hintergrund holt die
//                      Wache „IF NOT EXISTS"-Anweisungen selbst nach (erst nach
//                      3 s, dann mit wachsendem Abstand bis 10 min) — auch dort,
//                      wo der Aufrufer den Fehler mit `.catch(() => {})`
//                      verschluckt und sich „erledigt" gemerkt hat. So bleibt
//                      keine Funktion bis zum nächsten Neustart ohne ihre Spalte.
//
// Unverändert bleiben: jede normale Abfrage, Fragmente (auch eine DDL als
// Fragment — sie läuft im umgebenden Text, nicht über die Wache), `begin`/tx
// (auch DDL darin — die 35 Stellen dort haben ihr eigenes `SET LOCAL
// lock_timeout`), `reserve`, `json`, `array`, `end`, `options` und damit alle
// Geld-Wege. Ein Text, der Daten ändert oder Zeilen sperrt (INSERT, UPDATE,
// DELETE, MERGE, WITH, CALL, COPY, SELECT … FOR UPDATE/SHARE, Advisory-Locks),
// geht IMMER unverändert durch — auch wenn eine Tabellen-Anweisung dabei ist.
// Für Buchungen gilt kein kurzes Sperrlimit.
//
// Das Rückgabeobjekt ist die ECHTE postgres.js-Query (E-254-Nachprüfung):
// `.simple()`, `.values()`, `.raw()`, Fragmente, `instanceof`, Ergebnis-Felder
// (`count`, `command`) verhalten sich wie am rohen Client. Umgeleitet wird nur
// ihre Ausführung. `.cursor()`, `.forEach()`, `.describe()`, `.readable()`,
// `.writable()` laufen ungebremst wie vor E-254 (im Server nirgends an DDL).
// Bewusst NICHT poolweit `lock_timeout`: gemessen greift das auch bei
// `pg_advisory_xact_lock`, `SELECT … FOR UPDATE` und Zeilen-UPDATEs — also in
// Buchung, Raten-Storno, Tagesplatz und Auskunft.
//
// Schalter (Umgebung):
//   DDL_WACHE=aus            → roher Client, alles wie vor E-254 (Not-Aus).
//   DDL_LOCK_TIMEOUT=3s      → längste Wartezeit einer Anweisung auf ihre Sperre.
//   DDL_LOCK_VERSUCH=500ms   → Sperrfrist je Versuch (so lange warten Leser höchstens).
//   DDL_ABKUEHLEN_S=60       → längste Abkühlzeit, solange der Halter bleibt.
// ═══════════════════════════════════════════════════════════════════════════

const NAME = String.raw`(?:"(?:[^"]|"")+"|[A-Za-z_][\w$]*)(?:\.(?:"(?:[^"]|"")+"|[A-Za-z_][\w$]*))?`;
const IDENT = String.raw`(?:"(?:[^"]|"")+"|[A-Za-z_][\w$]*)`;

/** Längere Texte (nur Migrationen) werden nicht zerlegt, sondern nur mit Frist ausgeführt. */
const MAX_ZERLEGEN = 64 * 1024;

/**
 * Text in Anweisungen zerlegen: Trenner (Semikolon oder Komma) nur auf oberster
 * Ebene, Kommentare entfernt (auch verschachtelte), '…', "…" und $$…$$ bleiben
 * ganz. Leerraum wird nur AUSSERHALB davon zusammengezogen — E-254 (28.09.2026):
 * ein DO-Körper behält seine Zeilen, sonst liefe ein „-- Kommentar" darin bis zum
 * Ende des Körpers; und ein Vorgabewert 'a  b' bleibt, wie er im Katalog steht.
 */
export function zerlege(text: string, trenner = ";"): string[] {
  const teile: string[] = [];
  let akt = "";
  let tiefe = 0;
  const leer = () => { if (akt && !akt.endsWith(" ")) akt += " "; };
  const fertig = () => { const t = akt.trim(); if (t) teile.push(t); akt = ""; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === "-" && n === "-") { while (i < text.length && text[i] !== "\n") i++; leer(); continue; }
    if (c === "/" && n === "*") { i = kommentarEnde(text, i) - 1; leer(); continue; }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < text.length) { if (text[j] === c) { if (text[j + 1] === c) { j += 2; continue; } break; } j++; }
      akt += text.slice(i, j + 1); i = j; continue;
    }
    if (c === "$") {
      const m = text.slice(i, i + 64).match(/^\$([A-Za-z_]\w*)?\$/);
      if (m) {
        const ende = text.indexOf(m[0], i + m[0].length);
        const j = ende < 0 ? text.length : ende + m[0].length;
        akt += text.slice(i, j); i = j - 1; continue;
      }
    }
    if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f") { leer(); continue; }
    if (c === "(") tiefe++;
    if (c === ")") tiefe--;
    if (c === trenner && tiefe === 0) { fertig(); continue; }
    akt += c;
  }
  fertig();
  return teile;
}

// Position hinter einem Blockkommentar ab `i` — Postgres zählt verschachtelte
// Blockkommentare mit (E-254-Nachprüfung: kopf() tat das nicht, zerlege() schon).
function kommentarEnde(text: string, i: number): number {
  let tiefe = 1;
  i += 2;
  while (i < text.length && tiefe > 0) {
    if (text[i] === "/" && text[i + 1] === "*") { tiefe++; i += 2; }
    else if (text[i] === "*" && text[i + 1] === "/") { tiefe--; i += 2; }
    else i++;
  }
  return i;
}

/**
 * Was Postgres wirklich als Anweisung liest — E-254 (28.09.2026). Kommentare
 * (auch verschachtelte) fallen weg. Mit `texteLeeren` außerdem der Inhalt von
 * '…' und $tag$…$tag$ (bleiben als leere Hülle) und "Namen" (werden zu "x"):
 * Dann macht ein „ALTER TABLE" in einem Kommentar oder in RAISE NOTICE '…' aus
 * einer Buchung keine Tabellen-Anweisung.
 */
export function entkernen(text: string, texteLeeren: boolean): string {
  let aus = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === "-" && n === "-") { while (i < text.length && text[i] !== "\n") i++; aus += " "; continue; }
    if (c === "/" && n === "*") { i = kommentarEnde(text, i) - 1; aus += " "; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < text.length) { if (text[j] === c) { if (text[j + 1] === c) { j += 2; continue; } break; } j++; }
      aus += texteLeeren ? (c === "'" ? "''" : '"x"') : text.slice(i, j + 1); i = j; continue;
    }
    if (c === "$") {
      const m = text.slice(i, i + 64).match(/^\$([A-Za-z_]\w*)?\$/);
      if (m) {
        const ende = text.indexOf(m[0], i + m[0].length);
        const j = ende < 0 ? text.length : ende + m[0].length;
        aus += texteLeeren ? "$$$$" : text.slice(i, j); i = j - 1; continue;
      }
    }
    aus += c;
  }
  return aus;
}

/** Der Körper eines DO-Blocks (zwischen dem ersten $tag$-Paar) — ohne $-Hülle der ganze Rest. */
function doKoerper(anweisung: string): string {
  const m = anweisung.match(/\$([A-Za-z_]\w*)?\$/);
  if (!m || m.index === undefined) return anweisung.replace(/^\s*DO\s+/i, "");
  const start = m.index + m[0].length;
  const ende = anweisung.indexOf(m[0], start);
  return anweisung.slice(start, ende < 0 ? anweisung.length : ende);
}

const bezeichner = (s: string) => (s.startsWith('"') ? s.slice(1, -1).replace(/""/g, '"') : s.toLowerCase());

export type Pruefung = {
  art: "relation" | "extension" | "kein_trigger" | "spalte" | "nullbar" | "vorgabe";
  tabelle?: string;
  name: string;
  wert?: string;
};

/**
 * Ist diese EINE Anweisung ohne Tabellensperre im Katalog entscheidbar?
 * null = nicht entscheidbar → sie wird (mit Frist) ausgeführt. Übersprungen wird
 * nur, wenn ALLE Teilklauseln erkannt und erfüllt sind — genau die Semantik von
 * IF NOT EXISTS, nur ohne die Sperre davor.
 */
export function pruefplan(anweisung: string): Pruefung[] | null {
  let m: RegExpMatchArray | null;
  if ((m = anweisung.match(new RegExp(`^CREATE TABLE IF NOT EXISTS (${NAME}) ?\\(`, "i"))))
    return [{ art: "relation", name: m[1] }];
  if ((m = anweisung.match(new RegExp(`^CREATE (?:UNIQUE )?INDEX IF NOT EXISTS (${IDENT}) ON `, "i"))))
    return [{ art: "relation", name: m[1] }];
  if ((m = anweisung.match(new RegExp(`^CREATE EXTENSION IF NOT EXISTS (${IDENT})`, "i"))))
    return [{ art: "extension", name: bezeichner(m[1]) }];
  if ((m = anweisung.match(new RegExp(`^DROP TRIGGER IF EXISTS (${IDENT}) ON (${NAME})$`, "i"))))
    return [{ art: "kein_trigger", tabelle: m[2], name: bezeichner(m[1]) }];
  if ((m = anweisung.match(new RegExp(`^ALTER TABLE (?:IF EXISTS )?(?:ONLY )?(${NAME}) (.+)$`, "i")))) {
    const tabelle = m[1];
    const plan: Pruefung[] = [];
    for (const teil of zerlege(m[2], ",")) {
      let k: RegExpMatchArray | null;
      if ((k = teil.match(new RegExp(`^ADD (?:COLUMN )?IF NOT EXISTS (${IDENT})(?: |$)`, "i")))) plan.push({ art: "spalte", tabelle, name: bezeichner(k[1]) });
      else if ((k = teil.match(new RegExp(`^ALTER (?:COLUMN )?(${IDENT}) DROP NOT NULL$`, "i")))) plan.push({ art: "nullbar", tabelle, name: bezeichner(k[1]) });
      else if ((k = teil.match(new RegExp(`^ALTER (?:COLUMN )?(${IDENT}) SET DEFAULT ('(?:[^']|'')*')$`, "i")))) plan.push({ art: "vorgabe", tabelle, name: bezeichner(k[1]), wert: k[2] });
      else return null;
    }
    return plan.length ? plan : null;
  }
  return null;
}

// Was die Wache überhaupt anfasst. Bewusst NICHT dabei: LOCK TABLE (außerhalb
// einer Transaktion ein Fehler — in unserer Transaktion liefe es plötzlich
// durch), TRUNCATE (im Server nirgends), CREATE OR REPLACE FUNCTION/VIEW,
// COMMENT (sperren keine Tabelle für Leser).
const DDL_KOPF = /^(?:ALTER\s+TABLE|CREATE\s+(?:UNIQUE\s+)?INDEX|CREATE\s+TABLE|CREATE\s+(?:OR\s+REPLACE\s+)?(?:CONSTRAINT\s+)?TRIGGER|DROP\s+(?:TRIGGER|INDEX|TABLE)|CREATE\s+EXTENSION)\b/i;
const DO_MIT_DDL = /\b(?:ALTER\s+TABLE|CREATE\s+(?:UNIQUE\s+)?INDEX|DROP\s+TRIGGER|CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER)\b/i;
// Was nie in eine Transaktion darf (oder selbst eine steuert) → unverändert durchreichen.
const NIE_IN_TX = /\bCONCURRENTLY\b|^(?:BEGIN|COMMIT|ROLLBACK|END|START\s+TRANSACTION|SAVEPOINT|RELEASE|VACUUM|REINDEX)\b/i;
const IDEMPOTENT = /^(?:CREATE TABLE IF NOT EXISTS|CREATE (?:UNIQUE )?INDEX IF NOT EXISTS|CREATE EXTENSION IF NOT EXISTS|ALTER TABLE)\b/i;

// ── DATENÄNDERUNG GEHT NIE ÜBER DIE WACHE (E-254-Nachprüfung, 28.09.2026) ──
// Die Frist der Wache (Versuche à 0,5 s, zusammen 3 s, danach Abkühlzeit) ist für
// Tabellen-Anweisungen gebaut. Eine Buchung, die hinter einer Zeilensperre 5 s
// wartet, soll warten — nicht nach 3 s scheitern und 60 s lang denselben alten
// Fehler bekommen (gemessen mit einem DO-Block, der nur im Kommentar „ALTER
// TABLE" erwähnt, und mit „CREATE TABLE IF NOT EXISTS …; UPDATE …"). Deshalb
// geht ein Text, in dem eine Anweisung Daten ändert oder Zeilen sperrt, IMMER
// unverändert durch — wie vor E-254. Heute gibt es im Server keinen solchen
// Text; der Prüfstand (Abschnitt A) wird rot, sobald einer dazukommt.
//   Oberste Ebene: am Kopf der Anweisung (ein FUNCTION-Körper mit INSERT läuft
//   beim Anlegen nicht). Im DO-Körper: überall, Texte darin eingeschlossen
//   (EXECUTE 'UPDATE …') — im Zweifel durchreichen.
const DML_KOPF = /^(?:INSERT|UPDATE|DELETE|MERGE|WITH|CALL|COPY|TABLE|VALUES)\b/i;
const ZEILENSPERRE = /\bFOR\s+(?:NO\s+KEY\s+)?UPDATE\b|\bFOR\s+(?:KEY\s+)?SHARE\b|\bpg_(?:try_)?advisory/i;
const DML_IM_KOERPER = new RegExp(
  String.raw`\bINSERT\s+INTO\b|\bDELETE\s+FROM\b|\bMERGE\s+INTO\b|\bUPDATE\s+(?:ONLY\s+)?${NAME}(?:\s+(?:AS\s+)?${IDENT})?\s+SET\b|` +
    ZEILENSPERRE.source,
  "i",
);

/** Ändert diese EINE Anweisung (nach zerlege) Daten oder sperrt sie Zeilen? */
function aendertDaten(anweisung: string): boolean {
  if (/^DO\s/i.test(anweisung)) return DML_IM_KOERPER.test(entkernen(doKoerper(anweisung), false));
  if (DML_KOPF.test(anweisung)) return true;
  return /^SELECT\b/i.test(anweisung) && ZEILENSPERRE.test(entkernen(anweisung, true));
}

/** Wo die Anweisung beginnt: führende Leerzeichen und Kommentare überspringen (auch verschachtelte). */
function kopfStart(text: string): number {
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text.charCodeAt(i);
    if (c === 32 || c === 9 || c === 10 || c === 13) { i++; continue; }
    if (c === 45 && text.charCodeAt(i + 1) === 45) { const e = text.indexOf("\n", i); i = e < 0 ? n : e + 1; continue; }
    if (c === 47 && text.charCodeAt(i + 1) === 42) { i = kommentarEnde(text, i); continue; }
    break;
  }
  return i;
}

/** Führende Leerzeichen und Kommentare überspringen — ohne den ganzen Text zu kopieren. */
function kopf(text: string): string {
  const i = kopfStart(text);
  return text.slice(i, i + 200);
}

/** Beginnt der Text mit einer Tabellen-Anweisung (oder ist ein DO-Block, der eine enthält)? */
export function istDdl(text: string): boolean {
  const t = String(text);
  const start = kopfStart(t);
  const k = t.slice(start, start + 200);
  if (DDL_KOPF.test(k)) return true;
  // E-254-Nachprüfung: nur, was im DO-Körper wirklich ausgeführt wird — nicht ein
  // „ALTER TABLE" im Kommentar oder in einem Text.
  return /^DO\s/i.test(k) && DO_MIT_DDL.test(entkernen(doKoerper(t.slice(start, start + MAX_ZERLEGEN)), true));
}

export type DdlPlan = {
  /** Schlüssel für Gedächtnis, Einmal-Flug und Abkühlzeit. */
  text: string;
  /** Die ersten 80 Zeichen, Leerraum zusammengezogen — für die Log-Zeilen. */
  kurz: string;
  /** Tabellen, deren Halter beim Aufgeben genannt und in der Abkühlzeit nachgesehen werden. */
  tabellen: string[];
  /** Katalogprüfung für ALLE Anweisungen, oder null (dann immer ausführen). */
  pruefungen: Pruefung[] | null;
  /** Darf sich die Wache „erledigt" merken und im Hintergrund nachholen? */
  merkbar: boolean;
  /** Tagged Template mit Werten: nur Frist, kein Gedächtnis, keine Abkühlzeit. */
  mitWerten: boolean;
  /** Befehl der letzten Anweisung — `command` im Ergebnis, wenn nichts ausgeführt wurde. */
  befehl: string | null;
  /** Nur CREATE INDEX / CREATE TRIGGER: laufende Lesungen stören die Sperre nicht. */
  leserStoerenNicht: boolean;
};

const TABELLE_IN = new RegExp(
  `^(?:ALTER TABLE (?:IF EXISTS )?(?:ONLY )?|CREATE (?:UNIQUE )?INDEX (?:IF NOT EXISTS )?${IDENT} ON (?:ONLY )?|DROP TRIGGER (?:IF EXISTS )?${IDENT} ON |CREATE (?:OR REPLACE )?(?:CONSTRAINT )?TRIGGER ${IDENT} .*? ON )(${NAME})`,
  "i",
);

const ALTER_IN_DO = new RegExp(`\\bALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?(${NAME})`, "gi");

/** Der Befehl, den Postgres für eine übersprungene Anweisung gemeldet hätte. */
function befehlVon(anweisung: string | undefined): string | null {
  const m = String(anweisung ?? "").match(/^(ALTER TABLE|CREATE TABLE|CREATE (?:UNIQUE )?INDEX|CREATE EXTENSION|DROP TRIGGER)\b/i);
  return m ? m[1].toUpperCase().replace("UNIQUE ", "") : null;
}

/** Plan für einen Text — null heißt: keine Tabellen-Anweisung, unverändert durchreichen. */
export function planen(text: string, mitWerten = false): DdlPlan | null {
  if (!istDdl(text)) return null;
  const kurz = kopf(text).replace(/\s+/g, " ").slice(0, 80);
  if (text.length > MAX_ZERLEGEN) {
    if (NIE_IN_TX.test(text) || DML_IM_KOERPER.test(text)) return null;
    return { text, kurz, tabellen: [], pruefungen: null, merkbar: false, mitWerten, befehl: null, leserStoerenNicht: false };
  }
  const anweisungen = zerlege(text);
  if (anweisungen.length === 0 || anweisungen.some((a) => NIE_IN_TX.test(a))) return null;
  // Ein DO-Block, der selbst COMMIT/ROLLBACK ruft, darf nicht in eine Transaktion.
  if (anweisungen.some((a) => /^DO\s/i.test(a) && /\b(?:COMMIT|ROLLBACK)\b/i.test(entkernen(doKoerper(a), true)))) return null;
  // Daten ändern oder Zeilen sperren: unverändert durchreichen (siehe DML_KOPF).
  if (anweisungen.some(aendertDaten)) return null;
  const tabellen = Array.from(new Set(anweisungen.flatMap((a) => {
    const t = (a.match(TABELLE_IN) || [])[1];
    if (t) return [t];
    // DO-Block: die Tabellen aus den ALTER TABLE darin (für Halter-Zeile und Abkühlzeit).
    return /^DO\s/i.test(a) ? Array.from(entkernen(doKoerper(a), true).matchAll(ALTER_IN_DO), (m) => m[1]) : [];
  })));
  const befehl = befehlVon(anweisungen[anweisungen.length - 1]);
  const leserStoerenNicht = anweisungen.every((a) => /^CREATE (?:UNIQUE )?INDEX |^CREATE (?:OR REPLACE )?(?:CONSTRAINT )?TRIGGER /i.test(a));
  if (mitWerten) return { text, kurz, tabellen, pruefungen: null, merkbar: false, mitWerten: true, befehl, leserStoerenNicht };
  const plaene = anweisungen.map(pruefplan);
  const entscheidbar = plaene.every(Boolean);
  return {
    text,
    kurz,
    tabellen,
    pruefungen: entscheidbar ? (plaene.flat() as Pruefung[]) : null,
    merkbar: entscheidbar && anweisungen.every((a) => IDEMPOTENT.test(a)),
    mitWerten: false,
    befehl,
    leserStoerenNicht,
  };
}

const schlafen = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function dauerMs(wert: string | undefined, vorgabe: number): number {
  const m = String(wert ?? "").trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s)?$/i);
  if (!m) return vorgabe;
  const n = Number(m[1]) * (m[2]?.toLowerCase() === "s" ? 1000 : 1);
  return n >= 50 && n <= 600_000 ? Math.round(n) : vorgabe;
}

export type DdlWacheZahlen = {
  geprueft: number;       // Katalog-Vorabprüfungen
  schonDa: number;        // davon: alles schon da, nichts ausgeführt
  gedaechtnis: number;    // sofort fertig, weil in diesem Prozess schon erfolgreich
  einmalFlug: number;     // auf eine gerade laufende gleiche Anweisung gewartet
  ausgefuehrt: number;    // wirklich ausgeführt (mit Frist)
  sperrVersuche: number;  // Versuche, die an der Sperrfrist scheiterten
  aufgegeben: number;     // nach dem ganzen Fenster aufgegeben
  abkuehlung: number;     // in der Abkühlzeit sofort abgewiesen
  nachgeholt: number;     // im Hintergrund nachgeholt
};

/** Eine Anweisung, die an ihrer Sperrfrist aufgegeben hat (E-254). */
type Abweisung = {
  am: number;
  fehler: any;
  /** Wie oft hintereinander aufgegeben — jede Runde verdoppelt die erste Pause. */
  runde: number;
  /** Letzter Blick in pg_locks (höchstens einer je Sekunde, von allen Aufrufern geteilt). */
  blick?: { am: number; gehalten: Promise<boolean> };
};

type Instanz = {
  name: string;
  zahlen: DdlWacheZahlen;
  erledigt: Set<string>;
  abgewiesen: Map<string, Abweisung>;
  nachholen: Map<string, NodeJS.Timeout>;
  imFlug: Map<string, Promise<any>>;
};
const instanzen: Instanz[] = [];

/** Zähler aller Wachen (Prüfstand, Diagnose). */
export function ddlWacheStand(): Record<string, DdlWacheZahlen & { offen: string[] }> {
  const aus: Record<string, DdlWacheZahlen & { offen: string[] }> = {};
  for (const i of instanzen) aus[i.name] = { ...i.zahlen, offen: Array.from(i.abgewiesen.keys(), (t) => kopf(t).replace(/\s+/g, " ").slice(0, 80)) };
  return aus;
}

/**
 * Gedächtnis, Abkühlzeiten und geplantes Nachholen vergessen — für Prüfskripte,
 * die Spalten löschen und eine Schema-Funktion erneut laufen lassen.
 */
export function ddlWacheVergessen(): void {
  for (const i of instanzen) {
    i.erledigt.clear();
    i.abgewiesen.clear();
    i.nachholen.forEach((t) => clearTimeout(t));
    i.nachholen.clear();
  }
}

/** Ergebnis einer übersprungenen Anweisung — dieselben Felder wie postgres.js' Result. */
function leeresErgebnis(plan: DdlPlan, einfach: boolean): any[] {
  const e: any[] = [];
  Object.defineProperties(e, {
    count: { value: null, writable: true },
    state: { value: null, writable: true },
    command: { value: plan.befehl, writable: true },
    // Wie postgres.js: im einfachen Protokoll (unsafe ohne Werte, .simple())
    // bleibt `columns` leer (undefined), im erweiterten ist es [].
    columns: { value: einfach ? undefined : [], writable: true },
    statement: { value: null, writable: true },
  });
  return e;
}

/** Nicht ausgeführt, weil im Katalog schon alles da ist (Gedächtnis, Vorabprüfung). */
const UEBERSPRUNGEN = Symbol("ddl-wache:uebersprungen");

// Diese Formen baut die Wache nicht nach — sie laufen ungebremst wie vor E-254.
const DURCHREICHEN = ["cursor", "forEach", "describe", "readable", "writable"] as const;
const abbruchFehler = () => Object.assign(new Error("57014: canceling statement due to user request"), { code: "57014" });

/**
 * Legt die Wache um einen postgres.js-Client. Rückgabe hat denselben Typ und
 * verhält sich für alles außer Laufzeit-DDL exakt wie `roh`.
 */
export function ddlWache<T>(roh: T, name: string, opt: { log?: (zeile: string) => void } = {}): T {
  if (String(process.env.DDL_WACHE ?? "").trim().toLowerCase() === "aus") {
    console.log(`[DDL-WACHE] ${name}: AUS (DDL_WACHE=aus) — Tabellen-Anweisungen laufen ohne Sperrfrist.`);
    return roh;
  }
  const r: any = roh;
  const FENSTER_MS = dauerMs(process.env.DDL_LOCK_TIMEOUT, 3000);
  const VERSUCH_MS = Math.min(FENSTER_MS, dauerMs(process.env.DDL_LOCK_VERSUCH, 500));
  const ABKUEHLEN_MS = dauerMs(process.env.DDL_ABKUEHLEN_S ? `${process.env.DDL_ABKUEHLEN_S}s` : undefined, 60_000);
  // Erste Pause nach einem Aufgeben (danach je Runde doppelt, höchstens ABKUEHLEN_MS):
  // so lange wie ein ganzes Sperrfenster — auch bei einem Halter, den der Katalog
  // nicht zeigt, steht die Tabelle höchstens die Hälfte der Zeit unter Versuchen.
  const KURZ_MS = Math.min(ABKUEHLEN_MS, FENSTER_MS);
  const PAUSE_MS = 250;
  const GLEICHZEITIG = 2;
  const log = opt.log ?? ((z: string) => console.log(z));

  const inst: Instanz = {
    name,
    zahlen: { geprueft: 0, schonDa: 0, gedaechtnis: 0, einmalFlug: 0, ausgefuehrt: 0, sperrVersuche: 0, aufgegeben: 0, abkuehlung: 0, nachgeholt: 0 },
    erledigt: new Set(),
    abgewiesen: new Map(),
    nachholen: new Map(),
    imFlug: new Map(),
  };
  instanzen.push(inst);
  const z = inst.zahlen;

  // Zusammenfassung einmal 60 s nach dem ersten bewachten Aufruf — im Render-Log
  // der Beleg nach jedem Deploy: „ausgeführt" ≈ 0, „aufgegeben 0".
  let zusammenfassungGeplant = false;
  function zusammenfassungPlanen() {
    if (zusammenfassungGeplant) return;
    zusammenfassungGeplant = true;
    setTimeout(() => {
      log(`[DDL-WACHE] ${name} nach 60 s: geprüft ${z.geprueft} · schon da ${z.schonDa} · Gedächtnis ${z.gedaechtnis} · Einmal-Flug ${z.einmalFlug} · ausgeführt ${z.ausgefuehrt} · Sperre besetzt ${z.sperrVersuche} · aufgegeben ${z.aufgegeben} · Abkühlung ${z.abkuehlung} · nachgeholt ${z.nachgeholt}`);
    }, 60_000).unref?.();
  }

  // Höchstens zwei Tabellen-Anweisungen gleichzeitig: DDL belegt nie mehr als
  // 2 der 12 Plätze im Pool.
  let aktiv = 0;
  const warteschlange: (() => void)[] = [];
  const platz = () => (aktiv < GLEICHZEITIG ? (aktiv++, Promise.resolve()) : new Promise<void>((res) => warteschlange.push(res)));
  const frei = () => { const n = warteschlange.shift(); if (n) n(); else aktiv--; };

  async function schonDa(p: Pruefung[]): Promise<boolean> {
    z.geprueft++;
    try {
      const [zeile] = await r`
        SELECT COALESCE(bool_and(CASE p.art
          WHEN 'relation'     THEN to_regclass(p.name) IS NOT NULL
          WHEN 'extension'    THEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = p.name)
          WHEN 'kein_trigger' THEN NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass(p.tabelle) AND tgname = p.name)
          WHEN 'spalte'       THEN EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass(p.tabelle) AND attname = p.name AND attnum > 0 AND NOT attisdropped)
          WHEN 'nullbar'      THEN COALESCE((SELECT NOT attnotnull FROM pg_attribute WHERE attrelid = to_regclass(p.tabelle) AND attname = p.name AND attnum > 0 AND NOT attisdropped), FALSE)
          WHEN 'vorgabe'      THEN COALESCE((SELECT pg_get_expr(d.adbin, d.adrelid) = p.wert || '::' || format_type(a.atttypid, a.atttypmod)
                                             FROM pg_attribute a JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
                                            WHERE a.attrelid = to_regclass(p.tabelle) AND a.attname = p.name AND NOT a.attisdropped), FALSE)
          ELSE FALSE END), FALSE) AS ok
        FROM unnest(${p.map((x) => x.art)}::text[], ${p.map((x) => x.tabelle ?? "")}::text[],
                    ${p.map((x) => x.name)}::text[], ${p.map((x) => x.wert ?? "")}::text[]) AS p(art, tabelle, name, wert)`;
      return zeile?.ok === true;
    } catch {
      // Die Prüfung selbst ging schief (z. B. ein Name, den to_regclass nicht
      // mag): dann wie früher ausführen — nur eben mit Frist.
      return false;
    }
  }

  async function halter(tabellen: string[]): Promise<string> {
    if (tabellen.length === 0) return "unbekannt";
    try {
      const zeilen = await r`
        SELECT a.pid, a.application_name AS app, a.state,
               EXTRACT(EPOCH FROM NOW() - COALESCE(a.xact_start, a.query_start))::int AS sek,
               LEFT(regexp_replace(COALESCE(a.query, ''), '[[:space:]]+', ' ', 'g'), 80) AS abfrage
          FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
         WHERE l.relation = ANY (ARRAY(SELECT to_regclass(t) FROM unnest(${tabellen}::text[]) t))
           AND l.granted AND l.pid <> pg_backend_pid()
         GROUP BY 1, 2, 3, 4, 5
         ORDER BY sek DESC NULLS LAST
         LIMIT 3`;
      return zeilen.map((x: any) => `pid ${x.pid} (${x.app || "?"}, ${x.state}, seit ${x.sek} s: ${x.abfrage})`).join("; ") || "unbekannt";
    } catch {
      return "unbekannt";
    }
  }

  /**
   * Hält noch jemand die Tabellen, und zwar länger als eine Sekunde? Nur der Katalog
   * (pg_locks, pg_stat_activity) — nimmt keine Sperre. Kurze Abfragen zählen nicht:
   * die hätten den Versuch nicht scheitern lassen. Eine Sitzung, deren Beginn wir
   * nicht sehen dürfen (fremder Datenbank-Nutzer), zählt als Halter. Bei CREATE
   * INDEX/TRIGGER stören Lesungen nicht, nur Schreiber.
   */
  async function langerHalter(plan: DdlPlan): Promise<boolean> {
    try {
      const [zeile] = await r`
        SELECT EXISTS (
          SELECT 1 FROM pg_locks l LEFT JOIN pg_stat_activity a ON a.pid = l.pid
           WHERE l.relation = ANY (ARRAY(SELECT to_regclass(t) FROM unnest(${plan.tabellen}::text[]) t))
             AND l.granted AND l.pid IS DISTINCT FROM pg_backend_pid()
             AND NOT (${plan.leserStoerenNicht}::boolean AND l.mode IN ('AccessShareLock', 'RowShareLock'))
             AND COALESCE(COALESCE(a.xact_start, a.query_start) < NOW() - INTERVAL '1 second', TRUE)
        ) AS gehalten`;
      return zeile?.gehalten !== false;
    } catch {
      return true;
    }
  }

  /**
   * Abkühlzeit (E-254-Nachprüfung): an den Halter gekoppelt statt an die Uhr.
   * Vorher wies die Wache nach dem Aufgeben 60 s lang JEDEN Aufruf ab — gemessen:
   * Halter nach 4 s weg, erster Erfolg nach 63 s, 60 Fehlaufrufe dazwischen.
   */
  async function abweisen(plan: DdlPlan, s: Abweisung): Promise<boolean> {
    const seit = Date.now() - s.am;
    if (seit >= ABKUEHLEN_MS) return false;                                        // spätestens jetzt neu versuchen
    if (seit < Math.min(ABKUEHLEN_MS, KURZ_MS * 2 ** (s.runde - 1))) return true; // die erste Pause: ohne Nachsehen
    if (plan.tabellen.length === 0) return false;                                  // Halter nicht feststellbar: versuchen
    if (!s.blick || Date.now() - s.blick.am >= 1000) s.blick = { am: Date.now(), gehalten: langerHalter(plan) };
    return s.blick.gehalten;
  }

  /** Mit Frist ausführen: Versuche à VERSUCH_MS, zusammen höchstens FENSTER_MS. */
  async function ausfuehren(plan: DdlPlan, lauf: (tx: any) => any, hintergrund = false): Promise<any> {
    const beginn = Date.now();
    for (let versuch = 1; ; versuch++) {
      await platz();
      const frist = Math.max(50, Math.min(VERSUCH_MS, FENSTER_MS - (Date.now() - beginn)));
      const t0 = Date.now();
      try {
        const erg = await r.begin(async (tx: any) => {
          await tx.unsafe(`SET LOCAL lock_timeout = '${frist}ms'`);
          return await lauf(tx);
        });
        z.ausgefuehrt++;
        // Wer etwas LÖSCHT oder umbenennt (Prüfskripte, Aufräumen), macht das
        // Gedächtnis ungültig — die nächste Prüfung fragt wieder den Katalog.
        if (!plan.merkbar && /\b(?:DROP|RENAME)\b/i.test(plan.text)) inst.erledigt.clear();
        log(`[DDL-WACHE] ${name}: ${hintergrund ? "nachgeholt" : "ausgeführt"} in ${Date.now() - t0} ms: ${plan.kurz}`);
        return erg;
      } catch (e: any) {
        if (e?.code !== "55P03") throw e;
        z.sperrVersuche++;
        if (Date.now() - beginn + PAUSE_MS + VERSUCH_MS / 2 > FENSTER_MS) {
          z.aufgegeben++;
          log(`[DB] DDL wartete zu lange auf Sperre — später erneut: ${plan.kurz}`);
          log(`[DDL-WACHE] ${name}: ${versuch} Versuch(e) in ${Date.now() - beginn} ms, Tabelle hält ${await halter(plan.tabellen)}`);
          throw e;
        }
      } finally {
        frei();
      }
      await schlafen(PAUSE_MS + Math.floor(Math.random() * 100));
    }
  }

  /**
   * Der ganze Weg einer Anweisung: Gedächtnis → Abkühlzeit → Einmal-Flug →
   * Vorabprüfung → Frist. Liefert das Ergebnis oder UEBERSPRUNGEN.
   * `nachholLauf` baut die Anweisung ohne Bezug zum ersten Aufrufer (für das
   * Nachholen im Hintergrund).
   */
  async function durchlauf(plan: DdlPlan, lauf: (tx: any) => any, hintergrund = false, nachholLauf = lauf): Promise<any> {
    zusammenfassungPlanen();
    if (plan.mitWerten) return ausfuehren(plan, lauf, hintergrund);
    const key = plan.text;
    if (plan.merkbar && inst.erledigt.has(key)) { z.gedaechtnis++; return UEBERSPRUNGEN; }
    if (!hintergrund) {
      const sperre = inst.abgewiesen.get(key);
      if (sperre && (await abweisen(plan, sperre))) { z.abkuehlung++; throw sperre.fehler; }
      // Während des Nachsehens kann ein anderer Aufruf fertig geworden sein.
      if (sperre && plan.merkbar && inst.erledigt.has(key)) { z.gedaechtnis++; return UEBERSPRUNGEN; }
    }
    // Einmal-Flug nur für wiederholbare Formen: Ein Text mit z. B. einem INSERT
    // darin soll bei zwei Aufrufern auch zweimal laufen, wie bisher.
    const laeuft = plan.merkbar ? inst.imFlug.get(key) : undefined;
    if (laeuft) { z.einmalFlug++; return laeuft; }
    const p = (async () => {
      if (plan.pruefungen && (await schonDa(plan.pruefungen))) { z.schonDa++; return UEBERSPRUNGEN; }
      return ausfuehren(plan, lauf, hintergrund);
    })();
    if (plan.merkbar) inst.imFlug.set(key, p);
    p.then(
      () => {
        if (plan.merkbar) inst.erledigt.add(key);
        inst.abgewiesen.delete(key);
        const t = inst.nachholen.get(key);
        if (t) { clearTimeout(t); inst.nachholen.delete(key); }
      },
      (e: any) => {
        if (e?.code === "55P03") {
          const vorher = inst.abgewiesen.get(key);
          inst.abgewiesen.set(key, { am: Date.now(), fehler: e, runde: (vorher?.runde ?? 0) + 1 });
          // Das Nachholen im Hintergrund plant sich selbst weiter (wachsender Abstand).
          if (plan.merkbar && !hintergrund) nachholenPlanen(plan, nachholLauf, 1);
        }
      },
    ).finally(() => { if (inst.imFlug.get(key) === p) inst.imFlug.delete(key); });
    return p;
  }

  /**
   * Nachholen im Hintergrund — nur „IF NOT EXISTS"-Formen (beliebig oft
   * wiederholbar). Erst nach KURZ_MS (3 s), dann mit wachsendem Abstand (bis
   * 10 min). Hält der Halter noch, wird ohne Sperrversuch neu geplant.
   */
  function nachholenPlanen(plan: DdlPlan, lauf: (tx: any) => any, runde: number) {
    const key = plan.text;
    if (inst.nachholen.has(key) || runde > 30) return;
    const warte = Math.min(KURZ_MS * 2 ** (runde - 1), 10 * 60_000) + Math.floor(Math.random() * 1000);
    const t = setTimeout(async () => {
      inst.nachholen.delete(key);
      if (inst.erledigt.has(key)) return;
      if (plan.tabellen.length && (await langerHalter(plan))) { nachholenPlanen(plan, lauf, runde + 1); return; }
      durchlauf(plan, lauf, true).then(
        () => { z.nachgeholt++; },
        (e: any) => {
          if (e?.code === "55P03") nachholenPlanen(plan, lauf, runde + 1);
          else log(`[DDL-WACHE] ${name}: Nachholen gescheitert (${e?.code || "?"}: ${String(e?.message || e).slice(0, 120)}): ${plan.kurz}`);
        },
      );
    }, warte);
    t.unref?.();
    inst.nachholen.set(key, t);
  }

  /**
   * Die ECHTE postgres.js-Query bleibt das Rückgabeobjekt (E-254-Nachprüfung:
   * vorher ein eigenes Promise-Objekt, dem .simple(), .cursor(), .forEach(),
   * .describe(), .cancel() fehlten und das als Fragment zu „$1" wurde).
   * Umgeleitet wird nur die Ausführung: `handler` ist die Stelle, an der
   * postgres.js eine Query an eine Verbindung gibt — genau so macht es
   * `sql.file` selbst. Solange niemand then/catch/finally/execute ruft, läuft
   * nichts (faul wie vorher); als Fragment läuft sie im umgebenden Text.
   */
  function bewachen(q: any, plan: DdlPlan): any {
    const rohHandler = q.handler;
    let laufend: any = null;
    let abgebrochen = false;
    // Dieselbe Anweisung in der Wache-Transaktion: gleiche Werte, gleiche
    // Optionen (simple/prepare), gleiche Rückgabeform (values/raw).
    const baue = (tx: any) => {
      const t = q.tagged ? tx(q.strings, ...q.args) : tx.unsafe(q.strings[0], q.args, q.options);
      Object.assign(t.options, q.options);
      if (q.isRaw) t.isRaw = q.isRaw;
      return t;
    };
    const lauf = (tx: any) => {
      if (abgebrochen) throw abbruchFehler();
      laufend = baue(tx);
      return laufend;
    };
    q.handler = (query: any) => {
      if (abgebrochen) return;
      durchlauf(plan, lauf, false, baue).then(
        (erg) => query.resolve(erg === UEBERSPRUNGEN ? leeresErgebnis(plan, !!query.options.simple) : erg),
        (e) => query.reject(e),
      );
    };
    for (const m of DURCHREICHEN) {
      q[m] = function (...a: any[]) {
        q.handler = rohHandler;
        for (const x of DURCHREICHEN) delete q[x];
        delete q.cancel;
        return Object.getPrototypeOf(q)[m].apply(q, a);
      };
    }
    q.cancel = () => {
      abgebrochen = true;
      if (laufend) return laufend.cancel();
      q.reject(abbruchFehler());
      return Promise.resolve();
    };
    return q;
  }

  // Erkennung je Template-Objekt nur einmal: Ein Tagged Template liefert an
  // derselben Code-Stelle immer dasselbe (eingefrorene) strings-Array.
  const planJeTemplate = new WeakMap<object, DdlPlan | null>();
  const planJeText = new Map<string, DdlPlan | null>();

  const unsafe = (...a: any[]) => {
    const [text, args] = a;
    if (typeof text === "string" && (args == null || (Array.isArray(args) && args.length === 0))) {
      let plan = planJeText.get(text);
      if (plan === undefined) {
        plan = istDdl(text) ? planen(text) : null;
        if (plan) { if (planJeText.size > 5000) planJeText.clear(); planJeText.set(text, plan); }
      }
      if (plan) return bewachen(r.unsafe(...a), plan);
    }
    return r.unsafe(...a);
  };

  return new Proxy(r, {
    apply(ziel, dies, a) {
      const s = a[0];
      if (s && Array.isArray(s) && Array.isArray((s as any).raw)) {
        let plan = planJeTemplate.get(s);
        if (plan === undefined) {
          plan = istDdl(s[0]) ? planen(s.length === 1 ? s[0] : s.join("$?"), s.length > 1) : null;
          planJeTemplate.set(s, plan);
        }
        if (plan) return bewachen(Reflect.apply(ziel, dies, a), plan);
      }
      return Reflect.apply(ziel, dies, a);
    },
    get(ziel, prop) {
      if (prop === "unsafe") return unsafe;
      return Reflect.get(ziel, prop, ziel);
    },
  }) as T;
}
