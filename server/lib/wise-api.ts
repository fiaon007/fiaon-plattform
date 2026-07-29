/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WISE-ZUGANG — STILLGELEGT, ABER EINSATZBEREIT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ DIESER WEG IST VERSPERRT — UND ZWAR NICHT WEGEN EINES FEHLERS.        │
 * │                                                                       │
 * │ Wise unterstützt „retrieving balance statements via API" mit          │
 * │ PERSÖNLICHEN Zugangstoken nur für Konten in den USA, Kanada,          │
 * │ Australien, Neuseeland, Singapur und Malaysia.                        │
 * │ FIAON LTD ist britisch. Der Abruf ist damit nicht vorgesehen.         │
 * │                                                                       │
 * │ Deshalb wurden am 29.07.2026 ALLE SIEBEN Signatur-Varianten           │
 * │ abgewiesen (siehe `scripts/wise-sca-diagnose.ts`): PKCS#1 v1.5,       │
 * │ die Kopfzeilen der offiziellen Vorlage, Base64URL, Hex, PSS,          │
 * │ nur-Kennung-ohne-Unterschrift und der Endpunkt aus der Vorlage.       │
 * │ Der Code lief gegen eine geschlossene Tür.                            │
 * │                                                                       │
 * │ IM EINSATZ IST STATTDESSEN: `server/lib/wise-csv.ts`                  │
 * │ Der Kontoauszug wird aus der Wise-Weboberfläche als CSV geladen.      │
 * │                                                                       │
 * │ WANN DIESER CODE WIEDER GEBRAUCHT WIRD                                │
 * │ Bei einem Partnerschaftsabkommen mit Wise (Wise Platform). Dann       │
 * │ genügt es, `WISE_AKTIV=1` zu setzen. Zuordnung, Bankbuch und          │
 * │ Abgleichsbericht sind bereits gemeinsam genutzt und bleiben gültig —  │
 * │ es ändert sich nur, WOHER die Umsätze kommen.                         │
 * │                                                                       │
 * │ Nicht gelöscht, weil hier die vollständige, geprüfte SCA-Signatur     │
 * │ steckt (12 Tests in `scripts/wise-sca-test.ts`). Sie noch einmal zu   │
 * │ bauen wäre reine Doppelarbeit.                                        │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * WOFÜR ES GEDACHT WAR
 * Der Kontoabgleich läuft über einen CSV-Upload von Hand. Wer ihn vergisst,
 * verliert Zahlungen: Der Kunde hat bezahlt, das System weiß es nicht, der
 * Agent ruft ihn zur Mahnung an. Dieses Modul sollte die Umsätze stündlich
 * selbst holen und diesen Handgriff überflüssig machen.
 *
 * SICHERHEIT — NICHT VERHANDELBAR
 *   · Der Token kommt AUSSCHLIESSLICH aus `process.env.WISE_API_TOKEN`,
 *     der private Schlüssel aus `process.env.WISE_PRIVATE_KEY_B64`.
 *     Beide werden nie geloggt, nie in eine Fehlermeldung geschrieben, nie
 *     gespeichert. `redact()` entfernt sie aus jedem Text, der nach außen geht.
 *   · Dieses Modul kennt ausschliesslich GET-Aufrufe. Es gibt hier keine
 *     Funktion, die bei Wise etwas auslösen, überweisen oder ändern könnte.
 *
 * STARKE KUNDENAUTHENTIFIZIERUNG (SCA)
 * Kontoauszüge sind bei Wise besonders geschützt. Der erste Aufruf wird
 * absichtlich mit 403 abgewiesen und trägt im Antwortkopf `x-2fa-approval`
 * eine Einmal-Kennung. Wer den privaten Schlüssel besitzt, signiert diese
 * Kennung und wiederholt den Aufruf — damit beweist der Server, dass er der
 * hinterlegte öffentliche Schlüssel ist. Das läuft hier zentral in `get()`:
 * jeder Aufruf im Modul ist automatisch abgedeckt, genau eine Wiederholung.
 *
 * ROBUSTHEIT
 *   · Zeitfenster von 400 Tagen — Wise erlaubt höchstens 469 je Abfrage.
 *   · Wiederholung mit wachsender Wartezeit bei 429 und 5xx.
 *   · Zeitlimit je Aufruf; ein hängender Aufruf blockiert nichts.
 *   · Fällt Wise aus oder scheitert die Signatur, wirft dieses Modul einen
 *     sprechenden Fehler — es liefert NIEMALS eine leere Liste, die wie „keine
 *     Zahlungen" aussieht. Ein stiller Fehlschlag wäre hier das gefährlichste
 *     Verhalten überhaupt: Er sähe aus wie ein Monat ohne Kundenzahlungen.
 */

import crypto from "node:crypto";

const WISE_BASE = "https://api.wise.com";
const FENSTER_TAGE = 400;
const ZEITLIMIT_MS = 30_000;

/** Wie in der offiziellen Wise-Vorlage (sca-personal-tokens). Ohne eigenen
 *  Bezeichner sendet Node einen nichtssagenden Standardwert. */
const KENNUNG_CLIENT = "FIAON-Kontoabgleich/1.0 (tw-statements-sca)";

/** Kopfzeilen, die bei einem 403 die Wahrheit enthalten. */
const DIAGNOSE_KOEPFE = [
  "x-2fa-approval",
  "x-2fa-approval-result",
  "www-authenticate",
  "x-request-id",
  "x-trace-id",
  "content-type",
  "content-length",
  "date",
];

/** Alle aussagekräftigen Kopfzeilen einer Antwort als eine Zeile. Enthält nie
 *  Geheimnisse — die Freigabe-Kennung ist eine Einmal-Kennung ohne Dauerwert. */
export function kopfBericht(res: Response): string {
  const teile: string[] = [];
  for (const name of DIAGNOSE_KOEPFE) {
    const v = res.headers.get(name);
    if (v) teile.push(`${name}: ${v}`);
  }
  return teile.join(" | ") || "(keine aussagekräftigen Kopfzeilen)";
}

export class WiseError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "WiseError";
  }
}

/** Entfernt Token und Schlüsselmaterial aus beliebigem Text — Schutz gegen
 * versehentliches Loggen. Gilt auch für Fehlermeldungen aus fremden Bibliotheken. */
function redact(text: string): string {
  let out = String(text);
  const t = process.env.WISE_API_TOKEN;
  if (t) out = out.split(t).join("«TOKEN»");
  const k = process.env.WISE_PRIVATE_KEY_B64;
  if (k) out = out.split(k).join("«SCHLUESSEL»");
  // Sollte je ein PEM-Block in einen Text geraten, hier abschneiden.
  return out.replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, "«SCHLUESSEL»");
}

function token(): string {
  const t = String(process.env.WISE_API_TOKEN || "").trim();
  if (!t) {
    throw new WiseError(
      "WISE_API_TOKEN ist nicht gesetzt. In Render unter Environment hinterlegen " +
      "(lokal: in .env eintragen — .env ist von Git ausgeschlossen).",
    );
  }
  return t;
}

const schlaf = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Schutzschalter.
 *
 * Ohne ihn würde ein späterer Aufruf dieses Moduls wieder in denselben
 * unerklärlichen 403 laufen und die Fehlersuche von vorne beginnen. Die
 * Meldung nennt den Grund und den Weg, der tatsächlich funktioniert.
 *
 * `scripts/wise-sca-diagnose.ts` bleibt bewusst aufrufbar — es setzt die
 * Variable selbst, damit ein Partnerschaftsabkommen sofort nachprüfbar ist.
 */
function stillgelegtPruefen(): void {
  if (process.env.WISE_AKTIV === "1") return;
  throw new WiseError(
    "Der Wise-Abruf über die Schnittstelle ist stillgelegt. Wise erlaubt den Abruf von " +
    "Kontoauszügen mit persönlichen Zugangstoken nur für Konten in den USA, Kanada, " +
    "Australien, Neuseeland, Singapur und Malaysia — FIAON LTD ist britisch. " +
    "Im Einsatz ist der CSV-Weg (server/lib/wise-csv.ts). " +
    "Nach einem Partnerschaftsabkommen mit Wise genügt WISE_AKTIV=1, um diesen Weg " +
    "wieder freizuschalten.",
  );
}

/** Antwortkörper für die Ausgabe aufbereiten — leere Körper klar benennen.
 *  Ein bloßes „Antwort:" ohne Inhalt lässt offen, ob nichts kam oder nichts
 *  gelesen wurde. */
function koerper(body: string): string {
  const t = String(body ?? "").trim();
  if (!t) return "(leer — Wise sendet bei 403 oft keinen Text; die Wahrheit steht in den Kopfzeilen)";
  return redact(t).slice(0, 600);
}

// ═══════════════════════════════════════════════════════════════════════════
// Signatur für die starke Kundenauthentifizierung
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Den privaten Schlüssel als PEM bereitstellen.
 *
 * Erwartet wird `WISE_PRIVATE_KEY_B64`: das PEM, Base64-kodiert. Ein PEM direkt
 * in eine Umgebungsvariable zu schreiben scheitert sonst an den Zeilenumbrüchen.
 *
 * Bewusst nachsichtig: Trägt jemand versehentlich das PEM unkodiert ein, wird
 * das erkannt und akzeptiert, statt mit einer rätselhaften Meldung abzubrechen.
 * Der Schlüssel wird einmal geprüft und dann als Schlüsselobjekt gehalten — so
 * liegt das Rohmaterial nicht länger als nötig als Zeichenkette herum.
 */
let schluesselCache: crypto.KeyObject | null = null;
let schluesselArt = "unbekannt";
let schluesselZeilen = 0;

function privaterSchluessel(): crypto.KeyObject {
  if (schluesselCache) return schluesselCache;

  const roh = String(process.env.WISE_PRIVATE_KEY_B64 || "").trim();
  if (!roh) {
    throw new WiseError(
      "Wise verlangt eine Signatur (SCA), aber WISE_PRIVATE_KEY_B64 ist nicht gesetzt. " +
      "In Render unter Environment das private PEM Base64-kodiert hinterlegen " +
      "(erzeugen mit: base64 -i wise-private.pem | tr -d '\\n').",
    );
  }

  let pem: string;
  if (roh.includes("-----BEGIN")) {
    pem = roh; // unkodiert eingetragen — nehmen wir auch
  } else {
    pem = Buffer.from(roh, "base64").toString("utf8");
  }

  // Art merken: PKCS#1 („BEGIN RSA PRIVATE KEY", von `openssl genrsa`) oder
  // PKCS#8 („BEGIN PRIVATE KEY", nach `openssl pkcs8`). Node liest beides —
  // aber bei einer Fehlersuche will man wissen, was tatsächlich vorliegt.
  schluesselArt = pem.includes("BEGIN RSA PRIVATE KEY")
    ? "PKCS#1"
    : pem.includes("BEGIN PRIVATE KEY")
      ? "PKCS#8"
      : "unbekannte Form";
  const zeilen = pem.trim().split("\n").length;
  schluesselZeilen = zeilen;

  if (!pem.includes("-----BEGIN")) {
    throw new WiseError(
      "WISE_PRIVATE_KEY_B64 ergibt kein gültiges PEM. Erwartet wird der Base64-Text " +
      "des privaten Schlüssels; nach dem Dekodieren muss er mit '-----BEGIN' anfangen.",
    );
  }
  if (/ENCRYPTED/.test(pem)) {
    throw new WiseError(
      "Der private Schlüssel ist mit einem Kennwort geschützt. Ein Server kann kein " +
      "Kennwort eingeben — bitte einen Schlüssel ohne Passphrase hinterlegen.",
    );
  }

  try {
    schluesselCache = crypto.createPrivateKey(pem);
  } catch (err: any) {
    throw new WiseError(
      `Der private Schlüssel ist unlesbar: ${redact(String(err?.message || err))}. ` +
      "Häufigste Ursache: beim Kopieren wurde der Base64-Text umgebrochen oder gekürzt.",
    );
  }
  return schluesselCache;
}

/**
 * Eine Einmal-Kennung signieren: SHA-256, PKCS#1 v1.5, Ergebnis Base64.
 *
 * Als eigenständige Funktion mit übergebenem Schlüssel, damit sie ohne Wise und
 * ohne Umgebungsvariablen prüfbar ist — siehe `scripts/wise-sca-test.ts`.
 */
export function signiereFreigabe(kennung: string, schluessel: crypto.KeyObject | string): string {
  return crypto
    .sign("sha256", Buffer.from(kennung, "utf8"), {
      key: schluessel as any,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    })
    .toString("base64");
}

/**
 * Prüft vorab, ob der private Schlüssel da und lesbar ist — ohne Netzzugriff.
 *
 * Sinn: Fehlt der Schlüssel, scheitert sonst erst der Abruf des ersten
 * Kontoauszugs, nach Profilen und Konten. Diese Prüfung sagt es in der ersten
 * Sekunde. Wirft nie.
 */
export function schluesselStatus(): { ok: boolean; text: string } {
  try {
    return { ok: true, text: schluesselBeschreibung() };
  } catch (err: any) {
    return { ok: false, text: redact(String(err?.message || err)) };
  }
}

/** Kurzbeschreibung des Schlüssels für Log und Fehlermeldung. Wirft, wenn er fehlt. */
function schluesselBeschreibung(): string {
  const k = privaterSchluessel();
  const bits = (k.asymmetricKeyDetails as any)?.modulusLength;
  const art = String(k.asymmetricKeyType || "unbekannt").toUpperCase();
  return `${art}${bits ? `-${bits}` : ""}, ${schluesselArt}, ${schluesselZeilen} PEM-Zeilen`;
}

/**
 * Der zum privaten Schlüssel gehörende öffentliche Schlüssel als PEM.
 *
 * Ein öffentlicher Schlüssel ist per Definition nicht geheim — er darf und soll
 * ausgegeben werden, damit man ihn mit dem bei Wise hinterlegten vergleichen kann.
 */
export function oeffentlicherSchluesselPem(): string {
  return crypto
    .createPublicKey(privaterSchluessel())
    .export({ type: "spki", format: "pem" })
    .toString()
    .trim();
}

/**
 * Nur für die Fehlersuche: das Schlüsselobjekt selbst.
 *
 * Ein `KeyObject` gibt sein Rohmaterial nicht als Text preis und kann nicht
 * versehentlich in ein Log geraten. Der Zweck ist, dass das Diagnoseskript
 * andere Signaturverfahren durchprobieren kann, ohne das Laden des Schlüssels
 * ein zweites Mal — und womöglich abweichend — nachzubauen.
 */
export function holePrivatenSchluessel(): crypto.KeyObject {
  return privaterSchluessel();
}

/** Fingerabdruck des öffentlichen Schlüssels — kurz vergleichbar, ohne langes PEM. */
export function oeffentlicherFingerabdruck(): string {
  const der = crypto
    .createPublicKey(privaterSchluessel())
    .export({ type: "spki", format: "der" }) as Buffer;
  return crypto.createHash("sha256").update(der).digest("base64");
}

// ═══════════════════════════════════════════════════════════════════════════
// Aufruf
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ein einzelner Aufruf mit Zeitlimit. Wirft nur bei Netzproblemen.
 *
 * Exportiert, damit `scripts/wise-sca-diagnose.ts` den Handschlag Schritt für
 * Schritt nachstellen kann, ohne die Logik zu verdoppeln — eine zweite,
 * abweichende Kopie wäre bei der Fehlersuche wertlos.
 */
export async function roherAufruf(pfad: string, zusatz: Record<string, string> = {}): Promise<Response> {
  stillgelegtPruefen();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ZEITLIMIT_MS);
  try {
    return await fetch(`${WISE_BASE}${pfad}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token()}`,
        Accept: "application/json",
        "User-Agent": KENNUNG_CLIENT,
        ...zusatz,
      },
      signal: ctrl.signal,
    });
  } catch (err: any) {
    // Ein fehlender Token ist ein Einrichtungsfehler, kein Netzproblem — sonst
    // sucht man an der falschen Stelle. Unverändert durchreichen.
    if (err instanceof WiseError) throw err;
    if (err?.name === "AbortError") {
      throw new WiseError(`Wise antwortete nicht innerhalb von ${ZEITLIMIT_MS / 1000} s (${redact(pfad)})`);
    }
    throw new WiseError(`Wise nicht erreichbar (${redact(pfad)}): ${redact(String(err?.message || err))}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Merker, damit der Hinweis auf die Signatur nur einmal je Lauf im Log steht. */
let scaGemeldet = false;

async function get<T>(pfad: string, versuch = 0): Promise<T> {
  let res = await roherAufruf(pfad);

  // ── Starke Kundenauthentifizierung ────────────────────────────────────────
  // Der erste 403 ist kein Fehler, sondern die Aufforderung zu unterschreiben.
  if (res.status === 403) {
    const kennung = res.headers.get("x-2fa-approval");
    if (!kennung) {
      const body = await res.text().catch(() => "");
      throw new WiseError(
        [
          `Wise verweigert den Zugriff auf ${redact(pfad)} (403) und nennt KEINE Freigabe-Kennung.`,
          "  Das ist keine Signaturfrage — die Signatur kam hier gar nicht zum Einsatz.",
          "  Es fehlt die Berechtigung: Hat der Token Leserechte für dieses Profil?",
          `  Kopfzeilen: ${kopfBericht(res)}`,
          `  Antwortkörper: ${koerper(body)}`,
        ].join("\n"),
        403,
      );
    }

    // Wirft mit klarer Meldung, wenn der Schlüssel fehlt oder unbrauchbar ist.
    const signatur = signiereFreigabe(kennung, privaterSchluessel());

    if (!scaGemeldet) {
      console.log("[WISE] Signatur für die starke Kundenauthentifizierung wird verwendet.");
      scaGemeldet = true;
    }

    // Genau eine Wiederholung — derselbe Aufruf, jetzt unterschrieben.
    res = await roherAufruf(pfad, { "x-2fa-approval": kennung, "X-Signature": signatur });

    // Alles außer Überlast und Serverstörung ist hier endgültig — und muss
    // vollständig erklärt werden. Ein nacktes „403" schickt sonst jeden auf
    // eine stundenlange Suche am falschen Ende.
    if (!res.ok && res.status !== 429 && res.status < 500) {
      const ergebnis = res.headers.get("x-2fa-approval-result");
      const neue = res.headers.get("x-2fa-approval");
      const body = await res.text().catch(() => "");
      throw new WiseError(
        [
          `Wise hat die unterschriebene Anfrage mit ${res.status} abgewiesen (${redact(pfad)}).`,
          `  x-2fa-approval-result: ${ergebnis ?? "(nicht gesendet)"}`,
          `  Kennung in der Antwort: ${
            !neue
              ? "keine"
              : neue === kennung
                ? "dieselbe wie im ersten 403"
                : "eine ANDERE — Wise hat die Kette neu begonnen, die Unterschrift wurde nicht gewertet"
          }`,
          `  Kopfzeilen: ${kopfBericht(res)}`,
          `  Antwortkörper: ${koerper(body)}`,
          `  Kennung ${kennung.length} Zeichen · Signatur ${signatur.length} Zeichen Base64 ` +
            `(RSA-2048 erwartet 344)`,
          `  Schlüssel: ${schluesselStatus().text}`,
          "  Nächster Schritt: npx tsx scripts/wise-sca-diagnose.ts — prüft die Varianten einzeln durch.",
        ].join("\n"),
        res.status,
      );
    }
  }

  // ── Überlast und Störungen ────────────────────────────────────────────────
  if ((res.status === 429 || res.status >= 500) && versuch < 4) {
    const warten = 1000 * Math.pow(2, versuch);
    console.warn(`[WISE] ${res.status} bei ${redact(pfad)} — erneuter Versuch in ${warten} ms`);
    await schlaf(warten);
    return get<T>(pfad, versuch + 1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new WiseError(
      `Wise antwortete ${res.status} auf ${redact(pfad)}: ${redact(body).slice(0, 400)}`,
      res.status,
    );
  }

  try {
    return (await res.json()) as T;
  } catch (err: any) {
    throw new WiseError(
      `Wise lieferte auf ${redact(pfad)} keine lesbare Antwort: ${redact(String(err?.message || err))}`,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Profile und Konten
// ═══════════════════════════════════════════════════════════════════════════

export interface WiseProfile {
  id: number;
  type: string;          // personal | business
  name: string;
}

/** Alle Profile des Tokens. v2 zuerst, v1 als Rückfallebene. */
export async function getProfiles(): Promise<WiseProfile[]> {
  let roh: any[];
  try {
    roh = await get<any[]>("/v2/profiles");
  } catch (err) {
    if (err instanceof WiseError && err.status === 404) roh = await get<any[]>("/v1/profiles");
    else throw err;
  }
  return (roh || []).map((p) => ({
    id: Number(p.id),
    type: String(p.type || "unbekannt"),
    name: String(
      p.fullName ??
      p.details?.name ??
      p.details?.businessName ??
      [p.details?.firstName, p.details?.lastName].filter(Boolean).join(" ") ??
      "",
    ).trim() || `Profil ${p.id}`,
  }));
}

export interface WiseBalance {
  id: number;
  currency: string;
  type: string;
}

/** Alle Guthabenkonten eines Profils (je Währung eines) — inkl. der EUR-Konten. */
export async function getBalances(profileId: number): Promise<WiseBalance[]> {
  const alle: WiseBalance[] = [];
  for (const typ of ["STANDARD", "SAVINGS"]) {
    try {
      const roh = await get<any[]>(`/v4/profiles/${profileId}/balances?types=${typ}`);
      for (const b of roh || []) {
        alle.push({ id: Number(b.id), currency: String(b.currency || "").toUpperCase(), type: typ });
      }
    } catch (err) {
      // Ein Profil ohne Sparkonten liefert hier 4xx — das ist kein Fehler.
      if (typ === "STANDARD") throw err;
    }
  }
  return alle;
}

// ═══════════════════════════════════════════════════════════════════════════
// Umsätze
// ═══════════════════════════════════════════════════════════════════════════

export interface WiseTxn {
  /** Eindeutiger Schlüssel gegen Doppelimport, z. B. „TRANSFER-123456789". */
  referenceNumber: string;
  profileId: number;
  balanceId: number;
  /** CREDIT = Eingang, DEBIT = Ausgang. */
  direction: string;
  /** DEPOSIT, TRANSFER, CARD, CONVERSION … */
  detailsType: string;
  bookedAt: Date | null;
  /** Immer positiv, in Cent. */
  amountCents: number;
  currency: string;
  payerName: string | null;
  senderAccount: string | null;
  paymentReference: string | null;
  description: string | null;
  /** Originalsatz für die Beweiskette. */
  raw: unknown;
}

function centsOf(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.abs(Math.round(n * 100));
}

function textOf(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

/**
 * Einen Umsatz aus der Wise-Antwort in unsere Form bringen.
 *
 * Bewusst defensiv: Wise liefert je nach Zahlungsweg unterschiedliche Felder
 * (SEPA-Eingang, Wise-zu-Wise, Kartenzahlung). Wir lesen jede bekannte
 * Schreibweise und werfen nichts weg — der Originalsatz bleibt in `raw`.
 */
export function normalisiere(t: any, profileId: number, balanceId: number): WiseTxn | null {
  const referenceNumber = textOf(t?.referenceNumber);
  if (!referenceNumber) return null;
  const d = t?.details ?? {};
  const datum = t?.date ? new Date(t.date) : null;
  return {
    referenceNumber,
    profileId,
    balanceId,
    direction: String(t?.type || "").toUpperCase(),
    detailsType: String(d?.type || "").toUpperCase(),
    bookedAt: datum && !isNaN(datum.getTime()) ? datum : null,
    amountCents: centsOf(t?.amount?.value ?? d?.amount?.value),
    currency: String(t?.amount?.currency ?? d?.amount?.currency ?? "EUR").toUpperCase().slice(0, 3),
    payerName: textOf(d?.senderName ?? d?.payerName ?? d?.merchant?.name),
    senderAccount: textOf(d?.senderAccount ?? d?.senderAccountNumber ?? d?.iban),
    paymentReference: textOf(d?.paymentReference ?? d?.reference),
    description: textOf(d?.description ?? t?.description),
    raw: t,
  };
}

function fensterListe(von: Date, bis: Date): Array<[Date, Date]> {
  const out: Array<[Date, Date]> = [];
  let start = new Date(von);
  while (start < bis) {
    const ende = new Date(Math.min(start.getTime() + FENSTER_TAGE * 86_400_000, bis.getTime()));
    out.push([new Date(start), ende]);
    start = new Date(ende.getTime() + 1);
  }
  return out;
}

/**
 * Alle Umsätze eines Guthabenkontos in einem Zeitraum. Zerlegt den Zeitraum
 * selbständig in erlaubte Fenster.
 */
export async function getStatement(
  profileId: number,
  balanceId: number,
  currency: string,
  von: Date,
  bis: Date,
): Promise<WiseTxn[]> {
  const out: WiseTxn[] = [];
  for (const [a, b] of fensterListe(von, bis)) {
    const pfad =
      `/v1/profiles/${profileId}/balance-statements/${balanceId}/statement.json` +
      `?currency=${encodeURIComponent(currency)}` +
      `&intervalStart=${encodeURIComponent(a.toISOString())}` +
      `&intervalEnd=${encodeURIComponent(b.toISOString())}` +
      `&type=COMPACT`;
    const antwort = await get<any>(pfad);
    for (const t of antwort?.transactions || []) {
      const n = normalisiere(t, profileId, balanceId);
      if (n) out.push(n);
    }
    // Höflich gegenüber der Schnittstelle bleiben.
    await schlaf(250);
  }
  return out;
}

export interface WiseAbrufErgebnis {
  txns: WiseTxn[];
  konten: Array<{ profil: string; profileId: number; balanceId: number; currency: string; anzahl: number }>;
}

/**
 * Vollständiger Abruf: alle Profile, alle Währungskonten, ganzer Zeitraum.
 * Doppelte Umsätze (dasselbe Konto in mehreren Fenstern) werden über
 * `referenceNumber` entfernt.
 */
export async function holeAlleUmsaetze(
  von: Date,
  bis: Date = new Date(),
  log: (s: string) => void = () => {},
): Promise<WiseAbrufErgebnis> {
  const profile = await getProfiles();
  if (profile.length === 0) throw new WiseError("Wise lieferte kein einziges Profil — Token prüfen.");
  log(`Profile: ${profile.map((p) => `${p.name} (${p.type})`).join(" · ")}`);

  const gesehen = new Set<string>();
  const txns: WiseTxn[] = [];
  const konten: WiseAbrufErgebnis["konten"] = [];

  for (const p of profile) {
    const balances = await getBalances(p.id);
    log(`  ${p.name}: ${balances.length} Währungskonto/-konten (${balances.map((b) => b.currency).join(", ") || "keins"})`);
    for (const b of balances) {
      const teil = await getStatement(p.id, b.id, b.currency, von, bis);
      let neu = 0;
      for (const t of teil) {
        if (gesehen.has(t.referenceNumber)) continue;
        gesehen.add(t.referenceNumber);
        txns.push(t);
        neu++;
      }
      konten.push({ profil: p.name, profileId: p.id, balanceId: b.id, currency: b.currency, anzahl: neu });
      log(`    ${b.currency}: ${neu} Umsätze`);
    }
  }
  return { txns, konten };
}

// ═══════════════════════════════════════════════════════════════════════════
// Einordnung — nicht jeder Eingang ist eine Kundenzahlung
// ═══════════════════════════════════════════════════════════════════════════

export type TxnArt =
  | "kundenzahlung"
  | "eigeneinlage"
  | "rueckbuchung"
  | "erstattung"
  | "sonstiges"
  | "ausgang";

/**
 * Grobeinordnung eines Umsatzes.
 *
 * Bewusst vorsichtig: Im Zweifel „sonstiges" statt „kundenzahlung". Ein falsch
 * als Kundenzahlung eingeordneter Eingang würde später jemanden fälschlich auf
 * bezahlt setzen — das ist der teurere Fehler.
 */
export function ordneEin(t: WiseTxn, eigeneNamen: string[] = []): TxnArt {
  if (t.direction !== "CREDIT") return "ausgang";

  const text = `${t.description ?? ""} ${t.paymentReference ?? ""}`.toLowerCase();
  const zahler = (t.payerName ?? "").toLowerCase();

  if (/refund|erstattung|reversal|rücklastschrift|ruecklastschrift|chargeback|storno/.test(text)) {
    return /refund|erstattung/.test(text) ? "erstattung" : "rueckbuchung";
  }
  // Eigene Einzahlung: Gesellschafter/Inhaber überweist auf das Firmenkonto,
  // oder Wise bucht zwischen eigenen Konten um.
  if (t.detailsType === "CONVERSION" || t.detailsType === "BALANCE") return "sonstiges";
  for (const n of eigeneNamen) {
    const k = n.trim().toLowerCase();
    if (k.length >= 3 && zahler.includes(k)) return "eigeneinlage";
  }
  if (/einlage|darlehen|gesellschafter|topup|top-up|aufladung/.test(text)) return "eigeneinlage";

  if (t.detailsType === "DEPOSIT") return "kundenzahlung";
  return "sonstiges";
}

/** Kurzer Erreichbarkeitstest für die Admin-Anzeige — wirft nie. */
export async function wiseStatus(): Promise<{ ok: boolean; profile?: number; fehler?: string }> {
  try {
    const p = await getProfiles();
    return { ok: true, profile: p.length };
  } catch (err: any) {
    return { ok: false, fehler: redact(String(err?.message || err)) };
  }
}
