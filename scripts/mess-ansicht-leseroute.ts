// ═══════════════════════════════════════════════════════════════════════════
// DIE LESE-ROUTEN-MATRIX DER ALS-MITARBEITER-ANSICHT
//
// ── DIE MELDUNG (19.08.2026) ───────────────────────────────────────────────
// Der Betreiber sieht in der Ansicht ein LEERES Portal: „Verdienst konnte nicht
// geladen werden", 0,00 €, „Bankdaten fehlen" (die IBAN ist hinterlegt),
// 0 Kunden überall. Verdacht: Die Nur-Lesen-Wand oder die Ansichts-Sitzung
// blockiert auch LESE-Routen.
//
// ── WAS DIESE MESSUNG TUT ─────────────────────────────────────────────────
// Sie fragt JEDE Lese-Route des Agentenbereichs zweimal ab — einmal mit einem
// echten Mitarbeiter-Token, einmal mit einem Ansichts-Token für denselben
// Menschen — und stellt die Antworten nebeneinander. Nur so lässt sich
// „die Ansicht ist kaputt" von „dieser Mitarbeiter hat wirklich keine Kunden"
// unterscheiden. Ohne die Gegenprobe hätte man beides verwechselt.
//
// ── WARUM SIE NICHTS SCHREIBT ─────────────────────────────────────────────
// Nur GET. Es entsteht kein Vorgang, keine Mail, kein Anruf. Das Ansichts-Token
// wird lokal signiert (`ansichtTokenBauen`) — es gibt keine Anmeldung als
// Mensch und keinen Klick in der Produktion.
//
//   npx tsx scripts/mess-ansicht-leseroute.ts [PORT]
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { ansichtTokenBauen, ANSICHT_COOKIE } from "../server/lib/fiaon-ansicht";

const PORT = process.argv[2] || process.env.PORT || "5188";
const BASIS = `http://127.0.0.1:${PORT}/api/fiaon`;

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(78)}\n${t}\n${"═".repeat(78)}`); }

/** Die Lese-Routen, die das Agenten-Portal beim Öffnen wirklich abfragt. */
const LESEROUTEN: { pfad: string; wofuer: string }[] = [
  { pfad: "/agent/me", wofuer: "Wer bin ich (Kopfzeile, Rolle)" },
  { pfad: "/agent/start", wofuer: "Startseite: Verdienst, Bankdaten, Kunden" },
  { pfad: "/agent/earnings", wofuer: "Verdienst-Karte" },
  { pfad: "/agent/payouts", wofuer: "Auszahlungen + Bankdaten-Status" },
  { pfad: "/agent/kunden/liste", wofuer: "Kundenliste" },
  { pfad: "/agent/crm/kunden?limit=5", wofuer: "Arbeitsliste (Karten)" },
  { pfad: "/agent/aufgaben", wofuer: "Aufgaben" },
  { pfad: "/agent/kalender/termine", wofuer: "Kalender" },
  { pfad: "/agent/updates/stand", wofuer: "Neuigkeiten-Zähler" },
  { pfad: "/agent/leistung", wofuer: "Leistungsübersicht" },
  { pfad: "/agent/dokumente", wofuer: "Dokumente" },
  { pfad: "/agent/profil", wofuer: "Profil (IBAN maskiert)" },
  { pfad: "/agent/vertrieb/uebersicht", wofuer: "Leitung: Vertriebsbereich" },
  { pfad: "/agent/inkasso/faelle", wofuer: "Forderungen (Rolle inkasso)" },
  { pfad: "/agent/startgespraeche", wofuer: "Startgespräche (Rolle onboarding)" },
  { pfad: "/admin/academy/stand", wofuer: "Academy-Stand" },
];

interface Antwort { status: number; ok: boolean | null; laenge: number; auszug: string; }

async function hole(pfad: string, cookie: string): Promise<Antwort> {
  try {
    const r = await fetch(`${BASIS}${pfad}`, { headers: { cookie }, redirect: "manual" });
    const text = await r.text();
    let ok: boolean | null = null;
    try { ok = JSON.parse(text)?.ok ?? null; } catch { ok = null; }
    return { status: r.status, ok, laenge: text.length, auszug: text.slice(0, 160).replace(/\s+/g, " ") };
  } catch (e) {
    return { status: 0, ok: null, laenge: 0, auszug: e instanceof Error ? e.message : String(e) };
  }
}

async function main(): Promise<void> {
  mkdirSync("reports", { recursive: true });

  // ── DEN PRÜFFALL GEZIELT WÄHLEN, NICHT DEN ERSTBESTEN ───────────────────
  // AGENTS.md: „Der ungünstigste Fall, nicht der erstbeste." Gesucht ist ein
  // echter Mitarbeiter, der NACHWEISLICH Kunden, Provisionen UND eine IBAN hat.
  // Bei einem Menschen ohne Daten wäre ein leeres Portal richtig, und die
  // Messung würde nichts beweisen.
  const kandidaten = (await sqlPool`
    SELECT a.id, a.name, a.rolle, a.active,
           (a.bank_iban_masked IS NOT NULL AND a.bank_iban_masked <> '') AS hat_iban,
           (SELECT COUNT(*)::int FROM fiaon_persons p
             WHERE p.assigned_agent_id = a.id AND p.merged_into_person_id IS NULL) AS kunden,
           (SELECT COUNT(*)::int FROM fiaon_commissions c
             WHERE c.agent_id = a.id AND c.status <> 'storniert') AS provisionen
    FROM fiaon_agents a
    WHERE a.active AND NOT COALESCE(a.is_test_account, FALSE)
    ORDER BY 6 DESC, 7 DESC
  `) as any[];

  titel("0. DIE ECHTEN MITARBEITER — WER HAT ÜBERHAUPT DATEN?");
  log("");
  log("  Kennung  Name                      Rolle             IBAN  Kunden  Provisionen");
  for (const k of kandidaten) {
    log(`  ${String(k.id).padStart(7)}  ${String(k.name).slice(0, 24).padEnd(25)}`
      + ` ${String(k.rolle ?? "—").padEnd(17)} ${k.hat_iban ? " ja " : "NEIN"}`
      + ` ${String(k.kunden).padStart(7)} ${String(k.provisionen).padStart(12)}`);
  }

  const pruef = kandidaten.find((k) => k.kunden > 0 && k.provisionen > 0 && k.hat_iban)
    ?? kandidaten.find((k) => k.kunden > 0) ?? kandidaten[0];
  if (!pruef) { log("\n  Kein echter Mitarbeiter gefunden — Abbruch."); await sqlPool.end(); return; }

  log("");
  log(`  Prüffall: ${pruef.name} (Kennung ${pruef.id}, Rolle ${pruef.rolle ?? "—"})`);
  log(`            ${pruef.kunden} Kunden, ${pruef.provisionen} Provisionen,`
    + ` IBAN ${pruef.hat_iban ? "hinterlegt" : "FEHLT"}`);
  log("");
  log("  Diese Zahlen sind der Maßstab: Was die Ansicht zeigt, muss dazu passen.");

  // ── DAS ANSICHTS-TOKEN ─────────────────────────────────────────────────
  const token = ansichtTokenBauen(Number(pruef.id));
  const ansichtCookie = `${ANSICHT_COOKIE}=${token}`;

  titel("1. DIE MATRIX — JEDE LESE-ROUTE MIT ANSICHTS-TOKEN");
  log("");
  log("  Route                              Ansicht        ohne Cookie   Befund");
  log(`  ${"─".repeat(76)}`);

  const zeilen: any[] = [];
  for (const r of LESEROUTEN) {
    const mitAnsicht = await hole(r.pfad, ansichtCookie);
    const ohne = await hole(r.pfad, "");
    // Ein 401 OHNE Cookie ist richtig — die Route ist geschützt. Entscheidend
    // ist, dass sie MIT Ansichts-Token antwortet.
    const befund = mitAnsicht.status === 200 && mitAnsicht.ok !== false ? "liest"
      : mitAnsicht.status === 401 ? "401 — Ansicht wird NICHT erkannt"
      : mitAnsicht.status === 403 ? "403 — von einer Wand geblockt"
      : mitAnsicht.status === 404 ? "404 — Route gibt es nicht (oder andere Rolle)"
      : mitAnsicht.status >= 500 ? `${mitAnsicht.status} — SERVERFEHLER`
      : `${mitAnsicht.status}`;
    log(`  ${r.pfad.slice(0, 34).padEnd(35)}${String(mitAnsicht.status).padEnd(15)}`
      + `${String(ohne.status).padEnd(14)}${befund}`);
    if (mitAnsicht.status >= 400 && mitAnsicht.status !== 404) {
      log(`      ${mitAnsicht.auszug.slice(0, 140)}`);
    }
    zeilen.push({ ...r, ansicht: mitAnsicht.status, ohne: ohne.status, befund,
      auszug: mitAnsicht.auszug });
  }

  const kaputt = zeilen.filter((z) => z.ansicht === 401 || z.ansicht === 403 || z.ansicht >= 500);
  titel("2. DAS ERGEBNIS");
  log("");
  log(`  ${String(zeilen.length).padStart(4)}  Lese-Routen geprüft`);
  log(`  ${String(zeilen.filter((z) => z.ansicht === 200).length).padStart(4)}  antworten mit 200`);
  log(`  ${String(kaputt.length).padStart(4)}  antworten 401, 403 oder 5xx — die dürfen es NICHT`);
  log(`  ${String(zeilen.filter((z) => z.ansicht === 404).length).padStart(4)}  404 (Route existiert nicht oder gehört einer anderen Rolle)`);
  log("");
  for (const k of kaputt) log(`     ${String(k.ansicht)}  ${k.pfad}  (${k.wofuer})`);

  // ═══════════════════════════════════════════════════════════════════════
  titel("3. UND ZEIGT DIE ANSICHT DIE RICHTIGEN ZAHLEN?");
  // ═══════════════════════════════════════════════════════════════════════
  // Ein 200 beweist nur, dass die Route antwortet. Ob sie die Daten DIESES
  // Menschen liefert, ist die zweite Frage — und die eigentliche.
  const start = await hole("/agent/start", ansichtCookie);
  let j: any = null;
  try { j = JSON.parse(start.auszug.length < start.laenge ? "{}" : "{}"); } catch { /* egal */ }
  const voll = await fetch(`${BASIS}/agent/start`, { headers: { cookie: ansichtCookie } })
    .then((r) => r.json()).catch(() => null) as any;
  log("");
  if (!voll?.ok) {
    log(`  /agent/start antwortet nicht mit ok:true — ${start.auszug.slice(0, 150)}`);
  } else {
    const a = voll.agent ?? {};
    const v = voll.verdienst ?? {};
    log(`  Name in der Antwort:        ${a.name ?? "—"}   (erwartet: ${pruef.name})`);
    log(`  Rolle:                      ${a.rolle ?? "—"}   (erwartet: ${pruef.rolle ?? "—"})`);
    log(`  Bankdaten hinterlegt:       ${JSON.stringify(v.bankHinterlegt ?? voll.bankHinterlegt ?? null)}`
      + `   (in der Datenbank: ${pruef.hat_iban})`);
    log(`  Kunden in der Antwort:      ${JSON.stringify(voll.kunden?.gesamt ?? voll.kundenGesamt ?? null)}`
      + `   (in der Datenbank: ${pruef.kunden})`);
    log("");
    log("  Vollständige Antwort in reports/ansicht-leseroute-start.json");
    writeFileSync("reports/ansicht-leseroute-start.json", JSON.stringify(voll, null, 2), "utf8");
  }

  writeFileSync("reports/ansicht-leseroute.csv",
    "route;wofuer;status_mit_ansicht;status_ohne_cookie;befund;auszug\n"
    + zeilen.map((z) => [z.pfad, z.wofuer, z.ansicht, z.ohne, z.befund,
      `"${String(z.auszug).replace(/"/g, '""').slice(0, 200)}"`].join(";")).join("\n") + "\n",
    "utf8");
  log("");
  log("  reports/ansicht-leseroute.csv");
  log("");
  await sqlPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
