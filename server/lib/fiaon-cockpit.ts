// ═══════════════════════════════════════════════════════════════════
// KI-COCKPIT — Sicherheits-Leitplanken + Ausführung (Prompt 3/3).
//
// Ablauf (verbindlich, siehe SYSTEM_DIAGNOSE.md):
//   Frage → KI erzeugt EINE read-only SQL-Abfrage → Server PRÜFT sie hart und
//   führt sie NUR-LESEND aus → Ergebnis geht als Tabelle an den Betreiber.
//   Für die Erklärung gehen nur AGGREGIERTE, ANONYMISIERTE Werte an die KI —
//   niemals Namen, E-Mails, Telefonnummern, IBANs, Adressen.
//
// Grundsatz: Der KI wird NIE vertraut. Jede Prüfung passiert serverseitig.
// Mehrfache, unabhängige Schutzschichten:
//   1. Whitelist: nur SELECT/WITH, Einzel-Statement, keine Kommentare.
//   2. Verbotene Schlüsselwörter (INSERT/UPDATE/DELETE/DDL/COPY/SET/…).
//   3. Tabellen-Allowlist (nur Geschäftstabellen) + verbotene Spalten
//      (verschlüsselte Bankdaten, Passwörter, Secrets).
//   4. Ausführung in einer READ-ONLY-Transaktion mit statement_timeout und
//      erzwungenem LIMIT — selbst wenn eine Prüfung versagte, blockt die DB.
// ═══════════════════════════════════════════════════════════════════

import postgres from "postgres";

export const MAX_ROWS = 500;
const TIMEOUT_MS = 6000;

// Nur-Lese-Pool: default_transaction_read_only + statement_timeout bereits auf
// Verbindungsebene gesetzt. Selbst eine durchgerutschte Schreib-Anweisung
// scheitert hier an der Datenbank (zusätzlich zur Wort-Whitelist).
const roPool = postgres(process.env.DATABASE_URL!, {
  ssl: "require",
  max: 2,
  connection: { default_transaction_read_only: true, statement_timeout: TIMEOUT_MS },
});

// ── Allowlist: NUR diese Geschäftstabellen darf die KI abfragen. ──────────────
// (Keine users/session/secrets — die stünden sonst der KI-generierten SQL offen.)
export const ALLOWED_TABLES = new Set<string>([
  "fiaon_applications",       // Kunden / Anträge / Bestellungen
  "fiaon_leads",              // Interessenten
  "fiaon_commissions",        // Provisionen
  "fiaon_contact_log",        // Kunden-Kontakt-Ergebnisse
  "fiaon_lead_log",           // Lead-Aktivität (Übernahmen, Ergebnisse, Mailversand)
  "fiaon_agents",             // Agenten-Stamm (sensible Spalten sind gesperrt, s. u.)
  "fiaon_bank_txns",          // Bank-Eingänge / Kontoabgleich
  "fiaon_payouts",            // Auszahlungen
  "fiaon_agent_feedback",     // Feedback-Tickets
  "fiaon_agent_feedback_messages",
  "fiaon_diagnostics",        // System-Diagnose (bereits maskiert gespeichert)
  "fiaon_invoices",           // Rechnungen
]);

// ── Verbotene Spalten (nie selektierbar — auch nicht in WHERE/Ausdrücken). ────
// Verschlüsselte Bankdaten und alles, was ein Geheimnis/Zugang ist.
const DENIED_COLUMN_TOKENS = [
  "bank_iban_enc", "bank_holder_enc", "bank_bic_enc",
  "password", "passwort", "pass_hash", "secret", "token", "session",
];

// ── Verbotene Schlüsselwörter (schreibend / gefährlich). Wort-genau. ──────────
const FORBIDDEN_KEYWORDS = [
  "insert", "update", "delete", "drop", "alter", "truncate", "create", "grant",
  "revoke", "copy", "merge", "call", "do", "vacuum", "analyze", "reindex",
  "refresh", "lock", "attach", "detach", "comment", "into", "set", "reset",
  "begin", "commit", "rollback", "savepoint", "listen", "notify", "prepare",
  "execute", "explain", "cluster", "discard", "checkpoint", "load",
];
// Gefährliche Funktionen / System-Kataloge (Substring, nicht wort-genau).
const FORBIDDEN_SUBSTRINGS = [
  "pg_", "information_schema", "current_setting", "set_config", "dblink",
  "lo_import", "lo_export", "copy ", "\\g", "::regclass", "pg_catalog",
];
const DENIED_IDENTIFIERS = ["users", "sessions", "session", "user_role", "password_reset_tokens"];

export interface GuardResult { ok: boolean; sql?: string; error?: string }

/** Härtet und prüft die KI-SQL. Gibt bei Erfolg die (ggf. um LIMIT ergänzte) SQL zurück. */
export function validateReadOnlySql(raw: string): GuardResult {
  if (!raw || typeof raw !== "string") return { ok: false, error: "Leere Abfrage." };
  let s = raw.trim();

  // Code-Fences/Markdown entfernen, falls die KI welche liefert.
  s = s.replace(/^```(?:sql)?\s*/i, "").replace(/```\s*$/i, "").trim();
  // Nur EIN Statement: abschließende Semikolons entfernen …
  s = s.replace(/;\s*$/g, "").trim();
  if (!s) return { ok: false, error: "Leere Abfrage." };

  const lower = s.toLowerCase();

  // Kommentare sind verboten (könnten Prüfungen verschleiern).
  if (s.includes("--") || s.includes("/*") || s.includes("*/")) {
    return { ok: false, error: "Kommentare sind in Abfragen nicht erlaubt." };
  }
  // … kein weiteres Statement im Rest.
  if (s.includes(";")) return { ok: false, error: "Nur eine einzelne Abfrage ist erlaubt (kein ';')." };

  // Muss mit SELECT oder WITH (CTE) beginnen.
  if (!/^(select|with)\b/i.test(s)) return { ok: false, error: "Nur Lese-Abfragen (SELECT / WITH …) sind erlaubt." };

  // Verbotene Schlüsselwörter (wort-genau; updated_at/created_at bleiben erlaubt).
  for (const kw of FORBIDDEN_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(lower)) {
      return { ok: false, error: `Nicht erlaubtes Schlüsselwort: „${kw.toUpperCase()}". Es sind nur Lese-Abfragen zugelassen.` };
    }
  }
  for (const sub of FORBIDDEN_SUBSTRINGS) {
    if (lower.includes(sub)) return { ok: false, error: `Nicht erlaubter Ausdruck: „${sub.trim()}".` };
  }
  for (const col of DENIED_COLUMN_TOKENS) {
    if (lower.includes(col)) return { ok: false, error: "Die Abfrage greift auf gesperrte (sensible) Felder zu." };
  }
  for (const id of DENIED_IDENTIFIERS) {
    if (new RegExp(`\\b${id}\\b`, "i").test(lower)) return { ok: false, error: `Zugriff auf „${id}" ist nicht erlaubt.` };
  }

  // CTE-Namen sammeln (die sind als „Tabellen" nach FROM/JOIN erlaubt).
  const cteNames = new Set<string>();
  for (const m of Array.from(s.matchAll(/(?:\bwith\b|,)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+as\s*\(/gi))) {
    cteNames.add(m[1].toLowerCase());
  }

  // Jede nach FROM/JOIN referenzierte Tabelle muss erlaubt sein (oder ein CTE).
  for (const m of Array.from(s.matchAll(/\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi))) {
    const ref = m[1].toLowerCase().replace(/^public\./, "");
    if (cteNames.has(ref)) continue;
    if (!ALLOWED_TABLES.has(ref)) {
      return { ok: false, error: `Tabelle „${m[1]}" ist nicht freigegeben. Erlaubt sind nur Geschäftstabellen (Kunden, Leads, Zahlungen, Provisionen, Agenten, Feedback, Diagnose).` };
    }
  }

  // LIMIT erzwingen (Kostendeckel), falls die KI keins gesetzt hat.
  if (!/\blimit\s+\d+/i.test(s)) s = `${s}\nLIMIT ${MAX_ROWS}`;

  return { ok: true, sql: s };
}

export interface RunResult { columns: string[]; rows: any[]; rowCount: number; truncated: boolean }

/** Führt die geprüfte SQL in einer READ-ONLY-Transaktion mit Timeout aus. */
export async function runReadOnly(sql: string): Promise<RunResult> {
  return roPool.begin(async (tx) => {
    // Read-only zuerst (muss vor der ersten Anweisung der Transaktion stehen),
    // dann der Timeout — doppelte Absicherung zusätzlich zum Pool.
    await tx.unsafe("SET TRANSACTION READ ONLY");
    await tx.unsafe(`SET LOCAL statement_timeout = ${TIMEOUT_MS}`);
    const result = await tx.unsafe(sql);
    const rows = Array.isArray(result) ? result : [];
    const columns = (result as any).columns?.map((c: any) => c.name)
      || (rows.length ? Object.keys(rows[0]) : []);
    const capped = rows.slice(0, MAX_ROWS);
    return { columns, rows: capped, rowCount: rows.length, truncated: rows.length > MAX_ROWS };
  }) as Promise<RunResult>;
}

// ── Schema-Beschreibung für die KI (nur erlaubte Tabellen, ohne Secret-Spalten). ─
let schemaCache: { at: number; text: string } | null = null;
export async function buildSchemaDoc(): Promise<string> {
  if (schemaCache && Date.now() - schemaCache.at < 10 * 60_000) return schemaCache.text;
  const tables = Array.from(ALLOWED_TABLES);
  const rows = await roPool`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ANY(${tables})
    ORDER BY table_name, ordinal_position
  `;
  const byTable = new Map<string, string[]>();
  for (const r of rows as any[]) {
    if (DENIED_COLUMN_TOKENS.some((d) => String(r.column_name).toLowerCase().includes(d))) continue;
    if (!byTable.has(r.table_name)) byTable.set(r.table_name, []);
    byTable.get(r.table_name)!.push(`${r.column_name} ${simpleType(r.data_type)}`);
  }
  const lines: string[] = [];
  for (const t of tables) {
    const cols = byTable.get(t);
    if (cols && cols.length) lines.push(`${t}(${cols.join(", ")})`);
  }
  const text = lines.join("\n");
  schemaCache = { at: Date.now(), text };
  return text;
}

function simpleType(t: string): string {
  if (/char|text/.test(t)) return "text";
  if (/int|numeric|double|real|decimal/.test(t)) return "num";
  if (/timestamp|date/.test(t)) return "time";
  if (/bool/.test(t)) return "bool";
  return t;
}

// ── Ergebnis für die KI-Erklärung anonymisieren (nur Aggregate, nie Klartext-PII). ─
const SENSITIVE_COL = /(name|mail|email|phone|tel|iban|bic|holder|address|adresse|strasse|street|plz|city|ort|note|notiz|comment|kommentar|ref|reference|description|body|message|betreff|title|titel|dob|geburt|vorname|nachname)/i;
// Kategorie-Spalten, deren Werte unbedenklich sind (keine Personendaten).
const SAFE_CATEGORY_COL = /^(status|payment_status|quelle|source|kampagne|campaign|type|outcome|kind|commission_basis|match_status|severity|category|active|published|schufa_status)$/i;

export function aggregateForAi(columns: string[], rows: any[]): any {
  const out: Record<string, any> = {};
  for (const col of columns) {
    const values = rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined);
    const nums = values.map((v) => (typeof v === "number" ? v : Number(v))).filter((n) => Number.isFinite(n));
    const isNumeric = values.length > 0 && nums.length === values.length;
    if (isNumeric) {
      const sum = nums.reduce((a, b) => a + b, 0);
      out[col] = { typ: "zahl", summe: round2(sum), min: round2(Math.min(...nums)), max: round2(Math.max(...nums)), schnitt: round2(sum / nums.length) };
    } else if (SENSITIVE_COL.test(col)) {
      out[col] = { typ: "text_anonymisiert", verschiedene: new Set(values.map(String)).size };
    } else if (SAFE_CATEGORY_COL.test(col)) {
      const freq: Record<string, number> = {};
      for (const v of values) freq[String(v)] = (freq[String(v)] || 0) + 1;
      const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6);
      out[col] = { typ: "kategorie", verschiedene: Object.keys(freq).length, top: Object.fromEntries(top) };
    } else {
      out[col] = { typ: "sonstige", verschiedene: new Set(values.map(String)).size };
    }
  }
  return out;
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
