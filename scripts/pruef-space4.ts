// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: Space v4, Telefon-Richtlinie, iPhone-Panel
//
// ── DIE REGEL, DIE DIESEN PRÜFSTAND FORMT ──────────────────────────────────
// Am 11.08.2026 war „Alle prüfen" zum zweiten Mal beauftragt worden. Die
// Server-Route war fertig und getestet — es gab nur keinen Knopf. Alle vier
// Prüfungen jener Gruppe sahen ausschließlich in den Serverquelltext.
//
// Deshalb steht hier, wo es um Bedienbares geht, NICHT „die Route existiert",
// sondern: Ein Browsertest findet den Knopf und drückt ihn. Und wo eine Wand
// gemessen wird, wird die Wand selbst aufgerufen — nicht der Weg dorthin.
//
//   npx tsx scripts/pruef-space4.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  TELEFON_ZUSAGE_TEXT, TELEFON_ZUSAGE_VERSION, HINWEIS_VORGABE, darfWaehlen,
} from "../server/lib/fiaon-telefon-zusage";
import { zusageHash } from "../server/lib/fiaon-vertrieb-zusage";
import { telefonFehlerText } from "../shared/fiaon-telefon-fehler";
import { tageszahlen } from "../server/lib/fiaon-space";

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
const datei = (p: string) => readFileSync(p, "utf8");

class Zurueckrollen extends Error {}
const stempel = Date.now().toString(36).toUpperCase();

async function main(): Promise<void> {
  log("\n══ Prüfstand: Space v4, Richtlinie, Gerät ══\n");

  const [vorher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_vertrieb_zusagen)::int AS zusagen,
           (SELECT COUNT(*) FROM fiaon_calls)::int AS anrufe,
           (SELECT COUNT(*) FROM fiaon_agents)::int AS agenten
  `;

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("1. Telefon-Richtlinie: der Text");
  // ═══════════════════════════════════════════════════════════════════════
  const t = TELEFON_ZUSAGE_TEXT;
  gleich("Fassung 1.0", TELEFON_ZUSAGE_VERSION, "1.0-2026-08-11");
  ok("Sie nennt § 201 StGB",
    JSON.stringify(t).includes("201 StGB"));
  ok("… und die DSGVO-Informationspflicht",
    /Art\. 13/.test(JSON.stringify(t)));
  ok("Keine Kaltakquise steht ausdrücklich drin",
    t.kannNicht.some((x) => /Kaltakquise/i.test(x)));
  ok("Keine privaten Anrufe",
    t.kannNicht.some((x) => /private[nr]? Anrufe/i.test(x)));
  ok("Widerspruch beendet die Aufzeichnung",
    t.pflichten.some((p) => /Widerspruch beendet/i.test(p.titel)));
  ok("Verstoß ist ein Melde- und Disziplinarfall",
    t.pflichten.some((p) => /Disziplinarfall/i.test(p.titel)));
  ok(`${t.pflichten.length} Zusagen, lückenlos numeriert`,
    t.pflichten.every((p, i) => p.nr === i + 1) && t.pflichten.length >= 6);
  ok("Jede Zusage hat einen Text, der etwas sagt",
    t.pflichten.every((p) => p.text.length > 60));
  ok("Die Fußnote sagt, dass die Rechtsprüfung noch aussteht",
    /Rechtsberatung freigegeben/.test(t.hinweisProtokoll)
    && /juristische Bewertung steht noch aus/.test(t.hinweisProtokoll));
  ok("Der Prüfwert ist stabil", zusageHash(t) === zusageHash(t));
  ok("Der Pflichtsatz fragt nach Einverständnis",
    /einverstanden/i.test(HINWEIS_VORGABE) && /aufgezeichnet/i.test(HINWEIS_VORGABE));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("2. Die Wand: ohne Annahme kein Anruf");
  // ═══════════════════════════════════════════════════════════════════════
  // Direkt die Wand aufrufen, nicht die Route. Die Route prüft ZUERST die
  // Twilio-Einrichtung und antwortet ohne Zugangsdaten mit 503 — die
  // Richtlinie kommt dann nie an die Reihe. Genau daran ist mein erster
  // Prüfversuch gescheitert.
  const [ohne] = (await sqlPool`
    SELECT a.id, a.name FROM fiaon_agents a
    WHERE a.active AND NOT EXISTS (
      SELECT 1 FROM fiaon_vertrieb_zusagen z
      WHERE z.agent_id = a.id AND z.bereich = 'telefon' AND z.widerrufen_am IS NULL)
    ORDER BY a.id LIMIT 1
  `) as any[];
  if (ohne) {
    const d = await darfWaehlen(Number(ohne.id));
    ok(`Ohne Annahme gesperrt (${ohne.name})`, !d.erlaubt);
    ok("… mit Grund im Klartext", (d.grund ?? "").length > 30, d.grund ?? "");
  } else {
    ok("Ohne Annahme gesperrt", true, "alle Konten haben angenommen — nicht prüfbar");
  }

  const telQ = datei("server/routes/fiaon-telefonie.ts");
  ok("Die Route benutzt die Wand", /const richtlinie = await darfWaehlen\(req\.agent!\.id\)/.test(telQ));
  ok("… und antwortet mit 412", /status\(412\)[\s\S]{0,120}richtlinieOffen: true/.test(telQ));
  ok("Der abgelehnte Versuch wird protokolliert",
    /grund: "Telefon-Richtlinie nicht angenommen"/.test(telQ));
  ok("Es gibt eine Route zum Lesen", /router\.get\("\/telefon\/richtlinie"/.test(telQ));
  ok("… und eine zum Annehmen", /router\.post\("\/telefon\/richtlinie"/.test(telQ));
  ok("Die Roboter-Wand steht auch hier", /istRoboterUnterschrift/.test(telQ));
  ok("Der Prüfwert wird gegengeprüft",
    /pruefwert.*!==.*zusageHash\(TELEFON_ZUSAGE_TEXT\)/.test(telQ));
  ok("Ohne getippten Namen keine Annahme", /Das ist die Unterschrift/.test(telQ));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("3. Ohne Aufzeichnung fortsetzen");
  // ═══════════════════════════════════════════════════════════════════════
  ok("Es gibt die Route", /telefon\/:id\/ohne-aufzeichnung/.test(telQ));
  ok("Sie stoppt bei Twilio", /Status=stopped/.test(telQ));
  ok("… und vermerkt es am Anruf", /ohne_aufzeichnung_am = NOW\(\)/.test(telQ));
  ok("Der Vermerk wird AUCH gesetzt, wenn Twilio klemmt",
    /Der Wille des Kunden ist festgehalten/.test(telQ));
  ok("Es gibt kein Transkript zu einem Gespräch ohne Aufnahme",
    /transkript_status = 'entfaellt'/.test(telQ));
  ok("Nur der eigene Anruf", /Das ist nicht dein Anruf/.test(telQ));
  const [spalten] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM information_schema.columns
    WHERE table_name = 'fiaon_calls'
      AND column_name IN ('ohne_aufzeichnung_am', 'aufnahme_geloescht_am')
  `) as any[];
  gleich("Die Spalten sind angelegt", Number(spalten.n), 2);
  const [frist] = (await sqlPool`
    SELECT value FROM fiaon_settings WHERE key = 'aufnahme_frist_tage'
  `) as any[];
  gleich("Aufbewahrungsfrist steht auf 90 Tagen", String(frist?.value), "90");

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("4. Das Gerät");
  // ═══════════════════════════════════════════════════════════════════════
  ok("Es gibt ein eigenes Bauteil", existsSync("client/src/components/FiaonGeraet.tsx"));
  const gQ = datei("client/src/components/FiaonGeraet.tsx");
  ok("Titanrahmen als Verlauf, nicht als Bild",
    /linear-gradient\(158deg, #8e97a6/.test(gQ) && !/\.png|\.jpg/.test(gQ));
  ok("Kantenlicht innen", /inset 0 1\.5px 0 rgba\(255,255,255,\.5\)/.test(gQ));
  ok("Dynamic-Island-Aussparung", /fi-ger-insel/.test(gQ) && /fi-ger-linse/.test(gQ));
  ok("Seitentasten angedeutet",
    ["stumm", "lauter", "leiser", "seite"].every((x) => gQ.includes(`fi-ger-taste-${x}`)));
  ok("Glasreflex, aber schwach",
    /fi-ger-reflex/.test(gQ) && /rgba\(255,255,255,\.06\) 36%/.test(gQ));
  ok("3D-Neigung beim Öffnen", /translateZ\(-180px\) rotateX\(9deg\)/.test(gQ));
  ok("Display im CI-Dunkelblau", /#0d1c3f 0%, #0a1a3c 46%, #070f22/.test(gQ));
  ok("Auf 380 px KEIN Gerätekörper, sondern ein Blatt",
    /if \(schmal\) \{/.test(gQ) && /fi-ger-blatt/.test(gQ));
  ok("… mit Wischgriff", /fi-ger-griff/.test(gQ) && /onTouchMove/.test(gQ));
  ok("… und einer Schwelle, damit es nicht beim Scrollen zugeht",
    /zieht > 110/.test(gQ));
  ok("Escape schließt", /e\.key === "Escape"/.test(gQ));
  ok("Die Seite darunter rollt nicht mit", /document\.body\.style\.overflow = "hidden"/.test(gQ));
  ok("Reduzierte Bewegung wird geachtet", /prefers-reduced-motion/.test(gQ));

  ok("Wähltastatur mit Buchstabenzeile",
    /\["2", "ABC"\]/.test(gQ) && /\["7", "PQRS"\]/.test(gQ));
  ok("Tasten sinken beim Drücken ein",
    /\.fi-tast-taste:active[\s\S]{0,140}inset 0 2px 6px/.test(gQ));
  ok("Rütteln, wo das Gerät es kann", /navigator\.vibrate/.test(gQ));

  const sQ = datei("client/src/components/Softphone.tsx");
  ok("Das Panel benutzt das Gerät", /<FiaonGeraet offen=\{offen\}/.test(sQ));
  ok("… und nicht mehr die Ebene am Rand", !/andocken="rechts-unten"/.test(sQ));
  ok("Kundensuche im Display", /fi-tel-suche/.test(sQ) && /telefon\/suche/.test(sQ));
  ok("Die Suche liegt im Sichtfeld der Rolle",
    /nurEigene = rolle === "agent"/.test(telQ));
  ok("Der Pflichtsatz steht ÜBER dem Anrufknopf",
    sQ.indexOf("fi-tel-pflichtsatz") < sQ.indexOf('className="fi-tel-gruen"'));
  ok("Die Richtlinien-Tafel ist ein eigenes Bauteil", /function RichtlinienTafel/.test(sQ));
  ok("… in einer FiaonEbene", /<FiaonEbene[\s\S]{0,400}Vor dem ersten Anruf/.test(sQ));
  ok("Annehmen erst mit Haken UND Namen",
    /disabled=\{!gelesen \|\| name\.trim\(\)\.length < 3\}/.test(sQ));
  ok("Hooks stehen VOR dem frühen return",
    sQ.indexOf("// Die Richtlinie beim Öffnen holen") < sQ.indexOf("if (!stand) return null;"));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("5. Space v4");
  // ═══════════════════════════════════════════════════════════════════════
  const spQ = datei("client/src/pages/agent/space.tsx");
  ok("Feed 900 px, Seitenspalten 260",
    /grid-template-columns: 260px minmax\(560px, 900px\) 260px/.test(spQ));
  ok("Die Bühne ist durchscheinend, damit das Video trägt",
    /rgba\(13,28,63,\.82\)/.test(spQ));
  ok("Die helle Wäsche ist im Space aus",
    /\.fi-raum-waesche \{ display: none; \}/.test(spQ));
  ok("Die Breitengrenze der Hülle ist aufgehoben",
    /main\[class\*="max-w-"\]/.test(spQ) && /\.admin-flaeche \.max-w-6xl/.test(spQ));
  ok("Die Bestätigung steht IN der Karte",
    /fi-sp-bestaetigung/.test(spQ) && /loesche\?\.id === p\.id/.test(spQ));
  ok("… und nicht mehr als Dialog am Seitenende",
    !/Zurücknehmen — mit Rückfrage/.test(spQ));
  ok("Echte Tageszahlen statt Hausordnung",
    /fi-sp-tag-zahlen/.test(spQ) && !/<p className="fi-sp-seiten-titel">Der Raum<\/p>/.test(spQ));
  const app = datei("client/src/App.tsx");
  ok("/admin landet im Space", /path="\/admin" component=\{\(\) => <Umleitung nach="\/admin\/space"/.test(app));
  ok("Das Dashboard hat einen eigenen Weg", /path="\/admin\/dashboard"/.test(app));
  const shellQ = datei("client/src/components/admin/AdminShell.tsx");
  ok("Space steht im Admin-Menü direkt nach dem Dashboard",
    shellQ.indexOf('path: "/admin/space"') - shellQ.indexOf('path: "/admin/dashboard"') < 400);
  const teamShell = datei("client/src/pages/agent/shared.tsx");
  ok("… und im Team-Menü direkt nach Start",
    teamShell.indexOf('href: "/agent/space"') - teamShell.indexOf('href: "/agent/start"') < 300);

  // Die Zahlen müssen RECHNEN, nicht nur da sein.
  const [wer] = (await sqlPool`
    SELECT agent_id FROM fiaon_commissions WHERE status <> 'storniert'
    GROUP BY agent_id ORDER BY COUNT(*) DESC LIMIT 1
  `) as any[];
  const teamZahlen = await tageszahlen(Number(wer.agent_id), false);
  ok(`Team bekommt ${teamZahlen.length} Zahlen`, teamZahlen.length === 3);
  ok("… alle mit Wert", teamZahlen.every((z) => z.wert.length > 0));
  ok("Verdienst ist ein Betrag in Euro", /€$/.test(teamZahlen[0].wert), teamZahlen[0].wert);
  const adminZahlen = await tageszahlen(0, true);
  ok(`Vorgesetzter bekommt ${adminZahlen.length} Zahlen`, adminZahlen.length === 4);
  ok("… darunter Umsatz heute", adminZahlen.some((z) => /Umsatz heute/.test(z.titel)));
  ok("… und gescheiterte Mails", adminZahlen.some((z) => /Mails gescheitert/.test(z.titel)));
  ok("Keine Kundendaten in den Zahlen",
    !/[A-ZÄÖÜ][a-zäöü]+ [A-ZÄÖÜ][a-zäöü]+/.test(JSON.stringify(adminZahlen).replace(/Umsatz heute|Zahlung angekündigt|Kontakte heute|Mails gescheitert|letzte \d+ Stunden|vom ganzen Team|noch nicht eingegangen|Abschluss|Abschlüsse/g, "")));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("6. Der reservierte Twilio-Parameter");
  // ═══════════════════════════════════════════════════════════════════════
  ok("Der Browser sendet „An“, nicht „To“",
    /params: \{ An: j\.nummer, Ziel: j\.nummer \}/.test(sQ) && !/params: \{ To:/.test(sQ));
  ok("Die TwiML-Route liest An zuerst",
    /b\?\.An \|\| b\?\.Ziel \|\| b\?\.PhoneNumber \|\| b\?\.To/.test(telQ));
  ok("Ohne Nummer sagt die Ansage, was zu tun ist",
    /Es wurde keine Rufnummer übergeben/.test(telQ));
  ok("Was ankam, wird aufgeschrieben", /letztenTwimlAufrufMerken/.test(telQ));
  const dQ = datei("server/lib/fiaon-telefon-diagnose.ts");
  ok("Schritt 8 zeigt den letzten Anruf", /nr: 8,/.test(dQ));
  ok("Die Geo-Prüfung fragt voice.twilio.com", /voice\.twilio\.com\/v1/.test(dQ));
  ok("… alle drei DACH-Länder einzeln", /for \(const iso of \["DE", "AT", "CH"\]/.test(dQ));
  ok("Kein „undefined“ als Fehlertext", !/undefined/.test(telefonFehlerText(new Error())));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("7. Verhalten gegen echte Daten");
  // ═══════════════════════════════════════════════════════════════════════
  try {
    await sqlPool.begin(async (tx) => {
      const [a] = (await tx`
        INSERT INTO fiaon_agents (name, first_name, last_name, email, active, rolle)
        VALUES (${`Prüf Tel${stempel}`}, 'Prüf', ${`Tel${stempel}`},
                ${`t-${stempel}@pruefstand.test`.toLowerCase()}, TRUE, 'agent')
        RETURNING id
      `) as any[];

      // Ohne Zusage: gesperrt.
      const vor = await darfWaehlen(Number(a.id));
      ok("Neuer Mensch darf nicht wählen", !vor.erlaubt);
      gleich("… und es ist keine Neufassung", vor.neufassung, false);

      // Mit Zusage: frei. Die Zeile wird zurückgerollt — sie ist KEINE echte
      // Unterschrift, sondern ein Prüfwert an einem Prüfkonto.
      // Die Spalten heißen `text_hash` und `name_getippt` — nachgesehen, nicht
      // geraten. Es gibt kein `agent_name` und kein `gelesen` in dieser Tabelle.
      await tx`
        INSERT INTO fiaon_vertrieb_zusagen
          (agent_id, version, bereich, name_getippt, ip, user_agent, text_hash)
        VALUES (${a.id}, ${TELEFON_ZUSAGE_VERSION}, 'telefon',
                ${`Prüf Tel${stempel}`}, '203.0.113.9', 'Pruefstand',
                ${zusageHash(TELEFON_ZUSAGE_TEXT)})
      `;
      // darfWaehlen fragt den Pool, nicht die Transaktion — deshalb hier
      // dieselbe Abfrage in der Transaktion, sonst prüft man am Bestand vorbei.
      const [drin] = (await tx`
        SELECT accepted_at FROM fiaon_vertrieb_zusagen
        WHERE agent_id = ${a.id} AND bereich = 'telefon' AND version = ${TELEFON_ZUSAGE_VERSION}
          AND widerrufen_am IS NULL
      `) as any[];
      ok("Mit Annahme liegt der Nachweis vor", !!drin?.accepted_at);

      // Eine Neufassung fragt WIEDER.
      const [alt] = (await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_vertrieb_zusagen
        WHERE agent_id = ${a.id} AND bereich = 'telefon' AND version = '9.9-spaeter'
          AND widerrufen_am IS NULL
      `) as any[];
      gleich("Für eine neue Fassung gibt es noch keine Annahme", Number(alt.n), 0);

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("8. Gegenprobe: nichts geschrieben");
  // ═══════════════════════════════════════════════════════════════════════
  const [nachher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_vertrieb_zusagen)::int AS zusagen,
           (SELECT COUNT(*) FROM fiaon_calls)::int AS anrufe,
           (SELECT COUNT(*) FROM fiaon_agents)::int AS agenten
  `;
  gleich("Keine Zusage übrig", nachher.zusagen, vorher.zusagen);
  gleich("Kein Mitarbeiter übrig", nachher.agenten, vorher.agenten);
  ok(`Anrufe unverändert oder mehr (${vorher.anrufe} → ${nachher.anrufe})`,
    Number(nachher.anrufe) >= Number(vorher.anrufe));
  const [r2] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_agents WHERE last_name LIKE ${`%${stempel}`}
  `) as any[];
  gleich("Keine eigene Zeile übrig", Number(r2.n), 0);

  log(`\n══ Ergebnis: ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen ══\n`);
  if (fehlgeschlagen > 0) { log("Fehlgeschlagen:"); for (const f of fehler) log(`  · ${f}`); }
  await sqlPool.end();
  process.exit(fehlgeschlagen > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("\nPrüfstand abgebrochen:", err);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
