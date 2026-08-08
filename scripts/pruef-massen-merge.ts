// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: Massen-Zusammenführung
//
// Der Lauf fasst 628 Personensätze zu 366 Menschen zusammen — ohne dass ein
// Mensch jeden Fall ansieht. Genau deshalb muss die Maschine vorher beweisen,
// dass sie die beiden Fehler nicht macht, die hier wehtun:
//
//   zu wenig  → die Kartei bleibt doppelt (ärgerlich, reparierbar)
//   zu viel   → zwei Menschen werden einer (nicht reparierbar in dem Sinne,
//               der zählt: Der Kunde sieht die Rechnung eines Fremden)
//
// ALLES LÄUFT IN EINER TRANSAKTION, DIE AM ENDE ZURÜCKGEROLLT WIRD. Es wird nie
// etwas geschrieben, also gibt es auch nichts aufzuräumen.
//
//   npx tsx scripts/pruef-massen-merge.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import {
  besserenNamenFinden, bildeGruppen, invariantenBrueche, invariantenBruecheGesamt,
  ladeMassenPersonen, namensGuete, vornamenVereinbar, waehleBetreuer, waehleGewinner,
  type MassenPerson, type Stand,
} from "../server/lib/fiaon-massen-merge";
import { personenZusammenfuehren } from "../server/lib/fiaon-person-merge";
import { hygieneAusfuehren, hygieneFaelle } from "../server/lib/fiaon-produkt-hygiene";
import { produktstand } from "../server/lib/fiaon-produktstand";

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
const REF = (s: string) => `FIAON-PMM${stempel}-${s}`;
// Kein `.invalid` und kein `example.com`: Beides würde die Personen als
// Testdatensätze ausschließen — dann prüfte dieser Lauf die Ausschlussregel
// statt der Gruppenbildung. `.test` ist für genau diesen Zweck reserviert.
const MAIL = (s: string) => `${s}-${stempel}@pruefstand-massen.test`.toLowerCase();
const AKTEUR = { name: "Prüfstand (massen-merge)", agentId: null as number | null };

async function main(): Promise<void> {
  log("\n══ Prüfstand: Massen-Zusammenführung ══");

  const [vorher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_applications)::int AS bestellungen,
           (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_commissions)::int AS provisionen
  `;

  try {
    await sqlPool.begin(async (tx) => {
      const person = async (felder: Record<string, unknown>): Promise<number> => {
        const [r] = await tx`
          INSERT INTO fiaon_persons ${tx({
            person_ref: `FIAON-P-PM${stempel}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            kind: "private", account_status: "pending", priority_tier: 2, ...felder,
          } as any)} RETURNING id
        `;
        return Number(r.id);
      };
      const bestellung = async (felder: Record<string, unknown>): Promise<string> => {
        const [r] = await tx`
          INSERT INTO fiaon_applications ${tx({
            type: "private", status: "completed", payment_status: "pending_payment",
            pack_key: "ultra", pack_name: "FIAON Ultra\n(Elite Konto)", amount_due: "79.99",
            ...felder,
          } as any)} RETURNING ref
        `;
        return String(r.ref);
      };
      const kontakt = async (ref: string, agentId: number | null, wann: string) => {
        await tx`
          INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note, created_at)
          VALUES (${ref}, ${agentId}, ${"Prüfstand"}, 'call', 'erreicht', 'Prüfstand', ${wann})
        `;
      };

      // ═══════════════════════════════════════════════════════════════════
      gruppe("1. Vornamen: was vereinbar ist und was nicht");
      // ═══════════════════════════════════════════════════════════════════
      for (const [a, b] of [["Michael", "Michael"], ["Alex", "Alexander"], ["Ann", "Anna"],
        ["Mochael", "Michael"], ["Klaus Michael", "Michael"], ["Anna Maria", "Anna"],
        ["", "Gerda"], ["Hans-Rudolf", "Hans Rudolf"]] as [string, string][]) {
        ok(`vereinbar: „${a || "leer"}“ ↔ „${b}“`, vornamenVereinbar(a, b));
      }
      for (const [a, b] of [["Franz", "Gerda"], ["Nicole", "Athanasios"], ["Jan", "Tim"],
        ["Lisa", "Lena"], ["Michael", "Klaus"], ["Magdalena", "Konstantinos"]] as [string, string][]) {
        ok(`NICHT vereinbar: „${a}“ ↔ „${b}“`, !vornamenVereinbar(a, b));
      }

      // ═══════════════════════════════════════════════════════════════════
      gruppe("2. Kette: A~B über Telefon, B~C über E-Mail → EINE Gruppe");
      // ═══════════════════════════════════════════════════════════════════
      const nachnameKette = `Kettenmann${stempel}`;
      const kettenMail = MAIL("kette");
      const pA = await person({ first_name: "Kim", last_name: nachnameKette, phone_key9: "917342851", primary_phone: "+49151917342851" });
      const pB = await person({ first_name: "Kim", last_name: nachnameKette, phone_key9: "917342851", primary_phone: "+49151917342851", primary_email: kettenMail });
      const pC = await person({ first_name: "Kim", last_name: nachnameKette, phone_key9: "917342852", primary_phone: "+49151917342852", primary_email: kettenMail });
      const refA = await bestellung({ ref: REF("KETTE-A"), person_id: pA });
      const refB = await bestellung({ ref: REF("KETTE-B"), person_id: pB });
      const refC = await bestellung({ ref: REF("KETTE-C"), person_id: pC });
      await kontakt(refA, null, "2026-08-01T10:00:00Z");
      await kontakt(refB, null, "2026-08-02T10:00:00Z");
      await kontakt(refC, null, "2026-08-03T10:00:00Z");

      const personen1 = await ladeMassenPersonen(tx as any);
      const { gruppen: gruppen1, ausschluesse: aus1 } = bildeGruppen(personen1);
      const kette = gruppen1.find((g) => [g.gewinner.id, ...g.verlierer.map((v) => v.person.id)].includes(pA));
      ok("Die drei Sätze bilden EINE Gruppe", !!kette);
      gleich("… mit genau drei Mitgliedern", kette ? kette.verlierer.length + 1 : 0, 3);
      ok("… A und C sind ohne gemeinsames Merkmal verbunden (über B)",
        !!kette && [kette.gewinner.id, ...kette.verlierer.map((v) => v.person.id)].includes(pC));

      const bestellungenVor = (await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE person_id = ANY(${[pA, pB, pC]}::int[])
      `)[0].n;
      for (const v of kette!.verlierer) {
        await personenZusammenfuehren(v.person.id, kette!.gewinner.id, { betreuer: "gewinner" }, AKTEUR, { tx: tx as any });
      }
      const [nachKette] = await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE person_id = ${kette!.gewinner.id}
      `;
      gleich("Zählprobe über alle drei: keine Bestellung verloren", Number(nachKette.n), Number(bestellungenVor));
      const [wegweiser] = await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_persons
        WHERE id = ANY(${[pA, pB, pC]}::int[]) AND merged_into_person_id = ${kette!.gewinner.id}
      `;
      gleich("Die beiden Verlierer zeigen auf den Gewinner", Number(wegweiser.n), 2);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("3. Haushalt: ein Anschluss, zwei Menschen");
      // ═══════════════════════════════════════════════════════════════════
      const nachnameHaus = `Haushalt${stempel}`;
      const hFranz = await person({ first_name: "Franz", last_name: nachnameHaus, phone_key9: "917342853", primary_phone: "+49151917342853", birthdate: "1954-01-22" });
      const hGerda = await person({ first_name: "Gerda", last_name: nachnameHaus, phone_key9: "917342853", primary_phone: "+49151917342853", birthdate: "1954-09-16" });
      await bestellung({ ref: REF("HAUS-F"), person_id: hFranz });
      await bestellung({ ref: REF("HAUS-G"), person_id: hGerda });

      const personen2 = await ladeMassenPersonen(tx as any);
      const { gruppen: gruppen2, ausschluesse: aus2 } = bildeGruppen(personen2);
      const zusammen = gruppen2.some((g) => {
        const ids = [g.gewinner.id, ...g.verlierer.map((v) => v.person.id)];
        return ids.includes(hFranz) && ids.includes(hGerda);
      });
      ok("Franz und Gerda werden NICHT zusammengeführt", !zusammen);
      const ausschluss = aus2.find((a) =>
        (a.a.id === hFranz && a.b.id === hGerda) || (a.a.id === hGerda && a.b.id === hFranz));
      ok("… das Paar steht als geklärter Ausschluss mit Begründung", !!ausschluss, JSON.stringify(ausschluss?.grund));
      ok("… und die Begründung nennt den gemeinsamen Anschluss",
        !!ausschluss && /Anschluss/.test(ausschluss.grund), ausschluss?.grund);

      // Abgehakt heißt abgehakt: Nach dem Eintrag taucht das Paar nicht wieder auf.
      const [kl, gr] = hFranz < hGerda ? [hFranz, hGerda] : [hGerda, hFranz];
      await tx`
        INSERT INTO fiaon_dubletten_entschieden (person_a, person_b, entscheidung, begruendung, akteur)
        VALUES (${kl}, ${gr}, 'keine_dublette', ${"Haushalt (Prüfstand)"}, ${AKTEUR.name})
      `;
      const [abgehakt] = await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_dubletten_entschieden
        WHERE person_a = ${kl} AND person_b = ${gr} AND entscheidung = 'keine_dublette'
      `;
      gleich("… und ist als „keine Dublette“ hinterlegt", Number(abgehakt.n), 1);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("4. Abo und Bonitätsauskunft leben nebeneinander");
      // ═══════════════════════════════════════════════════════════════════
      const nachnameAbo = `Abokund${stempel}`;
      const aboG = await person({ first_name: "Ali", last_name: nachnameAbo, phone_key9: "917342854", primary_phone: "+49151917342854" });
      const aboV = await person({ first_name: "Ali", last_name: nachnameAbo, phone_key9: "917342854", primary_phone: "+49151917342854" });
      const refAbo = await bestellung({ ref: REF("ABO-G"), person_id: aboG, created_at: "2026-07-01T10:00:00Z" });
      const refSchufa = await bestellung({
        ref: `FIAON-SCHUFA-PMM${stempel}`, person_id: aboG, type: "schufa",
        pack_name: "Bonitätsauskunft", amount_due: "74.00", created_at: "2026-07-02T10:00:00Z",
      });
      const refAbo2 = await bestellung({ ref: REF("ABO-V"), person_id: aboV, created_at: "2026-07-03T10:00:00Z" });

      await personenZusammenfuehren(aboV, aboG, { betreuer: "gewinner" }, AKTEUR, { tx: tx as any });
      const faelleAbo = await hygieneFaelle([aboG], tx as any);
      const stillAbo = await hygieneAusfuehren(faelleAbo, tx as any, "Prüfstand");

      const [schufaStand] = await tx`SELECT payment_status, superseded_by FROM fiaon_applications WHERE ref = ${refSchufa}`;
      gleich("Bonitätsauskunft bleibt offen (kein Stufenpaket)", schufaStand.payment_status, "pending_payment");
      ok("… und wird durch nichts ersetzt", schufaStand.superseded_by == null, String(schufaStand.superseded_by));
      const offeneStufen = await tx`
        SELECT ref, payment_status, superseded_by FROM fiaon_applications
        WHERE person_id = ${aboG} AND payment_status IN ('pending_payment','claimed_paid','expired')
          AND COALESCE(type,'') <> 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%'
      `;
      gleich("Genau eine offene Stufe bleibt", (offeneStufen as any[]).length, 1);
      gleich("… nämlich die jüngere", (offeneStufen as any[])[0]?.ref, refAbo2);
      gleich("Die ältere ist stillgelegt", stillAbo.length, 1);
      const [ersetzt] = await tx`SELECT payment_status, superseded_by FROM fiaon_applications WHERE ref = ${refAbo}`;
      gleich("… mit Zustand 'superseded'", ersetzt.payment_status, "superseded");
      const [zeigerOk] = await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_applications
        WHERE payment_reference = ${ersetzt.superseded_by} OR ref = ${ersetzt.superseded_by}
      `;
      ok("… und einem Verweis, der wirklich auflösbar ist", Number(zeigerOk.n) > 0, String(ersetzt.superseded_by));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("5. Zwei offene Stufen aus zwei Verlierern");
      // ═══════════════════════════════════════════════════════════════════
      const nachnameDrei = `Dreifach${stempel}`;
      const dG = await person({ first_name: "Bo", last_name: nachnameDrei, phone_key9: "917342855", primary_phone: "+49151917342855" });
      const dV1 = await person({ first_name: "Bo", last_name: nachnameDrei, phone_key9: "917342855", primary_phone: "+49151917342855" });
      const dV2 = await person({ first_name: "Bo", last_name: nachnameDrei, phone_key9: "917342855", primary_phone: "+49151917342855" });
      await bestellung({ ref: REF("DREI-G"), person_id: dG, created_at: "2026-07-01T10:00:00Z" });
      await bestellung({ ref: REF("DREI-1"), person_id: dV1, created_at: "2026-07-05T10:00:00Z" });
      const refJuengste = await bestellung({ ref: REF("DREI-2"), person_id: dV2, created_at: "2026-07-09T10:00:00Z" });
      for (const v of [dV1, dV2]) {
        await personenZusammenfuehren(v, dG, { betreuer: "gewinner" }, AKTEUR, { tx: tx as any });
      }
      const stillDrei = await hygieneAusfuehren(await hygieneFaelle([dG], tx as any), tx as any, "Prüfstand");
      const offenDrei = await tx`
        SELECT ref FROM fiaon_applications WHERE person_id = ${dG}
          AND payment_status IN ('pending_payment','claimed_paid','expired')
      `;
      gleich("Aus drei offenen Stufen wird genau eine", (offenDrei as any[]).length, 1);
      gleich("… und zwar die jüngste", (offenDrei as any[])[0]?.ref, refJuengste);
      gleich("Zwei Bestellungen stillgelegt", stillDrei.length, 2);

      const [keineWeg] = await tx`SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE person_id = ${dG}`;
      gleich("Keine Bestellung verschwunden", Number(keineWeg.n), 3);

      // Ein angefangener Antrag (`pending`) ist KEINE offene Stufe: Es gibt
      // keine Rechnung, keine Mahnung, nichts stillzulegen. Die Akte darf
      // deshalb auch nicht zur Bereinigung auffordern.
      const dV3 = await person({ first_name: "Bo", last_name: nachnameDrei, phone_key9: "917342855", primary_phone: "+49151917342855" });
      await bestellung({ ref: REF("DREI-3"), person_id: dG, payment_status: "pending", status: "personal_data", created_at: "2026-07-11T10:00:00Z" });
      const nochOffen = await hygieneFaelle([dG], tx as any);
      gleich("Ein angefangener Antrag erzeugt keinen Hygiene-Fall", nochOffen.length, 0);
      const standDrei = await produktstand(dG, tx as any);
      ok("… und die Akte meldet keine zwei offenen Stufen", !standDrei.mehrfachStufe,
        JSON.stringify({ text: standDrei.text, mehrfach: standDrei.mehrfachStufe }));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("6. Betreuer-Konflikt: entschieden, protokolliert, Provision unberührt");
      // ═══════════════════════════════════════════════════════════════════
      const [agentAlt] = await tx`SELECT id FROM fiaon_agents WHERE active = TRUE ORDER BY id ASC LIMIT 1`;
      const [agentNeu] = await tx`SELECT id FROM fiaon_agents WHERE active = TRUE ORDER BY id DESC LIMIT 1`;
      const idAlt = Number(agentAlt.id);
      const idNeu = Number(agentNeu.id);
      ok("Zwei verschiedene Agenten für den Test vorhanden", idAlt !== idNeu, `${idAlt} / ${idNeu}`);

      const nachnameBet = `Streitfall${stempel}`;
      const bG = await person({
        first_name: "Cem", last_name: nachnameBet, phone_key9: "917342856", primary_phone: "+49151917342856",
        assigned_agent_id: idAlt, betreuung_seit: "2026-06-01T10:00:00Z",
      });
      const bV = await person({
        first_name: "Cem", last_name: nachnameBet, phone_key9: "917342856", primary_phone: "+49151917342856",
        assigned_agent_id: idNeu, betreuung_seit: "2026-07-01T10:00:00Z",
      });
      const refBezahlt = await bestellung({
        ref: REF("BET-G"), person_id: bG, payment_status: "paid",
        completed_at: "2026-07-20T10:00:00Z", assigned_agent_id: idAlt,
      });
      const refOffen = await bestellung({ ref: REF("BET-V"), person_id: bV, assigned_agent_id: idNeu });
      // Der Verlierer hat den JÜNGEREN dokumentierten Kontakt.
      await kontakt(refBezahlt, idAlt, "2026-07-20T10:00:00Z");
      await kontakt(refOffen, idNeu, "2026-08-05T10:00:00Z");
      await tx`
        INSERT INTO fiaon_commissions (agent_id, ref, base_amount_cents, rate_bp, amount_cents, status, kind)
        VALUES (${idAlt}, ${refBezahlt}, 7999, 1000, 800, 'ausgezahlt', 'abschluss')
      `;
      const [provVor] = await tx`
        SELECT agent_id, amount_cents, status FROM fiaon_commissions WHERE ref = ${refBezahlt}
      `;

      const personen3 = await ladeMassenPersonen(tx as any);
      const gruppeBet = bildeGruppen(personen3).gruppen.find((g) =>
        [g.gewinner.id, ...g.verlierer.map((v) => v.person.id)].includes(bG));
      ok("Der Streitfall bildet eine Gruppe", !!gruppeBet);
      ok("… und ist als Betreuer-Konflikt erkannt", !!gruppeBet?.betreuerKonflikt);
      gleich("… Zuständigkeit geht an den jüngsten dokumentierten Kontakt", gruppeBet?.betreuerId, idNeu);
      gleich("… der Gewinner ist die Person mit der bezahlten Bestellung", gruppeBet?.gewinner.id, bG);

      for (const v of gruppeBet!.verlierer) {
        const wahl = v.person.betreuerId === gruppeBet!.betreuerId ? "verlierer" : "gewinner";
        await personenZusammenfuehren(v.person.id, gruppeBet!.gewinner.id, { betreuer: wahl }, AKTEUR, { tx: tx as any });
      }
      await tx`UPDATE fiaon_persons SET assigned_agent_id = ${gruppeBet!.betreuerId} WHERE id = ${bG}`;
      const [betreuerNachher] = await tx`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${bG}`;
      gleich("Nach dem Merge ist genau ein Agent zuständig", Number(betreuerNachher.assigned_agent_id), idNeu);

      const [provNach] = await tx`
        SELECT agent_id, amount_cents, status FROM fiaon_commissions WHERE ref = ${refBezahlt}
      `;
      gleich("Gebuchte Provision: Agent unverändert", Number(provNach.agent_id), Number(provVor.agent_id));
      gleich("Gebuchte Provision: Betrag unverändert", Number(provNach.amount_cents), Number(provVor.amount_cents));
      gleich("Gebuchte Provision: Stand unverändert", provNach.status, provVor.status);
      const [bezahltStand] = await tx`SELECT payment_status FROM fiaon_applications WHERE ref = ${refBezahlt}`;
      gleich("Die bezahlte Bestellung bleibt bezahlt", bezahltStand.payment_status, "paid");

      // ═══════════════════════════════════════════════════════════════════
      gruppe("7. Gewinnerwahl: bezahlt → jüngster Kontakt → älteste ID");
      // ═══════════════════════════════════════════════════════════════════
      const bau = (id: number, felder: Partial<MassenPerson>): MassenPerson => ({
        id, personRef: `P${id}`, name: `Person ${id}`, vorname: "Test", nachname: "Wahl",
        email: null, telefon: null, phoneKey9: null, geburtsdatum: null,
        betreuerId: null, betreuerName: null, betreuungSeit: null,
        bestellungen: 1, bezahlteBestellungen: 0, letzterKontakt: null, angelegt: null,
        mails: [], nummern: [], letzteZahlung: null, gdprGesperrt: false, gesperrt: false,
        ...felder,
      });
      gleich("Bezahlt schlägt jüngeren Kontakt",
        waehleGewinner([
          bau(10, { bezahlteBestellungen: 1, letzteZahlung: "2026-01-01T00:00:00Z" }),
          bau(11, { letzterKontakt: "2026-08-01T00:00:00Z" }),
        ]).gewinner.id, 10);
      gleich("Bei zwei Zahlungen gewinnt die jüngste",
        waehleGewinner([
          bau(12, { bezahlteBestellungen: 1, letzteZahlung: "2026-01-01T00:00:00Z" }),
          bau(13, { bezahlteBestellungen: 1, letzteZahlung: "2026-07-01T00:00:00Z" }),
        ]).gewinner.id, 13);
      gleich("Ohne Zahlung gewinnt der jüngste Kontakt",
        waehleGewinner([
          bau(14, { letzterKontakt: "2026-02-01T00:00:00Z" }),
          bau(15, { letzterKontakt: "2026-08-01T00:00:00Z" }),
        ]).gewinner.id, 15);
      gleich("Ohne alles gewinnt die älteste ID",
        waehleGewinner([bau(17, {}), bau(16, {})]).gewinner.id, 16);
      gleich("Betreuer: jüngster dokumentierter Kontakt",
        waehleBetreuer([
          bau(18, { betreuerId: 1, betreuungSeit: "2026-01-01T00:00:00Z", letzterKontakt: "2026-02-01T00:00:00Z" }),
          bau(19, { betreuerId: 2, betreuungSeit: "2026-06-01T00:00:00Z", letzterKontakt: "2026-08-01T00:00:00Z" }),
        ]).betreuerId, 2);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("8. Der saubere Name gewinnt");
      // ═══════════════════════════════════════════════════════════════════
      ok("„Wien Wien“ ist schlechter als „Milan Acimovic“",
        namensGuete("Wien", "Wien") < namensGuete("Milan", "Acimovic"));
      ok("„Gerda M“ ist schlechter als „Gerda Molk“",
        namensGuete("Gerda", "M") < namensGuete("Gerda", "Molk"));
      ok("„Maria Tietz4“ ist schlechter als „Maria Tietz“",
        namensGuete("Maria", "Tietz4") < namensGuete("Maria", "Tietz"));
      ok("Zwei gleichwertige Namen: kein Vorsprung",
        namensGuete("Klaua", "Wegehaupt") === namensGuete("Klaus", "Wegehaupt"));

      // Der Ortsname im Namensfeld — nachgebaut, aber mit eigenem Nachnamen und
      // eigenem Geburtsdatum. Ein erster Entwurf benutzte „Wien" und fing sich
      // den ECHTEN „Wien Wien"-Satz aus dem Bestand in die Testgruppe ein.
      const ortsfall = `Ortsfall${stempel}`;
      const nachnameName = `Namensfall${stempel}`;
      const nG = await person({ first_name: ortsfall, last_name: ortsfall, phone_key9: "917342857", primary_phone: "+49151917342857", birthdate: "1975-10-29" });
      const nV = await person({ first_name: "Milan", last_name: nachnameName, phone_key9: "917342857", primary_phone: "+49151917342857", birthdate: "1975-10-29" });
      await bestellung({ ref: REF("NAME-G"), person_id: nG, payment_status: "paid", completed_at: "2026-07-01T10:00:00Z" });
      await bestellung({ ref: REF("NAME-V"), person_id: nV });
      const personen4 = await ladeMassenPersonen(tx as any);
      const gruppeName = bildeGruppen(personen4).gruppen.find((g) =>
        [g.gewinner.id, ...g.verlierer.map((v) => v.person.id)].includes(nG));
      gleich("Gewinner ist die Person mit der bezahlten Bestellung", gruppeName?.gewinner.id, nG);
      const quelle = gruppeName ? besserenNamenFinden(gruppeName) : null;
      gleich("Der bessere Name kommt vom Verlierer", quelle?.id, nV);

      await personenZusammenfuehren(nV, nG, {
        betreuer: "gewinner", felder: { first_name: "verlierer", last_name: "verlierer" },
      }, AKTEUR, { tx: tx as any });
      const [namenNachher] = await tx`SELECT first_name, last_name FROM fiaon_persons WHERE id = ${nG}`;
      gleich("Die Akte heißt danach richtig (Vorname)", namenNachher.first_name, "Milan");
      gleich("Die Akte heißt danach richtig (Nachname)", namenNachher.last_name, nachnameName);
      const [alteName] = await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_person_aliases
        WHERE person_id = ${nG} AND kind = 'first_name' AND value_norm = ${ortsfall.toLowerCase()}
      `;
      gleich("Der alte Name ist als Alias gesichert (nichts verloren)", Number(alteName.n), 1);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("9. Notbremse: Invarianten erkennen einen Verlust");
      // ═══════════════════════════════════════════════════════════════════
      const basis: Stand = { bestellungen: 10, verwendungszwecke: 10, verlauf: 20, provisionen: 2, leads: 3, ohnePerson: 0 };
      gleich("Unveränderter Stand: kein Bruch", invariantenBrueche(basis, basis).length, 0);
      ok("Eine verlorene Bestellung wird erkannt",
        invariantenBrueche(basis, { ...basis, bestellungen: 9 }).some((b) => /Bestellungen/.test(b)));
      ok("Ein verlorener Verwendungszweck wird erkannt",
        invariantenBrueche(basis, { ...basis, verwendungszwecke: 9 }).some((b) => /Verwendungszweck/.test(b)));
      ok("Ein verlorener Verlaufseintrag wird erkannt",
        invariantenBrueche(basis, { ...basis, verlauf: 19 }).some((b) => /Verlauf/.test(b)));
      ok("Ein zusätzlicher Verlaufseintrag ist KEIN Bruch (Merge schreibt eine Notiz)",
        invariantenBrueche(basis, { ...basis, verlauf: 22 }).length === 0);
      ok("Eine verlorene Provision wird erkannt",
        invariantenBrueche(basis, { ...basis, provisionen: 1 }).some((b) => /Provision/.test(b)));
      ok("Eine verwaiste Bestellung wird JE GRUPPE erkannt",
        invariantenBrueche(basis, { ...basis, ohnePerson: 1 }).some((b) => /ohne Person/.test(b)));
      ok("Gesamtstand darf wachsen (der Betrieb läuft weiter)",
        invariantenBruecheGesamt(basis, { ...basis, bestellungen: 12, verlauf: 25 }).length === 0);
      // Am 08.08.2026 stoppte der Lauf, weil während der ersten Welle fünf echte
      // Besucher ein Formular begonnen hatten. Ein Entwurf hat noch keine Person
      // — das ist der Trichter, nicht dieser Lauf.
      ok("Neue Entwürfe ohne Person stoppen den Gesamtlauf NICHT",
        invariantenBruecheGesamt(basis, { ...basis, bestellungen: 11, ohnePerson: 1 }).length === 0);
      ok("Ein Schwund stoppt ihn weiterhin",
        invariantenBruecheGesamt(basis, { ...basis, bestellungen: 9 }).length > 0);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("10. Eine gescheiterte Gruppe lässt die vorherigen unversehrt");
      // ═══════════════════════════════════════════════════════════════════
      // Genau das Versprechen der Wellen: Gruppe 1 ist fertig und bleibt, wenn
      // Gruppe 2 zurückgerollt wird.
      const nachnameW = `Welle${stempel}`;
      const w1G = await person({ first_name: "Eva", last_name: nachnameW, phone_key9: "917342858", primary_phone: "+49151917342858" });
      const w1V = await person({ first_name: "Eva", last_name: nachnameW, phone_key9: "917342858", primary_phone: "+49151917342858" });
      const w2G = await person({ first_name: "Udo", last_name: nachnameW, phone_key9: "917342859", primary_phone: "+49151917342859" });
      const w2V = await person({ first_name: "Udo", last_name: nachnameW, phone_key9: "917342859", primary_phone: "+49151917342859" });
      await bestellung({ ref: REF("W1-G"), person_id: w1G });
      await bestellung({ ref: REF("W1-V"), person_id: w1V });
      await bestellung({ ref: REF("W2-G"), person_id: w2G });
      await bestellung({ ref: REF("W2-V"), person_id: w2V });

      await tx.savepoint(async (sp) => {
        await personenZusammenfuehren(w1V, w1G, { betreuer: "gewinner" }, AKTEUR, { tx: sp as any });
      });
      let zweiteGescheitert = false;
      try {
        await tx.savepoint(async (sp) => {
          await personenZusammenfuehren(w2V, w2G, { betreuer: "gewinner" }, AKTEUR, { tx: sp as any });
          throw new Error("Invariante gebrochen (simuliert)");
        });
      } catch { zweiteGescheitert = true; }
      ok("Die zweite Gruppe ist gescheitert", zweiteGescheitert);
      const [w1Stand] = await tx`SELECT merged_into_person_id FROM fiaon_persons WHERE id = ${w1V}`;
      gleich("Die erste Gruppe bleibt zusammengeführt", Number(w1Stand.merged_into_person_id), w1G);
      const [w2Stand] = await tx`SELECT merged_into_person_id FROM fiaon_persons WHERE id = ${w2V}`;
      ok("Die zweite Gruppe ist vollständig zurückgerollt", w2Stand.merged_into_person_id == null,
        String(w2Stand.merged_into_person_id));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("11. Wer NICHT automatisch angefasst wird");
      // ═══════════════════════════════════════════════════════════════════
      const nachnameTabu = `Tabu${stempel}`;
      const tGdpr = await person({ first_name: "Rea", last_name: nachnameTabu, phone_key9: "917342861", primary_phone: "+49151917342861" });
      const tNormal = await person({ first_name: "Rea", last_name: nachnameTabu, phone_key9: "917342861", primary_phone: "+49151917342861" });
      await bestellung({ ref: REF("TABU-1"), person_id: tGdpr, gdpr_deleted_at: "2026-05-01T10:00:00Z" });
      await bestellung({ ref: REF("TABU-2"), person_id: tNormal });
      const personen5 = await ladeMassenPersonen(tx as any);
      const tabuDrin = bildeGruppen(personen5).gruppen.some((g) =>
        [g.gewinner.id, ...g.verlierer.map((v) => v.person.id)].includes(tGdpr));
      ok("DSGVO-gelöschte Bestellung: die Person bleibt außen vor", !tabuDrin);

      const tGesperrt = await person({
        first_name: "Sam", last_name: `Gesperrt${stempel}`, phone_key9: "917342862",
        primary_phone: "+49151917342862", account_status: "suspended",
      });
      const tOffen = await person({ first_name: "Sam", last_name: `Gesperrt${stempel}`, phone_key9: "917342862", primary_phone: "+49151917342862" });
      await bestellung({ ref: REF("SPERR-1"), person_id: tGesperrt });
      await bestellung({ ref: REF("SPERR-2"), person_id: tOffen });
      const personen6 = await ladeMassenPersonen(tx as any);
      const gesperrtDrin = bildeGruppen(personen6).gruppen.some((g) =>
        [g.gewinner.id, ...g.verlierer.map((v) => v.person.id)].includes(tGesperrt));
      ok("Gesperrtes Konto: die Person bleibt außen vor", !gesperrtDrin);

      const tAttrappeA = await person({ first_name: "Til", last_name: `Attrappe${stempel}`, phone_key9: "701234567", primary_phone: "+491701234567" });
      const tAttrappeB = await person({ first_name: "Til", last_name: `Attrappe${stempel}A`, phone_key9: "701234567", primary_phone: "+491701234567" });
      await bestellung({ ref: REF("ATT-1"), person_id: tAttrappeA });
      await bestellung({ ref: REF("ATT-2"), person_id: tAttrappeB });
      const personen7 = await ladeMassenPersonen(tx as any);
      const attrappeVerbunden = bildeGruppen(personen7).gruppen.some((g) => {
        const ids = [g.gewinner.id, ...g.verlierer.map((v) => v.person.id)];
        return ids.includes(tAttrappeA) && ids.includes(tAttrappeB);
      });
      ok("Attrappen-Nummer verbindet niemanden", !attrappeVerbunden);

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  // ═══════════════════════════════════════════════════════════════════
  gruppe("12. Gegenprobe: keine Testzeile zurückgeblieben");
  // ═══════════════════════════════════════════════════════════════════
  const marke = `%${stempel}%`;
  const reste = await sqlPool`
    SELECT 'bestellungen' AS art, COUNT(*)::int AS n FROM fiaon_applications WHERE ref LIKE ${marke}
    UNION ALL SELECT 'personen', COUNT(*)::int FROM fiaon_persons WHERE person_ref LIKE ${"%PM" + stempel + "%"}
    UNION ALL SELECT 'aliase', COUNT(*)::int FROM fiaon_person_aliases WHERE value_norm LIKE ${marke}
    UNION ALL SELECT 'verlauf', COUNT(*)::int FROM fiaon_contact_log WHERE ref LIKE ${marke}
    UNION ALL SELECT 'provisionen', COUNT(*)::int FROM fiaon_commissions WHERE ref LIKE ${marke}
  `;
  for (const r of reste as any[]) gleich(`Zurückgerollt: ${r.art}`, Number(r.n), 0);

  const [nachher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_applications)::int AS bestellungen,
           (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_commissions)::int AS provisionen
  `;
  ok(`Bestand nicht geschrumpft: Bestellungen (${vorher.bestellungen} → ${nachher.bestellungen})`,
    Number(nachher.bestellungen) >= Number(vorher.bestellungen));
  ok(`Bestand nicht geschrumpft: Personen (${vorher.personen} → ${nachher.personen})`,
    Number(nachher.personen) >= Number(vorher.personen));
  ok(`Provisionen unverändert (${vorher.provisionen} → ${nachher.provisionen})`,
    Number(nachher.provisionen) === Number(vorher.provisionen));

  log(`\n══ Ergebnis: ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen ══\n`);
  if (fehler.length > 0) log(`Fehlgeschlagen:\n${fehler.map((f) => `  · ${f}`).join("\n")}\n`);
  await sqlPool.end();
  process.exit(fehlgeschlagen > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[PRUEF-MASSEN-MERGE]", err);
  process.exit(1);
});
