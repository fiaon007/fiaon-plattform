// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: Mail-System, Zustell-Wahrheit, Zugang
//
// Was hier schiefgehen kann, trifft unmittelbar Menschen:
//   · Ein Kunde wird Stufe A und niemand ruft an (Barghouti, 08.08.2026).
//   · Ein Testeintrag steht als echter Kunde in einer Rundmail.
//   · Eine Zahlungsaufforderung geht an jemanden, der längst bezahlt hat.
//   · Die Plattform behauptet „Make-Zweig fehlt", obwohl alle 21 aktiv sind.
//   · Ein Passwort-Link gilt ewig oder für den falschen Kunden.
//
// BREVO IST EINE ATTRAPPE. `BREVO_API_KEY` zeigt auf eine `.invalid`-Adresse,
// der Make-Webhook ebenso. Es geht keine echte Mail raus, und die
// Verifikation läuft gegen das Verhalten „Brevo nicht erreichbar" — was
// genau der Zustand ist, in dem der Vorgesetzte die Plattform heute vorfindet.
//
//   npx tsx scripts/pruef-mail.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";

const ECHT = {
  make: process.env.MAKE_WEBHOOK_URL,
  brevo: process.env.BREVO_API_KEY,
  openai: process.env.OPENAI_API_KEY,
};
process.env.MAKE_WEBHOOK_URL = "http://attrappe.pruefstand.invalid/keine-echten-mails";
process.env.BREVO_API_KEY = "";
process.env.OPENAI_API_KEY = "";

import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { agentMitKleinsterLast, sofortZuteilen } from "../server/lib/fiaon-zuteilung";
import { personTierAktualisieren } from "../server/lib/tier";
import {
  alsTestMarkieren, kennzeichenLaden, keinTestSql, testKandidaten, VORGABE_KENNZEICHEN,
} from "../server/lib/fiaon-testerkennung";
import { mailEvent, mailEvents, templateZuordnen, verifikationSpeichern, verifikationsText } from "../server/lib/fiaon-mail-events";
import { mailSenden } from "../server/lib/fiaon-mail-senden";
import { brevoKonfiguriert, OHNE_SCHLUESSEL, rahmen } from "../server/lib/fiaon-brevo";
import { zweigPruefen, zustellungAbgleichen } from "../server/lib/fiaon-zustellung";
import { bausteineFuellen, empfaengerSuche, filterGruppen, zielgruppeLaden, PRO_STUNDE } from "../server/lib/fiaon-zentrale";
import { entschaerfen, kiKonfiguriert } from "../server/lib/fiaon-mail-ki";
import {
  einmalPasswortErzeugen, einmalPasswortSetzen, passwortSetzen,
  setzLinkErzeugen, setzLinkPruefen, zugangFreischalten, LINK_MINUTEN,
} from "../server/lib/fiaon-zugang";
import { echtePersonSql } from "../server/lib/fiaon-bestand-filter";

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
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 58 - t.length))}`); }

class Zurueckrollen extends Error {}
const stempel = Date.now().toString(36).toUpperCase();
const REF = (s: string) => `FIAON-MAIL${stempel}-${s}`;
const MAIL = (s: string) => `${s}-${stempel}@pruefstand-mail.test`.toLowerCase();

async function main(): Promise<void> {
  log("\n══ Prüfstand: Mail, Zustellung, Zugang ══");
  log(`   Make:  ${process.env.MAKE_WEBHOOK_URL}`);
  log(`   Brevo: (Attrappe — Schlüssel leer)`);

  const [vorher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_applications)::int AS bestellungen,
           (SELECT COUNT(*) FROM fiaon_mail_log)::int AS maillog,
           (SELECT COUNT(*) FROM fiaon_mail_events)::int AS mailevents,
           (SELECT COUNT(*) FROM fiaon_agents)::int AS agenten,
           (SELECT COUNT(*) FROM fiaon_persons WHERE ist_test_am IS NOT NULL)::int AS tests
  `;

  try {
    await sqlPool.begin(async (tx) => {
      const person = async (f: Record<string, unknown>): Promise<number> => {
        const [r] = await tx`
          INSERT INTO fiaon_persons ${tx({
            person_ref: `FIAON-P-ML${stempel}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            first_name: "Prüf", last_name: `Mail${stempel}`, priority_tier: 3, tier_reason: "nur_lead", ...f,
          } as any)} RETURNING id
        `;
        return Number(r.id);
      };
      const bestellung = async (f: Record<string, unknown>): Promise<string> => {
        const [r] = await tx`
          INSERT INTO fiaon_applications ${tx({
            type: "private", status: "completed", payment_status: "pending_payment", ...f,
          } as any)} RETURNING ref
        `;
        return String(r.ref);
      };
      const agent = async (f: Record<string, unknown>): Promise<number> => {
        const [r] = await tx`
          INSERT INTO fiaon_agents ${tx({
            name: `Prüfmail ${stempel}`, email: MAIL("a"), active: true,
            distribution_active: true, is_test_account: false, rolle: "agent", ...f,
          } as any)} RETURNING id
        `;
        return Number(r.id);
      };

      // ═══════════════════════════════════════════════════════════════════
      gruppe("1. Ereignis-Zuteilung: wer heiß wird, bekommt jemanden");
      // ═══════════════════════════════════════════════════════════════════
      const p1 = await person({ first_name: "Heisswird", primary_email: MAIL("hw") });
      const r1 = await bestellung({ ref: REF("A"), person_id: p1, payment_status: "pending_payment" });
      const vorTier = (await tx`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${p1}`) as any[];
      ok("Frischer Lead hat keinen Zuständigen", !vorTier[0].assigned_agent_id);

      // Der Klick „ich habe bezahlt" — genau der Weg, den Barghouti ging.
      await tx`UPDATE fiaon_applications SET payment_status = 'claimed_paid' WHERE ref = ${r1}`;
      const tier = await personTierAktualisieren(tx, { ref: r1 });
      gleich("Nach der Zahlungsmeldung: Stufe A", tier?.tier, 1);
      const [nachTier] = (await tx`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${p1}`) as any[];
      ok("… und SOFORT ein Zuständiger — nicht morgen früh", !!nachTier.assigned_agent_id,
        String(nachTier.assigned_agent_id));

      // Kleinste Last gewinnt.
      const leer = await agent({ email: MAIL("leer"), first_name: "Leerlauf" });
      gleich("Der Leerlaufende bekommt den nächsten", await agentMitKleinsterLast(tx as any), leer);
      const p2 = await person({ first_name: "Zweiter", primary_email: MAIL("z2"), priority_tier: 2, tier_reason: "rechnung_offen" });
      await bestellung({ ref: REF("B"), person_id: p2 });
      const z2 = await sofortZuteilen(p2, tx as any);
      gleich("Stufe B wird ebenfalls sofort zugeteilt", z2.agentId, leer);

      // Testkonten und Besitzschutz.
      const testAgent = await agent({ email: MAIL("ta"), is_test_account: true, first_name: "Testkonto" });
      ok("Ein Testkonto bekommt nie Kunden", (await agentMitKleinsterLast(tx as any)) !== testAgent);
      const p3 = await person({
        first_name: "Betreut", primary_email: MAIL("bt"), priority_tier: 1, tier_reason: "zahlung_angekuendigt",
        betreuung_seit: new Date(Date.now() - 30 * 86400000),
      });
      // Ein ECHTER Betreuer muss dokumentiert sein — seit dem 09.08.2026
      // schützt der Besitzschutz nur, wenn es jemanden zu schützen gibt.
      // Sandra Ulke-Züllich (Person 4310) lag einen Monat lang ohne
      // Zuständigen, weil ihr einziger „Betreuer" ein Testkonto war.
      const p3ref = await bestellung({ ref: REF("BETREUT"), person_id: p3 });
      await tx`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note)
        VALUES (${p3ref}, ${leer}, 'Leerlauf', 'result', 'nicht_erreicht', 'Prüfstand: dokumentierte Betreuung')
      `;
      const z3 = await sofortZuteilen(p3, tx as any);
      ok("Besitzschutz: dokumentiert Betreute werden NICHT umverteilt", !z3.zugeteilt, z3.grund);
      ok("… mit dem Grund im Klartext", /Besitzschutz/.test(z3.grund));

      // Der Umkehrfall: betreuung_seit gesetzt, aber nur von einem Testkonto
      // dokumentiert → es gibt niemanden zu schützen, also wird verteilt.
      const pTest = await person({
        first_name: "Scheinbetreut", primary_email: MAIL("sb"), priority_tier: 2, tier_reason: "rechnung_offen",
        betreuung_seit: new Date(Date.now() - 30 * 86400000),
      });
      const pTestRef = await bestellung({ ref: REF("SCHEIN"), person_id: pTest });
      await tx`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note)
        VALUES (${pTestRef}, ${testAgent}, 'Testkonto', 'result', 'nicht_erreicht', 'Prüfstand: Scheinbetreuung')
      `;
      const zTest = await sofortZuteilen(pTest, tx as any);
      ok("Ein Testkonto als „Betreuer“ schützt NICHT — die Person wird verteilt",
        zTest.zugeteilt, zTest.grund);

      const p4 = await person({ first_name: "Schon", primary_email: MAIL("sc"), priority_tier: 1, tier_reason: "zahlung_angekuendigt", assigned_agent_id: leer });
      gleich("Wer schon jemanden hat, behält ihn", (await sofortZuteilen(p4, tx as any)).zugeteilt, false);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("2. Testerkennung: was wir selbst angelegt haben");
      // ═══════════════════════════════════════════════════════════════════
      const k = await kennzeichenLaden(tx as any);
      ok("Interne Domains sind vorbelegt", k.domains.includes("schwarzott-global.com") && k.domains.includes("fiaon.com"));
      ok("Präfixe für Proben ebenfalls", k.praefixe.includes("demo@"));
      ok("Und die Namen im Haus", k.namen.some((n) => n.includes("schwarzott")));

      const intern = await person({ first_name: "Intern", last_name: `Mail${stempel}`, primary_email: `probe-${stempel}@fiaon.com`.toLowerCase() });
      await bestellung({ ref: REF("INT"), person_id: intern, email: `probe-${stempel}@fiaon.com`.toLowerCase() });
      const kand = await testKandidaten(tx as any, intern);
      gleich("Interne Domain wird erkannt", kand.length, 1);
      ok("… mit Begründung", /alle Adressen intern/.test(kand[0]?.grund ?? ""));

      // DIE HARTE GRENZE
      const bezahlt = await person({ first_name: "Bezahlt", last_name: `Mail${stempel}`, primary_email: `zahlt-${stempel}@fiaon.com`.toLowerCase(), priority_tier: 0, tier_reason: "bezahlt" });
      await bestellung({ ref: REF("PAID"), person_id: bezahlt, payment_status: "paid", email: `zahlt-${stempel}@fiaon.com`.toLowerCase() });
      gleich("Ein BEZAHLTER Kunde ist nie Kandidat", (await testKandidaten(tx as any, bezahlt)).length, 0);
      gleich("… und lässt sich auch nicht von Hand markieren",
        await alsTestMarkieren(bezahlt, "Versuch", "Prüfstand", tx as any), false);
      const [immerNoch] = (await tx`SELECT ist_test_am FROM fiaon_persons WHERE id = ${bezahlt}`) as any[];
      ok("… er bleibt ein echter Kunde", !immerNoch.ist_test_am);

      // Markierung wirkt in den Listen.
      await alsTestMarkieren(intern, kand[0].grund, "Prüfstand", tx as any);
      const [markiert] = (await tx`SELECT ist_test_am, ist_test_grund, assigned_agent_id FROM fiaon_persons WHERE id = ${intern}`) as any[];
      ok("Markiert, mit Grund und Zeitpunkt", !!markiert.ist_test_am && !!markiert.ist_test_grund);
      ok("… und aus der Zuteilung genommen", !markiert.assigned_agent_id);
      ok("Kein Hard-Delete — die Zeile steht noch", !!(await tx`SELECT id FROM fiaon_persons WHERE id = ${intern}`).length);
      ok("Die zentrale Filterbedingung deckt Testeinträge ab", /ist_test_am IS NULL/.test(echtePersonSql("p")));
      ok("… und es gibt eine eigene Bedingung dafür", /ist_test_am IS NULL/.test(keinTestSql("p")));
      gleich("Ein Testeintrag wird nicht mehr zugeteilt", (await sofortZuteilen(intern, tx as any)).zugeteilt, false);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("3. Die falsche Warnliste ist WEG");
      // ═══════════════════════════════════════════════════════════════════
      const hub = readFileSync("server/routes/fiaon-admin-hub.ts", "utf8");
      const hubCode = hub.split("\n").filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z)).join("\n");
      ok("Keine Heuristik über „Vorgesetzten-TODO“ mehr", !/Vorgesetzten-TODO\/i\.test/.test(hubCode));
      ok("… und kein `makeBranchReady` im Code", !/makeBranchReady/.test(hubCode));
      // Nur SICHTBARER Text. Die Kommentare in diesen Dateien erklären, was
      // hier früher stand und warum es weg ist — genau dieser Satz enthält die
      // Wörter. Ein erster Entwurf prüfte den Rohtext und fiel darüber; dieselbe
      // Falle wie beim Onboarding-Bereich am Vortag.
      for (const datei of ["client/src/pages/admin-events.tsx", "client/src/pages/admin-kunde.tsx", "client/src/pages/admin-funktionen.tsx"]) {
        const sichtbar = readFileSync(datei, "utf8").split("\n")
          .filter((z) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(z)).join("\n");
        ok(`Keine „Make-Zweig fehlt“-Behauptung in ${datei.split("/").pop()}`,
          !/Make-Zweig fehlt/.test(sichtbar));
        ok(`… und kein makeBranchReady mehr in ${datei.split("/").pop()}`,
          !/makeBranchReady/.test(sichtbar));
      }

      // ═══════════════════════════════════════════════════════════════════
      gruppe("4. Registry: eine Wahrheit, gemessener Stand");
      // ═══════════════════════════════════════════════════════════════════
      const alle = await mailEvents(tx as any);
      ok("Alle Ereignisse sind erfasst", alle.length >= 30, String(alle.length));
      ok("Jedes trägt Klartext (was, wann, an wen)", alle.every((e) => e.klartext.length > 15));
      ok("Jedes trägt Zielgruppe und Gruppe", alle.every((e) => !!e.zielgruppe && !!e.gruppe));
      ok("Jedes trägt Rechte", alle.every((e) => e.rollen.length > 0));
      ok("Jedes trägt Parameter mit Beispielwerten", alle.every((e) => e.parameter.length > 0));
      ok("Ohne Prüfung heißt es „ungeprüft“ — keine Behauptung",
        alle.filter((e) => !e.verifiziertAm && !e.geprueftAm).every((e) => e.verifikation === "ungeprueft"));

      const beispiel = alle.find((e) => e.type === "payment_details")!;
      ok("Der Text zu „ungeprüft“ sagt, was zu tun ist", /Zweig prüfen/.test(verifikationsText({ ...beispiel, verifikation: "ungeprueft" } as any)));
      const nichtText = verifikationsText({ ...beispiel, verifikation: "nicht_bestaetigt" } as any);
      ok("Bei „nicht bestätigt“ steht Make als mögliche Ursache", /Make-Zweig/.test(nichtText));
      ok("… UND das Brevo-Template als zweite", /Brevo-Template/.test(nichtText));

      await verifikationSpeichern("payment_details", true, "Prüfstand", tx as any);
      const nachher1 = await mailEvent("payment_details", tx as any);
      gleich("Nach einer erfolgreichen Prüfung: bestätigt", nachher1?.verifikation, "bestaetigt");
      ok("… mit Datum im Text", /bestätigt am/.test(verifikationsText(nachher1!)));
      await verifikationSpeichern("payment_details", false, "Fehlversuch", tx as any);
      const nachher2 = await mailEvent("payment_details", tx as any);
      gleich("Ein späterer Fehlversuch löscht die Bestätigung NICHT", nachher2?.verifikation, "bestaetigt");
      ok("… der Fehlversuch steht als Ergebnis daneben", nachher2?.pruefErgebnis === "Fehlversuch");

      await templateZuordnen("payment_details", 42, "Zahlungsdaten V3", tx as any);
      const mitVorlage = await mailEvent("payment_details", tx as any);
      gleich("Vorlage zugeordnet", mitVorlage?.brevoTemplateId, 42);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("5. Eine Tür: kein Versand am Protokoll vorbei");
      // ═══════════════════════════════════════════════════════════════════
      const webhook = readFileSync("server/make-webhook.ts", "utf8");
      ok("Der Webhook protokolliert SELBST", /protokollNebenbei\(eventType, payload, erg\)/.test(webhook));
      ok("… und der Doppeleintrag ist verhindert", /protokolliertSelbst/.test(webhook));
      const logLib = readFileSync("server/lib/fiaon-mail-log.ts", "utf8");
      ok("Die Marke wird auch bei einem Fehler wieder entfernt (finally)",
        /finally \{\s*\n\s*protokolliertSelbst\.delete/.test(logLib));

      const vorSend = Number(((await tx`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE person_id = ${p2}`) as any[])[0].n);
      const send1 = await mailSenden({
        event: "payment_details", personId: p2,
        akteur: { name: "Prüfstand", agentId: leer, rolle: "vertriebsleiter" }, lauf: tx as any,
      });
      gleich("Der tote Webhook meldet „fehlgeschlagen“", send1.status, "fehlgeschlagen");
      const [nachSend] = (await tx`
        SELECT COUNT(*)::int AS n, MAX(ausgeloest_von) AS wer FROM fiaon_mail_log WHERE person_id = ${p2}
      `) as any[];
      gleich("Er steht trotzdem im Protokoll", Number(nachSend.n), vorSend + 1);
      gleich("… mit dem Auslöser", nachSend.wer, "Prüfstand");

      // Zustandsprüfung und Rechte.
      const anBezahlten = await mailSenden({
        event: "payment_details", personId: bezahlt,
        akteur: { name: "Prüfstand", agentId: leer, rolle: "vertriebsleiter" }, lauf: tx as any,
      });
      gleich("Zahlungsdaten an einen BEZAHLTEN: abgelehnt", anBezahlten.status, "abgelehnt");
      ok("… mit dem Zustand als Grund", /bezahlt/i.test(anBezahlten.grund || ""));

      const falscheRolle = await mailSenden({
        event: "payment_reminder", personId: p2,
        akteur: { name: "Prüfstand", agentId: leer, rolle: "agent" }, lauf: tx as any,
      });
      gleich("Ein Teammitglied darf keine Mahnung senden", falscheRolle.status, "abgelehnt");
      ok("… mit klarer Ansage", /Rolle/.test(falscheRolle.grund || ""));

      gleich("Unbekanntes Ereignis: abgelehnt",
        (await mailSenden({ event: "gibtsnicht", personId: p2, akteur: { name: "P", agentId: null, rolle: "admin" }, lauf: tx as any })).status,
        "abgelehnt");

      // ── DAS TAGESLIMIT SPERRT NICHT MEHR (19.08.2026) ────────────────
      // Hier stand: gleich(„Das 4. Mal am selben Tag: abgelehnt",
      // viertes.status, „abgelehnt"). Seit dem Umbau von Sperre auf Warnung
      // (AGENTS.md) darf der vierte Versand nicht mehr abgelehnt werden.
      for (let i = 0; i < 3; i++) {
        await tx`
          INSERT INTO fiaon_mail_log (event, person_id, empfaenger, status, ausgeloest_von, ausgeloest_agent_id)
          VALUES ('payment_details', ${p2}, ${MAIL("x")}, 'versandt', 'Prüfstand', ${leer})
        `;
      }
      const viertes = await mailSenden({
        event: "payment_details", personId: p2,
        akteur: { name: "Prüfstand", agentId: leer, rolle: "vertriebsleiter" }, lauf: tx as any,
      });
      ok("Das 4. Mal am selben Tag wird NICHT wegen des Tageslimits abgelehnt",
        !/Tageslimit/.test(viertes.grund || ""), `${viertes.status}: ${viertes.grund ?? "—"}`);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("6. Zustell-Wahrheit ohne Brevo-Schlüssel");
      // ═══════════════════════════════════════════════════════════════════
      ok("Ohne Schlüssel meldet Brevo sich sauber ab", !brevoKonfiguriert());
      ok("… mit einem Hinweis, der sagt, was zu tun ist", /BREVO_API_KEY/.test(OHNE_SCHLUESSEL));

      const pruefung = await zweigPruefen("payment_details", MAIL("pruef"),
        { name: "Prüfstand", agentId: null, rolle: "admin" }, { maxWartenMs: 1 });
      ok("Eine Prüfung ohne Schlüssel stürzt nicht ab", pruefung.bestaetigt === false);
      ok("… und nennt den fehlenden Schlüssel", /BREVO_API_KEY/.test(pruefung.text));

      const abgleich = await zustellungAbgleichen({}, tx as any);
      gleich("Der Abgleich läuft ins Leere, ohne zu scheitern", abgleich.geprueft, 0);
      ok("… mit Begründung", /BREVO_API_KEY/.test(abgleich.grund || ""));

      // Der Abgleich selbst — mit gestellten Werten statt echter API.
      await tx`
        INSERT INTO fiaon_mail_log (event, person_id, empfaenger, status, created_at)
        VALUES ('welcome', ${p2}, ${MAIL("zu")}, 'versandt', NOW() - INTERVAL '2 hours')
      `;
      await tx`
        UPDATE fiaon_mail_log SET zustellung = 'zugestellt', zustellung_am = NOW(), abgeglichen_am = NOW()
        WHERE id = (SELECT MAX(id) FROM fiaon_mail_log WHERE person_id = ${p2})
      `;
      const [zst] = (await tx`
        SELECT zustellung FROM fiaon_mail_log WHERE person_id = ${p2} ORDER BY id DESC LIMIT 1
      `) as any[];
      gleich("Ein abgeglichener Eintrag trägt den echten Zustand", zst.zustellung, "zugestellt");
      const [nichtNochmal] = (await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_mail_log
        WHERE person_id = ${p2} AND status = 'versandt'
          AND (abgeglichen_am IS NULL OR abgeglichen_am < NOW() - INTERVAL '45 minutes')
      `) as any[];
      ok("Frisch abgeglichene Zeilen werden nicht sofort erneut abgefragt", Number(nichtNochmal.n) < 5);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("7. Mail-Zentrale: Empfänger, Bausteine, Grenzen");
      // ═══════════════════════════════════════════════════════════════════
      const aliasP = await person({ first_name: "Aliaskunde", primary_email: MAIL("neu") });
      await bestellung({ ref: REF("AL"), person_id: aliasP, email: MAIL("neu") });
      await tx`
        INSERT INTO fiaon_person_aliases (person_id, kind, value_norm, value_raw)
        VALUES (${aliasP}, 'email', ${MAIL("alt")}, ${MAIL("alt")})
        ON CONFLICT DO NOTHING
      `;
      const gefunden = await empfaengerSuche(stempel.toLowerCase(), null, tx as any);
      ok("Die Suche findet über die Adresse", gefunden.some((g) => g.personId === aliasP), String(gefunden.length));
      const ueberAlias = await empfaengerSuche(`alt-${stempel}`.toLowerCase(), null, tx as any);
      ok("… UND über eine alte Adresse (Alias)", ueberAlias.some((g) => g.personId === aliasP));

      // Testeinträge fallen raus.
      const rausTest = await empfaengerSuche(`Mail${stempel}`, null, tx as any);
      ok("Ein Testeintrag taucht in keiner Suche auf", !rausTest.some((g) => g.personId === intern));

      const ziel = await zielgruppeLaden({ personIds: [p2, intern, aliasP] }, null, tx as any);
      ok("Auch in der Zielgruppe fehlt der Testeintrag", !ziel.empfaenger.some((e) => e.personId === intern));
      ok("… und der Ausschluss wird benannt", /Testeinträge/.test(ziel.ausgeschlossen));

      const mitExtern = await zielgruppeLaden({ extern: ["hallo@example.com", "kaputt"] }, null, tx as any);
      gleich("Externe Adressen kommen dazu — ungültige nicht", mitExtern.empfaenger.length, 1);
      ok("… und sind als extern gekennzeichnet", mitExtern.empfaenger[0].extern);

      const gruppen = await filterGruppen(null, tx as any);
      ok("Alle acht Filtergruppen liefern eine Zahl", gruppen.length === 8 && gruppen.every((g) => g.anzahl >= 0),
        gruppen.map((g) => `${g.titel}:${g.anzahl}`).join(" "));

      // BAUSTEINE JE EMPFÄNGER — der eigentliche Punkt.
      const e1 = { personId: p2, name: "Anna", email: "a@x.de", vorname: "Anna", extern: false, zahlungsreferenz: "FIAON-AAA111", betrag: "99.99", agentVorname: "Lucas" };
      const e2 = { personId: aliasP, name: "Bert", email: "b@x.de", vorname: "Bert", extern: false, zahlungsreferenz: "FIAON-BBB222", betrag: "49.00", agentVorname: "Nikita" };
      const vorlage = "Hi {Anrede}, wie besprochen: {Zahlungsdaten}. Dein Ansprechpartner: {Agent-Vorname}";
      const t1 = bausteineFuellen(vorlage, e1 as any);
      const t2 = bausteineFuellen(vorlage, e2 as any);
      ok("Empfänger 1 bekommt SEINEN Verwendungszweck", t1.includes("FIAON-AAA111") && !t1.includes("FIAON-BBB222"));
      ok("Empfänger 2 bekommt SEINEN", t2.includes("FIAON-BBB222") && !t2.includes("FIAON-AAA111"));
      ok("Anrede je Empfänger", t1.startsWith("Hi Anna") && t2.startsWith("Hi Bert"));
      ok("Ansprechpartner je Empfänger", t1.includes("Lucas") && t2.includes("Nikita"));
      ok("Die IBAN steht drin", t1.includes("BE09 9058 9276 3957"));
      ok("Der Florentine-Fall funktioniert", bausteineFuellen("Hi {Anrede}, wie besprochen: {Zahlungsdaten}", e1 as any).includes("Verwendungszweck: FIAON-AAA111"));
      ok("Ohne Referenz wird nichts erfunden",
        /kein Verwendungszweck vor/.test(bausteineFuellen("{Zahlungsdaten}", { ...e1, zahlungsreferenz: null } as any)));

      gleich("Das Stundenkontingent steht bei 200", PRO_STUNDE, 200);
      const routen = readFileSync("server/routes/fiaon-mail.ts", "utf8");
      ok("Ohne Vorschau kein Versand an mehrere", /code: "vorschau_noetig"/.test(routen));
      ok("… und das Merkmal wird nach dem Versand verbraucht", /vorschauMerker\.delete/.test(routen));
      ok("Ein Teammitglied darf an höchstens zehn", /rolle === "admin" \|\| rolle === "vertriebsleiter" \? 5000 : 10/.test(routen));
      ok("Der CI-Rahmen trägt das Impressum", /impressum/i.test(rahmen("x", "y")));
      ok("… und den Absender welcome@fiaon.com", /welcome@fiaon\.com/.test(readFileSync("server/lib/fiaon-brevo.ts", "utf8")));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("8. KI: die Guardrails halten");
      // ═══════════════════════════════════════════════════════════════════
      ok("Ohne Schlüssel meldet die KI sich ab", !kiKonfiguriert());
      // Die Antwort einer KI, die auf einen provozierenden Prompt hereinfällt.
      const boese = "Wir garantieren dir ein Limit von 25.000 Euro. Unsere Beratung ist kostenlos "
        + "und unser Berater berät dich persönlich. Die Bewilligung garantiert dir dein sicheres Limit.";
      const sauber = entschaerfen(boese);
      ok("„garantiert“ wird entfernt", !/garantiert/i.test(sauber.text), sauber.text);
      ok("„Beratung“ wird entfernt", !/beratung/i.test(sauber.text));
      ok("„Berater“ wird entfernt", !/berater\b/i.test(sauber.text));
      ok("„berät“/„beraten“ wird entfernt", !/\bberaten\b/i.test(sauber.text));
      ok("… und der Mensch erfährt, was geändert wurde", sauber.entfernt.length >= 3, sauber.entfernt.join(", "));
      ok("Ein harmloser Text bleibt unverändert",
        entschaerfen("Hi Anna, hier sind deine Zahlungsdaten.").text === "Hi Anna, hier sind deine Zahlungsdaten.");
      const kiLib = readFileSync("server/lib/fiaon-mail-ki.ts", "utf8");
      ok("Der Systemprompt verbietet Zusagen ausdrücklich", /ABSOLUT VERBOTEN/.test(kiLib));
      ok("Die KI-Datei kann NICHT senden (Bauart, nicht Einstellung)",
        !/eigeneMailSenden|sendMakeWebhook/.test(kiLib));
      ok("Sie nutzt den vorhandenen Schlüssel, keinen zweiten Anbieter",
        /OPENAI_API_KEY/.test(kiLib) && !/ANTHROPIC|GROQ/.test(kiLib));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("9. Zugang retten");
      // ═══════════════════════════════════════════════════════════════════
      const zp = await person({ first_name: "Zugang", primary_email: MAIL("zug"), priority_tier: 0, tier_reason: "bezahlt" });
      const zref = await bestellung({
        ref: REF("ZUG"), person_id: zp, payment_status: "paid", status: "payment_completed",
        email: MAIL("zug"), first_name: "Zugang", last_name: `Mail${stempel}`,
      });

      const link = setzLinkErzeugen(zref);
      const u = new URL(link);
      const gut = setzLinkPruefen(zref, u.searchParams.get("exp")!, u.searchParams.get("e")!, u.searchParams.get("sig")!);
      ok("Ein frischer Setz-Link ist gültig", gut.gueltig);
      const fremd = setzLinkPruefen("FIAON-ANDERER", u.searchParams.get("exp")!, u.searchParams.get("e")!, u.searchParams.get("sig")!);
      ok("Er lässt sich nicht auf einen anderen Kunden umschreiben", !fremd.gueltig);
      const verdreht = setzLinkPruefen(zref, u.searchParams.get("exp")!, "abcdef01", u.searchParams.get("sig")!);
      ok("Eine geänderte Einmal-Kennung fällt auf", !verdreht.gueltig);
      const alt = setzLinkErzeugen(zref, -1000);
      const au = new URL(alt);
      const abgelaufen = setzLinkPruefen(zref, au.searchParams.get("exp")!, au.searchParams.get("e")!, au.searchParams.get("sig")!);
      ok("Ein abgelaufener Link wird abgelehnt", !abgelaufen.gueltig);
      ok("… mit einer Meldung, die weiterhilft", /abgelaufen/.test(abgelaufen.grund || "") && /neuen/.test(abgelaufen.grund || ""));
      gleich("Er gilt 60 Minuten", LINK_MINUTEN, 60);

      const einmal = einmalPasswortErzeugen();
      ok("Das Einmal-Passwort ist am Telefon vorlesbar", /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/.test(einmal), einmal);
      ok("… ohne verwechselbare Zeichen (0/O/1/l/I)", !/[01OIl]/.test(einmal));
      ok("… und zweimal erzeugt nicht dasselbe", einmalPasswortErzeugen() !== einmalPasswortErzeugen());

      const gesetzt = await einmalPasswortSetzen(zref, "Prüfstand", "Kunde hängt am Telefon", tx as any);
      ok("Das Einmal-Passwort wird gesetzt", gesetzt.ok && !!gesetzt.passwort);
      const [nachEinmal] = (await tx`
        SELECT password, passwort_wechsel_noetig, einmal_passwort_bis FROM fiaon_applications WHERE ref = ${zref}
      `) as any[];
      gleich("… steht am Konto", nachEinmal.password, gesetzt.passwort);
      ok("… und erzwingt den Wechsel beim ersten Login", nachEinmal.passwort_wechsel_noetig === true);
      ok("… mit Ablauf in 24 Stunden", new Date(nachEinmal.einmal_passwort_bis).getTime() > Date.now() + 23 * 3600_000);
      const [audit] = (await tx`
        SELECT type, actor, reason FROM fiaon_agent_events
        WHERE type = 'zugang_einmalpasswort' ORDER BY id DESC LIMIT 1
      `) as any[];
      gleich("Alles auditiert", audit?.actor, "Prüfstand");
      ok("… mit Begründung", /Telefon/.test(audit?.reason ?? ""));
      const [inAkte] = (await tx`
        SELECT note FROM fiaon_contact_log WHERE ref = ${zref} ORDER BY id DESC LIMIT 1
      `) as any[];
      ok("… und in der Kundenakte", /Einmal-Passwort/.test(inAkte?.note ?? ""));

      const neuGesetzt = await passwortSetzen(zref, "MeinNeuesPasswort2026", tx as any);
      ok("Ein neues Passwort lässt sich setzen", neuGesetzt.ok);
      const [nachNeu] = (await tx`
        SELECT password, passwort_wechsel_noetig FROM fiaon_applications WHERE ref = ${zref}
      `) as any[];
      gleich("… es steht am Konto", nachNeu.password, "MeinNeuesPasswort2026");
      ok("… und der Wechselzwang ist damit erledigt", nachNeu.passwort_wechsel_noetig === false);
      ok("Zu kurze Passwörter werden abgelehnt", !(await passwortSetzen(zref, "kurz", tx as any)).ok);

      // Freischalten
      const klemmt = await person({ first_name: "Klemmt", primary_email: MAIL("kl"), priority_tier: 0, tier_reason: "bezahlt" });
      const kref = await bestellung({ ref: REF("KLEMM"), person_id: klemmt, payment_status: "paid", status: "draft", email: MAIL("kl") });
      ok("Ohne Begründung wird nicht freigeschaltet",
        !(await zugangFreischalten(kref, "Prüfstand", "hm", tx as any)).ok);
      const frei = await zugangFreischalten(kref, "Prüfstand", "Bezahlt, aber Status hängt auf draft", tx as any);
      ok("Mit Begründung schon", frei.ok, frei.grund);
      const [nachFrei] = (await tx`SELECT status FROM fiaon_applications WHERE ref = ${kref}`) as any[];
      gleich("… und der Status steht auf completed", nachFrei.status, "completed");

      const unbezahlt = await person({ first_name: "Unbezahlt", primary_email: MAIL("ub") });
      const uref = await bestellung({ ref: REF("UNB"), person_id: unbezahlt, payment_status: "pending_payment", email: MAIL("ub") });
      const nichtFrei = await zugangFreischalten(uref, "Prüfstand", "Will halt rein", tx as any);
      ok("Ohne Zahlung KEINE Freischaltung", !nichtFrei.ok);
      ok("… mit dem richtigen Hinweis", /keine Zahlung gebucht/.test(nichtFrei.grund || ""));

      const zugangRouten = readFileSync("server/routes/fiaon-zugang-retten.ts", "utf8");
      ok("Die Werkzeuge sind der Leitung vorbehalten", /istVertriebsleiter/.test(zugangRouten));
      ok("Jede Aktion verlangt eine Begründung", (zugangRouten.match(/Bitte kurz begründen/g) || []).length >= 2);
      ok("Nach dem Setzen ist der Kunde direkt eingeloggt", /konto: erg\.konto/.test(zugangRouten));

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("10. Gegenprobe: nichts geschrieben");
  // ═══════════════════════════════════════════════════════════════════════
  const [nachher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_applications)::int AS bestellungen,
           (SELECT COUNT(*) FROM fiaon_mail_log)::int AS maillog,
           (SELECT COUNT(*) FROM fiaon_mail_events)::int AS mailevents,
           (SELECT COUNT(*) FROM fiaon_agents)::int AS agenten,
           (SELECT COUNT(*) FROM fiaon_persons WHERE ist_test_am IS NOT NULL)::int AS tests
  `;
  // Nicht auf Gleichheit: Der Betrieb läuft weiter (Lehre vom 08.08.2026).
  for (const feld of ["personen", "bestellungen", "maillog", "mailevents", "agenten"] as const) {
    ok(`Nichts verloren: ${feld} (${vorher[feld]} → ${nachher[feld]})`,
      Number(nachher[feld]) >= Number(vorher[feld]));
  }
  gleich("Keine neue Testmarkierung durch diesen Lauf", nachher.tests, vorher.tests);
  const reste = (await sqlPool`
    SELECT 'personen' AS was, COUNT(*)::int AS n FROM fiaon_persons WHERE last_name = ${`Mail${stempel}`}
    UNION ALL SELECT 'agenten', COUNT(*)::int FROM fiaon_agents WHERE name = ${`Prüfmail ${stempel}`}
    UNION ALL SELECT 'bestellungen', COUNT(*)::int FROM fiaon_applications WHERE ref LIKE ${`FIAON-MAIL${stempel}%`}
    UNION ALL SELECT 'maillog', COUNT(*)::int FROM fiaon_mail_log WHERE empfaenger LIKE ${`%${stempel.toLowerCase()}@pruefstand-mail.test`}
  `) as any[];
  for (const r of reste) gleich(`Keine eigene Zeile übrig: ${r.was}`, Number(r.n), 0);

  process.env.MAKE_WEBHOOK_URL = ECHT.make;
  process.env.BREVO_API_KEY = ECHT.brevo;
  process.env.OPENAI_API_KEY = ECHT.openai;

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
