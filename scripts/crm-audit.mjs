/**
 * ═══════════════════════════════════════════════════════════════════
 * CRM-UMBAU — SCHRITT 0: BESTANDSAUFNAHME (NUR LESEN)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Zweck: Das echte Live-Schema und die echten Zahlen ermitteln, BEVOR
 * eine Migration geschrieben wird. Ohne diesen Schritt schreibt man
 * Migrationen gegen `shared/schema.ts` — und das ist hier nicht die
 * Wahrheit: ein großer Teil der fiaon_*-Tabellen wird zur Laufzeit per
 * SQL angelegt und steht in keiner Drizzle-Definition.
 *
 * Sicherheit:
 *   1. Alles läuft in EINER Transaktion mit SET TRANSACTION READ ONLY.
 *      Postgres selbst weist damit jedes INSERT/UPDATE/DELETE zurück —
 *      auch dann, wenn unten ein Fehler steckt. Am Ende ROLLBACK.
 *   2. Spaltennamen werden aus information_schema gelesen, nicht geraten.
 *      Fehlt eine Spalte, entfällt der Abschnitt mit Hinweis statt Absturz.
 *   3. Passwort-Hashes, IBANs und Tokens werden aus der Agenten-Ausgabe
 *      entfernt, damit der Report weitergegeben werden kann.
 *
 * Aufruf:  node scripts/crm-audit.mjs
 * Ausgabe: stdout + reports/crm_audit_<ISO-Datum>.json
 */
import "dotenv/config";
import postgres from "postgres";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("DATABASE_URL fehlt. Erwartet in .env oder Umgebung.");
  process.exit(1);
}

// Render-Fallstrick: die INTERNE URL (dpg-xxxx-a ohne Punkt im Host) löst
// ausschließlich innerhalb von Render auf. Lokal führt sie zu ENOTFOUND —
// was leicht als "falsche Datenbank" fehlgedeutet wird.
const host = (() => {
  try { return new URL(DB_URL).hostname; } catch { return ""; }
})();
if (host && !host.includes(".")) {
  console.error(
    `\nDATABASE_URL zeigt auf den INTERNEN Render-Host "${host}".\n` +
    `Der ist nur innerhalb von Render erreichbar. Lokal die EXTERNE URL nutzen:\n` +
    `  postgresql://<user>:<pw>@${host}.oregon-postgres.render.com/<db>?sslmode=require\n`
  );
  process.exit(1);
}

const sql = postgres(DB_URL, { ssl: "require", max: 1, onnotice: () => {} });

/** Sammelt den Report parallel zur Konsolenausgabe. */
const report = { erzeugtAm: new Date().toISOString(), host, abschnitte: {} };

const line = (s = "") => console.log(s);
const head = (t) => { line(); line("─".repeat(72)); line(t); line("─".repeat(72)); };
const tabelle = (rows) => {
  if (!rows?.length) { line("  (keine Zeilen)"); return; }
  for (const r of rows) {
    line("  " + Object.entries(r).map(([k, v]) => `${k}=${v === null ? "∅" : v}`).join("  "));
  }
};

/**
 * Spalten-Landkarte: table -> Map(column -> meta)
 *
 * Nimmt die Transaktion als Argument. Wichtig: der Pool hat max=1, eine
 * zweite Verbindung waehrend der laufenden Transaktion wuerde blockieren.
 */
async function spaltenKarte(tx) {
  const rows = await tx`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name LIKE 'fiaon_%'
    ORDER BY table_name, ordinal_position`;
  const karte = new Map();
  for (const r of rows) {
    if (!karte.has(r.table_name)) karte.set(r.table_name, new Map());
    karte.get(r.table_name).set(r.column_name, r);
  }
  return karte;
}

async function main() {
  await sql.begin(async (tx) => {
    // Harte Leseschranke: ab hier kann diese Transaktion nichts mehr schreiben.
    await tx.unsafe("SET TRANSACTION READ ONLY");

    const karte = await spaltenKarte(tx);
    const hat = (t, c) => karte.get(t)?.has(c) ?? false;
    const existiert = (t) => karte.has(t);

    // ── 0) Verbindung ────────────────────────────────────────────────
    head("0) VERBINDUNG");
    const [info] = await tx`
      SELECT current_database() AS db, current_user AS usr,
             substring(version(), 1, 45) AS pg,
             pg_size_pretty(pg_database_size(current_database())) AS groesse`;
    tabelle([info]);
    report.abschnitte.verbindung = info;

    // ── 1) ABBRUCHKRITERIUM: Waisen-Anträge ──────────────────────────
    head("1) WAISEN-ANTRAEGE — ABBRUCHKRITERIUM (>5 % echter Antraege)");
    if (!existiert("fiaon_applications")) {
      line("  fiaon_applications fehlt — Audit kann nicht fortgesetzt werden.");
      return;
    }
    const hatEntwurf = hat("fiaon_applications", "ist_entwurf");
    const hatPersonId = hat("fiaon_applications", "person_id");
    if (!hatPersonId) {
      line("  Spalte person_id fehlt — das Personenmodell ist nicht verknuepft. STOPP.");
      report.abschnitte.waisen = { fehler: "person_id fehlt" };
    } else {
      // Entwuerfe (Funnel-Abbrecher ohne jede Kontaktmoeglichkeit) haben per
      // Design keine Person. Sie muessen aus der Quote heraus, sonst entsteht
      // ein Fehlalarm.
      const [w] = await tx.unsafe(`
        SELECT count(*)::int AS antraege_total,
               ${hatEntwurf ? "(count(*) FILTER (WHERE ist_entwurf))::int" : "0"} AS entwuerfe,
               ${hatEntwurf ? "(count(*) FILTER (WHERE NOT ist_entwurf))::int" : "count(*)::int"} AS echte_antraege,
               ${hatEntwurf
                 ? "(count(*) FILTER (WHERE person_id IS NULL AND NOT ist_entwurf))::int"
                 : "(count(*) FILTER (WHERE person_id IS NULL))::int"} AS waisen_echt,
               ${hatEntwurf ? "(count(*) FILTER (WHERE person_id IS NULL AND ist_entwurf))::int" : "0"} AS waisen_entwurf
        FROM fiaon_applications`);
      const pct = w.echte_antraege ? (100 * w.waisen_echt) / w.echte_antraege : 0;
      w.pct_waisen_echt = Number(pct.toFixed(2));
      tabelle([w]);

      // Waisen MIT Kontaktdaten sind die eigentlichen Reparaturfaelle:
      // sie haetten eine Person bekommen muessen.
      const kontaktBed = [
        hat("fiaon_applications", "email") ? "coalesce(email,'') <> ''" : null,
        hat("fiaon_applications", "phone") ? "coalesce(phone,'') <> ''" : null,
      ].filter(Boolean).join(" OR ") || "false";
      const [wk] = await tx.unsafe(`
        SELECT count(*)::int AS waisen_mit_kontakt,
               (count(*) FILTER (WHERE payment_status = 'paid'))::int AS davon_bezahlt
        FROM fiaon_applications
        WHERE person_id IS NULL ${hatEntwurf ? "AND NOT ist_entwurf" : ""} AND (${kontaktBed})`);
      tabelle([wk]);

      report.abschnitte.waisen = { ...w, ...wk, schwelle_pct: 5, verletzt: pct > 5 };
      line();
      line(pct > 5
        ? `  ⛔ ABBRUCH: ${w.pct_waisen_echt} % der echten Antraege haben kein person_id (Schwelle 5 %).`
        : `  ✓ ${w.pct_waisen_echt} % Waisen — unter der Schwelle von 5 %.`);
      if (wk.davon_bezahlt > 0) {
        line(`  ⚠ ${wk.davon_bezahlt} BEZAHLTE Antraege ohne Person — das sind verlorene Provisionen/Bestandskunden.`);
      }
    }

    // ── 2) Die Agenten ───────────────────────────────────────────────
    head("2) AGENTEN — WER EXISTIERT, WER IST TEST-ACCOUNT?");
    if (!existiert("fiaon_agents")) {
      line("  fiaon_agents fehlt.");
    } else {
      const geheim = ["password_hash", "password", "passwort_hash", "iban", "iban_enc",
        "iban_encrypted", "bank_iban", "reset_token", "reset_token_hash", "setup_token",
        "setup_token_hash", "session_token", "avatar", "avatar_data", "avatar_url"];
      const sichtbar = [...karte.get("fiaon_agents").keys()].filter((c) => !geheim.includes(c));
      const agenten = await tx.unsafe(
        `SELECT ${sichtbar.map((c) => `"${c}"`).join(", ")} FROM fiaon_agents ORDER BY id`);
      tabelle(agenten);
      report.abschnitte.agenten = agenten;
      line();
      line(`  Spalte is_test_account vorhanden: ${hat("fiaon_agents", "is_test_account") ? "JA" : "NEIN (Migration muss sie anlegen)"}`);

      // Aktuelle Last je Agent — Grundlage fuer die Neuverteilung.
      if (hat("fiaon_applications", "assigned_agent_id")) {
        line();
        line("  Aktuelle Zuweisungen (Antragsebene, ohne Entwuerfe):");
        // offene_zusagen ist die Kernzahl: das sind die Tier-1-Kunden. Genau hier
        // zeigt sich die Schieflage, die die offene Kartei erzeugt hat.
        const last = await tx.unsafe(`
          SELECT ag.id,
                 count(ap.id)::int AS antraege,
                 (count(ap.id) FILTER (WHERE ap.payment_status = 'claimed_paid'))::int AS offene_zusagen,
                 (count(ap.id) FILTER (WHERE ap.payment_status = 'pending_payment'))::int AS offene_antraege,
                 (count(ap.id) FILTER (WHERE ap.payment_status = 'paid'))::int AS bezahlt,
                 count(DISTINCT ap.person_id)::int AS personen
          FROM fiaon_agents ag
          LEFT JOIN fiaon_applications ap
                 ON ap.assigned_agent_id = ag.id ${hatEntwurf ? "AND NOT ap.ist_entwurf" : ""}
          GROUP BY ag.id ORDER BY ag.id`);
        tabelle(last);
        report.abschnitte.agentenLast = last;

        if (hat("fiaon_leads", "assigned_agent_id")) {
          line();
          line("  Zugewiesene Leads je Agent:");
          const leadLast = await tx.unsafe(`
            SELECT ag.id, count(l.id)::int AS leads
            FROM fiaon_agents ag
            LEFT JOIN fiaon_leads l ON l.assigned_agent_id = ag.id
            GROUP BY ag.id ORDER BY ag.id`);
          tabelle(leadLast);
          report.abschnitte.agentenLeads = leadLast;
        }

        // Letzte Aktivitaet — entscheidet mit, ob ein Agent echt oder Karteileiche ist.
        if (existiert("fiaon_agent_events") && hat("fiaon_agent_events", "agent_id")
            && hat("fiaon_agent_events", "created_at")) {
          line();
          line("  Letzte Aktivitaet je Agent (fiaon_agent_events):");
          const aktiv = await tx.unsafe(`
            SELECT ag.id,
                   max(e.created_at) AS letztes_event,
                   count(e.id)::int  AS events
            FROM fiaon_agents ag
            LEFT JOIN fiaon_agent_events e ON e.agent_id = ag.id
            GROUP BY ag.id ORDER BY ag.id`);
          tabelle(aktiv);
          report.abschnitte.agentenAktivitaet = aktiv;
        }

        const [herrenlos] = await tx.unsafe(`
          SELECT count(*)::int AS unzugewiesen
          FROM fiaon_applications
          WHERE assigned_agent_id IS NULL ${hatEntwurf ? "AND NOT ist_entwurf" : ""}`);
        line(`  Unzugewiesene echte Antraege: ${herrenlos.unzugewiesen}`);
        report.abschnitte.unzugewiesen = herrenlos.unzugewiesen;
      }
    }

    // ── 3) Status-Verteilung ─────────────────────────────────────────
    head("3) STATUS-VERTEILUNG (Grundlage der Tier-Berechnung)");
    if (hat("fiaon_applications", "payment_status")) {
      const ps = await tx.unsafe(`
        SELECT payment_status, count(*)::int AS anzahl
        FROM fiaon_applications
        WHERE true ${hatEntwurf ? "AND NOT ist_entwurf" : ""}
        GROUP BY 1 ORDER BY 2 DESC`);
      line("  payment_status (ohne Entwuerfe):");
      tabelle(ps);
      report.abschnitte.paymentStatus = ps;
    }
    if (hat("fiaon_applications", "status")) {
      const st = await tx.unsafe(`
        SELECT status, count(*)::int AS anzahl
        FROM fiaon_applications
        WHERE true ${hatEntwurf ? "AND NOT ist_entwurf" : ""}
        GROUP BY 1 ORDER BY 2 DESC`);
      line();
      line("  status (ohne Entwuerfe):");
      tabelle(st);
      report.abschnitte.status = st;
    }
    if (hat("fiaon_applications", "merged_into")) {
      const [m] = await tx.unsafe(
        `SELECT count(*)::int AS supersedet FROM fiaon_applications WHERE merged_into IS NOT NULL`);
      line();
      line(`  Antraege mit merged_into (supersedet/gemergt): ${m.supersedet}`);
      report.abschnitte.supersedet = m.supersedet;
    }

    // ── 4) Personen ──────────────────────────────────────────────────
    head("4) PERSONEN — VERTEILUNG UND MERGE-ZUSTAND");
    if (existiert("fiaon_persons")) {
      const [p] = await tx.unsafe(`
        SELECT count(*)::int AS personen_total,
               ${hat("fiaon_persons", "merged_into_person_id")
                 ? "(count(*) FILTER (WHERE merged_into_person_id IS NOT NULL))::int" : "0"} AS gemergt,
               ${hat("fiaon_persons", "merged_into_person_id")
                 ? "(count(*) FILTER (WHERE merged_into_person_id IS NULL))::int" : "count(*)::int"} AS lebend,
               ${hat("fiaon_persons", "agent_conflict")
                 ? "(count(*) FILTER (WHERE agent_conflict))::int" : "0"} AS agent_konflikte,
               ${hat("fiaon_persons", "assigned_agent_id")
                 ? "(count(*) FILTER (WHERE assigned_agent_id IS NOT NULL))::int" : "0"} AS mit_agent,
               ${hat("fiaon_persons", "primary_email")
                 ? "(count(*) FILTER (WHERE coalesce(primary_email,'') = ''))::int" : "0"} AS ohne_email,
               ${hat("fiaon_persons", "phone_key9")
                 ? "(count(*) FILTER (WHERE coalesce(phone_key9,'') = ''))::int" : "0"} AS ohne_telefon
        FROM fiaon_persons`);
      tabelle([p]);
      report.abschnitte.personen = p;

      if (hatPersonId) {
        line();
        line("  Antraege pro Person (ohne Entwuerfe) — belegt den Bedarf fuer Option A:");
        const hist = await tx.unsafe(`
          SELECT antraege, count(*)::int AS personen FROM (
            SELECT person_id, count(*)::int AS antraege
            FROM fiaon_applications
            WHERE person_id IS NOT NULL ${hatEntwurf ? "AND NOT ist_entwurf" : ""}
            GROUP BY person_id
          ) t GROUP BY antraege ORDER BY antraege`);
        tabelle(hist);
        report.abschnitte.antraegeProPerson = hist;
      }

      // Spalten, die die Migration anlegen soll — pruefen was schon da ist.
      line();
      line("  Zielspalten auf fiaon_persons (Soll-Ist):");
      for (const c of ["priority_tier", "assigned_agent_id", "assigned_at",
        "promised_payment_date", "follow_up_date", "unreachable_count",
        "is_blocked", "merged_into_person_id"]) {
        line(`    ${hat("fiaon_persons", c) ? "vorhanden " : "FEHLT    "} ${c}`);
      }
      report.abschnitte.zielspalten = Object.fromEntries(
        ["priority_tier", "assigned_agent_id", "assigned_at", "promised_payment_date",
          "follow_up_date", "unreachable_count", "is_blocked", "merged_into_person_id"]
          .map((c) => [c, hat("fiaon_persons", c)]));
    }

    // ── 5) Tier-Vorschau ─────────────────────────────────────────────
    head("5) TIER-VORSCHAU (MAX ueber alle Antraege je lebender Person)");
    if (existiert("fiaon_persons") && hatPersonId && hat("fiaon_applications", "payment_status")) {
      const lebendFilter = hat("fiaon_persons", "merged_into_person_id")
        ? "WHERE p.merged_into_person_id IS NULL" : "";
      const vor = await tx.unsafe(`
        WITH agg AS (
          SELECT p.id,
                 bool_or(a.payment_status = 'paid')         AS bezahlt,
                 bool_or(a.payment_status = 'claimed_paid') AS zusage,
                 count(a.id)::int                            AS antraege
          FROM fiaon_persons p
          LEFT JOIN fiaon_applications a
                 ON a.person_id = p.id ${hatEntwurf ? "AND NOT a.ist_entwurf" : ""}
          ${lebendFilter}
          GROUP BY p.id
        )
        SELECT CASE
                 WHEN bezahlt THEN 'Bestandskunde (raus aus Sales-Pool)'
                 WHEN zusage  THEN 'Tier 1 — Zahlung angekuendigt'
                 WHEN antraege > 0 THEN 'Tier 2 — Antrag, keine Zusage'
                 ELSE 'Tier 3 — kein Antrag (Lead)'
               END AS tier,
               count(*)::int AS personen
        FROM agg GROUP BY 1 ORDER BY 1`);
      tabelle(vor);
      report.abschnitte.tierVorschau = vor;
    } else {
      line("  Vorbedingungen fehlen.");
    }

    // ── 6) Leads ─────────────────────────────────────────────────────
    head("6) LEADS (Tier-3-Quelle)");
    if (existiert("fiaon_leads")) {
      const lc = karte.get("fiaon_leads");
      line(`  Spalten: ${[...lc.keys()].join(", ")}`);
      if (lc.has("status")) {
        const ls = await tx.unsafe(
          `SELECT status, count(*)::int AS anzahl FROM fiaon_leads GROUP BY 1 ORDER BY 2 DESC`);
        tabelle(ls);
        report.abschnitte.leadStatus = ls;
      }
      const personSpalte = ["person_id", "fiaon_person_id"].find((c) => lc.has(c));
      if (personSpalte) {
        const [lp] = await tx.unsafe(`
          SELECT count(*)::int AS leads_total,
                 (count(*) FILTER (WHERE ${personSpalte} IS NULL))::int AS ohne_person
          FROM fiaon_leads`);
        tabelle([lp]);
        report.abschnitte.leadsOhnePerson = lp;
      } else {
        line("  ⚠ Keine person_id-Spalte auf fiaon_leads — Tier 3 laesst sich derzeit");
        line("    nicht ueber die Person aggregieren. Das ist ein Migrationspunkt.");
        report.abschnitte.leadsOhnePerson = { fehler: "keine person-spalte" };
      }
    }

    // ── 7) Zahlungswahrheit ──────────────────────────────────────────
    head("7) ZAHLUNGSWAHRHEIT — 'paid' vs. Kontoabgleich");
    if (existiert("fiaon_bank_txns")) {
      const bc = karte.get("fiaon_bank_txns");
      line(`  fiaon_bank_txns Spalten: ${[...bc.keys()].join(", ")}`);
      const refSpalte = ["ref", "application_ref", "matched_ref", "zugeordnet_ref", "antrag_ref"]
        .find((c) => bc.has(c));
      if (refSpalte) {
        const [z] = await tx.unsafe(`
          SELECT count(*)::int AS bezahlte_antraege,
                 (count(*) FILTER (WHERE EXISTS (
                   SELECT 1 FROM fiaon_bank_txns t WHERE t.${refSpalte} = a.ref
                 )))::int AS mit_banktransaktion
          FROM fiaon_applications a
          WHERE a.payment_status = 'paid'`);
        tabelle([z]);
        const ohne = z.bezahlte_antraege - z.mit_banktransaktion;
        if (ohne > 0) {
          line(`  ⚠ ${ohne} Antraege stehen auf 'paid' OHNE Banktransaktion.`);
          line("    Fuer die Regel 'paid = bankbestaetigt' ist das der Graubereich —");
          line("    Bestandskunden-Ausschluss muss darauf Ruecksicht nehmen.");
        }
        report.abschnitte.zahlungswahrheit = { ...z, ohne_banktransaktion: ohne, refSpalte };
      } else {
        line("  ⚠ Keine erkennbare Referenzspalte — Verknuepfung manuell klaeren.");
      }
    }

    // ── 8) Vorhandene Aktivitaets-/Audit-Tabellen ────────────────────
    head("8) VORHANDENE AUDIT-/AKTIVITAETS-TABELLEN (Doppelbau vermeiden)");
    for (const t of ["fiaon_contact_log", "fiaon_agent_events", "fiaon_kartei_events",
      "fiaon_merge_log", "fiaon_lead_log", "fiaon_commissions"]) {
      if (!existiert(t)) { line(`  ${t}: existiert nicht`); continue; }
      const [c] = await tx.unsafe(`SELECT count(*)::int AS n FROM ${t}`);
      line(`  ${t}: ${c.n} Zeilen — Spalten: ${[...karte.get(t).keys()].join(", ")}`);
      report.abschnitte.auditTabellen ??= {};
      report.abschnitte.auditTabellen[t] = { zeilen: c.n, spalten: [...karte.get(t).keys()] };
    }

    // Kein manuelles ROLLBACK: die Transaktion ist READ ONLY, es gibt nichts
    // zu verwerfen. Ein ROLLBACK hier wuerde nur mit dem COMMIT kollidieren,
    // das sql.begin() am Ende selbst setzt.
  });

  const pfad = resolve(ROOT, "reports", `crm_audit_${new Date().toISOString().slice(0, 10)}.json`);
  mkdirSync(dirname(pfad), { recursive: true });
  writeFileSync(pfad, JSON.stringify(report, null, 2), "utf8");
  head("FERTIG");
  line(`  Report: ${pfad}`);
  line("  Es wurde ausschliesslich gelesen (SET TRANSACTION READ ONLY).");
}

main()
  .catch((err) => { console.error("\nAudit fehlgeschlagen:", err); process.exitCode = 1; })
  .finally(() => sql.end({ timeout: 5 }));
