/**
 * ═══════════════════════════════════════════════════════════════════
 * PHASE 0 — NOTFALL „KUNDEN KÖNNEN SICH NICHT EINLOGGEN"
 * ═══════════════════════════════════════════════════════════════════
 *
 * NUR LESEND. Kein UPDATE, kein DELETE, keine Mail, kein Webhook.
 * Liefert Zahlen zu den vier Hypothesen:
 *
 *   H1  Verschluckt der Login-Endpunkt technische Fehler? (Code-Prüfung, hier nur Kontext)
 *   H2  Passwort verloren (Merge / Überschreiben durch Zwischenspeichern)?
 *   H3  Status-Filter sperrt bezahlte Kunden aus?
 *   H4  Der konkrete Fall des Betreibers.
 *
 * Zusätzlich: E-Mail-Normalisierung (Groß/Kleinschreibung, Leerzeichen) und
 * die „Neueste-Zeile-gewinnt"-Falle des Logins (ORDER BY created_at DESC LIMIT 1).
 *
 * Verwendung:  npx tsx scripts/login-notfall-phase0.ts
 *              npx tsx scripts/login-notfall-phase0.ts --md
 */

import "dotenv/config";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL fehlt.");
  process.exit(2);
}
const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: 3,
  connect_timeout: 15,
  // Harte Bremse: keine Abfrage darf das 60-s-Zeitlimit sprengen.
  connection: { statement_timeout: 20000 },
});

const MD = process.argv.includes("--md");
const OPERATOR_REF = "FIAON-MNPTDV19-QYAJ";
const OPERATOR_EMAIL = "office@schwarzott-global.com";

/** Genau der Ausdruck, den der Login als „hinterlegtes Passwort" liest. */
const HAS_PW = sql`COALESCE(NULLIF(password, ''), NULLIF(utm->>'password', '')) IS NOT NULL`;

function h(title: string) {
  console.log(MD ? `\n### ${title}\n` : `\n═══ ${title} ${"═".repeat(Math.max(0, 60 - title.length))}`);
}
function line(label: string, value: any) {
  console.log(MD ? `| ${label} | **${value}** |` : `  ${label.padEnd(52, ".")} ${value}`);
}
function tableHead(a: string, b: string) {
  if (MD) console.log(`| ${a} | ${b} |\n|---|---|`);
}

async function main() {
  console.log(MD ? "# Phase 0 — Login-Notfall: Messung" : "PHASE 0 — LOGIN-NOTFALL (nur lesend)");
  console.log(MD ? `\n_Stand: ${new Date().toISOString()}_` : `Stand: ${new Date().toISOString()}`);

  // ── Grundmengen ───────────────────────────────────────────────────
  h("Grundmengen");
  tableHead("Kennzahl", "Anzahl");
  const [g] = await sql`
    SELECT
      COUNT(*)::int                                                        AS zeilen_gesamt,
      COUNT(*) FILTER (WHERE merged_into IS NOT NULL)::int                 AS gemergt,
      COUNT(*) FILTER (WHERE payment_status = 'paid')::int                 AS bezahlt,
      COUNT(*) FILTER (WHERE payment_status = 'paid'
                         AND merged_into IS NOT NULL)::int                 AS bezahlt_und_gemergt,
      COUNT(*) FILTER (WHERE ${HAS_PW})::int                               AS mit_passwort
    FROM fiaon_applications
  `;
  line("Antragszeilen gesamt", g.zeilen_gesamt);
  line("davon als Dublette zusammengeführt (merged_into)", g.gemergt);
  line("davon bezahlt (payment_status='paid')", g.bezahlt);
  line("bezahlt UND gemergt", g.bezahlt_und_gemergt);
  line("Zeilen mit hinterlegtem Passwort", g.mit_passwort);

  // ── H2: Passwort fehlt bei bezahlten Kunden ───────────────────────
  h("H2 — Bezahlte Kunden OHNE hinterlegtes Passwort");
  tableHead("Kennzahl", "Anzahl");
  const [h2] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE payment_status = 'paid' AND merged_into IS NULL
                         AND NOT (${HAS_PW}))::int AS bezahlt_ohne_pw,
      COUNT(*) FILTER (WHERE payment_status = 'paid' AND merged_into IS NOT NULL
                         AND NOT (${HAS_PW}))::int AS bezahlt_gemergt_ohne_pw
    FROM fiaon_applications
  `;
  line("bezahlt, aktiv, KEIN Passwort  → ausgesperrt", h2.bezahlt_ohne_pw);
  line("bezahlt, gemergt, kein Passwort", h2.bezahlt_gemergt_ohne_pw);

  // Merge-Nebenwirkung: Verlierer hatte ein Passwort, Gewinner hat keines.
  const pwLostByMerge = await sql`
    SELECT l.ref AS verlierer, w.ref AS gewinner, w.payment_status, w.email,
           COUNT(*) OVER ()::int AS gesamt
    FROM fiaon_applications l
    JOIN fiaon_applications w ON w.ref = l.merged_into
    WHERE l.merged_into IS NOT NULL
      AND COALESCE(NULLIF(l.password,''), NULLIF(l.utm->>'password','')) IS NOT NULL
      AND COALESCE(NULLIF(w.password,''), NULLIF(w.utm->>'password','')) IS NULL
    ORDER BY w.payment_status
    LIMIT 20
  `;
  line("Merge-Verlust: Verlierer hat PW, Gewinner nicht", pwLostByMerge[0]?.gesamt ?? 0);
  for (const r of pwLostByMerge) console.log(`      ${r.verlierer} → ${r.gewinner} (${r.payment_status}) ${r.email ?? "-"}`);

  // ── H3: Status-Filter ─────────────────────────────────────────────
  h("H3 — Status-Verteilung der BEZAHLTEN, aktiven Kunden");
  tableHead("status / account_status", "Anzahl");
  const statusRows = await sql`
    SELECT COALESCE(status,'(leer)') AS status,
           COALESCE(account_status,'(leer)') AS account_status,
           COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE ${HAS_PW})::int AS mit_pw
    FROM fiaon_applications
    WHERE payment_status = 'paid' AND merged_into IS NULL
    GROUP BY 1, 2 ORDER BY n DESC
  `;
  for (const r of statusRows) line(`${r.status} / ${r.account_status}`, `${r.n} (mit PW: ${r.mit_pw})`);

  const [gate] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE account_status = 'suspended')::int AS gesperrt,
      COUNT(*) FILTER (WHERE status NOT IN ('completed','documents_submitted','payment_completed')
                         AND payment_status <> 'paid')::int     AS antrag_offen,
      COUNT(*) FILTER (WHERE status <> 'completed')::int        AS reset_blockiert
    FROM fiaon_applications
    WHERE merged_into IS NULL AND payment_status = 'paid'
  `;
  line("bezahlt + account_status='suspended' (harte Sperre)", gate.gesperrt);
  line("bezahlt, aber Zugangs-Gate würde greifen", gate.antrag_offen);
  line("bezahlt, aber status<>'completed' → PW-Reset blockiert", gate.reset_blockiert);

  // ── Login-Lookup-Fallen ───────────────────────────────────────────
  h("Login-Lookup: exakte E-Mail + „neueste Zeile gewinnt\"");
  tableHead("Kennzahl", "Anzahl");
  const [mail] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE email IS NOT NULL AND email <> LOWER(TRIM(email)))::int AS nicht_normalisiert,
      COUNT(*) FILTER (WHERE email IS NULL OR email = '')::int                       AS ohne_email
    FROM fiaon_applications
    WHERE payment_status = 'paid'
  `;
  line("bezahlt, E-Mail nicht kleingeschrieben/getrimmt", mail.nicht_normalisiert);
  line("bezahlt, gar keine E-Mail im Feld `email`", mail.ohne_email);

  // Der Login nimmt WHERE email = ? ORDER BY created_at DESC LIMIT 1.
  // Falle: die neueste Zeile hat KEIN Passwort, eine ältere Zeile derselben
  // E-Mail hat eines → Kunde kennt sein Passwort, der Login sieht es nie.
  const newestWins = await sql`
    WITH ranked AS (
      SELECT ref, email, created_at, payment_status, status, merged_into,
             COALESCE(NULLIF(password,''), NULLIF(utm->>'password','')) AS pw,
             ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) AS rn
      FROM fiaon_applications
      WHERE email IS NOT NULL AND email <> ''
    )
    SELECT n.email, n.ref AS neueste_ref, n.payment_status AS neueste_zahlung,
           n.merged_into,
           (SELECT string_agg(o.ref, ', ') FROM ranked o
             WHERE o.email = n.email AND o.rn > 1 AND o.pw IS NOT NULL) AS refs_mit_pw,
           COUNT(*) OVER ()::int AS gesamt
    FROM ranked n
    WHERE n.rn = 1 AND n.pw IS NULL
      AND EXISTS (SELECT 1 FROM ranked o WHERE o.email = n.email AND o.rn > 1 AND o.pw IS NOT NULL)
    ORDER BY n.payment_status DESC
    LIMIT 20
  `;
  line("E-Mails, bei denen die NEUESTE Zeile kein PW hat,", "");
  line("  eine ältere Zeile derselben E-Mail aber schon", newestWins[0]?.gesamt ?? 0);
  for (const r of newestWins) {
    console.log(`      ${r.email} → Login liest ${r.neueste_ref} (${r.neueste_zahlung}${r.merged_into ? ", gemergt" : ""}), PW liegt in: ${r.refs_mit_pw}`);
  }

  // ── H4: Der Fall des Betreibers ───────────────────────────────────
  h("H4 — Betreiber-Datensatz");
  const op = await sql`
    SELECT ref, email, first_name, last_name, status, account_status, payment_status,
           merged_into, superseded_by, created_at, updated_at,
           (password IS NOT NULL AND password <> '')          AS hat_password_spalte,
           (NULLIF(utm->>'password','') IS NOT NULL)          AS hat_password_utm,
           utm::text                                          AS utm_roh
    FROM fiaon_applications
    WHERE ref = ${OPERATOR_REF} OR LOWER(TRIM(email)) = ${OPERATOR_EMAIL}
    ORDER BY created_at DESC
  `;
  if (op.length === 0) {
    console.log(`  KEIN Datensatz für ${OPERATOR_REF} / ${OPERATOR_EMAIL} gefunden.`);
  }
  for (const r of op) {
    console.log(
      `  ${r.ref} | ${r.email} | ${r.first_name ?? ""} ${r.last_name ?? ""}\n` +
      `    status=${r.status} account=${r.account_status} zahlung=${r.payment_status}\n` +
      `    merged_into=${r.merged_into ?? "-"} superseded_by=${r.superseded_by ?? "-"}\n` +
      `    Passwort: Spalte=${r.hat_password_spalte} utm=${r.hat_password_utm}  utm_roh=${String(r.utm_roh).slice(0, 120)}\n` +
      `    erstellt=${r.created_at?.toISOString?.() ?? r.created_at} geändert=${r.updated_at?.toISOString?.() ?? r.updated_at}`,
    );
  }

  // ── Arbeitsliste (Teil B) ─────────────────────────────────────────
  h("Teil B — Arbeitsliste: bezahlt, aber ausgesperrt");
  const locked = await sql`
    SELECT ref, email, COALESCE(first_name,'') || ' ' || COALESCE(last_name,'') AS name,
           status, account_status, merged_into,
           CASE
             WHEN merged_into IS NOT NULL                     THEN 'als Dublette zusammengeführt'
             WHEN NOT (COALESCE(NULLIF(password,''), NULLIF(utm->>'password','')) IS NOT NULL)
                                                              THEN 'kein Passwort hinterlegt'
             WHEN account_status = 'suspended'                THEN 'Konto gesperrt'
             ELSE 'Status'
           END AS grund
    FROM fiaon_applications
    WHERE payment_status = 'paid'
      AND (
        merged_into IS NOT NULL
        OR NOT (COALESCE(NULLIF(password,''), NULLIF(utm->>'password','')) IS NOT NULL)
        OR account_status = 'suspended'
      )
    ORDER BY grund, ref
  `;
  line("Betroffene bezahlte Kunden", locked.length);
  for (const r of locked) console.log(`      ${r.ref} | ${r.name.trim() || "-"} | ${r.email ?? "-"} | ${r.grund}`);

  await sql.end();
}

main().catch(async (e) => {
  console.error("FEHLER:", e instanceof Error ? e.message : e);
  await sql.end().catch(() => {});
  process.exit(1);
});
