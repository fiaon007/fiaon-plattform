// ═══════════════════════════════════════════════════════════════════════════
// DIE RECHTE-MATRIX: WAS KANN EIN AGENT HEUTE?
//
// ── DER AUFTRAG ────────────────────────────────────────────────────────────
// Geschäftsregel des Betreibers: „JEDER Agent kann einen Kunden komplett
// anlegen und pflegen — bis zu dem Punkt, an dem der Kunde zahlen kann."
//
// Bevor Rechte geöffnet werden, muss dastehen, welche es gibt. Diese Messung
// liest die Routen aus dem Quelltext und ordnet sie ein:
//
//   · Wer darf sie aufrufen? (requireAgent / nurAdmin / Rollenprüfung)
//   · Greift der Besitzschutz? (requireEigenerKunde)
//   · Gibt es sie überhaupt?
//
// NUR LESEN — kein Netzwerk, keine Datenbankänderung.
//
//   npx tsx scripts/mess-agentenrechte.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(72)}\n${t}\n${"═".repeat(72)}`); }
const lies = (p: string) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

/** Alle Routendateien, die Kundenpflege betreffen. */
const DATEIEN = [
  // ── NEU AM 25.08.2026 ──────────────────────────────────────────────────
  // Der Vollpfleger-Bereich. Ohne diesen Eintrag zeigte die Matrix „nachher"
  // dasselbe wie „vorher" — eine Messung, die die neue Datei nicht liest,
  // beweist nichts.
  "server/routes/fiaon-agent-anlage.ts",
  "server/routes/fiaon-agent.ts",
  "server/routes/fiaon-vertrieb.ts",
  "server/routes/fiaon-kunden.ts",
  "server/routes/fiaon-antrag.ts",
  "server/routes/fiaon-admin-hub.ts",
];

interface Route {
  datei: string;
  zeile: number;
  methode: string;
  pfad: string;
  wachen: string[];
}

function routenLesen(): Route[] {
  const raus: Route[] = [];
  for (const datei of DATEIEN) {
    const quelle = lies(datei);
    const zeilen = quelle.split("\n");
    for (let i = 0; i < zeilen.length; i++) {
      const m = /^router\.(get|post|patch|put|delete)\(\s*"([^"]+)"\s*,?\s*(.*)$/.exec(zeilen[i].trim());
      if (!m) continue;
      // Die Wächter stehen zwischen Pfad und Handler — manchmal auch in der
      // nächsten Zeile. Beide lesen.
      const rest = `${m[3]} ${zeilen[i + 1] ?? ""}`;
      const wachen = [
        "requireAgent", "requireEigenerKunde", "nurAdmin", "nurLesenWand",
        "requireVertrieb", "requireLeitung", "ansichtNurLesen",
      ].filter((w) => rest.includes(w));
      raus.push({ datei, zeile: i + 1, methode: m[1].toUpperCase(), pfad: m[2], wachen });
    }
  }
  return raus;
}

async function main(): Promise<void> {
  const routen = routenLesen();

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. DIE FÄHIGKEITEN AUS DEM AUFTRAG — gibt es sie?");
  // ═════════════════════════════════════════════════════════════════════════
  const faehigkeiten: [string, RegExp][] = [
    ["Neukunde anlegen (Mitarbeiter)", /\/(agent|vertrieb)\/(kunden|customers)\/(neu|pruefen)$/],
    ["Produkt an bestehende Akte", /\/produkt$|nachbuch/i],
    ["Stammdaten ändern (Kunde)", /customers\/:ref\/stammdaten|kunden\/:ref\/stammdaten/],
    ["Termin anbieten", /termin-anbieten/],
    ["Preiskatalog lesen", /agent\/katalog/],
    ["Zahlungsdaten senden", /send-payment-email|zahlungsdaten/i],
    ["Kontaktergebnis erfassen", /contact-result/],
    ["Unbezahlte Buchung wegräumen", /(wegraeumen|storn|dismiss)/i],
  ];
  for (const [name, muster] of faehigkeiten) {
    const treffer = routen.filter((r) => muster.test(r.pfad));
    log(`\n  ── ${name} ──`);
    if (treffer.length === 0) { log("     KEINE Route gefunden"); continue; }
    for (const t of treffer.slice(0, 6)) {
      const wer = t.wachen.length ? t.wachen.join(" + ") : "OHNE Wache";
      log(`     ${t.methode.padEnd(6)} ${t.pfad.padEnd(52)} ${wer}`);
    }
    if (treffer.length > 6) log(`     … und ${treffer.length - 6} weitere`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. WELCHE ROUTEN SIND FÜR AGENTEN OFFEN?");
  // ═════════════════════════════════════════════════════════════════════════
  const agentRouten = routen.filter((r) => r.wachen.includes("requireAgent"));
  const adminRouten = routen.filter((r) => r.wachen.includes("nurAdmin"));
  const ohneWache = routen.filter((r) => r.wachen.length === 0);
  log(`  ${String(routen.length).padStart(5)}  Routen in den fünf Dateien`);
  log(`  ${String(agentRouten.length).padStart(5)}  für Agenten (requireAgent)`);
  log(`  ${String(agentRouten.filter((r) => r.wachen.includes("requireEigenerKunde")).length).padStart(5)}  … davon mit Besitzschutz`);
  log(`  ${String(adminRouten.length).padStart(5)}  nur für die Verwaltung (nurAdmin)`);
  log(`  ${String(ohneWache.length).padStart(5)}  ohne erkennbare Wache (meist öffentliche Antragsstrecke)`);

  // ── DIE SCHREIBENDEN ADMIN-ROUTEN ──────────────────────────────────────
  // Das sind die Kandidaten: Wenn ein Agent einen Kunden komplett pflegen soll,
  // muss er einige davon erreichen.
  log("\n  SCHREIBENDE ROUTEN, DIE HEUTE NUR DIE VERWALTUNG DARF:");
  const schreibend = adminRouten.filter((r) => r.methode !== "GET");
  for (const r of schreibend.slice(0, 24)) {
    log(`     ${r.methode.padEnd(6)} ${r.pfad}`);
  }
  if (schreibend.length > 24) log(`     … und ${schreibend.length - 24} weitere`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. DIE ROLLEN IM HAUS");
  // ═════════════════════════════════════════════════════════════════════════
  const rollen = (await sqlPool`
    SELECT COALESCE(rolle, '(leer)') AS rolle, COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE active)::int AS aktiv
    FROM fiaon_agents
    WHERE COALESCE(is_test_account, FALSE) = FALSE
    GROUP BY 1 ORDER BY n DESC
  `) as any[];
  for (const r of rollen) {
    log(`  ${String(r.aktiv).padStart(5)} aktiv / ${String(r.n).padStart(3)} gesamt   ${r.rolle}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("4. WAS AGENTEN HEUTE TATSÄCHLICH TUN");
  // ═════════════════════════════════════════════════════════════════════════
  // Die Rechte-Frage ist auch eine Bestandsfrage: Legen Agenten schon Kunden an?
  const [anlagen] = (await sqlPool`
    SELECT
      COUNT(*)::int AS gesamt,
      COUNT(*) FILTER (WHERE assigned_agent_id IS NOT NULL)::int AS mit_agent,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS letzte_30_tage
    FROM fiaon_applications
    WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL
      AND COALESCE(type, '') <> 'schufa'
  `) as any[];
  log(`  ${String(anlagen.gesamt).padStart(6)}  Bestellungen gesamt`);
  log(`  ${String(anlagen.mit_agent).padStart(6)}  … einem Agenten zugewiesen`);
  log(`  ${String(anlagen.letzte_30_tage).padStart(6)}  … in den letzten 30 Tagen entstanden`);

  // Und: Wie viele Kontaktversuche pro Agent? Das zeigt, wer wirklich arbeitet.
  const aktiv = (await sqlPool`
    SELECT a.name, a.rolle,
           (SELECT COUNT(*)::int FROM fiaon_contact_log c
             WHERE c.agent_id = a.id AND c.created_at > NOW() - INTERVAL '30 days') AS kontakte,
           (SELECT COUNT(*)::int FROM fiaon_applications x
             WHERE x.assigned_agent_id = a.id AND x.merged_into IS NULL) AS kunden
    FROM fiaon_agents a
    WHERE a.active AND COALESCE(a.is_test_account, FALSE) = FALSE
    ORDER BY 3 DESC
  `) as any[];
  log("\n  JE MITARBEITER (letzte 30 Tage):");
  for (const a of aktiv) {
    log(`     ${String(a.name).padEnd(24)} ${String(a.rolle).padEnd(16)} `
      + `${String(a.kontakte).padStart(5)} Kontakte · ${String(a.kunden).padStart(4)} Kunden`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("5. DIE RESTE AUS TEIL 3 — messen, was wirklich offen ist");
  // ═════════════════════════════════════════════════════════════════════════
  // (a) „Erreicht — Sonstiges" mit Pflichtnotiz: Panel ja, Liste?
  const karte = lies("client/src/components/agent/KundenKarte.tsx")
    + lies("client/src/pages/agent/kunden.tsx")
    + lies("client/src/pages/agent/crm.tsx");
  const pflichtStellen = (karte.match(/sonstiges/gi) ?? []).length;
  log(`  ${String(pflichtStellen).padStart(5)}  Stellen mit „Sonstiges“ in Kundenkarte/Liste`);
  log(`         Pflichtnotiz erkennbar: ${/notiz.*min|min.*10|mindestens 10/i.test(karte) ? "ja" : "NEIN"}`);

  // (b) Die number_update_request-Fälle
  const [nr] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt, COUNT(DISTINCT ref)::int AS bestellungen
    FROM fiaon_contact_log
    WHERE note ILIKE '%number_update%' OR type ILIKE '%number_update%'
  `.catch(() => [{ gesamt: 0, bestellungen: 0 }])) as any[];
  log(`\n  ${String(nr.gesamt).padStart(5)}  Kontakt-Log-Einträge mit „number_update“`);
  log(`  ${String(nr.bestellungen).padStart(5)}  betroffene Bestellungen`);

  // Gibt es überhaupt einen Wartezustand?
  const [spalte] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM information_schema.columns
    WHERE table_name = 'fiaon_applications' AND column_name IN ('wartet_auf', 'wartet_auf_kunde')
  `) as any[];
  log(`         Spalte für den Wartezustand vorhanden: ${Number(spalte.n) > 0 ? "ja" : "NEIN — muss angelegt werden"}`);

  // (c) Das Zustellprotokoll
  const events = lies("client/src/pages/admin-events.tsx");
  log(`\n  Zustellprotokoll:`);
  for (const [was, da] of [
    ["Zeitraum-Filter", /zeitraum|tage.*filter/i.test(events)],
    ["Event-Filter", /event.*filter|filterEvent/i.test(events)],
    ["Empfänger-Suche", /empfaenger.*such|suche.*empfaenger/i.test(events)],
    ["Zeilen aufklappbar", /aufklapp|<details/i.test(events)],
    ["Seitenweise", /seite|offset|pageSize/i.test(events)],
    ["CSV-Export", /csv/i.test(events)],
  ] as [string, boolean][]) {
    log(`         ${was.padEnd(22)} ${da ? "vorhanden" : "FEHLT"}`);
  }

  // (d) Der Team-Kalender
  const kal = lies("client/src/components/internal/team-calendar.tsx");
  log(`\n  Team-Kalender:`);
  log(`         grid-cols-7 vorhanden:      ${/grid-cols-7/.test(kal) ? "ja" : "nein"}`);
  log(`         Schmal-Fassung (md:/sm:):   ${/(md|sm):grid-cols|hidden md:grid/.test(kal) ? "ja" : "FEHLT"}`);
  log(`         Zeilen der Datei:           ${kal.split("\n").length}`);

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/mess-agentenrechte.csv",
    `datei;zeile;methode;pfad;wachen\n${routen.map((r) =>
      `${r.datei};${r.zeile};${r.methode};${r.pfad};${r.wachen.join("+") || "—"}`).join("\n")}\n`, "utf8");
  log("\n  CSV: reports/mess-agentenrechte.csv\n");
  await sqlPool.end();
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
