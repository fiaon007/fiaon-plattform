// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND BETRIEB: Testkonten, Terminlauf, Marken, Team-Zentrale, Reste
//
// Was hier gehalten wird — jedes davon war einmal kaputt:
//   1. Das Team-Bild zeigt Menschen, keine Werkzeuge.
//   2. Jeder zeitgesteuerte Lauf geht durch die EINE Registratur.
//   3. Ohne Versandkanal wird nichts verbraucht — „übersprungen", nicht „weg".
//   4. Eine Erinnerung, die nicht rausging, ist nicht verbraucht.
//   5. Jede Marke zählt EXAKT, was die Zielseite zeigt.
//   6. Der Weg zur Nachbuchung endet nicht im Leeren.
//   7. Kunden umhängen nimmt die PERSON mit, nicht nur die Bestellung.
//
// ALLES IN EINER TRANSAKTION, DIE AM ENDE ZURÜCKGEROLLT WIRD.
//
//   npx tsx scripts/pruef-betrieb.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";

const ECHT_MAKE = process.env.MAKE_WEBHOOK_URL;
const ECHT_BREVO = process.env.BREVO_API_KEY;

import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  echteMitarbeiterSql, istTestkontoSql, nurTestkontenSql, testkontenZaehlen,
  testkontoStilllegen,
} from "../server/lib/fiaon-mitarbeiter-sicht";
import { kanalStand, versandErlaubtOderProtokoll } from "../server/lib/fiaon-versandkanal";
import { CRONS_AN, REGISTRIERT, tageslauf } from "../server/lib/fiaon-crons";
import { ZUSTELLUNG_TAGE, alleMarken } from "../server/lib/fiaon-marken";

let bestanden = 0;
let fehlgeschlagen = 0;
const fehler: string[] = [];
const log = (s = "") => console.log(s);
function ok(name: string, b: boolean, detail = ""): void {
  if (b) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; fehler.push(name); log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function gleich(name: string, ist: unknown, soll: unknown): void {
  ok(name, String(ist) === String(soll), `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 52 - t.length))}`); }
function datei(p: string): string {
  try { return readFileSync(p, "utf8"); } catch { return ""; }
}

class Zurueckrollen extends Error {}
const stempel = Date.now().toString(36).toUpperCase();

async function main(): Promise<void> {
  log("\n══ Prüfstand Betrieb ══\n");

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("1. Die Grenze um das Team-Bild");
  // ═════════════════════════════════════════════════════════════════════════
  ok("Es gibt eine Grenze für echte Mitarbeiter",
    /NOT/.test(echteMitarbeiterSql()) && /is_test_account/.test(echteMitarbeiterSql()));
  ok("… sie prüft AUCH das Namensmuster",
    /prüfstand/i.test(echteMitarbeiterSql()) && /knopf-durchgang/i.test(echteMitarbeiterSql()));
  ok("… und die Umkehrung für den Filter",
    !/^NOT/.test(nurTestkontenSql()) && /is_test_account/.test(nurTestkontenSql()));
  ok("Das Tabellenkürzel ist wählbar",
    istTestkontoSql("x").includes("x.is_test_account"));
  ok("COALESCE gegen NULL — sonst fällt ein Konto mit NULL heraus",
    /COALESCE\(.*is_test_account, FALSE\)/.test(istTestkontoSql()));

  // Die Ansichten müssen sie benutzen.
  for (const [name, pfad, muster] of [
    ["Die Team-Zentrale", "server/routes/fiaon-zentralen.ts", /WHERE \$\{kontenGrenze\}/],
    ["Die Mitarbeiterliste", "server/routes/fiaon-team.ts", /WHERE \$\{sqlPool\.unsafe\(kontenGrenze\)\}/],
  ] as [string, string, RegExp][]) {
    ok(`${name} filtert Testkonten aus`, muster.test(datei(pfad)));
  }
  const zentralen = datei("server/routes/fiaon-zentralen.ts");
  ok("… und Sortieren gilt NICHT als Grenze (der Kommentar sagt es)",
    /Sortieren ist\s*\n?\s*\/\/ keine Grenze/.test(zentralen));
  const zentraleSeite = datei("client/src/pages/admin-team-zentrale.tsx");
  ok("Es gibt einen anklickbaren Filter „Testkonten“",
    /Testkonten \$\{testZahl\.test\}/.test(zentraleSeite));
  ok("… und er sagt, wie viele Menschen wirklich im Team sind",
    /im Team ·/.test(zentraleSeite) && /Testkonten ausgeblendet/.test(zentraleSeite));

  // Der ECHTE Bestand — gegen die Produktionsdaten, nur lesend.
  const zahlen = await testkontenZaehlen();
  log(`\n        (${zahlen.echt} echte, ${zahlen.test} Testkonten, ${zahlen.testAktiv} davon aktiv)`);
  gleich("Es sind genau 6 echte Menschen im Team", zahlen.echt, 6);
  const [pruef] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE active)::int AS aktiv,
           COUNT(*) FILTER (WHERE password_hash IS NOT NULL)::int AS mit_passwort
    FROM fiaon_agents
    WHERE name ILIKE '%prüfstand%' OR name ILIKE '%pruefstand%'
       OR name ILIKE '%knopf-durchgang%' OR email ILIKE '%@pruefstand%'
  `) as any[];
  gleich("Kein Prüfstands-Konto ist noch aktiv", pruef.aktiv, 0);
  gleich("… und keines hat noch ein Passwort", pruef.mit_passwort, 0);

  // Die sechs Rollen, wie der Betreiber sie vorgegeben hat.
  const SOLL: Record<string, string> = {
    Daniel: "vertriebsleiter", Florentine: "vertriebsleiter",
    Nikita: "agent", Lucas: "agent", Diana: "inkasso", "Hans-Jürgen": "inkasso",
  };
  const echte = (await sqlPool.unsafe(`
    SELECT a.id, a.name, COALESCE(a.rolle, 'agent') AS rolle, a.active
    FROM fiaon_agents a WHERE ${echteMitarbeiterSql()} ORDER BY a.id
  `)) as any[];
  for (const [vorname, rolle] of Object.entries(SOLL)) {
    const m = echte.find((a) => String(a.name).startsWith(vorname));
    ok(`${vorname}: Rolle ${rolle}`, m != null && String(m.rolle) === rolle,
      m ? `hat ${m.rolle}` : "nicht gefunden");
  }
  ok("Alle sechs sind aktiv", echte.every((a) => a.active === true));

  // Die Prüfstands-Disziplin: benutzen die Läufe die eine Funktion?
  for (const p of ["scripts/pruef-abo-browser.ts", "scripts/pruef-onboarding-browser.ts",
                   "scripts/pruef-knopf-durchgang.ts"]) {
    const q = datei(p);
    ok(`${p.replace("scripts/", "")} legt über testkontoStilllegen still`,
      /await testkontoStilllegen\(/.test(q));
    ok(`… und schreibt kein eigenes UPDATE mehr`,
      !/UPDATE fiaon_agents\s*\n?\s*SET active = FALSE/.test(q));
  }
  const agents = datei("AGENTS.md");
  ok("Die Regel steht in AGENTS.md",
    /testkontoStilllegen\(id\)/.test(agents) && /echteMitarbeiterSql\(\)/.test(agents));

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("2. EINE Registratur für alle Läufe");
  // ═════════════════════════════════════════════════════════════════════════
  gleich("Auf diesem Rechner sind Tagesläufe AUS", CRONS_AN, false);
  // Die Registratur muss auch die NICHT gestarteten kennen — sonst kann man
  // nicht nachzählen, was es überhaupt gibt.
  const vorher = REGISTRIERT.length;
  tageslauf(`pruefstand-${stempel}`, () => {}, 60_000);
  ok("Ein registrierter Lauf steht in der Liste", REGISTRIERT.length === vorher + 1);
  const letzter = REGISTRIERT[REGISTRIERT.length - 1];
  gleich("… und ist als NICHT laufend vermerkt", letzter.laeuft, false);
  ok("Der zusätzliche Schalter funktioniert", (() => {
    const n = REGISTRIERT.length;
    tageslauf(`pruefstand-auch-${stempel}`, () => {}, 60_000, { auchWenn: true });
    return REGISTRIERT.length === n + 1 && REGISTRIERT[n].laeuft === true;
  })());

  // Kein Lauf darf mehr an der Bremse vorbei.
  for (const [pfad, name] of [
    ["server/routes/fiaon-followup.ts", "Tageslauf und Termin-Erinnerungen"],
    ["server/routes/fiaon-abo.ts", "Abo-Motor"],
    ["server/routes/fiaon-leads.ts", "Lead-Nachfass und Verteilung"],
    ["server/routes/fiaon-rueckrufe.ts", "Rückruf-Eskalation"],
  ] as [string, string][]) {
    const q = datei(pfad);
    ok(`${name}: über die Registratur`, /tageslauf\(\s*\n?\s*"/.test(q) || /tageslauf\("/.test(q));
    ok(`${name}: kein nacktes setInterval mehr`,
      !/^setInterval\(/m.test(q.replace(/\/\/.*$/gm, "")),
      "ein setInterval am Zeilenanfang umgeht die Bremse");
  }
  const abo = datei("server/routes/fiaon-abo.ts");
  ok("Der Abo-Motor behält seinen lokalen Testschalter",
    /auchWenn: process\.env\.ABO_MOTOR_LOKAL === "1"/.test(abo));
  ok("… und seinen Erstlauf nach 90 Sekunden",
    /beimStartNach: 90_000/.test(abo));

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("3. Ohne Kanal wird nichts verbraucht");
  // ═════════════════════════════════════════════════════════════════════════
  // Der Prüfstand läuft hier OHNE Kanal — das ist der zu prüfende Fall.
  delete process.env.MAKE_WEBHOOK_URL;
  process.env.BREVO_API_KEY = "";
  const ohne = kanalStand();
  gleich("Ohne Zugangsdaten: kein Kanal frei", ohne.frei, false);
  ok("… und der Grund nennt beide Variablen",
    /MAKE_WEBHOOK_URL/.test(ohne.grund) && /BREVO_API_KEY/.test(ohne.grund));
  ok("… und sagt, dass nichts verbraucht wurde",
    /nichts wurde verbraucht/i.test(ohne.grund));

  process.env.MAKE_WEBHOOK_URL = "http://attrappe.pruefstand.invalid/nichts";
  const mit = kanalStand();
  gleich("Mit Make-Attrappe: Kanal frei", mit.frei, true);
  gleich("… Make erkannt", mit.make, true);
  delete process.env.MAKE_WEBHOOK_URL;

  const fq = datei("server/routes/fiaon-followup.ts");
  ok("Der Terminlauf fragt zuerst nach dem Kanal",
    /versandErlaubtOderProtokoll\("Termin-Erinnerungen"\)/.test(fq));
  ok("… und nicht mehr nur nach MAKE_WEBHOOK_URL",
    !/if \(!process\.env\.MAKE_WEBHOOK_URL\) return 0;/.test(fq));
  ok("Ein Fehlschlag nimmt die Marke ZURÜCK",
    /UPDATE fiaon_termine SET erinnert_am = NULL/.test(fq));
  ok("… aber nur für Termine in der ZUKUNFT",
    /erinnert_am = NULL[\s\S]{0,200}beginn > NOW\(\) \+ INTERVAL '30 minutes'/.test(fq));
  ok("Der Grund wird gemeldet, nicht verschluckt",
    /console\.warn\(`\[FIAON-FOLLOWUP\] Termin \$\{t\.id\}/.test(fq));

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("4. Jede Marke zählt die Zielseiten-Zahl");
  // ═════════════════════════════════════════════════════════════════════════
  const marken = await alleMarken();
  gleich("Es gibt fünf Marken", Object.keys(marken).length, 5);
  for (const [name, m] of Object.entries(marken)) {
    ok(`Marke „${name}“ hat ein Ziel`, m.ziel.startsWith("/admin/"), m.ziel);
    ok(`… und einen Klartext`, m.text.length > 10, m.text);
    ok(`… und eine Zahl (keine NaN)`, Number.isFinite(m.wert), String(m.wert));
  }

  // DIE ZÄHLPROBEN: Marke gegen die Zielseite.
  const [aufgabenSeite] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_vermerke
    WHERE art = 'aufgabe' AND status = 'offen' AND fuer_betreiber AND entfernt_am IS NULL
  `) as any[];
  gleich("Aufgaben: Marke == offene Aufgaben der Zielseite",
    marken.aufgaben.wert, Number(aufgabenSeite.n));

  const [zustellSeite] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_mail_log
    WHERE status = 'fehlgeschlagen'
      AND created_at > NOW() - (${ZUSTELLUNG_TAGE} || ' days')::interval
  `) as any[];
  gleich("Zustellung: Marke == Fehlschläge im Protokoll-Fenster",
    marken.zustellung.wert, Number(zustellSeite.n));
  gleich("… und das Fenster ist dasselbe wie im Protokoll", ZUSTELLUNG_TAGE, 14);
  const mailRouten = datei("server/routes/fiaon-mail.ts");
  ok("Das Protokoll blickt ebenfalls 14 Tage zurück",
    /tage\) \|\| 14/.test(mailRouten) || /\|\| 14/.test(mailRouten));

  const { backfillCandidates } = await import("../server/routes/fiaon-team");
  const faelle = await backfillCandidates();
  gleich("Nachbuchung: Marke == Fälle der Zielseite",
    marken.nachbuchung.wert, faelle.length);
  const markenQuelle = datei("server/lib/fiaon-marken.ts");
  ok("… und sie RUFT die Funktion der Zielseite, statt sie nachzubauen",
    /const \{ backfillCandidates \} = await import\("\.\.\/routes\/fiaon-team"\)/.test(markenQuelle));
  const hub = datei("server/routes/fiaon-admin-hub.ts");
  ok("Der Hub nimmt alle Marken aus der EINEN Quelle",
    /marken\.aufgaben\.wert/.test(hub) && /marken\.zustellung\.wert/.test(hub)
    && /marken\.nachbuchung\.wert/.test(hub));

  const [zahlungSeite] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_applications
    WHERE payment_status = 'claimed_paid' AND merged_into IS NULL
  `) as any[];
  gleich("Zahlungen: Marke == Zielseite", marken.zahlungen.wert, Number(zahlungSeite.n));

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("5. Der Weg zur Nachbuchung endet nicht im Leeren");
  // ═════════════════════════════════════════════════════════════════════════
  const app = datei("client/src/App.tsx");
  const ziel = /path="\/admin\/nachbuchung" component=\{\(\) => <Umleitung nach="([^"]+)"/.exec(app)?.[1];
  ok("Die Umleitung von /admin/nachbuchung existiert", !!ziel, String(ziel));
  const tab = /tab=([a-z]+)/.exec(ziel ?? "")?.[1];
  ok("… sie zeigt auf einen Reiter", !!tab, String(tab));
  ok(`… und den Reiter „${tab}“ gibt es`,
    new RegExp(`\\["${tab}", "`).test(zentraleSeite),
    "die Umleitung führte auf einen Reiter, den es nicht gab");
  ok("Der Reiter rendert die Nachbuch-Tafel",
    /reiter === "nachbuchung" && \(\s*\n?\s*<NachbuchenTafel/.test(zentraleSeite));
  const tafel = datei("client/src/components/admin/NachbuchenTafel.tsx");
  ok("Die Tafel bucht EINZELN", /commission-backfill\/\$\{encodeURIComponent\(k\.ref\)\}\/book/.test(tafel));
  ok("… und GESAMMELT", /commission-backfill\/book-all/.test(tafel));
  ok("… mit Zähler im Bestätigungsdialog",
    /gesammelt buchen/.test(tafel) && /klar\.length/.test(tafel));
  ok("… und unklare Beträge bleiben stehen",
    /disabled=\{!klar/.test(tafel) && /Betrag unklar/.test(tafel));
  ok("Die Zeile verschwindet ohne Neuladen",
    /setListe\(\(v\) => \(v \?\? \[\]\)\.filter\(\(x\) => x\.ref !== k\.ref\)\)/.test(tafel));
  const funktionen = datei("client/src/pages/admin-funktionen.tsx");
  ok("„/admin/funktionen“ verlinkt nicht mehr im Kreis",
    /"Provision nachbuchen"[\s\S]{0,240}?href: "\/admin\/team\?tab=nachbuchung"/.test(funktionen));
  for (const [name, pfad] of [
    ["Die Kundenakte", "client/src/pages/admin-kunde.tsx"],
    ["Die Startseite", "client/src/pages/admin-hub.tsx"],
    ["Die Auszahlungen", "client/src/pages/admin-auszahlungen.tsx"],
  ] as [string, string][]) {
    const q = datei(pfad);
    ok(`${name} zeigt direkt auf den Reiter`,
      !/["']\/admin\/nachbuchung["']/.test(q));
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("6. Die Mehrfachauswahl beim Wegräumen");
  // ═════════════════════════════════════════════════════════════════════════
  const kunden = datei("client/src/pages/agent/kunden-neu.tsx");
  ok("Es gibt Häkchen an den Buchungen", /type="checkbox" checked=\{auswahl\.has\(b\.ref\)\}/.test(kunden));
  ok("… nur an unbezahlten und nur wenn mehr als eine da ist",
    /!b\.bezahlt && !b\.erledigt && \(k\.buchungen \?\? \[\]\)\.filter\(\(x\) => !x\.erledigt\)\.length > 1/.test(kunden));
  ok("… mit einem Namen für Screenreader", /zum Wegräumen auswählen/.test(kunden));
  ok("Es gibt EINEN Sammelknopf mit Zähler",
    /Auswahl wegräumen \(\$\{auswahl\.size\}\)/.test(kunden));
  ok("… und ein Dialog mit Zahl und Summe",
    /Summe: \$\{eur\(summe\)\}/.test(kunden));
  ok("Der Reihe nach, nicht parallel — die Wand rechnet mit dem Zwischenstand",
    /for \(const ref of refs\)/.test(kunden) && /Der Reihe nach, nicht parallel/.test(kunden));
  ok("Teilerfolge werden BENANNT",
    /geblieben\.map\(\(g\) => `\$\{g\.ref\}: \$\{g\.grund\}`\)/.test(kunden));

  // ═════════════════════════════════════════════════════════════════════════
  // Ab hier gegen echte Daten — in einer Transaktion, die zurückgerollt wird.
  // ═════════════════════════════════════════════════════════════════════════
  await (await import("../server/routes/fiaon-agent")).ensureAgentTables();

  const vorZahl = (await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_agents)::int AS agenten,
           (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_mail_log)::int AS protokoll
  `)[0] as any;

  try {
    await sqlPool.begin(async (tx) => {
      gruppe("7. Kunden umhängen nimmt die PERSON mit");

      const [von] = (await tx`
        INSERT INTO fiaon_agents (name, email, rolle, active, is_test_account, created_at)
        VALUES (${`Prüf Abgang ${stempel}`}, ${`ab-${stempel}@pruefstand.test`},
                'agent', TRUE, TRUE, NOW())
        RETURNING id
      `) as any[];
      const [zu] = (await tx`
        INSERT INTO fiaon_agents (name, email, rolle, active, is_test_account, created_at)
        VALUES (${`Prüf Zugang ${stempel}`}, ${`zu-${stempel}@pruefstand.test`},
                'agent', TRUE, TRUE, NOW())
        RETURNING id
      `) as any[];
      const [person] = (await tx`
        INSERT INTO fiaon_persons (person_ref, kind, first_name, last_name, primary_email,
                                   priority_tier, assigned_agent_id, betreuung_seit,
                                   follow_up_date, created_at, updated_at)
        VALUES (${`PB-${stempel}`}, 'privat', 'Uma', 'Umhang',
                ${`uma-${stempel}@pruefstand.test`}, 1, ${von.id}, NOW(),
                (NOW() + INTERVAL '20 days')::date, NOW(), NOW())
        RETURNING id
      `) as any[];
      const ref = `FIAON-BTR${stempel}`;
      await tx`
        INSERT INTO fiaon_applications
          (ref, type, status, pack_key, pack_name, first_name, last_name, email,
           amount_due, payment_status, person_id, assigned_agent_id, created_at, updated_at)
        VALUES (${ref}, 'privat', 'submitted', 'pro', 'FIAON Pro', 'Uma', 'Umhang',
                ${`uma-${stempel}@pruefstand.test`}, 59.99, 'pending_payment',
                ${person.id}, ${von.id}, NOW(), NOW())
      `;

      // Die alte Route hängt NUR die Bestellung um — das ist der Befund.
      const alteRoute = datei("server/routes/fiaon-team.ts");
      const iAlt = alteRoute.indexOf('router.post("/admin/team/reassign"');
      const altBlock = alteRoute.slice(iAlt, iAlt + 1400);
      ok("Die alte Route fasst nur fiaon_applications an",
        /UPDATE fiaon_applications SET assigned_agent_id/.test(altBlock)
        && !/UPDATE fiaon_persons/.test(altBlock));
      ok("Die neue Route fasst BEIDE an",
        /kunden-umhaengen[\s\S]{0,2600}UPDATE fiaon_persons[\s\S]{0,900}UPDATE fiaon_applications/.test(alteRoute));

      // Jetzt der echte Umzug — direkt mit derselben Logik.
      const personen = (await tx`
        UPDATE fiaon_persons
        SET assigned_agent_id = ${zu.id}, assigned_at = NOW(),
            betreuung_seit = NOW(), follow_up_date = NULL, updated_at = NOW()
        WHERE assigned_agent_id = ${von.id} AND merged_into_person_id IS NULL
        RETURNING id
      `) as any[];
      gleich("Die Person ist umgezogen", personen.length, 1);

      // ══════════════════════════════════════════════════════════════════
      // EIN DATENBANK-TRIGGER ZIEHT DIE BESTELLUNG SCHON NACH
      //
      // ── GEFUNDEN VOM PRÜFSTAND (17.08.2026) ─────────────────────────
      // Diese Prüfung erwartete zuerst, dass der Bestellungs-UPDATE eine
      // Zeile trifft — und bekam null. Der Grund ist gut: Auf fiaon_persons
      // liegt ein Trigger „fiaon_person_owner_propagate", der die
      // Bestellungen einer Person automatisch nachzieht, sobald sich ihr
      // Betreuer ändert.
      //
      // Das heißt: Die RICHTIGE Richtung war längst gebaut (Person → Bestellung
      // wird nachgezogen), nur die FALSCHE war offen — die alte Route
      // /admin/team/reassign fasst ausschließlich die Bestellung an, und von
      // dort zieht nichts zur Person zurück.
      //
      // Die neue Route macht beides ausdrücklich. Das ist keine Verdopplung,
      // sondern ein Gürtel neben dem Hosenträger: Wer den Trigger einmal
      // löscht, hat weiterhin einen funktionierenden Umzug.
      // ══════════════════════════════════════════════════════════════════
      const [nachTrigger] = (await tx`
        SELECT assigned_agent_id FROM fiaon_applications WHERE ref = ${ref}
      `) as any[];
      gleich("Der Trigger zieht die Bestellung automatisch nach",
        nachTrigger.assigned_agent_id, zu.id);
      const bestellungen = (await tx`
        UPDATE fiaon_applications
        SET assigned_agent_id = ${zu.id}, updated_at = NOW()
        WHERE assigned_agent_id = ${von.id} AND merged_into IS NULL
        RETURNING ref
      `) as any[];
      gleich("… der ausdrückliche UPDATE findet danach nichts mehr", bestellungen.length, 0);

      const [nach] = (await tx`
        SELECT assigned_agent_id, follow_up_date, betreuung_seit
        FROM fiaon_persons WHERE id = ${person.id}
      `) as any[];
      gleich("… die Person gehört dem Neuen", nach.assigned_agent_id, zu.id);
      gleich("… die Wiedervorlage steht auf heute (NULL)", nach.follow_up_date, null);
      ok("… und die Betreuungssperre ist neu gesetzt", nach.betreuung_seit != null);
      const [nachB] = (await tx`
        SELECT assigned_agent_id FROM fiaon_applications WHERE ref = ${ref}
      `) as any[];
      gleich("… und die Bestellung auch", nachB.assigned_agent_id, zu.id);
      const [beimAlten] = (await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE assigned_agent_id = ${von.id}
      `) as any[];
      gleich("Beim Alten bleibt kein Kunde", beimAlten.n, 0);

      // ── DAS ZIEL DARF KEIN TESTKONTO SEIN ──────────────────────────────
      const teamQuelle = datei("server/routes/fiaon-team.ts");
      ok("Ein Testkonto kann kein Ziel sein",
        /kunden-umhaengen[\s\S]{0,1500}\$\{echteMitarbeiterSql\(\)\}/.test(teamQuelle));
      ok("Ohne Grund geht es nicht",
        /grund\.length < 5[\s\S]{0,200}Bitte einen Grund angeben/.test(teamQuelle));
      ok("Und alles in EINER Transaktion",
        /kunden-umhaengen[\s\S]{0,2000}sqlPool\.begin\(async \(tx\) =>/.test(teamQuelle));

      // ── DIE ABSCHLUSSFUNKTION WIRKT ───────────────────────────────────
      gruppe("8. testkontoStilllegen setzt beides");
      await testkontoStilllegen(Number(von.id), tx as any);
      const [still] = (await tx`
        SELECT active, is_test_account, password_hash, distribution_active, name
        FROM fiaon_agents WHERE id = ${von.id}
      `) as any[];
      gleich("stillgelegt", still.active, false);
      gleich("… und als Test markiert", still.is_test_account, true);
      gleich("… ohne Passwort", still.password_hash, null);
      gleich("… und aus der Verteilung", still.distribution_active, false);
      ok("… und der Name sagt es", /stillgelegt/.test(String(still.name)));
      // Zweimal aufrufen darf den Namen nicht doppelt anhängen.
      await testkontoStilllegen(Number(von.id), tx as any);
      const [zweimal] = (await tx`SELECT name FROM fiaon_agents WHERE id = ${von.id}`) as any[];
      gleich("GEGENPROBE: zweimal stilllegen hängt nichts doppelt an",
        (String(zweimal.name).match(/stillgelegt/g) ?? []).length, 1);

      // ── DER ÜBERSPRUNGEN-EINTRAG ──────────────────────────────────────
      gruppe("9. „Übersprungen“ statt „verbraucht“");
      delete process.env.MAKE_WEBHOOK_URL;
      process.env.BREVO_API_KEY = "";
      const erlaubt = await versandErlaubtOderProtokoll(`Prüflauf ${stempel}`, tx as any);
      gleich("Ohne Kanal ist der Versand NICHT erlaubt", erlaubt, false);
      const [eintrag] = (await tx`
        SELECT status, grund FROM fiaon_mail_log
        WHERE event = 'lauf_uebersprungen' AND grund LIKE ${`Prüflauf ${stempel}%`}
      `) as any[];
      ok("Es steht ein Eintrag im Protokoll", eintrag != null);
      gleich("… mit dem Status „uebersprungen“", eintrag?.status, "uebersprungen");
      ok("… und dem Grund im Klartext",
        /Kein Versandkanal eingerichtet/.test(String(eintrag?.grund)));
      // Zweiter Aufruf am selben Tag: KEINE zweite Zeile.
      await versandErlaubtOderProtokoll(`Prüflauf ${stempel}`, tx as any);
      const [zahl] = (await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_mail_log
        WHERE event = 'lauf_uebersprungen' AND grund LIKE ${`Prüflauf ${stempel}%`}
      `) as any[];
      gleich("GEGENPROBE: der zweite Lauf schreibt keine zweite Zeile", zahl.n, 1);

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("10. Zurückgerollt");
  // ═════════════════════════════════════════════════════════════════════════
  const nachZahl = (await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_agents)::int AS agenten,
           (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_mail_log)::int AS protokoll
  `)[0] as any;
  for (const f of ["agenten", "personen", "protokoll"]) {
    ok(`${f}: nichts verloren`, Number(nachZahl[f]) >= Number(vorZahl[f]),
      `vorher ${vorZahl[f]}, nachher ${nachZahl[f]}`);
  }
  const [reste] = (await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_agents WHERE email LIKE ${`%-${stempel}@pruefstand.test`})::int
         + (SELECT COUNT(*) FROM fiaon_persons WHERE person_ref = ${`PB-${stempel}`})::int
         + (SELECT COUNT(*) FROM fiaon_mail_log WHERE grund LIKE ${`Prüflauf ${stempel}%`})::int AS c
  `) as any[];
  gleich("Kein Prüfstands-Datensatz in der Produktion", reste.c, 0);

  // Die echten Zugangsdaten zurücksetzen — der Prozess läuft weiter.
  if (ECHT_MAKE) process.env.MAKE_WEBHOOK_URL = ECHT_MAKE;
  if (ECHT_BREVO) process.env.BREVO_API_KEY = ECHT_BREVO;

  log(`\n${"═".repeat(62)}`);
  log(`  ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`);
  if (fehler.length > 0) {
    log("\n  Fehlgeschlagen:");
    for (const f of fehler) log(`    · ${f}`);
  }
  log(`${"═".repeat(62)}\n`);

  await sqlPool.end();
  process.exit(fehlgeschlagen > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
