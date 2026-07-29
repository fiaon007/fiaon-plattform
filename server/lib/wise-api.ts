/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WISE-ZUGANG — NUR LESEND
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WARUM
 * Der Kontoabgleich lief bisher über einen CSV-Upload von Hand. Wer ihn
 * vergisst, verliert Zahlungen: Der Kunde hat bezahlt, das System weiß es
 * nicht, der Agent ruft ihn zur Mahnung an. Diese Datei holt die Umsätze
 * direkt bei Wise ab.
 *
 * SICHERHEIT — NICHT VERHANDELBAR
 *   · Der Token kommt AUSSCHLIESSLICH aus `process.env.WISE_API_TOKEN`.
 *     Er wird nie geloggt, nie in eine Fehlermeldung geschrieben, nie
 *     gespeichert. `redact()` entfernt ihn aus jedem Text, der nach außen geht.
 *   · Dieses Modul kennt ausschliesslich GET-Aufrufe. Es gibt hier keine
 *     Funktion, die bei Wise etwas auslösen, überweisen oder ändern könnte.
 *
 * ROBUSTHEIT
 *   · Zeitfenster von 400 Tagen — Wise erlaubt höchstens 469 je Abfrage.
 *   · Wiederholung mit wachsender Wartezeit bei 429 und 5xx.
 *   · Zeitlimit je Aufruf; ein hängender Aufruf blockiert nichts.
 *   · Fällt Wise aus, wirft dieses Modul einen sprechenden Fehler — es liefert
 *     NIEMALS eine leere Liste, die wie „keine Zahlungen" aussieht. Ein stiller
 *     Fehlschlag wäre hier das gefährlichste Verhalten überhaupt.
 */

const WISE_BASE = "https://api.wise.com";
const FENSTER_TAGE = 400;
const ZEITLIMIT_MS = 30_000;

export class WiseError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "WiseError";
  }
}

/** Entfernt den Token aus beliebigem Text — Schutz gegen versehentliches Loggen. */
function redact(text: string): string {
  const t = process.env.WISE_API_TOKEN;
  if (!t) return text;
  return text.split(t).join("«TOKEN»");
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

async function get<T>(pfad: string, versuch = 0): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ZEITLIMIT_MS);
  try {
    const res = await fetch(`${WISE_BASE}${pfad}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token()}`, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (res.status === 429 || res.status >= 500) {
      if (versuch < 4) {
        const warten = 1000 * Math.pow(2, versuch);
        console.warn(`[WISE] ${res.status} bei ${redact(pfad)} — erneuter Versuch in ${warten} ms`);
        await schlaf(warten);
        return get<T>(pfad, versuch + 1);
      }
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new WiseError(
        `Wise antwortete ${res.status} auf ${redact(pfad)}: ${redact(body).slice(0, 400)}`,
        res.status,
      );
    }
    return (await res.json()) as T;
  } catch (err: any) {
    if (err instanceof WiseError) throw err;
    if (err?.name === "AbortError") {
      throw new WiseError(`Wise antwortete nicht innerhalb von ${ZEITLIMIT_MS / 1000} s (${redact(pfad)})`);
    }
    throw new WiseError(`Wise nicht erreichbar (${redact(pfad)}): ${redact(String(err?.message || err))}`);
  } finally {
    clearTimeout(timer);
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
