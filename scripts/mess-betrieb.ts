// ═══════════════════════════════════════════════════════════════════════════
// MESSUNG VOR DEN FIXES — Testkonten, Terminlauf, Badges, Team-Zentrale
//
// NUR LESEN. Dieses Skript schreibt nichts.
//
//   npx tsx scripts/mess-betrieb.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const log = (s = "") => console.log(s);
function titel(t: string): void {
  log(`\n${"═".repeat(72)}\n${t}\n${"═".repeat(72)}`);
}
function zahl(name: string, v: unknown, hinweis = ""): void {
  log(`  ${String(v).padStart(7)}  ${name}${hinweis ? `  — ${hinweis}` : ""}`);
}
const befund: Record<string, unknown> = {};
function datei(p: string): string {
  try { return readFileSync(p, "utf8"); } catch { return ""; }
}
function feld(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csv(name: string, zeilen: Record<string, unknown>[]): string {
  mkdirSync("reports", { recursive: true });
  const pfad = `reports/${name}`;
  if (zeilen.length === 0) { writeFileSync(pfad, "keine Treffer\n", "utf8"); return pfad; }
  const kopf = Object.keys(zeilen[0]);
  writeFileSync(pfad, `${[kopf.join(";"), ...zeilen.map((z) => kopf.map((k) => feld(z[k])).join(";"))].join("\n")}\n`, "utf8");
  return pfad;
}

async function main(): Promise<void> {
  // ═════════════════════════════════════════════════════════════════════════
  titel("1. TESTKONTEN IM TEAM-BILD");
  // Der Betreiber sieht seine sechs Menschen zwischen Prüfstands-Konten. Diese
  // Konten habe ICH angelegt — jeder Browser-Prüfstand braucht eine Anmeldung.
  // Sie sind stillgelegt, aber nicht ausgeblendet: Die Team-Ansicht filtert
  // nicht auf `is_test_account`.
  // ═════════════════════════════════════════════════════════════════════════
  const alle = (await sqlPool`
    SELECT id, name, email, rolle, active, is_test_account, created_at::date AS seit
    FROM fiaon_agents ORDER BY id
  `) as any[];
  const istTestName = (n: string) =>
    /prüfstand|pruefstand|knopf-durchgang|testkonto|^test\b|probelauf/i.test(String(n || ""));
  const test = alle.filter((a) => a.is_test_account || istTestName(a.name));
  const echt = alle.filter((a) => !(a.is_test_account || istTestName(a.name)));

  zahl("Mitarbeiter-Konten insgesamt", alle.length);
  zahl("… davon Testkonten (Marke ODER Namensmuster)", test.length);
  zahl("… davon ECHTE Menschen", echt.length);
  zahl("… Testkonten OHNE die Marke is_test_account", test.filter((a) => !a.is_test_account).length,
    "die fallen durch jeden Filter, der nur die Marke prüft");
  zahl("… Testkonten, die noch AKTIV sind", test.filter((a) => a.active).length);

  log("\n  DIE ECHTEN SECHS (Soll laut Betreiber):");
  const SOLL: Record<string, string> = {
    daniel: "vertriebsleiter", florentine: "vertriebsleiter",
    nikita: "agent", lucas: "agent",
    diana: "inkasso", "hans-jürgen": "inkasso",
  };
  const rollenPruefung: Record<string, unknown>[] = [];
  for (const a of echt) {
    const vorname = String(a.name || "").trim().split(/\s+/)[0].toLowerCase();
    const soll = SOLL[vorname];
    const ist = String(a.rolle || "agent");
    const stimmt = soll ? soll === ist : null;
    log(`    ${String(a.id).padStart(4)}  ${String(a.name).padEnd(24)} `
      + `rolle=${ist.padEnd(16)} aktiv=${a.active ? "ja " : "NEIN"} `
      + (soll ? (stimmt ? "✓ wie vorgegeben" : `✗ SOLL: ${soll}`) : "(nicht in der Sechser-Liste)"));
    rollenPruefung.push({ id: a.id, name: a.name, ist, soll: soll ?? "", stimmt: stimmt ?? "" });
  }
  const fehlend = Object.keys(SOLL).filter((v) =>
    !echt.some((a) => String(a.name || "").trim().split(/\s+/)[0].toLowerCase() === v));
  if (fehlend.length > 0) log(`\n    NICHT GEFUNDEN: ${fehlend.join(", ")}`);
  log(`\n  CSV: ${csv("mess-mitarbeiter.csv", alle.map((a) => ({ ...a, ist_test: a.is_test_account || istTestName(a.name) })))}`);

  // Zählen die Team-Abfragen die Testkonten mit?
  const zQuelle = datei("server/routes/fiaon-team.ts") + datei("server/routes/fiaon-zentrale.ts");
  const [teamZahl] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_agents WHERE active
  `) as any[];
  zahl("\n  Konten, die eine Abfrage „WHERE active“ liefert", teamZahl.n,
    "so viele Karten sieht der Betreiber ohne Filter");
  befund.testkonten = {
    gesamt: alle.length, test: test.length, echt: echt.length,
    ohneMarke: test.filter((a) => !a.is_test_account).length,
    nochAktiv: test.filter((a) => a.active).length,
    rollen: rollenPruefung, fehlend,
  };

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. DER TERMINLAUF — VERBRAUCHTE ERINNERUNGEN");
  // ═════════════════════════════════════════════════════════════════════════
  const verbraucht = (await sqlPool`
    SELECT t.id, t.beginn::text, t.status, t.erinnert_am::text, t.person_id, t.quelle,
           t.beginn > NOW() AS noch_zukunft,
           (SELECT l.status FROM fiaon_mail_log l
             WHERE l.event = 'termin_erinnerung' AND l.person_id = t.person_id
               AND l.created_at BETWEEN t.erinnert_am - INTERVAL '5 minutes'
                                    AND t.erinnert_am + INTERVAL '15 minutes'
             ORDER BY l.created_at DESC LIMIT 1) AS protokoll,
           (SELECT l.grund FROM fiaon_mail_log l
             WHERE l.event = 'termin_erinnerung' AND l.person_id = t.person_id
               AND l.created_at BETWEEN t.erinnert_am - INTERVAL '5 minutes'
                                    AND t.erinnert_am + INTERVAL '15 minutes'
             ORDER BY l.created_at DESC LIMIT 1) AS grund
    FROM fiaon_termine t
    WHERE t.erinnert_am IS NOT NULL
    ORDER BY t.beginn DESC
  `) as any[];
  const ohneErfolg = verbraucht.filter((t) => t.protokoll !== "versandt");
  const nachholbar = ohneErfolg.filter((t) => t.noch_zukunft && t.status === "gebucht");
  const vorbei = ohneErfolg.filter((t) => !t.noch_zukunft);

  zahl("Termine mit gesetztem erinnert_am", verbraucht.length);
  zahl("… davon MIT erfolgreichem Versand", verbraucht.length - ohneErfolg.length);
  zahl("… davon OHNE erfolgreichen Versand", ohneErfolg.length,
    "die Erinnerung gilt als verbraucht, der Kunde hat nichts bekommen");
  zahl("… davon Termin noch in der ZUKUNFT (nachholbar)", nachholbar.length);
  zahl("… davon Termin schon vorbei (NICHT nachsenden)", vorbei.length,
    "eine Erinnerung an einen vergangenen Termin ist peinlich");
  const gruende = new Map<string, number>();
  for (const t of ohneErfolg) {
    const g = String(t.grund || t.protokoll || "ohne Protokolleintrag");
    gruende.set(g, (gruende.get(g) ?? 0) + 1);
  }
  log("\n  Woran es lag:");
  for (const [g, n] of Array.from(gruende.entries()).sort((a, b) => b[1] - a[1])) {
    log(`    ${String(n).padStart(4)} × ${g}`);
  }
  // Wie viele der vergangenen wurden zu No-Shows?
  const [noshow] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_termine
    WHERE erinnert_am IS NOT NULL AND beginn < NOW() AND status = 'verpasst'
  `) as any[];
  zahl("\n  No-Shows unter den erinnerten Terminen", noshow.n,
    `von ${verbraucht.filter((t) => !t.noch_zukunft).length} vergangenen`);
  log(`  CSV: ${csv("mess-termin-erinnerungen.csv", ohneErfolg)}`);
  befund.terminlauf = {
    mitErinnerung: verbraucht.length, ohneErfolg: ohneErfolg.length,
    nachholbar: nachholbar.length, vorbei: vorbei.length, noShows: Number(noshow.n),
  };

  // ── DIE CODE-SEITE: WER LÄUFT AN DER BREMSE VORBEI? ────────────────────
  log("\n  ZEITGESTEUERTE LÄUFE UND DIE BREMSE:");
  const laeufe: { datei: string; was: string; bremse: string }[] = [];
  for (const [pfad, name] of [
    ["server/routes/fiaon-followup.ts", "Tageslauf, Termin-Erinnerungen, Startgespräch-Einladungen"],
    ["server/routes/fiaon-abo.ts", "Abo-Motor"],
    ["server/routes/fiaon-leads.ts", "Lead-Nachfass, Lead-Verteilung"],
    ["server/routes/fiaon-rueckrufe.ts", "Rückruf-Eskalation"],
    ["server/routes/fiaon-antrag.ts", "Zahlungserinnerungen"],
    ["server/routes/fiaon-agent.ts", "Rückruf-Erinnerungen"],
    ["server/routes/fiaon-telefonie.ts", "Aufnahmen aufräumen"],
  ] as [string, string][]) {
    const q = datei(pfad);
    const ueberRegistratur = /tageslauf\(/.test(q);
    const eigenerTakt = /setInterval\(/.test(q);
    const inlinePruefung = /if \(!CRONS_AN\) return/.test(q)
      || /CRONS_AN\s*&&/.test(q) || /process\.env\.NODE_ENV === "production"/.test(q);
    const bremse = ueberRegistratur ? "Registratur"
      : inlinePruefung ? "eigene Prüfung (nicht die Registratur)"
      : eigenerTakt ? "KEINE" : "kein Takt";
    laeufe.push({ datei: pfad.replace("server/routes/", ""), was: name, bremse });
    log(`    ${bremse === "KEINE" ? "✗" : "·"} ${pfad.replace("server/routes/", "").padEnd(24)} ${bremse.padEnd(38)} ${name}`);
  }
  befund.laeufe = laeufe;

  // Setzt der Lauf erinnert_am VOR dem Versand?
  const fq = datei("server/routes/fiaon-followup.ts");
  const iUpdate = fq.indexOf("UPDATE fiaon_termine SET erinnert_am = NOW()");
  const iVersand = fq.indexOf("versendenUndProtokollieren", iUpdate > 0 ? iUpdate : 0);
  log("");
  zahl("erinnert_am wird VOR dem Versand gesetzt",
    iUpdate > 0 && iVersand > iUpdate ? "JA" : "nein",
    "scheitert der Versand, ist die Erinnerung verbraucht");
  zahl("… und bei Fehlschlag zurückgenommen",
    /erinnert_am = NULL/.test(fq) ? "ja" : "NEIN");

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. TEAM-ZENTRALE — WAS IST ERREICHBAR?");
  // ═════════════════════════════════════════════════════════════════════════
  const zentrale = datei("client/src/pages/admin-team-zentrale.tsx");
  const app = datei("client/src/App.tsx");
  const funktionen = datei("client/src/pages/admin-funktionen.tsx");

  // Der Weg, den der Betreiber nimmt: /admin/nachbuchung.
  const umleitung = /path="\/admin\/nachbuchung" component=\{\(\) => <Umleitung nach="([^"]+)"/.exec(app);
  log(`  Umleitung /admin/nachbuchung → ${umleitung?.[1] ?? "(keine)"}`);
  const zielTab = /tab=([a-z]+)/.exec(umleitung?.[1] ?? "")?.[1];
  const tabTypen = /type TabType =([^;]+);/.exec(zentrale)?.[1] ?? "";
  const tabsDa = (tabTypen.match(/"([a-z]+)"/g) ?? []).map((s) => s.replace(/"/g, ""));
  log(`  Reiter, die es gibt: ${tabsDa.join(", ")}`);
  if (zielTab) {
    zahl(`Der Reiter „${zielTab}“ existiert`, tabsDa.includes(zielTab) ? "JA" : "NEIN",
      tabsDa.includes(zielTab) ? "" : "die Umleitung führt auf einen Reiter, den es nicht gibt");
  }
  zahl("„Provision nachbuchen“ in /admin/funktionen zeigt auf",
    /"Provision nachbuchen"[\s\S]{0,220}?href: "([^"]+)"/.exec(funktionen)?.[1] ?? "(nicht gefunden)");

  const FUNKTIONEN: [string, RegExp][] = [
    ["Nachbuchung", /commission-backfill\/\$\{encodeURIComponent\(k\.ref\)\}\/book/],
    ["Provisionssatz ändern", /provision_bp|provisionssatz|satzBp/i],
    ["Provisionen einsehen", /provisionen|provision.*liste|akte/i],
    ["Auszahlungen", /admin\/payouts|auszahlung/i],
    ["Rolle ändern", /agents\/\$\{id\}\/rolle|\/rolle`/],
    ["Passwort-Reset", /force-reset/],
    ["Deaktivieren", /\/toggle`/],
    ["Löschen", /loesch-vorschau|\/loeschen`/],
    ["Bankdaten", /\/bank`/],
    ["Verfügbarkeit", /distribution_active/],
    ["Kunden umhängen", /team\/reassign|umhaengen/i],
    ["Verträge & Dokumente", /vertrag|onboarding\/agents\/\$\{id\}\/proof|\/proof`/i],
    ["Logs / Aktivität", /team\/\$\{id\}\/logs|zentrale\/team/],
    ["Wirtschaftlichkeit", /wirtschaftlichkeit/],
    ["Als Mitarbeiter ansehen", /team\/ansicht/],
  ];
  log("\n  MITARBEITER-DETAIL — Vollständigkeitsliste aus Paket 8:");
  const befundListe: Record<string, unknown>[] = [];
  for (const [name, muster] of FUNKTIONEN) {
    const da = muster.test(zentrale);
    log(`    ${da ? "·  erreichbar " : "✗  FEHLT     "} ${name}`);
    befundListe.push({ funktion: name, stand: da ? "erreichbar" : "fehlt" });
  }
  const fehlen = befundListe.filter((b) => b.stand === "fehlt");
  zahl("\n  Fehlende Funktionen", fehlen.length);
  log(`  CSV: ${csv("mess-teamzentrale-funktionen.csv", befundListe)}`);
  befund.teamZentrale = { fehlen: fehlen.map((f) => f.funktion), umleitung: umleitung?.[1], tabsDa };

  // ═════════════════════════════════════════════════════════════════════════
  titel("4. BADGE-INVENTUR — zählt die Marke, was die Zielseite zeigt?");
  // ═════════════════════════════════════════════════════════════════════════
  const heute = "(NOW() AT TIME ZONE 'Europe/Berlin')::date";
  const [b] = (await sqlPool.unsafe(`
    SELECT
      (SELECT COUNT(*)::int FROM fiaon_applications
        WHERE payment_status = 'claimed_paid' AND merged_into IS NULL) AS zahlungen_marke,
      (SELECT COUNT(*)::int FROM fiaon_payouts WHERE status = 'angefordert') AS auszahlungen_marke,
      (SELECT COUNT(*)::int FROM fiaon_vermerke
        WHERE art = 'aufgabe' AND status = 'offen' AND fuer_betreiber AND entfernt_am IS NULL
          AND (faellig_am < ${heute} OR faellig_am = ${heute})) AS aufgaben_marke,
      (SELECT COUNT(*)::int FROM fiaon_vermerke
        WHERE art = 'aufgabe' AND status = 'offen' AND fuer_betreiber AND entfernt_am IS NULL) AS aufgaben_seite,
      (SELECT COUNT(*)::int FROM fiaon_mail_log
        WHERE status = 'fehlgeschlagen' AND (created_at AT TIME ZONE 'Europe/Berlin')::date = ${heute}) AS zustellung_marke,
      (SELECT COUNT(*)::int FROM fiaon_mail_log
        WHERE status = 'fehlgeschlagen' AND created_at > NOW() - INTERVAL '14 days') AS zustellung_seite
  `)) as any[];
  log("  Marke                     Marke  Zielseite  stimmt?");
  const zeilen: [string, number, number, string][] = [
    ["Zahlungen (claimed_paid)", Number(b.zahlungen_marke), Number(b.zahlungen_marke), "gleiche Abfrage"],
    ["Auszahlungen (angefordert)", Number(b.auszahlungen_marke), Number(b.auszahlungen_marke), "gleiche Abfrage"],
    ["Aufgaben (heute+überfällig)", Number(b.aufgaben_marke), Number(b.aufgaben_seite),
      Number(b.aufgaben_marke) === Number(b.aufgaben_seite) ? "gleich" : "ABWEICHUNG — Marke zählt nur dringende"],
    ["Zustellung (Fehler heute)", Number(b.zustellung_marke), Number(b.zustellung_seite),
      "Marke = heute, Seite = 14 Tage"],
  ];
  for (const [n, m, s, t] of zeilen) {
    log(`  ${n.padEnd(26)} ${String(m).padStart(5)} ${String(s).padStart(10)}  ${t}`);
  }
  befund.badges = zeilen.map(([n, m, s, t]) => ({ marke: n, wert: m, zielseite: s, hinweis: t }));

  // ═════════════════════════════════════════════════════════════════════════
  titel("5. RESTE — Mehrfach-Buchungen, Rechnungen, Anrufe");
  // ═════════════════════════════════════════════════════════════════════════
  const [mb] = (await sqlPool`
    SELECT COUNT(*)::int AS personen, SUM(anzahl)::int AS buchungen FROM (
      SELECT person_id, COUNT(*)::int AS anzahl FROM fiaon_applications
      WHERE merged_into IS NULL AND archived_at IS NULL AND person_id IS NOT NULL
        AND payment_status NOT IN ('paid', 'cancelled', 'refunded')
      GROUP BY person_id HAVING COUNT(*) > 1) x
  `) as any[];
  zahl("Personen mit mehreren offenen Buchungen", mb.personen);
  zahl("… betroffene Buchungen", mb.buchungen);

  const [rn] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_applications
    WHERE notiz_intern ILIKE '%Katalogpreis korrigiert%'
       OR EXISTS (SELECT 1 FROM fiaon_contact_log l WHERE l.ref = fiaon_applications.ref
                    AND l.note ILIKE '%Katalogpreis korrigiert%')
  `.catch(() => [{ n: -1 }] as any)) as any[];
  zahl("Bestellungen mit korrigiertem Preis (Spur)", rn.n);

  const [ap] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_calls
    WHERE notiz ILIKE '%Zuordnung prüfen%' OR notiz ILIKE '%zuordnung pruefen%'
  `.catch(() => [{ n: -1 }] as any)) as any[];
  zahl("Anrufe mit Marke „Zuordnung prüfen“", ap.n);
  befund.reste = { mehrfachPersonen: Number(mb.personen), mehrfachBuchungen: Number(mb.buchungen),
                   preisKorrigiert: Number(rn.n), anrufeMarkiert: Number(ap.n) };

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/mess-betrieb.json", `${JSON.stringify(befund, null, 2)}\n`, "utf8");
  log("\n  reports/mess-betrieb.json\n");
  await sqlPool.end();
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
