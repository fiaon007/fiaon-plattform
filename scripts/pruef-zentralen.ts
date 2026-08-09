// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: Kunden-Zentrale, Löschen, Team-Zentrale
//
// Der gefährlichste Teil dieses Pakets ist das LÖSCHEN. Zwei Fehler wären
// nicht reparabel:
//   · Ein bezahlter Kunde wird endgültig gelöscht → Rechnung weg, § 147 AO
//     verletzt, Buchhaltung kann den Umsatz nicht mehr belegen.
//   · Eine Massenlöschung läuft ohne Bestätigung durch.
// Beides wird hier mit echten Daten in einer zurückgerollten Transaktion
// durchgespielt — nicht simuliert.
//
//   npx tsx scripts/pruef-zentralen.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";

const ECHT_MAKE = process.env.MAKE_WEBHOOK_URL;
process.env.MAKE_WEBHOOK_URL = "http://attrappe.pruefstand.invalid/keine-echten-mails";

import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { alleTrefferIds, filterZahlen, kundenListe } from "../server/lib/fiaon-kundenzentrale";
import { ausfuehren, einteilen, vorschau } from "../server/lib/fiaon-loeschen";
import { echtePersonSql } from "../server/lib/fiaon-bestand-filter";
import { empfaengerSuche, zielgruppeLaden } from "../server/lib/fiaon-zentrale";
import { statusAusTierGrund, stufeAusTier } from "../shared/fiaon-kundenstatus";

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
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 56 - t.length))}`); }

class Zurueckrollen extends Error {}
const stempel = Date.now().toString(36).toUpperCase();
const REF = (s: string) => `FIAON-ZEN${stempel}-${s}`;
const MAIL = (s: string) => `${s}-${stempel}@pruefstand-zentralen.test`.toLowerCase();

async function main(): Promise<void> {
  log("\n══ Prüfstand: Zentralen ══\n");

  const [vorher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_applications)::int AS bestellungen,
           (SELECT COUNT(*) FROM fiaon_commissions)::int AS provisionen,
           (SELECT COUNT(*) FROM fiaon_loeschungen)::int AS loeschungen,
           (SELECT COUNT(*) FROM fiaon_team_nachrichten)::int AS nachrichten,
           (SELECT COUNT(*) FROM fiaon_posts)::int AS posts
  `;

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("1. Teil 0: Die Verteilung ist gelaufen");
  // ═══════════════════════════════════════════════════════════════════════
  const [z0] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
    WHERE ${sqlPool.unsafe(echtePersonSql("p"))} AND p.assigned_agent_id IS NULL
      AND p.priority_tier IN (1, 2) AND NOT p.is_blocked AND p.betreuung_seit IS NULL
  `) as any[];
  gleich("Keine Person auf Stufe A oder B ohne Zuständigen", Number(z0.n), 0);

  const last = (await sqlPool`
    SELECT COUNT(p.id)::int AS n FROM fiaon_agents a
    LEFT JOIN fiaon_persons p ON p.assigned_agent_id = a.id
      AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL AND p.priority_tier BETWEEN 1 AND 3
    WHERE a.active AND a.distribution_active AND NOT a.is_test_account
    GROUP BY a.id
  `) as any[];
  const zahlen = last.map((r) => Number(r.n));
  const spanne = Math.max(...zahlen) - Math.min(...zahlen);
  ok(`Verteilung ausgewogen (Spanne ${spanne} bei ${zahlen.join("/")})`, spanne <= 60, String(spanne));

  // Testeinträge und Gesperrte haben zu Recht keinen Zuständigen.
  //
  // Bei der ersten Fassung dieser Prüfung fiel Sandra Ulke-Züllich auf
  // (Person 4310): dokumentiert betreut seit dem 04.07.2026 — von Agent 7,
  // einem TESTKONTO. Der Besitzschutz hielt sie einen Monat lang aus jeder
  // Verteilung heraus, zugunsten eines „Betreuers", hinter dem kein Mensch
  // sitzt. Der Schutz greift seither nur noch für echte, aktive Mitarbeiter.
  const [betreut] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons
    WHERE betreuung_seit IS NOT NULL AND assigned_agent_id IS NULL
      AND ist_test_am IS NULL AND NOT is_blocked AND merged_into_person_id IS NULL
  `) as any[];
  gleich("Kein echter Kunde steht trotz Betreuung ohne Zuweisung da", Number(betreut.n), 0);
  const zuteilLib = readFileSync("server/lib/fiaon-zuteilung.ts", "utf8");
  ok("Der Besitzschutz prüft, ob der Betreuer ein echter Mitarbeiter ist",
    /NOT ag\.is_test_account/.test(zuteilLib));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("2. Filter: Zahlen stimmen mit dem Vokabular überein");
  // ═══════════════════════════════════════════════════════════════════════
  const zz = await filterZahlen();
  ok("Alle Filterzahlen sind Zahlen", Object.values(zz).every((v) => Number.isFinite(Number(v))));
  gleich("Stufen ergeben zusammen höchstens die Gesamtzahl",
    Number(zz.stufe_a) + Number(zz.stufe_b) + Number(zz.stufe_c) + Number(zz.bezahlt) <= Number(zz.alle), true);

  // Zählprobe: Was der Filter sagt, muss die Liste auch liefern.
  for (const [name, filter, schluessel] of [
    ["Stufe A", { stufe: ["A"] }, "stufe_a"],
    ["Stufe B", { stufe: ["B"] }, "stufe_b"],
    ["Ohne Agent", { ohneAgent: true }, "ohne_agent"],
    ["KYC offen", { kycOffen: true }, "kyc_offen"],
    ["Kündigungen", { kuendigungen: true }, "kuendigungen"],
  ] as const) {
    const l = await kundenListe({ ...(filter as any), limit: 10 });
    gleich(`Zählprobe ${name}`, l.gesamt, Number(zz[schluessel]));
  }

  // Testeinträge NUR mit ausdrücklichem Filter.
  const ohne = await kundenListe({ limit: 10 });
  const mit = await kundenListe({ tests: true, limit: 10 });
  ok("Ohne Filter kein einziger Testeintrag", ohne.zeilen.every((z: any) => !z.ist_test_am));
  ok("Mit Filter ausschließlich Testeinträge",
    mit.zeilen.length > 0 && mit.zeilen.every((z: any) => !!z.ist_test_am), String(mit.gesamt));
  gleich("Und die Zahl stimmt", mit.gesamt, Number(zz.tests));

  // Kombinierbarkeit.
  const kombi = await kundenListe({ stufe: ["B"], ohneTelefon: true, limit: 5 });
  const nurB = await kundenListe({ stufe: ["B"], limit: 1 });
  ok("Kombinierte Filter schränken weiter ein", kombi.gesamt <= nurB.gesamt,
    `${kombi.gesamt} <= ${nurB.gesamt}`);
  ok("… und liefern nur Zeilen ohne Telefon", kombi.zeilen.every((z: any) => !z.primary_phone));

  // „Alle Treffer wählen" über Seitengrenzen.
  const seite = await kundenListe({ stufe: ["A"], limit: 10 });
  const alle = await alleTrefferIds({ stufe: ["A"] });
  gleich("„Alle Treffer“ erfasst exakt die Trefferzahl", alle.length, seite.gesamt);
  ok("… und enthält die Zeilen der ersten Seite",
    seite.zeilen.every((z: any) => alle.includes(Number(z.person_id))));

  // Sortierungen liefern verschiedene Reihenfolgen.
  const arbeit = await kundenListe({ sortierung: "arbeit", limit: 10 });
  const neueste = await kundenListe({ sortierung: "neueste", limit: 10 });
  ok("Sortierungen unterscheiden sich",
    arbeit.zeilen.map((z: any) => z.person_id).join() !== neueste.zeilen.map((z: any) => z.person_id).join());

  // Gelöschte tauchen nirgends auf.
  const [dsgvo] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
    WHERE EXISTS (SELECT 1 FROM fiaon_applications a
                    WHERE a.person_id = p.id AND a.gdpr_deleted_at IS NOT NULL)
  `) as any[];
  if (Number(dsgvo.n) > 0) {
    const geloeschteIds = (await sqlPool`
      SELECT DISTINCT p.id FROM fiaon_persons p
      JOIN fiaon_applications a ON a.person_id = p.id
      WHERE a.gdpr_deleted_at IS NOT NULL LIMIT 20
    `) as any[];
    const sichtbar = await kundenListe({ limit: 200 });
    ok("DSGVO-Gelöschte stehen in KEINER Liste",
      !sichtbar.zeilen.some((z: any) => geloeschteIds.some((g) => Number(g.id) === Number(z.person_id))));
  } else {
    ok("DSGVO-Gelöschte stehen in KEINER Liste (keine im Bestand)", true);
  }

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("3. Statusvokabular: eine Wahrheit, keine zweite");
  // ═══════════════════════════════════════════════════════════════════════
  const stichprobe = await kundenListe({ limit: 50 });
  ok("Jede Zeile bekommt einen Status aus dem Vokabular",
    stichprobe.zeilen.every((z: any) => !!statusAusTierGrund(z.tier_reason).anzeige));
  ok("Stufen A/B/C kommen aus stufeAusTier — keine eigene Zuordnung",
    stichprobe.zeilen.filter((z: any) => [1, 2, 3].includes(z.priority_tier))
      .every((z: any) => !!stufeAusTier(z.priority_tier)));
  const seiteQuelle = readFileSync("client/src/pages/admin-kunden.tsx", "utf8");
  ok("Die Seite baut keine eigenen Statustexte",
    /statusAusTierGrund/.test(seiteQuelle) && !/Rechnung offen"|Lead"\s*:/.test(seiteQuelle));

  try {
    await sqlPool.begin(async (tx) => {
      const person = async (f: Record<string, unknown>): Promise<number> => {
        const [r] = await tx`
          INSERT INTO fiaon_persons ${tx({
            person_ref: `FIAON-P-ZN${stempel}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            first_name: "Prüf", last_name: `Zentrale${stempel}`, priority_tier: 3, tier_reason: "nur_lead", ...f,
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

      // ═══════════════════════════════════════════════════════════════════
      gruppe("4. Löschen: die Einteilung entscheidet, nicht der Klickende");
      // ═══════════════════════════════════════════════════════════════════
      const lead = await person({ first_name: "Nurlead", primary_email: MAIL("lead") });
      const leadRef = await bestellung({ ref: REF("LEAD"), person_id: lead, email: MAIL("lead") });

      const kunde = await person({ first_name: "Bezahlt", primary_email: MAIL("kunde"), priority_tier: 0, tier_reason: "bezahlt" });
      const kundeRef = await bestellung({
        ref: REF("PAID"), person_id: kunde, payment_status: "paid", email: MAIL("kunde"),
        invoice_number: `RE-${stempel}`, amount_due: 99.99,
      });

      const teilung = await einteilen([lead, kunde], tx as any);
      const tLead = teilung.find((t) => t.personId === lead)!;
      const tKunde = teilung.find((t) => t.personId === kunde)!;
      gleich("Ein Lead ohne Zahlung: endgültig", tLead.art, "endgueltig");
      gleich("Ein bezahlter Kunde: anonymisiert", tKunde.art, "anonymisiert");
      ok("… mit Begründung im Klartext", /Rechnung/.test(tKunde.begruendung) && /147 AO/.test(tKunde.begruendung));

      const v = await vorschau([lead, kunde], tx as any);
      gleich("Die Vorschau zählt beide Kategorien getrennt", `${v.endgueltig}/${v.anonymisiert}`, "1/1");
      gleich("Der Bestätigungssatz nennt die Zahl", v.bestaetigung, "2 Einträge löschen");
      ok("Die Hinweise nennen die Unumkehrbarkeit",
        v.hinweise.some((h) => /nicht rückgängig/.test(h)));
      ok("… und die Aufbewahrungspflicht", v.hinweise.some((h) => /147 AO/.test(h)));

      // ── OHNE BESTÄTIGUNG PASSIERT NICHTS ──────────────────────────────
      const ohneBest = await ausfuehren([lead, kunde], "Prüfstand", "", null, tx as any);
      ok("Ohne Bestätigungstext: abgelehnt", !ohneBest.ok);
      ok("… mit dem geforderten Wortlaut in der Meldung", /2 Einträge löschen/.test(ohneBest.fehler || ""));
      const falsch = await ausfuehren([lead, kunde], "Prüfstand", "ja löschen", null, tx as any);
      ok("Falscher Wortlaut: ebenfalls abgelehnt", !falsch.ok);
      const [nochDa] = (await tx`SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE id = ANY(${[lead, kunde]})`) as any[];
      gleich("… und beide stehen unverändert da", Number(nochDa.n), 2);

      // ── AUSFÜHREN ─────────────────────────────────────────────────────
      const erg = await ausfuehren([lead, kunde], "Prüfstand", v.bestaetigung, "Prüfstandslauf", tx as any);
      ok("Mit korrektem Wortlaut: ausgeführt", erg.ok, erg.fehler);
      gleich("Ein endgültig, ein anonymisiert", `${erg.endgueltig}/${erg.anonymisiert}`, "1/1");

      const [leadWeg] = (await tx`SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE id = ${lead}`) as any[];
      gleich("Der Lead ist vollständig weg", Number(leadWeg.n), 0);
      const [leadBest] = (await tx`SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE ref = ${leadRef}`) as any[];
      gleich("… samt seiner Bestellung", Number(leadBest.n), 0);

      const [kundeJetzt] = (await tx`
        SELECT first_name, last_name, primary_email, is_blocked FROM fiaon_persons WHERE id = ${kunde}
      `) as any[];
      ok("Der bezahlte Kunde EXISTIERT noch", !!kundeJetzt);
      gleich("… aber anonymisiert", kundeJetzt.first_name, "Gelöscht");
      ok("… ohne Kontaktdaten", !kundeJetzt.primary_email);
      const [rechnung] = (await tx`
        SELECT invoice_number, amount_due, gdpr_deleted_at FROM fiaon_applications WHERE ref = ${kundeRef}
      `) as any[];
      // DAS ist der Kern: Die Buchhaltung muss den Umsatz weiter belegen können.
      gleich("Die RECHNUNGSNUMMER bleibt lesbar", rechnung.invoice_number, `RE-${stempel}`);
      gleich("… und der Betrag", String(rechnung.amount_due), "99.99");
      ok("… und die Löschung ist vermerkt", !!rechnung.gdpr_deleted_at);
      const [akte] = (await tx`
        SELECT note FROM fiaon_contact_log WHERE ref = ${kundeRef} ORDER BY id DESC LIMIT 1
      `) as any[];
      ok("Die Akte erklärt, warum die Rechnung bleibt", /147 AO/.test(akte?.note ?? ""));

      // Aus jeder Liste raus.
      const nachher = await kundenListe({ limit: 200 }, tx as any);
      ok("Der Anonymisierte steht in KEINER Liste mehr",
        !nachher.zeilen.some((z: any) => Number(z.person_id) === kunde));
      const suche = await empfaengerSuche(`Zentrale${stempel}`, null, tx as any);
      gleich("… und in keiner Empfängersuche", suche.length, 0);
      const ziel = await zielgruppeLaden({ personIds: [kunde] }, null, tx as any);
      gleich("… und in keiner Mail-Zielgruppe", ziel.empfaenger.length, 0);

      // Protokoll.
      const protokoll = (await tx`
        SELECT art, person_name, akteur, stapel, grund FROM fiaon_loeschungen WHERE stapel = ${erg.stapel!}
      `) as any[];
      gleich("Beide Löschungen sind protokolliert", protokoll.length, 2);
      ok("… mit Person, Akteur und Grund",
        protokoll.every((p) => !!p.person_name && p.akteur === "Prüfstand" && p.grund === "Prüfstandslauf"));
      ok("… und einem gemeinsamen Vorgangskennzeichen",
        new Set(protokoll.map((p) => p.stapel)).size === 1 && /^L-\d{4}-\d{2}-\d{2}-[0-9A-F]{6}$/.test(erg.stapel!));

      // Zweimal löschen ändert nichts mehr.
      const nochmal = await einteilen([kunde], tx as any);
      gleich("Ein bereits Gelöschter wird übersprungen", nochmal[0]?.art, "gesperrt");

      // ═══════════════════════════════════════════════════════════════════
      gruppe("5. Nachrichten und Banner");
      // ═══════════════════════════════════════════════════════════════════
      const [agent] = (await tx`
        SELECT id FROM fiaon_agents WHERE active AND NOT is_test_account ORDER BY id LIMIT 1
      `) as any[];
      const [n1] = (await tx`
        INSERT INTO fiaon_team_nachrichten (agent_id, text, banner_bis, created_by)
        VALUES (${agent.id}, ${"Bitte heute die Stufe-A-Liste abarbeiten."},
                ${new Date(Date.now() + 7 * 86400000)}, 'Prüfstand')
        RETURNING id
      `) as any[];
      const offen = async () => (await tx`
        SELECT id FROM fiaon_team_nachrichten
        WHERE agent_id = ${agent.id} AND bestaetigt_am IS NULL AND entfernt_am IS NULL
          AND (banner_bis IS NULL OR banner_bis > NOW())
      `) as any[];
      ok("Die Nachricht erscheint beim Empfänger", (await offen()).some((x) => x.id === n1.id));

      await tx`UPDATE fiaon_team_nachrichten SET bestaetigt_am = NOW() WHERE id = ${n1.id}`;
      ok("Nach „Verstanden“ ist sie weg", !(await offen()).some((x) => x.id === n1.id));
      const [best] = (await tx`SELECT bestaetigt_am FROM fiaon_team_nachrichten WHERE id = ${n1.id}`) as any[];
      ok("… und die Bestätigung ist festgehalten", !!best.bestaetigt_am);

      const [n2] = (await tx`
        INSERT INTO fiaon_team_nachrichten (agent_id, text, banner_bis, created_by)
        VALUES (${agent.id}, ${"Abgelaufen"}, ${new Date(Date.now() - 3600_000)}, 'Prüfstand')
        RETURNING id
      `) as any[];
      ok("Ein abgelaufenes Banner verschwindet von selbst", !(await offen()).some((x) => x.id === n2.id));

      // Ereignis verkünden: GENAU EIN Post.
      const vorPosts = Number(((await tx`SELECT COUNT(*)::int AS n FROM fiaon_posts`) as any[])[0].n);
      const schluessel = `event-pruef-${stempel}`;
      for (let i = 0; i < 2; i++) {
        await tx`
          INSERT INTO fiaon_posts (autor_agent_id, autor_typ, text, angepinnt, auto_art, auto_schluessel)
          VALUES (NULL, 'leitung', ${"Titel\n\nText"}, TRUE, 'verkuendung', ${schluessel})
          ON CONFLICT (auto_art, auto_schluessel) WHERE auto_art IS NOT NULL AND auto_schluessel IS NOT NULL
          DO NOTHING
        `;
      }
      const nachPosts = Number(((await tx`SELECT COUNT(*)::int AS n FROM fiaon_posts`) as any[])[0].n);
      gleich("Eine Verkündung erzeugt GENAU EINEN Post", nachPosts - vorPosts, 1);
      const [post] = (await tx`
        SELECT angepinnt, autor_typ FROM fiaon_posts WHERE auto_schluessel = ${schluessel}
      `) as any[];
      ok("… angepinnt und als Leitung gekennzeichnet", post.angepinnt === true && post.autor_typ === "leitung");

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("6. Umleitungen: kein Lesezeichen läuft ins Leere");
  // ═══════════════════════════════════════════════════════════════════════
  const app = readFileSync("client/src/App.tsx", "utf8");
  for (const [pfad, ziel] of [
    ["/admin/database", "kycOffen=1"],
    ["/admin/personen", "dubletten=1"],
    ["/admin/leads", "stufe=C"],
    ["/admin/kuendigungen", "kuendigungen=1"],
    ["/admin/kartei", "/admin/kunden"],
    ["/admin/nachbuchung", "/admin/team"],
  ] as const) {
    const muster = new RegExp(`path="${pfad}"[^\\n]*Umleitung nach="[^"]*${ziel.replace(/[/?=]/g, "\\$&")}`);
    ok(`${pfad} leitet um (${ziel})`, muster.test(app));
  }
  ok("Die Lead-Automatik bleibt erreichbar", /path="\/admin\/lead-automatik"/.test(app));
  // ── AM 10.08.2026 ENTFERNT ───────────────────────────────────────────
  // Die Altseiten waren als Rückfallebene gedacht, bis die Zentralen im
  // Betrieb bestätigt sind. Der Vorgesetzte hat entschieden: weg damit. Zwei
  // Wege zur selben Sache heißen zwei Stellen zum Ändern und eine zum
  // Vergessen. Beide Adressen leiten jetzt in die Zentrale.
  ok("Die alte Team-Adresse leitet um", /path="\/admin\/team-alt" component=\{\(\) => <Umleitung/.test(app));
  ok("Die alte Nachbuchung gibt es nicht mehr", !/path="\/admin\/nachbuchung-alt"/.test(app));

  const shell = readFileSync("client/src/components/admin/AdminShell.tsx", "utf8");
  for (const weg of ["/admin/database", "/admin/personen", "/admin/kartei", "/admin/kuendigungen", "/admin/nachbuchung"]) {
    ok(`Kein Menüpunkt mehr für ${weg}`, !new RegExp(`path: "${weg}"`).test(shell));
  }
  ok("Die Kunden-Zentrale steht im Menü", /label: "Kunden-Zentrale"/.test(shell));
  ok("Die Team-Zentrale steht im Menü", /label: "Team-Zentrale"/.test(shell));
  ok("Die Mail-Zentrale steht im Menü", /label: "Mail-Zentrale"/.test(shell));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("7. Team-Zentrale: dieselben Endpunkte wie vorher");
  // ═══════════════════════════════════════════════════════════════════════
  const teamSeite = readFileSync("client/src/pages/admin-team-zentrale.tsx", "utf8");
  ok("Provisionssatz läuft über den BESTEHENDEN Endpunkt",
    /admin\/agents\/\$\{id\}\/update/.test(teamSeite));
  ok("Nachbuchung läuft über den BESTEHENDEN Endpunkt",
    /admin\/commission-backfill\/\$\{encodeURIComponent\(k\.ref\)\}\/book/.test(teamSeite));
  ok("… und liest die Kandidaten von dort",
    /admin\/commission-backfill\/candidates/.test(teamSeite));
  const zentralen = readFileSync("server/routes/fiaon-zentralen.ts", "utf8");
  ok("Das Protokoll schreibt nichts NEUES mit",
    /fiaon_agent_events/.test(zentralen) && /fiaon_contact_log/.test(zentralen)
      && !/INSERT INTO fiaon_agent_events/.test(zentralen.split("logs")[1] ?? ""));
  ok("Massenlöschung ist als Vorgesetzten-Sache gekennzeichnet", /NUR der Vorgesetzte/.test(zentralen));

  const loeschLib = readFileSync("server/lib/fiaon-loeschen.ts", "utf8");
  ok("Vorschau und Ausführung benutzen DIESELBE Einteilung",
    /const v = await vorschau\(personIds, lauf\)/.test(loeschLib));
  ok("Die Anonymisierung nutzt dieselben Spalten wie der bestehende Weg",
    /gdpr_deleted_at = NOW\(\)/.test(loeschLib) && /bank_statement_pdf = NULL/.test(loeschLib));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("8. Gegenprobe: nichts geschrieben");
  // ═══════════════════════════════════════════════════════════════════════
  const [nachher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_applications)::int AS bestellungen,
           (SELECT COUNT(*) FROM fiaon_commissions)::int AS provisionen,
           (SELECT COUNT(*) FROM fiaon_loeschungen)::int AS loeschungen,
           (SELECT COUNT(*) FROM fiaon_team_nachrichten)::int AS nachrichten,
           (SELECT COUNT(*) FROM fiaon_posts)::int AS posts
  `;
  // Nicht auf Gleichheit bei Personen und Bestellungen: Der Betrieb läuft
  // weiter. Bei Löschungen und Nachrichten schon — dort schreibt nur dieser
  // Lauf, und er wurde zurückgerollt.
  for (const feld of ["personen", "bestellungen"] as const) {
    ok(`Nichts verloren: ${feld} (${vorher[feld]} → ${nachher[feld]})`,
      Number(nachher[feld]) >= Number(vorher[feld]));
  }
  gleich("Keine Provision angefasst", nachher.provisionen, vorher.provisionen);
  gleich("Kein Löschprotokoll übrig", nachher.loeschungen, vorher.loeschungen);
  gleich("Keine Nachricht übrig", nachher.nachrichten, vorher.nachrichten);
  gleich("Kein Post übrig", nachher.posts, vorher.posts);
  const reste = (await sqlPool`
    SELECT 'personen' AS was, COUNT(*)::int AS n FROM fiaon_persons WHERE last_name = ${`Zentrale${stempel}`}
    UNION ALL SELECT 'bestellungen', COUNT(*)::int FROM fiaon_applications WHERE ref LIKE ${`FIAON-ZEN${stempel}%`}
  `) as any[];
  for (const r of reste) gleich(`Keine eigene Zeile übrig: ${r.was}`, Number(r.n), 0);

  process.env.MAKE_WEBHOOK_URL = ECHT_MAKE;
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
