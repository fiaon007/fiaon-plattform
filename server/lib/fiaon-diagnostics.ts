// ═══════════════════════════════════════════════════════════════════
// FIAON System-Diagnose (Phase 5) — zentraler Ereignis-/Problem-Logger.
//
// ZWECK: Der Vorgesetzte sieht auf /admin/diagnose in Echtzeit, was klemmt —
// technisch, bei Kunden, bei Agenten — BEVOR ein Agent ein Ticket schreibt.
//
// STRIKTE REGELN (nicht verhandelbar):
//  1. MASKIERUNG SERVERSEITIG *vor* Speicherung — nie ungefiltert in den
//     Browser. API-Keys, Tokens, Passwörter, Secrets, IBANs, vollständige
//     E-Mail-Adressen und Telefonnummern werden redigiert. (Merkregel: in
//     diesem Projekt lag ein GitHub-PAT im Klartext in einer Git-Remote-URL —
//     genau so etwas darf nie in einer Ansicht landen.)
//  2. RING-PUFFER HART BEGRENZT (Rohdaten-Tail): max. RAW_MAX_LINES Zeilen /
//     RAW_MAX_BYTES Bytes im Speicher — 512-MB-Budget.
//  3. Das Logging darf die App NIE ausbremsen oder abstürzen lassen:
//     asynchron, non-blocking, jeder Fehler im Logging wird verschluckt.
//  4. Aufbewahrung begrenzt (RETENTION_DAYS) + Löschfunktion.
// ═══════════════════════════════════════════════════════════════════

import postgres from "postgres";
import { createHash } from "crypto";

// ── Typen ────────────────────────────────────────────────────────────────────
export type Severity = "kritisch" | "warnung" | "info";
export type Category =
  | "email_make"   // E-Mail/Make: Webhook-/Versand-Fehler
  | "lead"         // Lead-Eingang: abgelehnte/ungültige Intakes, Ausbleiben
  | "zahlung"      // Zahlungen: Zuordnung, Abweichung, Provision, Dubletten
  | "agent"        // Agenten: blockierte Akte, Login, fehlgeschlagene Aktion
  | "kunde"        // Kunden/Nutzer: Antrag-Fehler, Upload, Zahlungsseite
  | "system";      // System: Exceptions, DB, Timeouts, Cron, Speicher

export interface DiagnosticInput {
  severity: Severity;
  category: Category;
  /** kurzer stabiler Code, z. B. "make_webhook_http" — Basis der Aggregation */
  code: string;
  /** Klartext-Bedeutung (Deutsch, für Nicht-Entwickler) */
  message: string;
  /** optionaler Lösungshinweis */
  hint?: string;
  /** Direktlink zum betroffenen Kunden/Agenten/Lead (relativer Admin-Pfad) */
  link?: string;
  /** vorgeschlagene Direktaktion am Eintrag */
  action?: { kind: string; label: string; ref?: string } | null;
  /** zusätzliche Kontextdaten (werden ebenfalls maskiert) */
  context?: Record<string, unknown>;
}

// ── Konfiguration (512-MB-Budget) ─────────────────────────────────────────────
const RETENTION_DAYS = 7;         // persistierte Ereignisse
const RAW_MAX_LINES = 1000;       // Ring-Puffer: max. Zeilen
const RAW_MAX_BYTES = 2 * 1024 * 1024; // Ring-Puffer: max. 2 MB

// ── Lazy Postgres-Pool (eigener, klein — kein Import-Zyklus) ──────────────────
let pool: ReturnType<typeof postgres> | null = null;
function getPool(): ReturnType<typeof postgres> | null {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) pool = postgres(process.env.DATABASE_URL, { ssl: "require", max: 2 });
  return pool;
}

// ═══════════════════════════════════════════════════════════════════
// MASKIERUNG — Muster-basiert, serverseitig, vor jeder Speicherung/Auslieferung.
// Reihenfolge zählt: erst spezifische Secrets, dann generische PII.
// ═══════════════════════════════════════════════════════════════════
const SECRET_PATTERNS: { re: RegExp; replace: (m: string, ...g: string[]) => string }[] = [
  // Verbindungs-Strings mit eingebetteten Zugangsdaten (postgres://user:pass@host, redis://…)
  { re: /\b([a-z][a-z0-9+.\-]*:\/\/)([^:@\/\s]+):([^@\/\s]+)@/gi, replace: (_m, sch, user) => `${sch}${user}:***@` },
  // GitHub-PAT (ghp_, github_pat_, gho_, ghu_, ghs_, ghr_) — der reale Vorfall
  { re: /\b(gh[pousr]_[A-Za-z0-9]{6,}|github_pat_[A-Za-z0-9_]{6,})\b/g, replace: () => "ghp_***REDIGIERT***" },
  // OpenAI / Stripe / generische sk-/pk-/rk- Keys
  { re: /\b((?:sk|pk|rk)[-_](?:live|test|proj|[A-Za-z0-9])[A-Za-z0-9\-_]{6,})\b/g, replace: () => "sk-***REDIGIERT***" },
  // Google API-Key (AIza…)
  { re: /\bAIza[0-9A-Za-z\-_]{20,}\b/g, replace: () => "AIza***REDIGIERT***" },
  // Bearer-Token / Authorization-Header
  { re: /\b(Bearer|Basic)\s+[A-Za-z0-9\-._~+\/=]{8,}/gi, replace: (_m, kind) => `${kind} ***REDIGIERT***` },
  // JWT (drei base64url-Segmente)
  { re: /\beyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\b/g, replace: () => "eyJ***JWT-REDIGIERT***" },
  // Bekannte Secret-Env-Namen mit Wertzuweisung (DATABASE_URL=…, SESSION_SECRET: …)
  { re: /\b(DATABASE_URL|SESSION_SECRET|MAKE_WEBHOOK_URL|[A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD))\b(\s*[:=]\s*)("?)([^\s"']+)\3/g, replace: (_m, k, sep) => `${k}${sep}***REDIGIERT***` },
];

/** IBAN maskieren: die ersten 4 + letzten 2 Zeichen bleiben (DE** **** **52). */
function maskIban(iban: string): string {
  const compact = iban.replace(/\s+/g, "");
  if (compact.length < 8) return "IBAN ***";
  return `${compact.slice(0, 4)} **** ${compact.slice(-2)}`;
}

/** E-Mail maskieren: ma***@gmail.com (erste 2 Zeichen des lokalen Teils). */
function maskEmail(local: string, domain: string): string {
  const head = local.slice(0, 2);
  return `${head}${local.length > 2 ? "***" : "*"}@${domain}`;
}

/** Telefonnummer maskieren: die letzten 2 Ziffern bleiben (+49 176 *** **52). */
function maskPhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 6) return "*** ***";
  const cc = raw.trim().startsWith("+") ? `+${digits.slice(0, 2)} ` : "";
  return `${cc}*** *** **${digits.slice(-2)}`;
}

/**
 * Redigiert einen beliebigen String. IDEMPOTENT und robust: wirft nie.
 * Deckt Secrets, IBAN, E-Mail und Telefonnummern ab.
 */
export function maskSensitive(input: unknown): string {
  if (input == null) return "";
  let s = typeof input === "string" ? input : safeStringify(input);
  try {
    for (const { re, replace } of SECRET_PATTERNS) s = s.replace(re, replace as any);
    // IBAN (DE + 20 Stellen, tolerant gegen Leerzeichen/Gruppen)
    s = s.replace(/\b([A-Z]{2}\d{2}(?:[ ]?[A-Za-z0-9]){10,30})\b/g, (m) => maskIban(m));
    // E-Mail
    s = s.replace(/\b([A-Za-z0-9._%+\-]+)@([A-Za-z0-9.\-]+\.[A-Za-z]{2,})\b/g, (_m, l, d) => maskEmail(l, d));
    // Telefonnummern (international/nationale Schreibweisen mit >= 7 Ziffern)
    s = s.replace(/(?:\+?\d[\d\s().\-\/]{6,}\d)/g, (m) => {
      const digits = m.replace(/[^\d]/g, "");
      return digits.length >= 7 && digits.length <= 15 ? maskPhone(m) : m;
    });
  } catch {
    // Maskierung darf nie werfen — im Zweifel den Rohstring hart abschneiden.
    return typeof input === "string" ? input.slice(0, 500) : "[unmaskierbar]";
  }
  return s;
}

/** Maskiert alle String-Werte eines Kontext-Objekts (flach + eine Ebene tief). */
export function maskContext(obj: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!obj || typeof obj !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") out[k] = maskSensitive(v);
    else if (v && typeof v === "object") out[k] = maskSensitive(safeStringify(v));
    else out[k] = v;
  }
  return out;
}

function safeStringify(v: unknown): string {
  try { return typeof v === "string" ? v : JSON.stringify(v); }
  catch { return String(v); }
}

// ═══════════════════════════════════════════════════════════════════
// RING-PUFFER (Rohdaten-Tail) — im Speicher, hart begrenzt, maskiert.
// ═══════════════════════════════════════════════════════════════════
interface RawLine { at: string; level: string; text: string; bytes: number }
const rawBuffer: RawLine[] = [];
let rawBytes = 0;

/** Fügt eine (bereits maskierte) Rohzeile hinzu und hält die harte Grenze ein. */
export function pushRaw(level: string, text: string): void {
  try {
    const masked = maskSensitive(text).slice(0, 2000);
    const line: RawLine = { at: new Date().toISOString(), level, text: masked, bytes: Buffer.byteLength(masked, "utf8") };
    rawBuffer.push(line);
    rawBytes += line.bytes;
    // Grenze durchsetzen: Zeilen UND Bytes.
    while (rawBuffer.length > RAW_MAX_LINES || rawBytes > RAW_MAX_BYTES) {
      const dropped = rawBuffer.shift();
      if (!dropped) break;
      rawBytes -= dropped.bytes;
    }
  } catch { /* Logging darf nie stören */ }
}

export function getRawTail(opts?: { q?: string; limit?: number }): { lines: RawLine[]; totalLines: number; totalBytes: number; maxLines: number; maxBytes: number } {
  const q = (opts?.q || "").toLowerCase().trim();
  const limit = Math.min(Math.max(opts?.limit || RAW_MAX_LINES, 1), RAW_MAX_LINES);
  let lines = rawBuffer;
  if (q) lines = lines.filter((l) => l.text.toLowerCase().includes(q) || l.level.toLowerCase().includes(q));
  // Neueste zuerst, begrenzt.
  const sliced = lines.slice(-limit).reverse();
  return { lines: sliced, totalLines: rawBuffer.length, totalBytes: rawBytes, maxLines: RAW_MAX_LINES, maxBytes: RAW_MAX_BYTES };
}

// ═══════════════════════════════════════════════════════════════════
// PERSISTENTE EREIGNISSE — Tabelle, Insert (async/non-blocking), Retention.
// ═══════════════════════════════════════════════════════════════════
let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (tableReady) return tableReady;
  const sql = getPool();
  if (!sql) return Promise.resolve();
  tableReady = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS fiaon_diagnostics (
        id BIGSERIAL PRIMARY KEY,
        severity VARCHAR NOT NULL,          -- kritisch | warnung | info
        category VARCHAR NOT NULL,          -- email_make | lead | zahlung | agent | kunde | system
        code VARCHAR NOT NULL,              -- stabiler Fehler-Code (Aggregations-Basis)
        fingerprint VARCHAR NOT NULL,       -- code + normalisierte Kernaussage
        message TEXT NOT NULL,              -- MASKIERTE Klartext-Bedeutung
        hint TEXT,                          -- Lösungshinweis
        link VARCHAR,                       -- Direktlink (Admin-Pfad)
        action JSONB,                       -- vorgeschlagene Direktaktion
        context JSONB,                      -- MASKIERTER Zusatzkontext
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS fiaon_diag_created_idx ON fiaon_diagnostics (created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS fiaon_diag_sev_cat_idx ON fiaon_diagnostics (severity, category, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS fiaon_diag_fp_idx ON fiaon_diagnostics (fingerprint, created_at DESC)`;
  })().catch((err) => {
    tableReady = null; // erneuter Versuch beim nächsten Log
    console.warn("[DIAGNOSE] Tabelle konnte nicht angelegt werden:", err instanceof Error ? err.message : err);
  });
  return tableReady;
}

function fingerprintFor(code: string, message: string): string {
  // Normalisiert: Zahlen/UUIDs/Refs raus, damit identische Fehler zusammenfallen.
  const norm = message
    .toLowerCase()
    .replace(/\b[0-9a-f]{8}-[0-9a-f\-]{20,}\b/g, "#")
    .replace(/fiaon-[a-z0-9]+/gi, "#ref")
    .replace(/\d+/g, "#")
    .slice(0, 120);
  return createHash("sha1").update(`${code}|${norm}`).digest("hex").slice(0, 16);
}

/**
 * Zentrale Log-Funktion. NON-BLOCKING: gibt sofort zurück, schreibt im
 * Hintergrund. Maskiert Nachricht + Kontext VOR der Speicherung. Wirft nie.
 * Legt zusätzlich eine maskierte Zeile in den Rohdaten-Ring-Puffer.
 */
export function logDiagnostic(entry: DiagnosticInput): void {
  // 1) Ring-Puffer sofort (synchron, billig)
  pushRaw(entry.severity, `[${entry.category}] ${entry.code}: ${entry.message}`);
  // 2) Persistenz im Hintergrund
  (async () => {
    try {
      await ensureTable();
      const sql = getPool();
      if (!sql) return;
      const message = maskSensitive(entry.message).slice(0, 2000);
      const hint = entry.hint ? maskSensitive(entry.hint).slice(0, 1000) : null;
      const link = entry.link ? entry.link.slice(0, 300) : null;
      const action = entry.action ? JSON.stringify(entry.action) : null;
      const context = entry.context ? JSON.stringify(maskContext(entry.context)) : null;
      const fp = fingerprintFor(entry.code, message);
      await sql`
        INSERT INTO fiaon_diagnostics (severity, category, code, fingerprint, message, hint, link, action, context)
        VALUES (${entry.severity}, ${entry.category}, ${entry.code}, ${fp}, ${message}, ${hint}, ${link}, ${action}, ${context})
      `;
    } catch (err) {
      // Absolut verschlucken — die App läuft normal weiter.
      try { console.warn("[DIAGNOSE] Insert fehlgeschlagen:", err instanceof Error ? err.message : err); } catch {}
    }
  })();
}

/** Löscht Ereignisse älter als RETENTION_DAYS (oder alle, wenn all=true). */
export async function purgeDiagnostics(all = false): Promise<number> {
  const sql = getPool();
  if (!sql) return 0;
  await ensureTable();
  const rows = all
    ? await sql`DELETE FROM fiaon_diagnostics RETURNING id`
    : await sql`DELETE FROM fiaon_diagnostics WHERE created_at < NOW() - (${RETENTION_DAYS} || ' days')::interval RETURNING id`;
  return rows.length;
}

export const DIAGNOSTICS_CONFIG = { RETENTION_DAYS, RAW_MAX_LINES, RAW_MAX_BYTES };

// ═══════════════════════════════════════════════════════════════════
// CONSOLE-INTERCEPTION + PROZESS-HANDLER — additiv, einmalig.
// Speist den Rohdaten-Ring-Puffer aus console.error/warn/log (maskiert)
// und erzeugt aus unbehandelten Fehlern strukturierte 'system'-Ereignisse.
// Ändert KEIN bestehendes Verhalten: Original-Console wird zuerst aufgerufen.
// ═══════════════════════════════════════════════════════════════════
let installed = false;
export function installDiagnostics(): void {
  if (installed) return;
  installed = true;

  const wrap = (level: "log" | "warn" | "error", orig: (...a: any[]) => void) => {
    return (...args: any[]) => {
      try { orig.apply(console, args); } catch {}
      try {
        const text = args.map((a) => (typeof a === "string" ? a : safeStringify(a))).join(" ");
        pushRaw(level, text);
      } catch { /* nie stören */ }
    };
  };
  /* eslint-disable no-console */
  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);
  console.log = wrap("log", origLog);
  console.warn = wrap("warn", origWarn);
  console.error = wrap("error", origError);
  /* eslint-enable no-console */

  // Unbehandelte Fehler → strukturiertes kritisches System-Ereignis (additiv).
  process.on("unhandledRejection", (reason: any) => {
    logDiagnostic({
      severity: "kritisch", category: "system", code: "unhandled_rejection",
      message: `Unbehandelter Promise-Fehler: ${reason instanceof Error ? reason.message : String(reason)}`,
      hint: "Ein asynchroner Vorgang ist gescheitert, ohne abgefangen zu werden. Rohdaten-Tab für Stacktrace prüfen.",
    });
  });
  process.on("uncaughtException", (err: Error) => {
    logDiagnostic({
      severity: "kritisch", category: "system", code: "uncaught_exception",
      message: `Unbehandelte Ausnahme: ${err?.message || String(err)}`,
      hint: "Schwerer Laufzeitfehler. Rohdaten-Tab und Server-Logs prüfen.",
    });
  });
}
