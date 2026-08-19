// ═══════════════════════════════════════════════════════════════════════════
// WELCHE BESTELLUNG LANDET IN DER ZAHLUNGSDATEN-MAIL?
//
// ── DIE MELDUNG (Florentine Lombardi, 19.08.2026) ──────────────────────────
// „Er wollte ein Pro-Paket. Das High End habe ich rausgenommen. Wenn ich auf
// Rechnung senden drücke, bekommt er aber eine E-Mail für das High-End-Paket."
//
// ── DER VERDACHT, DEN DIESE MESSUNG PRÜFT ─────────────────────────────────
// `zahlungsdatenSenden` (server/routes/fiaon-agent-kunden.ts) löst die
// Bestellung so auf:
//
//     WHERE person_id = … AND merged_into IS NULL
//       AND payment_status IN ('pending_payment','claimed_paid','expired')
//     ORDER BY created_at DESC LIMIT 1
//
// Es fehlt `archived_at IS NULL`. Die Abfrage 30 Zeilen darunter hat den Filter
// — diese nicht. Wer ein Paket „rausnimmt", archiviert die Bestellung; sie
// bleibt damit in dieser Auswahl. Und weil sie SPÄTER angelegt wurde als das
// Pro-Paket, gewinnt sie das `ORDER BY created_at DESC`.
//
// ── WAS DAS KOSTET ────────────────────────────────────────────────────────
// Der Kunde überweist den falschen Betrag mit dem falschen Verwendungszweck.
// Der Kontoabgleich findet ihn nicht, die Abo-Rate entsteht auf dem falschen
// Preis, die Provision ebenfalls.
//
// NUR LESEND.
//
//   npx tsx scripts/mess-falsches-paket.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(78)}\n${t}\n${"═".repeat(78)}`); }
const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const euro = (c: unknown) => `${(Number(c ?? 0) / 100).toFixed(2).replace(".", ",")} €`;

async function main(): Promise<void> {
  mkdirSync("reports", { recursive: true });

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. DIE AUFLÖSUNG, WIE SIE HEUTE IST — UND WIE SIE SEIN MÜSSTE");
  // ═════════════════════════════════════════════════════════════════════════
  // Beide Abfragen nebeneinander, über den ganzen Bestand. Wo sie
  // auseinandergehen, bekommt der Kunde die falsche Mail.
  const abweichend = (await sqlPool`
    WITH heute AS (
      -- Die Auswahl, die „zahlungsdatenSenden“ heute trifft: OHNE Archiv-Filter.
      SELECT DISTINCT ON (a.person_id) a.person_id, a.ref, a.pack_name,
             a.amount_due, a.payment_reference, a.archived_at, a.created_at
      FROM fiaon_applications a
      WHERE a.person_id IS NOT NULL AND a.merged_into IS NULL
        AND a.payment_status IN ('pending_payment', 'claimed_paid', 'expired')
      ORDER BY a.person_id, a.created_at DESC
    ),
    richtig AS (
      -- Dieselbe Auswahl MIT Archiv-Filter.
      SELECT DISTINCT ON (a.person_id) a.person_id, a.ref, a.pack_name,
             a.amount_due, a.payment_reference, a.created_at
      FROM fiaon_applications a
      WHERE a.person_id IS NOT NULL AND a.merged_into IS NULL
        AND a.archived_at IS NULL
        AND a.payment_status IN ('pending_payment', 'claimed_paid', 'expired')
      ORDER BY a.person_id, a.created_at DESC
    )
    SELECT h.person_id, h.ref AS ref_heute, h.pack_name AS paket_heute,
           h.amount_due AS betrag_heute, h.payment_reference AS zweck_heute,
           h.archived_at,
           r.ref AS ref_richtig, r.pack_name AS paket_richtig,
           r.amount_due AS betrag_richtig, r.payment_reference AS zweck_richtig,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.person_ref) AS name,
           ag.name AS betreuer
    FROM heute h
    LEFT JOIN richtig r ON r.person_id = h.person_id
    JOIN fiaon_persons p ON p.id = h.person_id AND p.merged_into_person_id IS NULL
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE h.archived_at IS NOT NULL
      AND p.ist_test_am IS NULL
    ORDER BY h.archived_at DESC
  `) as any[];

  log("");
  log(`  ${String(abweichend.length).padStart(5)}  Personen, bei denen die heutige Auflösung eine`);
  log("         ARCHIVIERTE Bestellung wählt");
  log("");
  if (abweichend.length === 0) {
    log("  Keine. Achtung: Das heißt NICHT, dass der Fehler nicht existiert —");
    log("  es heißt, dass gerade keine Person in diesem Zustand steht. Die");
    log("  Auflösung ist trotzdem falsch, und der nächste Pakettausch trifft sie.");
  }
  for (const a of abweichend) {
    const anders = String(a.paket_heute) !== String(a.paket_richtig ?? "")
      || Number(a.betrag_heute) !== Number(a.betrag_richtig ?? 0);
    log(`  Person ${String(a.person_id).padStart(6)}  ${String(a.name).slice(0, 26).padEnd(27)}`
      + ` ${String(a.betreuer ?? "—").slice(0, 18)}`);
    log(`      GESENDET WÜRDE:  ${String(a.paket_heute).padEnd(28)} ${euro(a.betrag_heute).padStart(11)}`
      + `  ${a.zweck_heute ?? "—"}   (archiviert ${String(a.archived_at).slice(0, 10)})`);
    log(`      RICHTIG WÄRE:    ${String(a.paket_richtig ?? "— keine lebende Bestellung —").padEnd(28)}`
      + ` ${a.betrag_richtig != null ? euro(a.betrag_richtig).padStart(11) : "".padStart(11)}`
      + `  ${a.zweck_richtig ?? "—"}`);
    if (anders) log("      → Betrag und/oder Verwendungszweck weichen ab.");
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. FLORENTINES FALL — 19.08.2026");
  // ═════════════════════════════════════════════════════════════════════════
  // Über ihr Konto und den Zeitpunkt im Protokoll. Gesucht ist eine Person, bei
  // der an diesem Tag eine Bestellung archiviert wurde.
  const [flo] = (await sqlPool`
    SELECT id, name FROM fiaon_agents WHERE name ILIKE '%florentine%' LIMIT 1
  `) as any[];
  log("");
  log(`  Agentin: ${flo ? `${flo.name} (Kennung ${flo.id})` : "nicht gefunden"}`);

  const spuren = (await sqlPool`
    SELECT a.ref, a.person_id, a.pack_name, a.amount_due, a.payment_reference,
           a.archived_at, a.created_at, a.payment_status, a.archived_reason,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.person_ref) AS name
    FROM fiaon_applications a
    JOIN fiaon_persons p ON p.id = a.person_id
    WHERE a.archived_at::date BETWEEN DATE '2026-08-18' AND DATE '2026-08-20'
      AND a.merged_into IS NULL
    ORDER BY a.archived_at DESC
    LIMIT 20
  `) as any[];
  log(`  ${spuren.length} Bestellungen wurden am 18.–20.08.2026 archiviert:`);
  for (const s of spuren) {
    log(`     ${String(s.archived_at).slice(0, 19)}  ${String(s.ref).padEnd(22)}`
      + ` ${String(s.pack_name ?? "—").slice(0, 24).padEnd(25)} ${euro(s.amount_due).padStart(11)}`
      + `  Person ${s.person_id} (${String(s.name).slice(0, 18)})`);
    if (s.archived_reason) log(`        Grund: ${String(s.archived_reason).slice(0, 90)}`);
  }

  // Und die Gegenprobe: Steht bei diesen Personen noch eine lebende Bestellung?
  for (const s of spuren.slice(0, 6)) {
    const geschwister = (await sqlPool`
      SELECT ref, pack_name, amount_due, payment_reference, payment_status,
             archived_at, created_at
      FROM fiaon_applications
      WHERE person_id = ${s.person_id} AND merged_into IS NULL
      ORDER BY created_at DESC
    `) as any[];
    if (geschwister.length < 2) continue;
    log("");
    log(`  Person ${s.person_id} (${String(s.name).slice(0, 24)}) — alle Bestellungen:`);
    for (const g of geschwister) {
      const marke = g.archived_at ? "ARCHIVIERT" : "lebend    ";
      log(`     ${marke}  ${String(g.created_at).slice(0, 19)}  ${String(g.ref).padEnd(22)}`
        + ` ${String(g.pack_name ?? "—").slice(0, 22).padEnd(23)} ${euro(g.amount_due).padStart(11)}`
        + `  ${g.payment_status}`);
    }
    // Wen würde die heutige Auflösung wählen?
    const heute = geschwister.find((g) =>
      ["pending_payment", "claimed_paid", "expired"].includes(String(g.payment_status)));
    const richtig = geschwister.find((g) => !g.archived_at
      && ["pending_payment", "claimed_paid", "expired"].includes(String(g.payment_status)));
    log(`     → heutige Auflösung wählt: ${heute?.ref ?? "—"} (${heute?.pack_name ?? "—"})`);
    log(`     → richtig wäre:            ${richtig?.ref ?? "—"} (${richtig?.pack_name ?? "—"})`);
    if (heute && richtig && heute.ref !== richtig.ref) {
      log("     ⚠ DAS IST DER FEHLER: verschiedene Bestellungen.");
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. WIE VIELE PERSONEN HABEN MEHRERE OFFENE BESTELLUNGEN?");
  // ═════════════════════════════════════════════════════════════════════════
  // Auch ohne Archiv ist „die neueste" eine stille Entscheidung. Der Agent sieht
  // nicht, dass es mehrere gibt — deshalb die Bestätigung vor dem Senden.
  const [mehrere] = (await sqlPool`
    WITH z AS (
      SELECT a.person_id, COUNT(*)::int AS n
      FROM fiaon_applications a
      JOIN fiaon_persons p ON p.id = a.person_id AND p.merged_into_person_id IS NULL
      WHERE a.merged_into IS NULL AND a.archived_at IS NULL
        AND a.payment_status IN ('pending_payment', 'claimed_paid', 'expired')
        AND p.ist_test_am IS NULL
      GROUP BY a.person_id
    )
    SELECT COUNT(*) FILTER (WHERE n > 1)::int AS mit_mehreren,
           COUNT(*)::int AS mit_offener,
           COALESCE(MAX(n), 0)::int AS hoechstens
    FROM z
  `) as any[];
  log("");
  log(`  ${String(mehrere.mit_offener).padStart(5)}  Personen mit mindestens einer offenen Bestellung`);
  log(`  ${String(mehrere.mit_mehreren).padStart(5)}  davon mit MEHR ALS EINER — bei ihnen entscheidet die Auflösung still`);
  log(`  ${String(mehrere.hoechstens).padStart(5)}  die meisten offenen Bestellungen bei einer Person`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("4. DIE VIER WEITEREN WEGE — LÖST JEDER GLEICH AUF?");
  // ═════════════════════════════════════════════════════════════════════════
  // Die Frage aus dem Auftrag (1.d), einzeln beantwortet. Grundlage ist der
  // Quelltext, nicht die Vermutung.
  const { readFileSync } = await import("node:fs");
  const lies = (p: string) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

  const wege: { name: string; datei: string; suche: RegExp; }[] = [
    { name: "Zahlungsdaten-Mail", datei: "server/routes/fiaon-agent-kunden.ts",
      suche: /payment_status IN \('pending_payment', 'claimed_paid', 'expired'\)/ },
    { name: "Rechnung-PDF", datei: "server/routes/fiaon-rechnung.ts",
      suche: /FROM fiaon_applications/ },
    { name: "Zahlungsdaten/QR (Karte)", datei: "server/routes/fiaon-agent-kunden.ts",
      suche: /payment_reference/ },
    { name: "Abo-Ratenerzeugung", datei: "server/routes/fiaon-abo.ts",
      suche: /FROM fiaon_applications/ },
  ];
  log("");
  for (const w of wege) {
    const q = lies(w.datei);
    const da = q.length > 0;
    const trifft = da && w.suche.test(q);
    const hatArchivFilter = da && /archived_at IS NULL/.test(q);
    log(`  ${w.name.padEnd(26)} ${da ? "Datei da" : "DATEI FEHLT"}`
      + `  ${trifft ? "eigene Auswahl gefunden" : "keine eigene Auswahl"}`
      + `  ${hatArchivFilter ? "kennt archived_at" : "OHNE archived_at"}`);
  }
  log("");
  log("  Die genaue Zuordnung steht im Report — hier zählt nur: Wer eine eigene");
  log("  Auswahl trifft, kann anders entscheiden als die Mail. Und genau das ist");
  log("  der Fehler, den EINE gemeinsame Funktion beseitigt.");

  // ═════════════════════════════════════════════════════════════════════════
  titel("5. WURDEN IN 14 TAGEN MAILS AUF EINE ERSETZTE BESTELLUNG VERSANDT?");
  // ═════════════════════════════════════════════════════════════════════════
  // Der Verlauf hält jeden Versand fest (`type = 'email_sent'`, mit der Referenz
  // der Bestellung). Wenn diese Referenz heute archiviert ist, ging die Mail auf
  // eine Bestellung, die es fachlich nicht mehr gibt.
  const fehlversand = (await sqlPool`
    SELECT cl.created_at, cl.ref, cl.agent_name, cl.note,
           a.pack_name, a.amount_due, a.payment_reference, a.archived_at, a.person_id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.person_ref) AS name,
           -- Was wäre richtig gewesen?
           (SELECT r.pack_name FROM fiaon_applications r
             WHERE r.person_id = a.person_id AND r.merged_into IS NULL
               AND r.archived_at IS NULL
             ORDER BY r.created_at DESC LIMIT 1) AS paket_richtig,
           (SELECT r.amount_due FROM fiaon_applications r
             WHERE r.person_id = a.person_id AND r.merged_into IS NULL
               AND r.archived_at IS NULL
             ORDER BY r.created_at DESC LIMIT 1) AS betrag_richtig
    FROM fiaon_contact_log cl
    JOIN fiaon_applications a ON a.ref = cl.ref
    JOIN fiaon_persons p ON p.id = a.person_id
    WHERE cl.type = 'email_sent'
      AND cl.created_at > NOW() - INTERVAL '14 days'
      AND a.archived_at IS NOT NULL
      -- Nur Versände, die VOR dem Archivieren nicht schon richtig waren:
      -- entscheidend ist, ob die Mail nach dem Tausch rausging.
    ORDER BY cl.created_at DESC
  `) as any[];

  log("");
  log(`  ${String(fehlversand.length).padStart(5)}  Zahlungsdaten-Mails der letzten 14 Tage auf eine`);
  log("         heute ARCHIVIERTE Bestellung");
  log("");
  const nachTausch = fehlversand.filter((f) =>
    new Date(f.created_at).getTime() > new Date(f.archived_at).getTime());
  log(`  ${String(nachTausch.length).padStart(5)}  davon NACH dem Archivieren versandt — das sind die`);
  log("         echten Fehlversände (vorher war die Bestellung noch gültig)");
  log("");
  for (const f of nachTausch) {
    log(`     ${String(f.created_at).slice(0, 19)}  ${String(f.name).slice(0, 24).padEnd(25)}`
      + ` ${String(f.ref).padEnd(22)}`);
    log(`        gesendet: ${String(f.pack_name ?? "—").padEnd(26)} ${euro(f.amount_due)}`);
    log(`        richtig:  ${String(f.paket_richtig ?? "—").padEnd(26)} ${euro(f.betrag_richtig)}`);
    log(`        durch ${f.agent_name ?? "—"}`);
  }
  if (nachTausch.length === 0) {
    log("  Keiner. Der Fehler ist im Code, hat aber in diesen 14 Tagen keine");
    log("  Mail auf eine archivierte Bestellung erzeugt — oder der Verlauf hält");
    log("  den Versand nicht unter der Referenz fest, unter der er lief.");
  }

  writeFileSync("reports/falsches-paket.csv",
    "art;person_id;name;betreuer;ref_gesendet;paket_gesendet;betrag_gesendet;zweck_gesendet;"
    + "ref_richtig;paket_richtig;betrag_richtig;zweck_richtig;archiviert_am\n"
    + abweichend.map((a) => ["auswahl_zeigt_auf_archiv", a.person_id, a.name, a.betreuer,
      a.ref_heute, a.paket_heute, a.betrag_heute, a.zweck_heute,
      a.ref_richtig, a.paket_richtig, a.betrag_richtig, a.zweck_richtig,
      a.archived_at].map(feld).join(";")).join("\n")
    + (abweichend.length && nachTausch.length ? "\n" : "")
    + nachTausch.map((f) => ["mail_nach_tausch", f.person_id, f.name, f.agent_name,
      f.ref, f.pack_name, f.amount_due, f.payment_reference,
      "", f.paket_richtig, f.betrag_richtig, "", f.archived_at].map(feld).join(";")).join("\n") + "\n",
    "utf8");
  log("");
  log("  reports/falsches-paket.csv");
  log("");
  await sqlPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
