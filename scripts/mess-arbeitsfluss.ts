// ═══════════════════════════════════════════════════════════════════════════
// MESSUNG VOR DEN FIXES — die Zahlen hinter dem Teamfeedback
//
// Jede Behauptung wird GEZÄHLT, bevor etwas geändert wird. Zwei der vier
// gemeldeten Ursachen waren anders als vermutet — und eine davon ist deutlich
// schlimmer als „geht nicht".
//
// NUR LESEN. Dieses Skript schreibt nichts, ändert nichts, verschickt nichts.
//
//   npx tsx scripts/mess-arbeitsfluss.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { berlinToday } from "../server/lib/fiaon-time";

const log = (s = "") => console.log(s);
function titel(t: string): void {
  log(`\n${"═".repeat(72)}\n${t}\n${"═".repeat(72)}`);
}
function zahl(name: string, v: unknown, hinweis = ""): void {
  log(`  ${String(v).padStart(7)}  ${name}${hinweis ? `  — ${hinweis}` : ""}`);
}
const befund: Record<string, unknown> = {};

function feld(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csv(datei: string, zeilen: Record<string, unknown>[]): string {
  mkdirSync("reports", { recursive: true });
  const pfad = `reports/${datei}`;
  if (zeilen.length === 0) { writeFileSync(pfad, "keine Treffer\n", "utf8"); return pfad; }
  const kopf = Object.keys(zeilen[0]);
  writeFileSync(pfad, `${[kopf.join(";"), ...zeilen.map((z) => kopf.map((k) => feld(z[k])).join(";"))].join("\n")}\n`, "utf8");
  return pfad;
}

async function main(): Promise<void> {
  log(`\nMessung am ${berlinToday()} (Europe/Berlin) — reine Lesezugriffe.\n`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. DER TERMIN-HAKEN — und warum er den FALSCHEN Eintrag trifft");
  // Feedback: „Kundengebuchte Termine lassen sich nicht abhaken; nach dem
  // Reload sind sie wieder da."
  //
  // Vermutet war ein Statusfilter. Gemessen ist es schlimmer: Der Kalender
  // mischt ZWEI Tabellen in EINE Liste —
  //   fiaon_contact_log (eigene Rückrufe)  und  fiaon_termine (Kundentermine)
  // — und der Haken ruft immer `/agent/calendar/:id/done`, das ausschließlich
  // in `fiaon_contact_log` schreibt. Die Kennung eines Termins landet damit
  // auf einem VERLAUFSEINTRAG mit derselben Zahl.
  // ═════════════════════════════════════════════════════════════════════════
  const [ids] = (await sqlPool`
    SELECT (SELECT MIN(id) FROM fiaon_termine)::int AS t_min,
           (SELECT MAX(id) FROM fiaon_termine)::int AS t_max,
           (SELECT MIN(id) FROM fiaon_contact_log)::int AS l_min,
           (SELECT MAX(id) FROM fiaon_contact_log)::int AS l_max
  `) as any[];
  log(`  Termin-Kennungen ${ids.t_min}–${ids.t_max}, Verlaufs-Kennungen ${ids.l_min}–${ids.l_max}`);
  log("  Die Bereiche ÜBERLAPPEN — beide Tabellen zählen ab 1 hoch.\n");

  const kollision = (await sqlPool`
    SELECT t.id, t.status, t.quelle, t.beginn,
           TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS termin_kunde,
           l.ref AS verlauf_ref, l.outcome AS verlauf_ergebnis,
           l.scheduled_at AS verlauf_termin, l.done_at IS NULL AS verlauf_offen,
           TRIM(COALESCE(a.first_name,'') || ' ' || COALESCE(a.last_name,'')) AS verlauf_kunde
    FROM fiaon_termine t
    JOIN fiaon_contact_log l ON l.id = t.id
    LEFT JOIN fiaon_persons p ON p.id = t.person_id
    LEFT JOIN fiaon_applications a ON a.ref = l.ref
    WHERE t.status = 'gebucht'
    ORDER BY t.id
  `) as any[];
  const [k] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE l.done_at IS NULL AND l.voided_at IS NULL)::int AS offen
    FROM fiaon_termine t JOIN fiaon_contact_log l ON l.id = t.id
  `) as any[];
  zahl("Termine, deren Kennung auch einen Verlaufseintrag trifft", k.gesamt);
  zahl("… davon trifft sie einen OFFENEN Rückruf", k.offen,
    "ein Klick erledigt den Rückruf eines fremden Kunden");
  zahl("gebuchte Termine mit Kollision (heute klickbar)", kollision.length);
  const fremd = kollision.filter((z) =>
    String(z.termin_kunde).trim() && String(z.verlauf_kunde).trim()
    && String(z.termin_kunde).trim() !== String(z.verlauf_kunde).trim());
  zahl("… davon zeigt der Verlaufseintrag auf einen ANDEREN Menschen", fremd.length);
  log(`  CSV: ${csv("mess-termin-kollision.csv", kollision)}`);
  befund.terminKollision = { gesamt: k.gesamt, offen: k.offen, fremdePerson: fremd.length };

  // Und der zweite Grund: Abhaken verlangt status='gebucht'.
  const [st] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE status = 'gebucht')::int AS gebucht,
           COUNT(*) FILTER (WHERE status = 'verpasst')::int AS verpasst,
           COUNT(*) FILTER (WHERE status = 'abgesagt')::int AS abgesagt,
           COUNT(*) FILTER (WHERE status = 'erledigt')::int AS erledigt
    FROM fiaon_termine
  `) as any[];
  log("");
  zahl("Termine gebucht", st.gebucht);
  zahl("Termine verpasst", st.verpasst, "nicht abhakbar: die Route verlangt „gebucht\u201c");
  zahl("Termine abgesagt", st.abgesagt, "verschwinden sofort — niemand sieht die Absage");
  zahl("Termine erledigt", st.erledigt, "in der ganzen Datenbank");
  befund.terminStatus = st;

  const quellen = (await sqlPool`
    SELECT quelle, status, COUNT(*)::int AS n FROM fiaon_termine GROUP BY 1,2 ORDER BY 1,2
  `) as any[];
  log("\n  Quelle × Status:");
  for (const q of quellen) log(`    ${String(q.quelle).padEnd(20)} ${String(q.status).padEnd(10)} ${q.n}`);
  befund.terminQuellen = quellen;

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. TELEFON-ERGEBNIS ≠ LISTEN-ERGEBNIS");
  // Feedback: „‚Nicht erreicht' aus dem Panel wirkt nicht auf die Kundenliste;
  // über die Liste direkt schon."
  //
  // Vermutet war, das Panel rufe den gemeinsamen Weg nicht auf. Es RUFT ihn
  // auf (`ergebnisAnwenden`) — aber der Listenweg tut FÜNF Dinge, das Panel
  // nur eines. `ergebnisAnwenden` schreibt KEINEN Verlaufseintrag; das machen
  // die Listenrouten selbst.
  // ═════════════════════════════════════════════════════════════════════════
  const [e1] = (await sqlPool`
    SELECT COUNT(*)::int AS mit_ergebnis FROM fiaon_calls WHERE ergebnis IS NOT NULL
  `) as any[];
  const [e2] = (await sqlPool`
    SELECT COUNT(*)::int AS ohne_verlauf FROM fiaon_calls c
    WHERE c.ergebnis IS NOT NULL AND c.person_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_contact_log l
        JOIN fiaon_applications a ON a.ref = l.ref
        WHERE a.person_id = c.person_id AND l.type = 'result'
          AND l.created_at BETWEEN c.beginn - INTERVAL '5 minutes'
                               AND c.beginn + INTERVAL '2 hours')
  `) as any[];
  zahl("Anrufe mit festgehaltenem Ergebnis", e1.mit_ergebnis);
  zahl("… OHNE jeden Verlaufseintrag beim Kunden", e2.ohne_verlauf,
    "der Agent hat dokumentiert, die Akte weiß nichts davon");
  befund.panelOhneVerlauf = { mitErgebnis: e1.mit_ergebnis, ohneVerlauf: e2.ohne_verlauf };

  // Die teuersten Einzelfälle: ein Rückruf ohne Verlaufseintrag kommt NIE in
  // den Kalender und NIE in die Erinnerungsleiste. Er ist verloren.
  const verloreneRueckrufe = (await sqlPool`
    SELECT c.id, c.beginn, c.person_id, c.nummer, c.ergebnis,
           TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS name,
           ag.name AS agent
    FROM fiaon_calls c
    LEFT JOIN fiaon_persons p ON p.id = c.person_id
    LEFT JOIN fiaon_agents ag ON ag.id = c.agent_id
    WHERE c.ergebnis = 'rueckruf_termin'
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_contact_log l
        JOIN fiaon_applications a ON a.ref = l.ref
        WHERE a.person_id = c.person_id AND l.outcome = 'rueckruf_termin'
          AND l.created_at BETWEEN c.beginn - INTERVAL '5 minutes'
                               AND c.beginn + INTERVAL '2 hours')
    ORDER BY c.beginn DESC
  `) as any[];
  zahl("Rückrufe im Panel OHNE Kalendereintrag", verloreneRueckrufe.length,
    "diese Rückrufe sind verloren — sie werden nie fällig");
  log(`  CSV: ${csv("mess-verlorene-rueckrufe.csv", verloreneRueckrufe)}`);
  befund.verloreneRueckrufe = verloreneRueckrufe.length;

  // „Falsche Nummer" im Panel schickt keine Nummern-Mail (das tut nur die Liste).
  const [nf] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_calls WHERE ergebnis = 'nummer_falsch'
  `) as any[];
  zahl("„Falsche Nummer\u201c im Panel gedrückt", nf.n,
    "ohne Nummern-Korrektur-Mail, die der Listenweg verschickt");
  befund.nummerFalschPanel = nf.n;

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. „ERREICHT — SONSTIGES\u201c OHNE NOTIZ");
  // ═════════════════════════════════════════════════════════════════════════
  const [so] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE NULLIF(TRIM(COALESCE(note,'')), '') IS NULL)::int AS ohne_notiz
    FROM fiaon_contact_log WHERE outcome = 'erreicht_sonstiges'
  `) as any[];
  zahl("Ergebnis „Erreicht — Sonstiges\u201c im Verlauf", so.gesamt);
  zahl("… davon OHNE jede Notiz", so.ohne_notiz,
    "niemand weiß, was besprochen wurde");
  const [soPanel] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_calls WHERE ergebnis = 'erreicht_sonstiges'
  `) as any[];
  zahl("… und im Telefon-Panel gedrückt", soPanel.n, "dort gibt es gar kein Notizfeld");
  befund.sonstiges = { ...so, panel: soPanel.n };

  // ═════════════════════════════════════════════════════════════════════════
  titel("4. DIE ONBOARDING-PFLICHT — der Bestand (Entscheidung Teil 1.2)");
  // ═════════════════════════════════════════════════════════════════════════
  const [ob] = (await sqlPool`
    SELECT COUNT(DISTINCT a.person_id)::int AS bezahlt,
      COUNT(DISTINCT a.person_id) FILTER (WHERE EXISTS (
        SELECT 1 FROM fiaon_termine t WHERE t.person_id = a.person_id
          AND t.quelle = 'onboarding_call' AND t.status = 'erledigt'))::int AS mit_erledigtem,
      COUNT(DISTINCT a.person_id) FILTER (WHERE EXISTS (
        SELECT 1 FROM fiaon_termine t WHERE t.person_id = a.person_id
          AND t.quelle = 'onboarding_call' AND t.status = 'gebucht'))::int AS mit_gebuchtem,
      COUNT(DISTINCT a.person_id) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM fiaon_termine t WHERE t.person_id = a.person_id
          AND t.quelle = 'onboarding_call'))::int AS ganz_ohne
    FROM fiaon_applications a
    WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND a.archived_at IS NULL
      AND a.gdpr_deleted_at IS NULL AND a.person_id IS NOT NULL
      AND a.type IS DISTINCT FROM 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
  `) as any[];
  zahl("bezahlte Paketkunden (Personen)", ob.bezahlt);
  zahl("… mit ERLEDIGTEM Startgespräch", ob.mit_erledigtem);
  zahl("… mit gebuchtem Startgespräch", ob.mit_gebuchtem);
  zahl("… ganz ohne Startgespräch-Termin", ob.ganz_ohne,
    "diese würde eine harte Pflicht AUSSPERREN");
  befund.onboardingBestand = ob;
  log("");
  log(`  ENTSCHEIDUNG: Eine harte Sperre für alle würde ${ob.ganz_ohne} zahlende`);
  log("  Bestandskunden aus ihrem Portal aussperren. Deshalb: Pflicht nur für");
  log("  NEU aktivierte Kunden, Bestand bekommt Banner + Einladung. Der");
  log("  Betreiber kann die Härte pro Fall über die Akte setzen.");

  const [as1] = (await sqlPool`
    SELECT account_status, COUNT(*)::int AS n FROM fiaon_applications
    WHERE payment_status = 'paid' AND merged_into IS NULL GROUP BY 1 ORDER BY 2 DESC
  `) as any[];
  log(`\n  account_status bei bezahlten Bestellungen: ${JSON.stringify(as1)}`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("5. NUMMERN-KORREKTUR — wer wartet auf den Kunden?");
  // ═════════════════════════════════════════════════════════════════════════
  const [nu] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE updated_at IS NULL)::int AS ohne_antwort,
           COUNT(*) FILTER (WHERE updated_at IS NULL AND sent_at < NOW() - INTERVAL '7 days')::int AS ueber_7_tage
    FROM fiaon_number_update_requests
  `) as any[];
  zahl("verschickte Nummern-Anfragen", nu.gesamt);
  zahl("… ohne Antwort des Kunden", nu.ohne_antwort,
    "stehen weiter jeden Tag in der Arbeitsliste");
  zahl("… davon länger als 7 Tage", nu.ueber_7_tage);
  befund.nummernAnfragen = nu;

  // ═════════════════════════════════════════════════════════════════════════
  titel("6. DOPPELTE BUCHUNGEN — lohnt eine Mehrfachauswahl?");
  // ═════════════════════════════════════════════════════════════════════════
  const mehr = (await sqlPool`
    SELECT anzahl, COUNT(*)::int AS personen FROM (
      SELECT person_id, COUNT(*)::int AS anzahl
      FROM fiaon_applications
      WHERE merged_into IS NULL AND archived_at IS NULL AND person_id IS NOT NULL
        AND payment_status NOT IN ('paid', 'cancelled', 'refunded')
      GROUP BY person_id HAVING COUNT(*) > 1
    ) x GROUP BY anzahl ORDER BY anzahl DESC
  `) as any[];
  const gesamtPersonen = mehr.reduce((s, m) => s + Number(m.personen), 0);
  const gesamtBuchungen = mehr.reduce((s, m) => s + Number(m.personen) * Number(m.anzahl), 0);
  zahl("Personen mit mehreren offenen Buchungen", gesamtPersonen);
  zahl("… betroffene Buchungen insgesamt", gesamtBuchungen);
  log("\n  Verteilung (offene Buchungen je Person):");
  for (const m of mehr.slice(0, 8)) log(`    ${String(m.anzahl).padStart(3)} Buchungen → ${m.personen} Personen`);
  befund.doppelteBuchungen = { personen: gesamtPersonen, buchungen: gesamtBuchungen };

  // ═════════════════════════════════════════════════════════════════════════
  titel("7. RÜCKRUFE UND EINGEHENDE MAILS — das Loch");
  // ═════════════════════════════════════════════════════════════════════════
  const [mi] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE assigned_to IS NULL)::int AS ohne_zustaendigen,
           COUNT(*) FILTER (WHERE status = 'NEW')::int AS unbearbeitet
    FROM mail_inbound
  `.catch(() => [{ gesamt: 0, ohne_zustaendigen: 0, unbearbeitet: 0 }] as any)) as any[];
  zahl("eingegangene Support-Mails", mi.gesamt);
  zahl("… ohne Zuständigen", mi.ohne_zustaendigen);
  zahl("… unbearbeitet", mi.unbearbeitet);
  log("  Heute entsteht daraus KEINE Aufgabe und KEINE Frist — die Mail liegt.");
  befund.inbound = mi;

  const [rr] = (await sqlPool`
    SELECT COUNT(*)::int AS offen,
           COUNT(*) FILTER (WHERE scheduled_at < NOW())::int AS ueberfaellig,
           COUNT(*) FILTER (WHERE scheduled_at < NOW() - INTERVAL '24 hours')::int AS ueber_24h
    FROM fiaon_contact_log
    WHERE outcome = 'rueckruf_termin' AND done_at IS NULL AND voided_at IS NULL
      AND scheduled_at IS NOT NULL
  `) as any[];
  log("");
  zahl("offene Rückruf-Termine", rr.offen);
  zahl("… überfällig", rr.ueberfaellig);
  zahl("… länger als 24 Stunden überfällig", rr.ueber_24h,
    "ohne Eskalation, ohne dass es jemand erfährt");
  befund.rueckrufe = rr;

  // ═════════════════════════════════════════════════════════════════════════
  titel("BEFUND ALS JSON");
  // ═════════════════════════════════════════════════════════════════════════
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/mess-arbeitsfluss.json", `${JSON.stringify(befund, null, 2)}\n`, "utf8");
  log("  reports/mess-arbeitsfluss.json\n");

  await sqlPool.end();
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
