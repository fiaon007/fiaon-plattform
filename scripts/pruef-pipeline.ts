// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: Lead-Pipeline und Terminsystem
//
// Was hier schiefgehen kann, geht bei echten Menschen schief:
//   · Eine Doppelbuchung heißt, dass zwei Kunden zur selben Minute auf einen
//     Anruf warten und einer nie klingelt.
//   · Eine Mail zu viel heißt Spam-Beschwerde; eine zu wenig heißt, dass
//     jemand ein fünftes Mal vergeblich angerufen wird.
//   · Ein falsch gerechneter Zeitpunkt heißt: Termin am falschen Tag.
//
// ALLES LÄUFT IN EINER TRANSAKTION, DIE AM ENDE ZURÜCKGEROLLT WIRD, und der
// Webhook zeigt im Test auf eine Attrappe. Es geht KEINE echte Mail raus und
// es bleibt keine Zeile stehen.
//
//   npx tsx scripts/pruef-pipeline.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";

// ── Die Attrappe MUSS vor allem anderen stehen ─────────────────────────────
// `sendMakeWebhookMitGrund` liest MAKE_WEBHOOK_URL beim AUFRUF, nicht beim
// Laden — trotzdem wird die Variable hier zuerst umgebogen, bevor irgendein
// Modul sie zwischenspeichern könnte. Eine Adresse in der reservierten Zone
// `.invalid` kann per Norm nicht aufgelöst werden: Selbst wenn die Zeile
// wegfiele, ginge nichts an Make.
const ECHTE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
process.env.MAKE_WEBHOOK_URL = "http://attrappe.pruefstand.invalid/keine-echten-mails";

import { sqlPool } from "../server/lib/db-pool";
import { stufeAusTier, STUFEN } from "@shared/fiaon-kundenstatus";
import {
  berlinDatum, berlinWochentag, berlinZeitpunkt, freieSlots, minutenZuZeit,
  terminAbsagen, terminBuchen, terminTokenErzeugen, terminTokenPruefen,
  verfuegbarkeitSetzen, verfuegbarkeitVon, zeitZuMinuten, buchungAnwenden,
  TerminFehler, HORIZONT_TAGE, SLOT_MINUTEN, VORLAUF_STUNDEN,
} from "../server/lib/fiaon-termine";
import {
  automatikNachFehlversuch, erreichtZuruecksetzen, ruhtSql,
  SCHWELLE_MAIL, SCHWELLE_RUHE, RUHE_TAGE,
} from "../server/lib/fiaon-nicht-erreicht";
import { versendenUndProtokollieren } from "../server/lib/fiaon-mail-log";
import { wiedereinstiegKandidaten, STAFFEL_PRO_TAG } from "../server/lib/fiaon-wiedereinstieg";

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
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 62 - t.length))}`); }

class Zurueckrollen extends Error {}

const stempel = Date.now().toString(36).toUpperCase();
const REF = (s: string) => `FIAON-PIP${stempel}-${s}`;
const MAIL = (s: string) => `${s}-${stempel}@pruefstand-pipeline.test`.toLowerCase();

async function main(): Promise<void> {
  log("\n══ Prüfstand: Lead-Pipeline und Terminsystem ══");
  log(`   Webhook zeigt auf: ${process.env.MAKE_WEBHOOK_URL}`);

  const [vorher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_applications)::int AS bestellungen,
           (SELECT COUNT(*) FROM fiaon_termine)::int AS termine,
           (SELECT COUNT(*) FROM fiaon_mail_log)::int AS maillog,
           (SELECT COUNT(*) FROM fiaon_agent_verfuegbarkeit)::int AS verfuegbarkeit
  `;

  try {
    await sqlPool.begin(async (tx) => {
      const person = async (f: Record<string, unknown>): Promise<number> => {
        const [r] = await tx`
          INSERT INTO fiaon_persons ${tx({
            person_ref: `FIAON-P-PIP${stempel}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            first_name: "Prüf", last_name: `Pipeline${stempel}`, priority_tier: 2,
            tier_reason: "rechnung_offen", ...f,
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
            name: `Prüfagent ${stempel}`, email: MAIL("agent"), active: true,
            distribution_active: true, is_test_account: false, rolle: "agent", ...f,
          } as any)} RETURNING id
        `;
        return Number(r.id);
      };

      /**
       * Einen erwarteten Fehlschlag ausführen, ohne die Transaktion zu
       * vergiften.
       *
       * In PostgreSQL bricht EINE fehlgeschlagene Anweisung die ganze
       * Transaktion ab — jede weitere Abfrage endet danach mit „current
       * transaction is aborted". Ein Prüfstand, der Ablehnungen prüft, löst
       * genau das ständig aus. Der Sicherungspunkt fängt den Abbruch auf einer
       * Ebene darunter ab, sodass danach normal weitergearbeitet werden kann.
       */
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
      gruppe("1. Die Stufen sind das Tier — keine zweite Einstufung");
      // ═══════════════════════════════════════════════════════════════════
      gleich("Tier 1 ist Stufe A", stufeAusTier(1)?.marke, "A");
      gleich("Tier 2 ist Stufe B", stufeAusTier(2)?.marke, "B");
      gleich("Tier 3 ist Stufe C", stufeAusTier(3)?.marke, "C");
      ok("Tier 0 (bezahlt) hat KEINE Stufe — kein Arbeitsvorrat", stufeAusTier(0) === null);
      ok("Tier -1 (ausgeschlossen) hat keine Stufe", stufeAusTier(-1) === null);
      gleich("Stufe A heißt „Zahlung gemeldet“", STUFEN.A.text, "Zahlung gemeldet");
      ok("Stufe B nennt die abgelaufene Frist ausdrücklich",
        /Frist/i.test(STUFEN.B.begruendung), STUFEN.B.begruendung);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("2. Sortierung: Termin > Zusage > Rückruf > A > B > C");
      // ═══════════════════════════════════════════════════════════════════
      const sortAgent = await agent({ email: MAIL("sort"), first_name: "Sina" });
      const heute = berlinDatum(new Date());

      const pTermin = await person({ first_name: "Termin", assigned_agent_id: sortAgent, priority_tier: 3, tier_reason: "nur_lead" });
      const pZusage = await person({ first_name: "Zusage", assigned_agent_id: sortAgent, priority_tier: 2, tier_reason: "rechnung_offen", promised_payment_date: heute });
      const pA = await person({ first_name: "StufeA", assigned_agent_id: sortAgent, priority_tier: 1, tier_reason: "zahlung_angekuendigt" });
      const pB = await person({ first_name: "StufeB", assigned_agent_id: sortAgent, priority_tier: 2, tier_reason: "rechnung_offen" });
      const pC = await person({ first_name: "StufeC", assigned_agent_id: sortAgent, priority_tier: 3, tier_reason: "nur_lead" });
      for (const [p, s] of [[pTermin, "TERMIN"], [pZusage, "ZUSAGE"], [pA, "A"], [pB, "B"], [pC, "C"]] as [number, string][]) {
        await bestellung({ ref: REF(s), person_id: p });
      }
      // Der Termin-Kunde bekommt einen Termin HEUTE — dadurch muss er trotz
      // Stufe C ganz nach oben rutschen.
      await tx`
        INSERT INTO fiaon_termine (person_id, agent_id, beginn, status, quelle)
        VALUES (${pTermin}, ${sortAgent}, ${berlinZeitpunkt(heute, 14 * 60)}, 'gebucht', 'onboarding')
      `;

      // Dieselbe Tagesgrenze wie die Anwendung: Europe/Berlin, nicht UTC.
      // Am 09.08.2026 um 00:15 Uhr Berliner Zeit stand in der Datenbank noch
      // der 08.08. — eine Zusage „für heute" fiel dadurch aus dem obersten
      // Rang und landete hinter Stufe A. Der Prüfstand hat es gefunden.
      const HEUTE = `(NOW() AT TIME ZONE 'Europe/Berlin')::date`;
      const ORDNUNG = `
        CASE
          WHEN EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = p.id AND t.status = 'gebucht'
                        AND t.beginn::date = ${HEUTE}) THEN 1
          WHEN p.promised_payment_date IS NOT NULL AND p.promised_payment_date <= ${HEUTE} THEN 2
          WHEN EXISTS (SELECT 1 FROM fiaon_contact_log cl JOIN fiaon_applications a3 ON a3.ref = cl.ref
                        WHERE a3.person_id = p.id AND cl.outcome = 'rueckruf_termin' AND cl.done_at IS NULL
                          AND cl.voided_at IS NULL AND cl.scheduled_at IS NOT NULL AND cl.scheduled_at <= NOW()) THEN 3
          WHEN p.priority_tier = 1 THEN 4
          WHEN p.priority_tier = 2 AND p.tier_reason = 'rechnung_offen' THEN 5
          WHEN p.priority_tier = 2 AND p.tier_reason = 'zahlungsfrist_abgelaufen' THEN 6
          WHEN p.priority_tier = 2 THEN 7
          WHEN p.priority_tier = 3 AND p.tier_reason = 'antrag_abgebrochen' THEN 8
          ELSE 9
        END`;
      const reihe = (await tx.unsafe(`
        SELECT p.first_name FROM fiaon_persons p
        WHERE p.assigned_agent_id = ${sortAgent} AND p.merged_into_person_id IS NULL
        ORDER BY ${ORDNUNG} ASC, p.id ASC
      `)) as any[];
      gleich("Reihenfolge stimmt", reihe.map((r) => r.first_name).join(" > "),
        "Termin > Zusage > StufeA > StufeB > StufeC");
      const listenQuelle = (await import("node:fs")).readFileSync("server/routes/fiaon-agent-start.ts", "utf8");
      ok("Die Arbeitsliste rechnet in Europe/Berlin, nicht in UTC",
        !/CURRENT_DATE/.test(listenQuelle.split("\n").filter((z) => !/^\s*(\*|\/\/)/.test(z)).join("\n")));

      // Zahlungsmeldung hebt sofort auf A — auch aus Stufe C heraus.
      await tx`UPDATE fiaon_applications SET payment_status = 'claimed_paid' WHERE ref = ${REF("C")}`;
      const { personTierAktualisieren } = await import("../server/lib/tier");
      await personTierAktualisieren(tx as any, { personId: pC });
      const [cJetzt] = await tx`SELECT priority_tier, tier_reason FROM fiaon_persons WHERE id = ${pC}`;
      gleich("claimed_paid hebt sofort auf Stufe A", stufeAusTier(cJetzt.priority_tier)?.marke, "A");

      // Bankbestätigt bezahlt → Tier 0 → aus jeder Anrufliste raus.
      await tx`UPDATE fiaon_applications SET payment_status = 'paid' WHERE ref = ${REF("B")}`;
      await personTierAktualisieren(tx as any, { personId: pB });
      const [bJetzt] = await tx`SELECT priority_tier FROM fiaon_persons WHERE id = ${pB}`;
      gleich("Bezahlt ist Tier 0", Number(bJetzt.priority_tier), 0);
      ok("Bezahlt hat keine Stufe mehr", stufeAusTier(bJetzt.priority_tier) === null);
      const inListe = (await tx`
        SELECT id FROM fiaon_persons
        WHERE assigned_agent_id = ${sortAgent} AND priority_tier BETWEEN 1 AND 3 AND NOT is_blocked
      `) as any[];
      ok("Der Selbstzahler ist aus der Arbeitsliste heraus",
        !inListe.some((r) => Number(r.id) === pB));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("3. Nachschub: A vor B vor C, Besitzschutz unangetastet");
      // ═══════════════════════════════════════════════════════════════════
      // Die Reihenfolge steht als Datenpaar im Code — hier wird geprüft, dass
      // sie A, B, C lautet und nicht etwa alphabetisch oder zufällig ist.
      const nachschubQuelle = (await import("node:fs")).readFileSync("server/routes/fiaon-followup.ts", "utf8");
      ok("Nachschub kennt Tier 3",
        /\[3, a\.offen3, cap3\]/.test(nachschubQuelle));
      ok("Nachschub geht in der Reihenfolge 1, 2, 3",
        /\[\[1, a\.offen1, cap1\], \[2, a\.offen2, cap2\], \[3, a\.offen3, cap3\]\]/.test(nachschubQuelle));
      ok("Besitzschutz steht weiterhin in der Reserve-Abfrage",
        /AND p\.betreuung_seit IS NULL/.test(nachschubQuelle));

      const betreut = await person({ first_name: "Betreut", assigned_agent_id: null, priority_tier: 3, tier_reason: "nur_lead", betreuung_seit: "2026-07-01T10:00:00Z" });
      const frei = await person({ first_name: "Frei", assigned_agent_id: null, priority_tier: 3, tier_reason: "nur_lead" });
      const reserve = (await tx`
        SELECT p.id FROM fiaon_persons p
        WHERE p.assigned_agent_id IS NULL AND p.merged_into_person_id IS NULL
          AND p.priority_tier = 3 AND NOT p.is_blocked AND p.betreuung_seit IS NULL
          AND p.id IN (${betreut}, ${frei})
      `) as any[];
      ok("Eine betreute Person kommt NICHT aus der Reserve",
        !reserve.some((r) => Number(r.id) === betreut));
      ok("Eine unberührte Person schon", reserve.some((r) => Number(r.id) === frei));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("4. Nicht erreicht: genau EINE Mail, dann Ruhe");
      // ═══════════════════════════════════════════════════════════════════
      const neAgent = await agent({ email: MAIL("ne"), first_name: "Nora" });
      const neP = await person({
        first_name: "Unerreichbar", assigned_agent_id: neAgent,
        primary_email: MAIL("kunde"), priority_tier: 2, tier_reason: "rechnung_offen",
      });
      await bestellung({ ref: REF("NE"), person_id: neP });

      const zaehlerAuf = async (n: number) =>
        tx`UPDATE fiaon_persons SET unreachable_count = ${n} WHERE id = ${neP}`;
      const mailsFuer = async (pid: number) =>
        Number(((await tx`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE person_id = ${pid}`) as any[])[0].n);

      await zaehlerAuf(1);
      const w1 = await automatikNachFehlversuch(neP, tx as any);
      ok("Nach dem 1. Versuch passiert nichts", w1.mail === null && !w1.ruht);
      gleich("… und es steht nichts im Versandprotokoll", await mailsFuer(neP), 0);

      await zaehlerAuf(2);
      const w2 = await automatikNachFehlversuch(neP, tx as any);
      gleich(`Nach dem ${SCHWELLE_MAIL}. Versuch geht der Terminlink raus`, w2.mail, "fehlgeschlagen");
      gleich("… genau eine Zeile im Versandprotokoll", await mailsFuer(neP), 1);
      ok("… und der Fall ruht noch NICHT", !w2.ruht);

      await zaehlerAuf(3);
      const w3 = await automatikNachFehlversuch(neP, tx as any);
      ok("Beim 3. Versuch KEINE zweite Mail (30-Tage-Sperre)", w3.mail === null, JSON.stringify(w3));
      gleich("… das Protokoll bleibt bei einer Zeile", await mailsFuer(neP), 1);

      await zaehlerAuf(4);
      const w4 = await automatikNachFehlversuch(neP, tx as any);
      ok(`Nach dem ${SCHWELLE_RUHE}. Versuch beginnt die Ruhe`, w4.ruht);
      const [ruhtP] = await tx`SELECT ruhe_seit, follow_up_date FROM fiaon_persons WHERE id = ${neP}`;
      ok("ruhe_seit ist gesetzt", !!ruhtP.ruhe_seit);
      const tageBis = Math.round((new Date(ruhtP.follow_up_date).getTime() - Date.now()) / 86_400_000);
      ok(`Wiedervorlage liegt ${RUHE_TAGE} Tage voraus (ist ${tageBis})`, tageBis >= RUHE_TAGE - 1 && tageBis <= RUHE_TAGE + 1);

      const raus = (await tx.unsafe(`
        SELECT p.id FROM fiaon_persons p WHERE p.id = ${neP} AND NOT ${ruhtSql("p")}
      `)) as any[];
      gleich("Ruhende sind aus der Tagesliste heraus", raus.length, 0);
      const drin = (await tx.unsafe(`
        SELECT p.id FROM fiaon_persons p WHERE p.id = ${neP} AND ${ruhtSql("p")}
      `)) as any[];
      gleich("… aber im Filter „Ruhend“ sichtbar", drin.length, 1);

      // Stufe A ruht NICHT — dort hängt gemeldetes Geld dran.
      const aP = await person({
        first_name: "Meldet", assigned_agent_id: neAgent, primary_email: MAIL("meldet"),
        priority_tier: 1, tier_reason: "zahlung_angekuendigt", unreachable_count: 5,
      });
      await bestellung({ ref: REF("A-RUHE"), person_id: aP, payment_status: "claimed_paid" });
      const wA = await automatikNachFehlversuch(aP, tx as any);
      ok("Stufe A kommt NICHT in den Ruhe-Pool", !wA.ruht);
      const [aRuht] = await tx`SELECT ruhe_seit FROM fiaon_persons WHERE id = ${aP}`;
      ok("… ruhe_seit bleibt leer", !aRuht.ruhe_seit);

      // Ohne E-Mail keine Mail — aber der Link-Kopierpfad existiert.
      const ohneMail = await person({
        first_name: "Ohnemail", assigned_agent_id: neAgent, primary_email: null,
        priority_tier: 2, tier_reason: "rechnung_offen", unreachable_count: 2,
      });
      const wO = await automatikNachFehlversuch(ohneMail, tx as any);
      gleich("Ohne E-Mail wird übersprungen, nicht versendet", wO.mail, "uebersprungen");
      ok("… der Hinweis nennt den Kopierweg", /Terminlink/i.test(wO.hinweis || ""), wO.hinweis || "");
      const [ohneStempel] = await tx`SELECT terminlink_mail_am FROM fiaon_persons WHERE id = ${ohneMail}`;
      ok("… und die 30-Tage-Sperre startet NICHT (er hat ja nichts bekommen)", !ohneStempel.terminlink_mail_am);
      ok("Der Buchungslink ist trotzdem erzeugbar", terminTokenErzeugen(ohneMail).split(".").length === 3);
      const kartenQuelle = (await import("node:fs")).readFileSync("server/routes/fiaon-agent-start.ts", "utf8");
      ok("Die Karte liefert den Terminlink mit", /terminLink: terminLink\(Number\(p\.id\)\)/.test(kartenQuelle));

      // Erreicht setzt zurück.
      await erreichtZuruecksetzen(neP, tx as any);
      const [zurueck] = await tx`SELECT unreachable_count, ruhe_seit FROM fiaon_persons WHERE id = ${neP}`;
      gleich("„Erreicht“ setzt den Zähler auf 0", Number(zurueck.unreachable_count), 0);
      ok("… und beendet die Ruhe", !zurueck.ruhe_seit);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("5. Zeitrechnung: Europe/Berlin, nicht Serverzeit");
      // ═══════════════════════════════════════════════════════════════════
      // Sommerzeit: Am 15.08. ist Berlin UTC+2 — 22:00 Wiener Wandzeit ist
      // derselbe Tag, nicht der nächste. Genau hier ist Ticket #13 entstanden.
      const sommer = berlinZeitpunkt("2026-08-15", 22 * 60);
      gleich("22:00 Berlin am 15.08. ist 20:00 UTC", sommer.toISOString(), "2026-08-15T20:00:00.000Z");
      gleich("… und bleibt beim 15.08. in Berlin", berlinDatum(sommer), "2026-08-15");
      const winter = berlinZeitpunkt("2026-01-15", 22 * 60);
      gleich("Im Winter ist 22:00 Berlin 21:00 UTC", winter.toISOString(), "2026-01-15T21:00:00.000Z");
      gleich("Auch im Winter derselbe Tag", berlinDatum(winter), "2026-01-15");
      // Die Nacht der Zeitumstellung 2026: 29.03. (Frühjahr), 25.10. (Herbst).
      const umstellung = berlinZeitpunkt("2026-03-29", 10 * 60);
      gleich("Am Umstellungstag stimmt 10:00 noch", berlinDatum(umstellung), "2026-03-29");
      gleich("Montag ist ISO-Tag 1", berlinWochentag("2026-08-10"), 1);
      gleich("Sonntag ist ISO-Tag 7", berlinWochentag("2026-08-16"), 7);
      gleich("Zeit hin und zurück", minutenZuZeit(zeitZuMinuten("09:20")!), "09:20");
      ok("Unsinnige Zeit wird abgelehnt", zeitZuMinuten("25:99") === null);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("6. Slots: Vorgabe, Vorlauf, Horizont, Raster");
      // ═══════════════════════════════════════════════════════════════════
      const slotAgent = await agent({ email: MAIL("slot"), first_name: "Sven" });
      const kunde = await person({ first_name: "Bucht", assigned_agent_id: slotAgent, primary_email: MAIL("bucht") });
      await bestellung({ ref: REF("SLOT"), person_id: kunde });

      const vorgabe = await verfuegbarkeitVon(slotAgent, tx as any);
      gleich("Ohne eigene Zeiten gilt die Vorgabe: 5 Tage", vorgabe.length, 5);
      ok("… Mo–Fr", vorgabe.every((f) => f.wochentag >= 1 && f.wochentag <= 5));
      ok("… 09:00 bis 18:00", vorgabe.every((f) => f.von === "09:00" && f.bis === "18:00"));

      const auskunft = await freieSlots(kunde, tx as any);
      ok("Es gibt freie Slots", auskunft.slots.length > 0, String(auskunft.slots.length));
      gleich("Der Betreuer ist gesetzt", auskunft.betreuer?.id, slotAgent);
      ok("ALLE Slots gehören dem Betreuer — niemand bucht sich weg",
        auskunft.slots.every((s) => s.agentId === slotAgent));
      const frueh = Date.now() + VORLAUF_STUNDEN * 3600_000;
      ok(`Kein Slot innerhalb des Vorlaufs von ${VORLAUF_STUNDEN} h`,
        auskunft.slots.every((s) => new Date(s.beginn).getTime() >= frueh));
      const spaet = Date.now() + HORIZONT_TAGE * 86_400_000;
      ok(`Kein Slot jenseits von ${HORIZONT_TAGE} Tagen`,
        auskunft.slots.every((s) => new Date(s.beginn).getTime() <= spaet));
      ok("Kein Slot am Wochenende (Vorgabe Mo–Fr)",
        auskunft.slots.every((s) => berlinWochentag(s.datum) <= 5));
      ok(`Alle Slots liegen im ${SLOT_MINUTEN}-Minuten-Raster`,
        auskunft.slots.every((s) => {
          const min = zeitZuMinuten(s.uhrzeit)!;
          return (min - 9 * 60) % SLOT_MINUTEN === 0;
        }));

      // Eigene Zeiten schlagen die Vorgabe.
      await verfuegbarkeitSetzen(slotAgent, [{ wochentag: 3, von: "10:00", bis: "11:00", aktiv: true }], tx as any);
      const eigene = await verfuegbarkeitVon(slotAgent, tx as any);
      gleich("Eigene Zeiten ersetzen die Vorgabe", eigene.length, 1);
      const nurMi = await freieSlots(kunde, tx as any);
      ok("Danach nur noch Mittwoch", nurMi.slots.every((s) => berlinWochentag(s.datum) === 3));
      ok("… und nur zwischen 10 und 11", nurMi.slots.every((s) => {
        const m = zeitZuMinuten(s.uhrzeit)!;
        return m >= 600 && m < 660;
      }));
      gleich("Eine Stunde im 20-Minuten-Raster sind 3 Slots je Tag",
        nurMi.slots.filter((s) => s.datum === nurMi.slots[0]?.datum).length, 3);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("7. Buchen: keine Doppelbuchung, keine Zeitreise");
      // ═══════════════════════════════════════════════════════════════════
      await verfuegbarkeitSetzen(slotAgent, [1, 2, 3, 4, 5].map((wochentag) => ({
        wochentag, von: "09:00", bis: "18:00", aktiv: true,
      })), tx as any);
      const frei2 = await freieSlots(kunde, tx as any);
      const zielSlot = frei2.slots[0];
      ok("Ein Slot steht zum Buchen bereit", !!zielSlot);

      const buchung = await terminBuchen({
        personId: kunde, agentId: slotAgent, beginn: zielSlot.beginn, quelle: "onboarding",
      }, tx as any);
      ok("Buchung gelingt", buchung.id > 0);
      ok("Ein Storno-Token wurde erzeugt", /^[0-9a-f]{48}$/.test(buchung.stornoToken));

      // Der zweite Versuch auf denselben Slot MUSS scheitern. Das ist die
      // eigentliche Prüfung: Der eindeutige Index, nicht die Vorabprüfung.
      const doppeltCode = await erwarteFehler((sp) => terminBuchen({
        personId: kunde, agentId: slotAgent, beginn: zielSlot.beginn, quelle: "nichterreicht_mail",
      }, sp));
      ok("Zweite Buchung auf denselben Slot wird abgelehnt", doppeltCode !== "", doppeltCode);
      gleich("… mit dem Grund „belegt“", doppeltCode, "belegt");
      const [wieviele] = await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_termine
        WHERE agent_id = ${slotAgent} AND beginn = ${new Date(zielSlot.beginn)} AND status = 'gebucht'
      `;
      gleich("Genau EINE Buchung steht auf dem Slot", Number(wieviele.n), 1);

      ok("Der gebuchte Slot wird nicht mehr angeboten",
        !(await freieSlots(kunde, tx as any)).slots.some((s) => s.beginn === zielSlot.beginn));

      const verboten = async (name: string, code: string, beginn: Date) => {
        gleich(name, await erwarteFehler((sp) =>
          terminBuchen({ personId: kunde, agentId: slotAgent, beginn, quelle: "onboarding" }, sp)), code);
      };
      await verboten("Termin in der Vergangenheit abgelehnt", "zu_frueh", new Date(Date.now() - 86_400_000));
      await verboten("Termin in 30 Minuten abgelehnt (Vorlauf)", "zu_frueh", new Date(Date.now() + 30 * 60_000));
      await verboten(`Termin in ${HORIZONT_TAGE + 5} Tagen abgelehnt (Horizont)`, "zu_spaet",
        new Date(Date.now() + (HORIZONT_TAGE + 5) * 86_400_000));
      // Eine Zeit ausserhalb des Rasters (09:07) darf nicht buchbar sein, auch
      // wenn jemand die Anfrage selbst baut.
      const morgen = berlinDatum(new Date(Date.now() + 2 * 86_400_000));
      await verboten("Zeit ausserhalb des Rasters abgelehnt", "kein_slot", berlinZeitpunkt(morgen, 9 * 60 + 7));
      await verboten("Zeit ausserhalb der Sprechzeit abgelehnt", "kein_slot", berlinZeitpunkt(morgen, 22 * 60));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("8. Besitzschutz: mit Betreuer, ohne Betreuer");
      // ═══════════════════════════════════════════════════════════════════
      const agentX = await agent({ email: MAIL("x"), first_name: "Xenia" });
      const agentY = await agent({ email: MAIL("y"), first_name: "Yannic" });
      const herrenlos = await person({ first_name: "Herrenlos", assigned_agent_id: null, primary_email: MAIL("herrenlos") });
      await bestellung({ ref: REF("HERR"), person_id: herrenlos });

      const offeneAuswahl = await freieSlots(herrenlos, tx as any);
      ok("Ohne Betreuer: kein Betreuer gemeldet", offeneAuswahl.betreuer === null);
      const angeboteneAgenten = new Set(offeneAuswahl.slots.map((s) => s.agentId));
      ok("Ohne Betreuer verteilen sich die Zeiten auf mehrere Ansprechpartner",
        angeboteneAgenten.size > 1, String(angeboteneAgenten.size));
      // Jede Uhrzeit darf nur EINMAL angeboten werden — sonst stünde „09:00"
      // viermal untereinander (gesehen im Screenshot vom 08.08.2026).
      const zeitpunkte = offeneAuswahl.slots.map((s) => s.beginn);
      gleich("Jede Uhrzeit steht genau einmal in der Liste",
        zeitpunkte.length, new Set(zeitpunkte).size);
      // Und die Last verteilt sich halbwegs gleichmäßig statt komplett auf einen.
      const jeAgent = new Map<number, number>();
      for (const s of offeneAuswahl.slots) jeAgent.set(s.agentId, (jeAgent.get(s.agentId) ?? 0) + 1);
      const werte = Array.from(jeAgent.values());
      // Toleranz 2, nicht 1: Agenten mit eigenen Zeitfenstern haben
      // unterschiedlich viele Slots im Angebot, der Ausgleich kann nie exakt
      // aufgehen. Gemeint ist „niemand bekommt alles", nicht Millimeterarbeit.
      ok("Kein Agent bekommt alle Zeiten",
        Math.max(...werte) - Math.min(...werte) <= 2, JSON.stringify(werte));

      const wahl = offeneAuswahl.slots.find((s) => s.agentId === agentY);
      ok("Yannic ist wählbar", !!wahl);
      const gepinnt = await terminBuchen({
        personId: herrenlos, agentId: agentY, beginn: wahl!.beginn, quelle: "nichterreicht_mail",
      }, tx as any);
      await buchungAnwenden(gepinnt, tx as any);
      const [nachher] = await tx`
        SELECT assigned_agent_id, betreuung_seit, unreachable_count, ruhe_seit, follow_up_date
        FROM fiaon_persons WHERE id = ${herrenlos}
      `;
      gleich("Die Buchung pinnt den gewählten Agenten", Number(nachher.assigned_agent_id), agentY);
      ok("… und setzt den Besitzschutz (betreuung_seit)", !!nachher.betreuung_seit);
      ok("Der Schutz ist derselbe, den Nachschub respektiert",
        /AND p\.betreuung_seit IS NULL/.test(nachschubQuelle));

      // Jetzt MIT Betreuer: nur noch dessen Slots.
      const nurYannic = await freieSlots(herrenlos, tx as any);
      gleich("Danach nur noch Slots des Betreuers",
        new Set(nurYannic.slots.map((s) => s.agentId)).size, 1);
      gleich("… und zwar Yannic", nurYannic.slots[0]?.agentId, agentY);
      ok("Xenia wird nicht mehr angeboten", !nurYannic.slots.some((s) => s.agentId === agentX));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("9. Buchung setzt Zähler zurück und holt aus der Ruhe");
      // ═══════════════════════════════════════════════════════════════════
      const ruhig = await person({
        first_name: "Ruhig", assigned_agent_id: slotAgent, primary_email: MAIL("ruhig"),
        unreachable_count: 4, ruhe_seit: new Date().toISOString(),
        follow_up_date: berlinDatum(new Date(Date.now() + 14 * 86_400_000)),
      });
      await bestellung({ ref: REF("RUHIG"), person_id: ruhig });
      const freiR = (await freieSlots(ruhig, tx as any)).slots[0];
      const bR = await terminBuchen({ personId: ruhig, agentId: slotAgent, beginn: freiR.beginn, quelle: "nichterreicht_mail" }, tx as any);
      await buchungAnwenden(bR, tx as any);
      const [rNach] = await tx`SELECT unreachable_count, ruhe_seit, follow_up_date FROM fiaon_persons WHERE id = ${ruhig}`;
      gleich("Terminbuchung setzt den Zähler auf 0", Number(rNach.unreachable_count), 0);
      ok("… beendet die Ruhe", !rNach.ruhe_seit);
      gleich("… und legt die Wiedervorlage auf den Termintag",
        berlinDatum(new Date(rNach.follow_up_date)), berlinDatum(new Date(bR.beginn)));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("10. Storno: einmalig gültig, gibt den Slot frei");
      // ═══════════════════════════════════════════════════════════════════
      const falsch = await terminAbsagen("a".repeat(48), "kunde", tx as any);
      ok("Ein falscher Storno-Token bewirkt nichts", !falsch.ok);
      const weg = await terminAbsagen(buchung.stornoToken, "kunde", tx as any);
      ok("Der richtige Token sagt ab", weg.ok);
      const nochmal = await terminAbsagen(buchung.stornoToken, "kunde", tx as any);
      ok("Derselbe Token ein zweites Mal: wirkungslos", !nochmal.ok);
      const [statusNach] = await tx`SELECT status FROM fiaon_termine WHERE id = ${buchung.id}`;
      gleich("Der Termin steht auf abgesagt", statusNach.status, "abgesagt");
      ok("Der Slot ist danach wieder frei",
        (await freieSlots(kunde, tx as any)).slots.some((s) => s.beginn === zielSlot.beginn));
      // Und er ist wieder buchbar — der Index sperrt abgesagte Termine nicht.
      const neu = await terminBuchen({ personId: kunde, agentId: slotAgent, beginn: zielSlot.beginn, quelle: "onboarding" }, tx as any);
      ok("Der freigegebene Slot lässt sich neu buchen", neu.id > 0);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("11. Token: signiert, fälschungssicher, mit Ablauf");
      // ═══════════════════════════════════════════════════════════════════
      const token = terminTokenErzeugen(kunde);
      gleich("Ein gültiges Token nennt seine Person", terminTokenPruefen(token)?.personId, kunde);
      ok("Ein gültiges Token ist nicht abgelaufen", terminTokenPruefen(token)?.abgelaufen === false);
      ok("Unsinn wird abgelehnt", terminTokenPruefen("abc") === null);
      ok("Leeres Token wird abgelehnt", terminTokenPruefen("") === null);
      const [pid, exp] = token.split(".");
      ok("Manipulierte Signatur wird abgelehnt",
        terminTokenPruefen(`${pid}.${exp}.${"0".repeat(32)}`) === null);
      ok("Fremde Person mit gültiger Signatur wird abgelehnt",
        terminTokenPruefen(`${kunde + 1}.${exp}.${token.split(".")[2]}`) === null);
      const alt = terminTokenErzeugen(kunde, -1000);
      ok("Ein abgelaufenes Token wird als abgelaufen erkannt", terminTokenPruefen(alt)?.abgelaufen === true);
      ok("… nennt aber weiterhin die Person (freundliche Seite statt Fehler)",
        terminTokenPruefen(alt)?.personId === kunde);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("12. „Nicht erschienen“ zählt wie ein Fehlversuch");
      // ═══════════════════════════════════════════════════════════════════
      const routeQuelle = (await import("node:fs")).readFileSync("server/routes/fiaon-termin.ts", "utf8");
      ok("Die Route erhöht bei „verpasst“ den Zähler",
        /status = 'verpasst'[\s\S]{0,900}unreachable_count = unreachable_count \+ 1/.test(routeQuelle)
        || /verpasst[\s\S]{0,1200}unreachable_count \+ 1/.test(routeQuelle));
      ok("… und ruft dieselbe Automatik wie ein Telefonat",
        /automatikNachFehlversuch/.test(routeQuelle));
      ok("„Erledigt“ setzt dagegen zurück", /erreichtZuruecksetzen/.test(routeQuelle));

      const verpasstP = await person({
        first_name: "Verpasst", assigned_agent_id: slotAgent, primary_email: MAIL("verpasst"),
        unreachable_count: 3, priority_tier: 2, tier_reason: "rechnung_offen",
      });
      await bestellung({ ref: REF("VERPASST"), person_id: verpasstP });
      await tx`UPDATE fiaon_persons SET unreachable_count = unreachable_count + 1 WHERE id = ${verpasstP}`;
      const wV = await automatikNachFehlversuch(verpasstP, tx as any);
      ok("Der 4. verpasste Termin führt in die Ruhe", wV.ruht);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("13. Webhook nicht erreichbar → kein Absturz, aber Spur");
      // ═══════════════════════════════════════════════════════════════════
      const spurP = await person({ first_name: "Spur", primary_email: MAIL("spur") });
      let stuerzteAb = false;
      let ergebnis: any = null;
      try {
        ergebnis = await versendenUndProtokollieren("termin_bestaetigung", {
          email: MAIL("spur"), vorname: "Spur", agent_vorname: "Sven",
          termin_datum: "12.08.2026", termin_uhrzeit: "14:20", storno_link: "https://example.invalid/x",
        }, { personId: spurP, lauf: tx as any });
      } catch { stuerzteAb = true; }
      ok("Ein toter Webhook wirft NICHT", !stuerzteAb);
      gleich("… das Ergebnis heißt „fehlgeschlagen“", ergebnis?.status, "fehlgeschlagen");
      ok("… mit einem Grund im Klartext", !!ergebnis?.grund, String(ergebnis?.grund));
      const [spurZeile] = await tx`
        SELECT event, status, grund, empfaenger FROM fiaon_mail_log
        WHERE person_id = ${spurP} ORDER BY id DESC LIMIT 1
      `;
      gleich("Es steht im Versandprotokoll", spurZeile?.status, "fehlgeschlagen");
      gleich("… mit dem richtigen Ereignis", spurZeile?.event, "termin_bestaetigung");
      ok("… und dem Empfänger", String(spurZeile?.empfaenger).includes("spur"));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("14. Wiedereinstieg: die Ausschlüsse greifen");
      // ═══════════════════════════════════════════════════════════════════
      const lange = new Date(Date.now() - 60 * 86_400_000).toISOString();
      const machKandidat = async (name: string, extra: Record<string, unknown> = {},
                                  bestell: Record<string, unknown> = {}) => {
        const id = await person({
          first_name: name, last_name: `Wieder${stempel}`, primary_email: MAIL(name.toLowerCase()),
          priority_tier: 2, tier_reason: "zahlungsfrist_abgelaufen",
          created_at: lange, assigned_at: new Date().toISOString(), ...extra,
        });
        await bestellung({ ref: REF(`W-${name}`), person_id: id, created_at: lange, ...bestell });
        return id;
      };
      const wNormal = await machKandidat("Normal");
      const wBezahlt = await machKandidat("Bezahlt", {}, { payment_status: "paid" });
      const wGesperrt = await machKandidat("Gesperrt", { is_blocked: true });
      const wSuspend = await machKandidat("Suspend", { account_status: "suspended" });
      const wDsgvo = await machKandidat("Dsgvo", {}, { gdpr_deleted_at: lange });
      const wSchon = await machKandidat("Schon", { wiedereinstieg_am: lange });
      const wLink = await machKandidat("Linkschon", { terminlink_mail_am: lange });
      const wOhneMail = await machKandidat("Ohnemail", { primary_email: null });
      const wTest = await person({
        first_name: "Test", last_name: "Test", primary_email: MAIL("tt"),
        priority_tier: 2, tier_reason: "rechnung_offen", created_at: lange,
      });
      await bestellung({ ref: REF("W-TEST"), person_id: wTest, created_at: lange });
      const wFrisch = await machKandidat("Frisch", { created_at: new Date().toISOString() },
        { created_at: new Date().toISOString() });
      const wTermin = await machKandidat("HatTermin");
      await tx`
        INSERT INTO fiaon_termine (person_id, agent_id, beginn, status, quelle)
        VALUES (${wTermin}, ${slotAgent}, ${new Date(Date.now() + 3 * 86_400_000)}, 'gebucht', 'onboarding')
      `;

      const kandidaten = await wiedereinstiegKandidaten(null, tx as any);
      const ids = new Set(kandidaten.map((k) => k.personId));
      ok("Ein stiller Kunde mit offener Rechnung ist dabei", ids.has(wNormal));
      for (const [name, id] of [
        ["Bezahlt", wBezahlt], ["Gesperrt", wGesperrt], ["Konto gesperrt", wSuspend],
        ["DSGVO-gelöscht", wDsgvo], ["hat die Mail schon", wSchon],
        ["hat den Terminlink schon", wLink], ["ohne E-Mail", wOhneMail],
        ["Testdatensatz", wTest], ["frisch angelegt", wFrisch], ["hat einen Termin", wTermin],
      ] as [string, number][]) {
        ok(`Ausgeschlossen: ${name}`, !ids.has(id));
      }
      gleich("Die Staffel ist auf 50 begrenzt", STAFFEL_PRO_TAG, 50);
      const gestaffelt = await wiedereinstiegKandidaten(STAFFEL_PRO_TAG, tx as any);
      ok("… und die Abfrage hält sich daran", gestaffelt.length <= STAFFEL_PRO_TAG, String(gestaffelt.length));
      // Der Fehler vom 08.08.2026: Eine Systemnotiz über eine FEHLGESCHLAGENE
      // Mail galt als Kundenkontakt und setzte die Stille-Uhr auf null. Damit
      // leerte sich die Zielgruppe genau dann, wenn der Versand nicht klappte.
      const stillMitNotiz = await machKandidat("Systemnotiz");
      await tx`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
        VALUES (${REF("W-Systemnotiz")}, NULL, 'System', 'system', 'Terminlink-Mail versandt', NOW())
      `;
      const nachNotiz = new Set((await wiedereinstiegKandidaten(null, tx as any)).map((k) => k.personId));
      ok("Eine Systemnotiz zählt NICHT als Kundenkontakt", nachNotiz.has(stillMitNotiz));
      // Ein echtes, von einem Menschen dokumentiertes Ergebnis dagegen schon.
      const [einAgent] = (await tx`SELECT id FROM fiaon_agents WHERE id = ${slotAgent}`) as any[];
      await tx`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note, created_at)
        VALUES (${REF("W-Systemnotiz")}, ${einAgent.id}, 'Prüfagent', 'result', 'nicht_erreicht', 'echter Anruf', NOW())
      `;
      const nachAnruf = new Set((await wiedereinstiegKandidaten(null, tx as any)).map((k) => k.personId));
      ok("Ein dokumentierter Anruf dagegen schon", !nachAnruf.has(stillMitNotiz));

      ok("Ein toter Kanal verbrennt die Zielgruppe nicht",
        /if \(!process\.env\.MAKE_WEBHOOK_URL\)/.test(
          (await import("node:fs")).readFileSync("server/lib/fiaon-wiedereinstieg.ts", "utf8")));
      ok("… und die Terminerinnerung ebenso wenig",
        /if \(!process\.env\.MAKE_WEBHOOK_URL\) return 0;/.test(
          (await import("node:fs")).readFileSync("server/routes/fiaon-followup.ts", "utf8")));

      ok("Die Zielgruppe misst NICHT über assigned_at",
        !/p\.assigned_at, p\.created_at\) < NOW\(\)/.test(
          (await import("node:fs")).readFileSync("server/lib/fiaon-wiedereinstieg.ts", "utf8")));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("15. Erinnerungen: genau einmal, auch bei Neustart");
      // ═══════════════════════════════════════════════════════════════════
      const erinnerP = await person({ first_name: "Erinnere", assigned_agent_id: slotAgent, primary_email: MAIL("erinnere") });
      await bestellung({ ref: REF("ERINNER"), person_id: erinnerP });
      const [terminBald] = await tx`
        INSERT INTO fiaon_termine (person_id, agent_id, beginn, status, quelle, storno_token)
        VALUES (${erinnerP}, ${slotAgent}, ${new Date(Date.now() + 12 * 3600_000)}, 'gebucht', 'onboarding', ${"b".repeat(48)})
        RETURNING id
      `;
      const beanspruchen = async () => (await tx`
        UPDATE fiaon_termine SET erinnert_am = NOW()
        WHERE id IN (
          SELECT t.id FROM fiaon_termine t
          WHERE t.status = 'gebucht' AND t.erinnert_am IS NULL
            AND t.beginn BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
            AND t.id = ${terminBald.id}
        ) RETURNING id
      `) as any[];
      gleich("Der erste Lauf beansprucht den Termin", (await beanspruchen()).length, 1);
      gleich("Ein zweiter Lauf findet nichts mehr (Neustart-fest)", (await beanspruchen()).length, 0);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("16. Keine echte Mail, kein echter Vorgang");
      // ═══════════════════════════════════════════════════════════════════
      ok("Der Webhook zeigt auf die Attrappe",
        String(process.env.MAKE_WEBHOOK_URL).includes("attrappe.pruefstand.invalid"));
      const echte = (await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE status = 'versandt'
          AND created_at > NOW() - INTERVAL '5 minutes'
      `) as any[];
      gleich("Nicht eine einzige Mail gilt als versandt", Number(echte[0].n), 0);

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("17. Gegenprobe: der Bestand ist unverändert");
  // ═══════════════════════════════════════════════════════════════════════
  const [nachher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_applications)::int AS bestellungen,
           (SELECT COUNT(*) FROM fiaon_termine)::int AS termine,
           (SELECT COUNT(*) FROM fiaon_mail_log)::int AS maillog,
           (SELECT COUNT(*) FROM fiaon_agent_verfuegbarkeit)::int AS verfuegbarkeit
  `;
  for (const feld of ["personen", "bestellungen", "termine", "maillog", "verfuegbarkeit"] as const) {
    gleich(`Zurückgerollt, keine Reste: ${feld}`, Number(nachher[feld]), Number(vorher[feld]));
  }
  const [reste] = await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE last_name = ${`Pipeline${stempel}`}
  `;
  gleich("Keine Prüf-Person übrig", Number(reste.n), 0);

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
