// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: Menschen & Momentum
//
// Vier Dinge, bei denen ein Fehler unmittelbar Menschen trifft:
//   · Eine Rolle, die zu viel sieht — jemand liest Kundendaten ohne Erklärung.
//   · Ein Gate, das zu oft erscheint — ein zahlender Kunde wird belästigt.
//   · Ein Space, in dem eine Rufnummer landet — Zuständigkeitsgrenzen weg.
//   · Ein Versandknopf ohne Zustandsprüfung — eine Zahlungsaufforderung an
//     jemanden, der längst bezahlt hat.
//
// ALLES IN EINER ZURÜCKGEROLLTEN TRANSAKTION. Der Webhook zeigt auf eine
// `.invalid`-Attrappe: keine echte Mail. Keine echten Posts: Auch die
// Testbeiträge fallen mit dem Rollback weg.
//
//   npx tsx scripts/pruef-menschen.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";

const ECHTE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
process.env.MAKE_WEBHOOK_URL = "http://attrappe.pruefstand.invalid/keine-echten-mails";

import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  autoPost, feedLesen, postGedanke, pruefeBeitrag, spaceSeed, ungelesen, REAKTIONEN,
} from "../server/lib/fiaon-space";
import { GEDANKEN, gedankeFuer } from "../server/lib/fiaon-gedanken";
import {
  dauerFuer, rolleFuerQuelle, freieSlots, terminBuchen, berlinDatum, berlinZeitpunkt,
  TerminFehler,
} from "../server/lib/fiaon-termine";
import { ONBOARDING_ZUSAGE_TEXT, ONBOARDING_ZUSAGE_VERSION } from "../server/lib/fiaon-onboarding-zusage";
import { ZUSAGE_TEXT, zusageHash, zusageStand } from "../server/lib/fiaon-vertrieb-zusage";
import { TAGESLIMIT, artenFuerRolle, versandErlaubt, versandKnoepfe } from "../server/lib/fiaon-versand";
import { versendenUndProtokollieren } from "../server/lib/fiaon-mail-log";
import { CRONS_AN } from "../server/lib/fiaon-crons";

let bestanden = 0;
let fehlgeschlagen = 0;
const fehler: string[] = [];
const log = (s = "") => console.log(s);
function ok(name: string, bedingung: boolean, detail = ""): void {
  if (bedingung) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; fehler.push(name); log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function gleich(name: string, ist: unknown, soll: unknown): void {
  ok(name, Object.is(ist, soll) || String(ist) === String(soll), `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 60 - t.length))}`); }

class Zurueckrollen extends Error {}
const stempel = Date.now().toString(36).toUpperCase();
const REF = (s: string) => `FIAON-MEN${stempel}-${s}`;
const MAIL = (s: string) => `${s}-${stempel}@pruefstand-menschen.test`.toLowerCase();

async function main(): Promise<void> {
  log("\n══ Prüfstand: Menschen & Momentum ══");
  log(`   Webhook: ${process.env.MAKE_WEBHOOK_URL}`);

  const [vorher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_applications)::int AS bestellungen,
           (SELECT COUNT(*) FROM fiaon_termine)::int AS termine,
           (SELECT COUNT(*) FROM fiaon_posts)::int AS posts,
           (SELECT COUNT(*) FROM fiaon_post_reaktionen)::int AS reaktionen,
           (SELECT COUNT(*) FROM fiaon_post_kommentare)::int AS kommentare,
           (SELECT COUNT(*) FROM fiaon_mail_log)::int AS maillog,
           (SELECT COUNT(*) FROM fiaon_vertrieb_zusagen)::int AS zusagen,
           (SELECT COUNT(*) FROM fiaon_agents)::int AS agenten
  `;

  try {
    await sqlPool.begin(async (tx) => {
      const person = async (f: Record<string, unknown>): Promise<number> => {
        const [r] = await tx`
          INSERT INTO fiaon_persons ${tx({
            person_ref: `FIAON-P-MEN${stempel}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            first_name: "Prüf", last_name: `Menschen${stempel}`, priority_tier: 0,
            tier_reason: "bezahlt", ...f,
          } as any)} RETURNING id
        `;
        return Number(r.id);
      };
      const bestellung = async (f: Record<string, unknown>): Promise<string> => {
        const [r] = await tx`
          INSERT INTO fiaon_applications ${tx({
            type: "private", status: "completed", payment_status: "paid", ...f,
          } as any)} RETURNING ref
        `;
        return String(r.ref);
      };
      const agent = async (f: Record<string, unknown>): Promise<number> => {
        const [r] = await tx`
          INSERT INTO fiaon_agents ${tx({
            name: `Prüfmensch ${stempel}`, email: MAIL("a"), active: true,
            distribution_active: true, is_test_account: false, rolle: "agent", ...f,
          } as any)} RETURNING id
        `;
        return Number(r.id);
      };
      const erwarteFehler = async (fn: (sp: any) => Promise<unknown>): Promise<string> => {
        try {
          await (tx as any).savepoint(async (sp: any) => { await fn(sp); });
          return "";
        } catch (e) {
          if (e instanceof TerminFehler) return e.code;
          return `kein TerminFehler: ${(e as Error)?.message ?? e}`;
        }
      };

      // ═══════════════════════════════════════════════════════════════════
      gruppe("1. Rolle onboarding: zwei Türen, zwei Antworten");
      // ═══════════════════════════════════════════════════════════════════
      const quelleBereich = readFileSync("server/routes/fiaon-onboarding-bereich.ts", "utf8");
      ok("Ohne Rolle antwortet der Bereich mit 404 (nicht 403)",
        /nurOnboarding[\s\S]{0,400}status\(404\)/.test(quelleBereich));
      ok("… und die Rolle wird bei JEDEM Aufruf frisch gelesen",
        /SELECT rolle FROM fiaon_agents WHERE id = \$\{agentId\} AND active/.test(quelleBereich));
      ok("Mit Rolle, ohne Zusage: 403 mit Code",
        /status\(403\)[\s\S]{0,200}zusage_erforderlich/.test(quelleBereich));
      ok("Jeder Datenweg hängt hinter BEIDEN Wächtern",
        (quelleBereich.match(/nurOnboarding, nurMitZusage/g) || []).length >= 4);

      // Die Grenzen der Rolle sind keine Zusage, sondern Abwesenheit im CODE.
      // Kommentare zählen dabei nicht mit — der Kopf dieser Datei nennt die
      // verbotenen Module ausdrücklich, damit niemand sie später hinzufügt.
      // Ein erster Entwurf prüfte den Rohtext und fiel über genau diesen Satz.
      const nurCode = quelleBereich.split("\n")
        .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z)).join("\n");
      for (const verboten of ["fiaon-verbuchung", "alsBezahltBuchen", "fiaon_commissions", "commission_"]) {
        ok(`Kein Zahlungs-/Provisionsweg im Bereich: ${verboten}`, !nurCode.includes(verboten));
      }
      ok("Der Lage-Weg gibt nur eigene Gesprächspartner frei",
        /Zu diesem Kunden hast du kein Startgespräch/.test(quelleBereich));

      const onb = await agent({ email: MAIL("onb"), first_name: "Ola", rolle: "onboarding" });
      const normal = await agent({ email: MAIL("norm"), first_name: "Nils", rolle: "agent" });
      const stand = await zusageStand(onb, "onboarding", ONBOARDING_ZUSAGE_VERSION);
      ok("Frisch vergebene Rolle: Erklärung steht aus", stand.offen);
      ok("… und ist keine Neufassung", !stand.neufassung);

      await tx`
        INSERT INTO fiaon_vertrieb_zusagen (agent_id, bereich, version, text_hash, name_getippt, ip, user_agent)
        VALUES (${onb}, 'onboarding', ${ONBOARDING_ZUSAGE_VERSION}, ${zusageHash(ONBOARDING_ZUSAGE_TEXT)},
                ${`Prüfmensch ${stempel}`}, '203.0.113.9', 'Mozilla/5.0')
      `;
      // Die Prüfung läuft gegen den Pool, die Zeile steht in der Transaktion —
      // deshalb hier direkt gegen tx nachsehen.
      const [angenommen] = (await tx`
        SELECT accepted_at FROM fiaon_vertrieb_zusagen
        WHERE agent_id = ${onb} AND bereich = 'onboarding' AND widerrufen_am IS NULL
      `) as any[];
      ok("Nach der Annahme steht der Nachweis", !!angenommen);
      const [vertriebZusage] = (await tx`
        SELECT id FROM fiaon_vertrieb_zusagen WHERE agent_id = ${onb} AND bereich = 'vertrieb'
      `) as any[];
      ok("Die Onboarding-Zusage öffnet NICHT den Vertriebsbereich", !vertriebZusage);

      ok("Beide Erklärungen sind verschiedene Texte",
        zusageHash(ONBOARDING_ZUSAGE_TEXT) !== zusageHash(ZUSAGE_TEXT));
      ok("Die Onboarding-Erklärung ist kürzer (6 statt 12 Punkte)",
        ONBOARDING_ZUSAGE_TEXT.pflichten.length === 6 && ZUSAGE_TEXT.pflichten.length === 12);
      for (const wort of ["Zweckbindung", "Vertraulichkeit", "Meldepflicht"]) {
        ok(`Die Erklärung enthält „${wort}“`,
          ONBOARDING_ZUSAGE_TEXT.pflichten.some((p) => p.titel.includes(wort)));
      }
      ok("… und schließt Zahlungs- und Provisionsrechte ausdrücklich aus",
        ONBOARDING_ZUSAGE_TEXT.pflichten.some((p) => /Zahlungs- und Provisionsrechte/.test(p.titel)));
      ok("… und verbietet Finanzberatung im Wortlaut",
        ONBOARDING_ZUSAGE_TEXT.pflichten.some((p) => /berate nicht zu\s*\n?\s*Finanzen|berate nicht zu Finanzen/.test(p.text.replace(/\s+/g, " "))));

      const rollenQuelle = readFileSync("server/routes/fiaon-team.ts", "utf8");
      // Am 10.08.2026 wurde die Kette aus Einzelvergleichen durch eine Liste
      // ersetzt — mit der Rolle 'inkasso' als vierter wäre sie sonst vier
      // Zeilen lang geworden, und die fünfte hätte jemand vergessen.
      ok("Die Rolle ist in /admin/team vergebbar",
        /const ROLLEN = \["agent", "vertriebsleiter", "onboarding", "inkasso"\]/.test(rollenQuelle));
      ok("… und wird gegen die Liste geprüft", /!ROLLEN\.includes\(rolle\)/.test(rollenQuelle));
      // Seit dem 11.08.2026 mit Ausnahme: Das PRÜFKONTO des Vorgesetzten ist
      // ein echter Mensch und muss jede Rolle annehmen können, sonst lässt
      // sich keine davon prüfen. Für Attrappen bleibt die Sperre.
      ok("Eine Attrappe bekommt KEINE erhöhte Rolle",
        /vorher\.is_test_account && !vorher\.pruefkonto && rolle !== "agent"/.test(rollenQuelle));
      ok("… das Prüfkonto schon", /!vorher\.pruefkonto/.test(rollenQuelle));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("2. Startgespräch: 15 Minuten, nur Onboarding");
      // ═══════════════════════════════════════════════════════════════════
      gleich("Ein Startgespräch dauert 15 Minuten", dauerFuer("onboarding_call"), 15);
      gleich("Ein Vertriebsgespräch dauert 20", dauerFuer("nichterreicht_mail"), 20);
      gleich("Startgespräche führt die Rolle onboarding", rolleFuerQuelle("onboarding_call"), "onboarding");
      ok("Andere Gespräche binden keine Rolle", rolleFuerQuelle("nichterreicht_mail") === null);

      const kunde = await person({ first_name: "Bezahlt", primary_email: MAIL("kunde") });
      await bestellung({ ref: REF("PAID"), person_id: kunde, payment_status: "paid" });

      const start = await freieSlots(kunde, tx as any, "onboarding_call");
      ok("Es gibt Startgespräch-Slots", start.slots.length > 0, String(start.slots.length));
      const angebotene = new Set(start.slots.map((s) => s.agentId));
      ok("NUR die Onboarding-Rolle wird angeboten",
        Array.from(angebotene).every((id) => id === onb), JSON.stringify(Array.from(angebotene)));
      ok("Der normale Vertriebsmitarbeiter ist NICHT dabei", !angebotene.has(normal));
      ok("Alle Slots liegen im 15-Minuten-Raster",
        start.slots.every((s) => {
          const [h, m] = s.uhrzeit.split(":").map(Number);
          return (h * 60 + m - 9 * 60) % 15 === 0;
        }));

      const b1 = await terminBuchen(
        { personId: kunde, agentId: onb, beginn: start.slots[0].beginn, quelle: "onboarding_call" }, tx as any);
      gleich("Die Buchung trägt 15 Minuten", (await tx`SELECT dauer_min FROM fiaon_termine WHERE id = ${b1.id}`
        .then((r: any) => r[0].dauer_min)), 15);
      const doppelt = await erwarteFehler((sp) => terminBuchen(
        { personId: kunde, agentId: onb, beginn: start.slots[0].beginn, quelle: "onboarding_call" }, sp));
      gleich("Doppelbuchung unmöglich", doppelt, "belegt");

      const falscheRolle = await erwarteFehler((sp) => terminBuchen(
        { personId: kunde, agentId: normal, beginn: start.slots[3].beginn, quelle: "onboarding_call" }, sp));
      gleich("Ein Startgespräch bei einer fremden Rolle wird abgelehnt", falscheRolle, "falsche_rolle");

      // ═══════════════════════════════════════════════════════════════════
      gruppe("3. Das Gate: wer es sieht und wer nicht");
      // ═══════════════════════════════════════════════════════════════════
      const gateQuelle = readFileSync("server/routes/fiaon-startgespraech.ts", "utf8");
      ok("Nur bezahlte Kunden bekommen das Gate", /lage\.bezahlt && !lage\.termin && !lage\.erledigt/.test(gateQuelle));
      ok("„Später“ setzt den Zeitstempel nur EINMAL (COALESCE)",
        /startgespraech_spaeter_am = COALESCE\(startgespraech_spaeter_am, NOW\(\)\)/.test(gateQuelle));
      ok("Die 48-Stunden-Mail hat eine Kanalbremse", /if \(!process\.env\.MAKE_WEBHOOK_URL\) return 0;/.test(gateQuelle));
      ok("Der Verpasst-Lauf schreibt KEINEN Verlaufseintrag (interner Vorgang)",
        !/runVerpassteTermine[\s\S]{0,700}fiaon_contact_log/.test(gateQuelle));

      // Zustand messen statt Route rufen: dieselbe Bedingung, in der Transaktion.
      const gateOffen = async (pid: number) => {
        const [z] = (await tx`
          SELECT
            EXISTS (SELECT 1 FROM fiaon_applications x WHERE x.person_id = ${pid}
                      AND x.merged_into IS NULL AND x.payment_status = 'paid') AS bezahlt,
            EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = ${pid}
                      AND t.quelle = 'onboarding_call' AND t.status = 'gebucht' AND t.beginn > NOW()) AS termin,
            EXISTS (SELECT 1 FROM fiaon_termine t2 WHERE t2.person_id = ${pid}
                      AND t2.quelle = 'onboarding_call' AND t2.status = 'erledigt') AS erledigt
        `) as any[];
        return !!z.bezahlt && !z.termin && !z.erledigt;
      };
      ok("Bezahlter Kunde MIT Termin sieht das Gate nicht", !(await gateOffen(kunde)));

      const ohneTermin = await person({ first_name: "OhneTermin", primary_email: MAIL("ot") });
      await bestellung({ ref: REF("PAID2"), person_id: ohneTermin, payment_status: "paid" });
      ok("Bezahlter Kunde OHNE Termin sieht das Gate", await gateOffen(ohneTermin));

      const unbezahlt = await person({ first_name: "Unbezahlt", primary_email: MAIL("ub"), priority_tier: 2, tier_reason: "rechnung_offen" });
      await bestellung({ ref: REF("OPEN"), person_id: unbezahlt, payment_status: "pending_payment" });
      ok("Ein unbezahlter Kunde sieht es NIE", !(await gateOffen(unbezahlt)));

      const erledigtP = await person({ first_name: "Erledigt", primary_email: MAIL("erl") });
      await bestellung({ ref: REF("PAID3"), person_id: erledigtP, payment_status: "paid" });
      await tx`
        INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle)
        VALUES (${erledigtP}, ${onb}, NOW() - INTERVAL '3 days', 15, 'erledigt', 'onboarding_call')
      `;
      ok("Nach einem geführten Gespräch ist Ruhe", !(await gateOffen(erledigtP)));

      // Zeitreise über gestellte Zeitstempel, nicht über echtes Warten.
      const spaeterP = await person({ first_name: "Spaeter", primary_email: MAIL("sp") });
      await bestellung({ ref: REF("PAID4"), person_id: spaeterP, payment_status: "paid" });
      const faelligeMail = async () => {
        const r = (await tx`
          SELECT p.id FROM fiaon_persons p
          WHERE p.id = ${spaeterP}
            AND p.startgespraech_spaeter_am IS NOT NULL AND p.startgespraech_mail_am IS NULL
            AND p.startgespraech_spaeter_am < NOW() - INTERVAL '48 hours'
        `) as any[];
        return r.length;
      };
      await tx`UPDATE fiaon_persons SET startgespraech_spaeter_am = NOW() WHERE id = ${spaeterP}`;
      gleich("Direkt nach dem Überspringen: keine Mail", await faelligeMail(), 0);
      await tx`UPDATE fiaon_persons SET startgespraech_spaeter_am = NOW() - INTERVAL '47 hours' WHERE id = ${spaeterP}`;
      gleich("Nach 47 Stunden: immer noch keine", await faelligeMail(), 0);
      await tx`UPDATE fiaon_persons SET startgespraech_spaeter_am = NOW() - INTERVAL '49 hours' WHERE id = ${spaeterP}`;
      gleich("Nach 49 Stunden: fällig", await faelligeMail(), 1);
      await tx`UPDATE fiaon_persons SET startgespraech_mail_am = NOW() WHERE id = ${spaeterP}`;
      gleich("Nach dem Versand: genau einmal, nie wieder", await faelligeMail(), 0);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("4. Space: schreiben, reagieren, verwalten");
      // ═══════════════════════════════════════════════════════════════════
      // Am 11.08.2026 von vier auf ZWEI reduziert: „Daumen, Herz, Stern,
      // Blitz" klang nach Auswahl und war keine — niemand konnte sagen, wofür
      // Stern statt Herz steht, und die Zahlen verteilten sich auf vier
      // Töpfe, sodass keine aussagekräftig war.
      gleich("Zwei Marken: gefällt mir, gefällt mir nicht", REAKTIONEN.length, 2);
      ok("… und zwar genau diese",
        REAKTIONEN.includes("gut" as any) && REAKTIONEN.includes("schlecht" as any));
      const [p1] = (await tx`
        INSERT INTO fiaon_posts (autor_agent_id, autor_typ, text)
        VALUES (${normal}, 'team', ${"Heute lief das dritte Gespräch richtig gut."}) RETURNING id
      `) as any[];
      await tx`INSERT INTO fiaon_post_reaktionen (post_id, agent_id, art) VALUES (${p1.id}, ${onb}, 'daumen')`;
      await tx`INSERT INTO fiaon_post_kommentare (post_id, agent_id, text) VALUES (${p1.id}, ${onb}, ${"Stark, erzähl mal."})`;
      const feed = await feedLesen(onb, 40, tx as any);
      const meiner = feed.find((f) => f.id === Number(p1.id));
      ok("Der Beitrag steht im Feed", !!meiner);
      gleich("… mit einer Reaktion", meiner?.reaktionen.daumen, 1);
      gleich("… die als die eigene erkannt wird", meiner?.meine, "daumen");
      gleich("… und einem Kommentar", meiner?.kommentare.length, 1);

      // Eine Reaktion je Mensch und Beitrag — Wechsel ersetzt.
      await tx`
        INSERT INTO fiaon_post_reaktionen (post_id, agent_id, art) VALUES (${p1.id}, ${onb}, 'herz')
        ON CONFLICT (post_id, agent_id) DO UPDATE SET art = EXCLUDED.art
      `;
      const [zahl] = (await tx`SELECT COUNT(*)::int AS n FROM fiaon_post_reaktionen WHERE post_id = ${p1.id} AND agent_id = ${onb}`) as any[];
      gleich("Wer die Marke wechselt, hat trotzdem nur eine", Number(zahl.n), 1);

      // Soft-Delete.
      await tx`UPDATE fiaon_posts SET geloescht_at = NOW(), geloescht_von = ${onb} WHERE id = ${p1.id}`;
      ok("Ein entfernter Beitrag verschwindet aus dem Feed",
        !(await feedLesen(onb, 40, tx as any)).some((f) => f.id === Number(p1.id)));
      const [nochDa] = (await tx`SELECT id, text FROM fiaon_posts WHERE id = ${p1.id}`) as any[];
      ok("… bleibt aber gespeichert (kein Hard-Delete)", !!nochDa && !!nochDa.text);

      const spaceQuelle = readFileSync("server/routes/fiaon-space.ts", "utf8");
      ok("Anpinnen nur für die Leitung", /anpinnen[\s\S]{0,300}Nur die Vertriebsleitung/.test(spaceQuelle));
      ok("Fremde Beiträge löschen nur die Leitung", /Du kannst nur eigene Beiträge löschen/.test(spaceQuelle));
      ok("Der Feed ist für jede Rolle offen (nur requireAgent)",
        /router\.get\("\/agent\/space", requireAgent,/.test(spaceQuelle));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("5. Space: die Wand gegen Kundendaten");
      // ═══════════════════════════════════════════════════════════════════
      const blockiert: [string, string][] = [
        ["Ruf mal 0176 22910692 an", "Telefonnummer"],
        ["+49 176 22910692", "Telefonnummer"],
        ["0176/22910692", "Telefonnummer"],
        ["DE89 3704 0044 0532 0130 00", "IBAN"],
        ["DE89370400440532013000", "IBAN"],
        ["max.mustermann@gmail.com hat gefragt", "E-Mail"],
        ["Verwendungszweck FIAON-PP3APC fehlt", "Verwendungszweck"],
      ];
      for (const [text, was] of blockiert) {
        const b = pruefeBeitrag(text);
        ok(`Abgelehnt (${was}): ${text.slice(0, 30)}`, !b.erlaubt, b.grund ?? "");
        ok(`… mit Begründung im Klartext`, !!b.grund && b.grund.length > 25);
      }
      const durch = [
        "Heute lief das dritte Gespräch richtig gut.",
        "Wir haben 2026 schon 340 Abschlüsse.",
        "Treffen um 14:30, Raum 2.",
        "Der Kunde zahlt 99,99 € im Monat — das ist kein Kundendatum.",
      ];
      for (const text of durch) {
        ok(`Durchgelassen: ${text.slice(0, 34)}`, pruefeBeitrag(text).erlaubt, pruefeBeitrag(text).grund ?? "");
      }
      ok("Leerer Beitrag abgelehnt", !pruefeBeitrag("  ").erlaubt);
      ok("Überlanger Beitrag abgelehnt", !pruefeBeitrag("x".repeat(4100)).erlaubt);
      ok("Die Prüfung steht im SERVER, nicht nur am Feld",
        /pruefeBeitrag/.test(spaceQuelle));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("6. Space: Auto-Posts sind idempotent");
      // ═══════════════════════════════════════════════════════════════════
      // Am 11.08.2026 auf 180 verdoppelt: Die Content-Engine setzt mehrere
      // Beiträge täglich — mit 90 wäre der Vorrat in vier Wochen durch.
      gleich("180 Gedanken", GEDANKEN.length, 180);
      const nummern = new Set(GEDANKEN.map((g) => g.nr));
      gleich("… mit eindeutigen Nummern", nummern.size, GEDANKEN.length);
      ok("… alle mit Text", GEDANKEN.every((g) => g.text.trim().length > 25));
      // Kein Spruch zweimal binnen 90 Tagen: Die Rotation ist ein Ringpuffer.
      const drei = new Set<number>();
      for (let t = 0; t < 90; t++) {
        const d = new Date(Date.now() + t * 86_400_000).toISOString().slice(0, 10);
        drei.add(gedankeFuer(d).nr);
      }
      gleich("In 90 Tagen kommt jeder genau einmal", drei.size, 90);

      // Ein Datum in der Zukunft: Der heutige Gedanke steht im Bestand längst,
      // und ein Prüfstand, dessen Ergebnis davon abhängt, ob der Tageslauf
      // schon lief, prüft die Uhrzeit statt die Idempotenz.
      const pruefTag = berlinDatum(new Date(Date.now() + 400 * 86_400_000));
      gleich("Erster Lauf legt den Gedanken an", await postGedanke(pruefTag, tx as any), true);
      gleich("Zweiter Lauf am selben Tag: nichts", await postGedanke(pruefTag, tx as any), false);
      const [gz] = (await tx`SELECT COUNT(*)::int AS n FROM fiaon_posts WHERE auto_art = 'gedanke' AND auto_schluessel = ${pruefTag}`) as any[];
      gleich("… und es steht genau ein Post da", Number(gz.n), 1);

      gleich("Auch ein Fremdaufruf desselben Schlüssels prallt ab",
        await autoPost("gedanke", pruefTag, "etwas anderes", tx as any), false);

      const spaceLib = readFileSync("server/lib/fiaon-space.ts", "utf8");
      ok("Ein API-Ausfall erzeugt KEINEN kaputten Post",
        /catch \{\s*\n\s*\/\/ Kein Netz, kein Post\. Absichtlich still\.\s*\n\s*return false;/.test(spaceLib));
      ok("Nachrichten sind hinter einem Flag und standardmäßig aus",
        /SPACE_NEWS \|\| ""\)\.toLowerCase\(\) !== "an"/.test(spaceLib));
      ok("Updates erscheinen als Verweis, nicht als Kopie",
        /steht unter „Updates“/.test(spaceLib));

      // Der Seed ist im Bestand schon gelaufen (die drei Posts stehen dauerhaft
      // im Space). Geprüft wird deshalb das Ergebnis, nicht die Anzahl der
      // Neuanlagen: dreimal angepinnt, und ein weiterer Lauf legt nichts nach.
      await spaceSeed(tx as any);
      gleich("Ein weiterer Seed legt nichts nach", await spaceSeed(tx as any), 0);
      const [seedZahl] = (await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_posts WHERE auto_art = 'seed' AND geloescht_at IS NULL
      `) as any[];
      gleich("Genau drei Startposts, nie mehr", Number(seedZahl.n), 3);
      const angepinnt = (await feedLesen(onb, 40, tx as any)).filter((f) => f.angepinnt);
      gleich("Drei angepinnte Beiträge stehen oben", angepinnt.length, 3);
      ok("… alle von FIAON als System", angepinnt.every((f) => f.autorTyp === "system" && f.autorName === "FIAON"));
      ok("… und einer erklärt die Kundendaten-Regel",
        angepinnt.some((f) => /KUNDENDATEN/.test(f.text)));

      const wieviel = await ungelesen(normal, tx as any);
      ok("Die Ungelesen-Marke zählt fremde Beiträge", wieviel > 0, String(wieviel));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("7. Versandzentrum: Zustand, Limit, Rechte");
      // ═══════════════════════════════════════════════════════════════════
      const bezahltP = kunde;
      const zahl1 = await versandErlaubt(bezahltP, "payment_details", tx as any);
      ok("Zahlungsdaten an einen BEZAHLTEN Kunden: gesperrt", !zahl1.erlaubt, zahl1.grund ?? "");
      ok("… mit einem Grund, der den Zustand nennt", /bezahlt/i.test(zahl1.grund || ""));

      const offenP = unbezahlt;
      const zahl2 = await versandErlaubt(offenP, "payment_details", tx as any);
      ok("Zahlungsdaten bei offener Rechnung: erlaubt", zahl2.erlaubt, zahl2.grund ?? "");

      const willkommen = await versandErlaubt(offenP, "welcome", tx as any);
      ok("Zugangsmail an einen Unbezahlten: gesperrt", !willkommen.erlaubt, willkommen.grund ?? "");

      const gesperrtP = await person({ first_name: "Gesperrt", primary_email: MAIL("gs"), is_blocked: true, priority_tier: 2, tier_reason: "rechnung_offen" });
      await bestellung({ ref: REF("BLOCK"), person_id: gesperrtP, payment_status: "pending_payment" });
      const anGesperrt = await versandErlaubt(gesperrtP, "nicht_erreicht_termin", tx as any);
      ok("Terminlink an einen Gesperrten: gesperrt", !anGesperrt.erlaubt, anGesperrt.grund ?? "");

      const ohneMailP = await person({ first_name: "Ohnemail", primary_email: null, priority_tier: 2, tier_reason: "rechnung_offen" });
      await bestellung({ ref: REF("NOMAIL"), person_id: ohneMailP, payment_status: "pending_payment" });
      const ohne = await versandErlaubt(ohneMailP, "payment_details", tx as any);
      ok("Ohne E-Mail: gesperrt", !ohne.erlaubt, ohne.grund ?? "");

      ok("Ein Startgespräch-Link geht nur an Bezahlte",
        !(await versandErlaubt(offenP, "onboarding_einladung", tx as any)).erlaubt);
      ok("… und nicht an jemanden, der schon einen Termin hat",
        !(await versandErlaubt(kunde, "onboarding_einladung", tx as any)).erlaubt);

      // Tageslimit: drei sind erlaubt, der vierte nicht.
      for (let i = 0; i < TAGESLIMIT; i++) {
        await tx`
          INSERT INTO fiaon_mail_log (event, person_id, empfaenger, status, ausgeloest_von, ausgeloest_agent_id)
          VALUES ('payment_details', ${offenP}, ${MAIL("x")}, 'versandt', 'Prüfstand', ${normal})
        `;
      }
      const vierter = await versandErlaubt(offenP, "payment_details", tx as any);
      ok(`Der ${TAGESLIMIT + 1}. Versuch am selben Tag: gesperrt`, !vierter.erlaubt, vierter.grund ?? "");
      ok("… mit dem Wort „Tageslimit“", /Tageslimit/.test(vierter.grund || ""));
      gleich("… und der Zähler stimmt", vierter.heute, TAGESLIMIT);

      // Automatische Sendungen zählen NICHT gegen das manuelle Limit.
      await tx`
        INSERT INTO fiaon_mail_log (event, person_id, empfaenger, status)
        VALUES ('nicht_erreicht_termin', ${offenP}, ${MAIL("x")}, 'versandt')
      `;
      gleich("Eine Automatik-Sendung zählt nicht gegen das Handlimit",
        (await versandErlaubt(offenP, "nicht_erreicht_termin", tx as any)).heute, 0);

      gleich("Das Onboarding darf nur zwei Arten senden", artenFuerRolle("onboarding").length, 2);
      ok("… und keine Zahlungsdaten", !artenFuerRolle("onboarding").includes("payment_details"));
      ok("Die Leitung darf alle", artenFuerRolle("vertriebsleiter").length >= 5);

      const knoepfe = await versandKnoepfe(offenP, "agent", tx as any);
      ok("Jeder Knopf trägt Titel und Zweck", knoepfe.every((k) => k.titel.length > 3 && k.zweck.length > 15));
      ok("Gesperrte Knöpfe tragen eine Begründung", knoepfe.filter((k) => !k.erlaubt).every((k) => !!k.grund));

      const versandQuelle = readFileSync("server/routes/fiaon-versand.ts", "utf8");
      ok("Ein Teammitglied darf nur EIGENE Kunden anschreiben",
        /assigned_agent_id = \$\{agentId\}/.test(versandQuelle));
      ok("Die Zustandsprüfung läuft auch im Schreibweg (nicht nur am Knopf)",
        /const pruefung = await versandErlaubt/.test(versandQuelle));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("8. Jeder Versand landet im Protokoll — und in der Transaktion");
      // ═══════════════════════════════════════════════════════════════════
      const vorLog = Number(((await tx`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE person_id = ${ohneTermin}`) as any[])[0].n);
      const erg = await versendenUndProtokollieren(
        "onboarding_einladung",
        { email: MAIL("prot"), vorname: "Prüf", termin_link: "https://example.invalid/x" },
        { personId: ohneTermin, verlaufRef: REF("PAID2"), verlaufText: "Prüfstand-Versand.",
          ausgeloestVon: "Prüfstand", ausgeloestAgentId: normal, lauf: tx as any },
      );
      gleich("Der tote Webhook meldet „fehlgeschlagen“", erg.status, "fehlgeschlagen");
      const [nachLog] = (await tx`
        SELECT COUNT(*)::int AS n, MAX(ausgeloest_von) AS wer FROM fiaon_mail_log WHERE person_id = ${ohneTermin}
      `) as any[];
      gleich("Es steht im Protokoll", Number(nachLog.n), vorLog + 1);
      gleich("… mit dem Auslöser", nachLog.wer, "Prüfstand");
      const [verlauf] = (await tx`
        SELECT note FROM fiaon_contact_log WHERE ref = ${REF("PAID2")} ORDER BY id DESC LIMIT 1
      `) as any[];
      ok("… und im Kundenverlauf, mit dem Wort FEHLGESCHLAGEN",
        /VERSAND FEHLGESCHLAGEN/.test(String(verlauf?.note ?? "")), String(verlauf?.note ?? "").slice(0, 90));

      // Kein Automatik-Versender schreibt am Protokoll vorbei.
      for (const datei of [
        "server/lib/fiaon-nicht-erreicht.ts",
        "server/lib/fiaon-wiedereinstieg.ts",
        "server/routes/fiaon-startgespraech.ts",
        "server/routes/fiaon-versand.ts",
        "server/routes/fiaon-onboarding-bereich.ts",
      ]) {
        const q = readFileSync(datei, "utf8");
        const direkt = /sendMakeWebhook(?!MitGrund)/.test(q);
        ok(`Kein Versand am Protokoll vorbei: ${datei.split("/").pop()}`, !direkt);
      }

      // ═══════════════════════════════════════════════════════════════════
      gruppe("9. Sichtbare Sprache");
      // ═══════════════════════════════════════════════════════════════════
      const kundenSeiten = [
        "client/src/pages/termin.tsx",
        "client/src/pages/zahlung.tsx",
        "client/src/pages/bonitaet-antrag.tsx",
        "client/src/pages/business-antrag.tsx",
        "client/src/pages/nummer-aktualisieren.tsx",
        "client/src/components/StartgespraechGate.tsx",
      ];
      for (const datei of kundenSeiten) {
        const roh = readFileSync(datei, "utf8");
        // Kommentare raus — dort darf über das Siezen geredet werden.
        const sichtbar = roh.split("\n")
          .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z)).join("\n");
        const treffer = sichtbar.match(/(?<![a-zäöüßA-ZÄÖÜ])(Sie |Ihnen|Ihre[nmrs]?|Ihr )/g) || [];
        ok(`Kundenseite duzt: ${datei.split("/").pop()}`, treffer.length === 0,
          treffer.slice(0, 3).join(" · "));
      }
      for (const datei of ["client/src/pages/termin.tsx", "client/src/components/StartgespraechGate.tsx"]) {
        const roh = readFileSync(datei, "utf8");
        ok(`Kein „Berater/Beratung“: ${datei.split("/").pop()}`,
          !/(?<!keine )(Berater|Beratung)(?!s?hinweis)/.test(roh.split("\n").filter((z) => !/^\s*(\/\/|\*)/.test(z)).join("\n")));
      }
      const landing = readFileSync("client/src/pages/fiaon-landing.tsx", "utf8");
      ok("Die Startseite nennt FIAON nicht mehr „Beratungsservice“", !/Beratungsservice/.test(landing));
      ok("… und wirbt nicht mit „Beratungen“", !/"Beratungen"/.test(landing));

      const shell = readFileSync("client/src/pages/agent/shared.tsx", "utf8");
      ok("Der Space steht im Menü", /label: "Space"/.test(shell));
      ok("Die Startgespräche stehen im Menü, nur für die Rolle",
        /label: "Startgespräche"[\s\S]{0,120}nurRolle: "onboarding"/.test(shell));
      const startSeite = readFileSync("client/src/pages/agent/start.tsx", "utf8");
      ok("Die Startseite grüßt mit Vornamen und Tageszeit",
        /gruss\(\)/.test(startSeite) && /Guten Morgen/.test(startSeite));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("10. Keine Tagesläufe auf einem Entwicklungsrechner");
      // ═══════════════════════════════════════════════════════════════════
      ok("Tagesläufe sind hier AUS (dieser Lauf ist kein Betrieb)", !CRONS_AN);
      for (const datei of [
        "server/routes/fiaon-followup.ts",
        "server/routes/fiaon-agent.ts",
        "server/routes/fiaon-antrag.ts",
      ]) {
        const q = readFileSync(datei, "utf8");
        const nacktesInterval = /^\s*setInterval\(/m.test(q.replace(/verifyTokens[\s\S]{0,200}/g, ""));
        ok(`Kein ungebremster Cron in ${datei.split("/").pop()}`,
          !nacktesInterval || /CRONS_AN|tageslauf\(/.test(q));
      }

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("11. Gegenprobe: der Bestand ist unverändert");
  // ═══════════════════════════════════════════════════════════════════════
  const [nachher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_applications)::int AS bestellungen,
           (SELECT COUNT(*) FROM fiaon_termine)::int AS termine,
           (SELECT COUNT(*) FROM fiaon_posts)::int AS posts,
           (SELECT COUNT(*) FROM fiaon_post_reaktionen)::int AS reaktionen,
           (SELECT COUNT(*) FROM fiaon_post_kommentare)::int AS kommentare,
           (SELECT COUNT(*) FROM fiaon_mail_log)::int AS maillog,
           (SELECT COUNT(*) FROM fiaon_vertrieb_zusagen)::int AS zusagen,
           (SELECT COUNT(*) FROM fiaon_agents)::int AS agenten
  `;
  // ── NICHT AUF GLEICHHEIT PRÜFEN ─────────────────────────────────────────
  // Der Betrieb läuft weiter, während dieser Lauf läuft. Beim ersten Versuch
  // schlug genau hier eine Prüfung fehl: „personen 4827 → 4828" — ein echter
  // Besucher hatte sich in der Zwischenzeit registriert. Dieselbe Falle wie
  // beim Massen-Merge (AGENTS.md: „Eine Invariante darf nicht den Betrieb
  // mitmessen").
  //
  // Gemessen wird deshalb, was dieser Lauf verantwortet: Nichts darf
  // SCHRUMPFEN, und von den eigenen Testdaten darf keine Zeile übrig sein.
  for (const feld of ["personen", "bestellungen", "termine", "posts", "reaktionen",
    "kommentare", "maillog", "zusagen", "agenten"] as const) {
    ok(`Nichts verloren: ${feld} (${vorher[feld]} → ${nachher[feld]})`,
      Number(nachher[feld]) >= Number(vorher[feld]));
  }
  const reste = (await sqlPool`
    SELECT 'personen' AS was, COUNT(*)::int AS n FROM fiaon_persons WHERE last_name = ${`Menschen${stempel}`}
    UNION ALL SELECT 'agenten', COUNT(*)::int FROM fiaon_agents WHERE name = ${`Prüfmensch ${stempel}`}
    UNION ALL SELECT 'bestellungen', COUNT(*)::int FROM fiaon_applications WHERE ref LIKE ${`FIAON-MEN${stempel}%`}
    UNION ALL SELECT 'maillog', COUNT(*)::int FROM fiaon_mail_log WHERE empfaenger LIKE ${`%${stempel.toLowerCase()}@pruefstand-menschen.test`}
    -- NUR reine Datums-Schlüssel: Der Seed-Lauf legt Beiträge mit
    -- „seed-…" an, und als Text sortiert „s" über jede Jahreszahl — die
    -- erste Fassung zählte deshalb 1020 fremde Beiträge als eigene Reste.
    UNION ALL SELECT 'posts', COUNT(*)::int FROM fiaon_posts WHERE auto_art = 'gedanke'
      AND auto_schluessel ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      AND auto_schluessel > to_char(NOW() + INTERVAL '300 days', 'YYYY-MM-DD')
  `) as any[];
  for (const r of reste) gleich(`Keine eigene Zeile übrig: ${r.was}`, Number(r.n), 0);

  process.env.MAKE_WEBHOOK_URL = ECHTE_WEBHOOK_URL;
  log(`\n══ Ergebnis: ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen ══\n`);
  if (fehlgeschlagen > 0) {
    log("Fehlgeschlagen:");
    for (const f of fehler) log(`  · ${f}`);
  }
  await sqlPool.end();
  process.exit(fehlgeschlagen > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("\nPrüfstand abgebrochen:", err);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
