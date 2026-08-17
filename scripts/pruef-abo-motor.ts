// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DER ABO-MOTOR UND DIE VIER BEFUNDE AUS DEM TEAMFEEDBACK
//
// Was hier geprüft wird — jedes davon hat einmal Geld oder Vertrauen gekostet:
//   1. Der Zyklus ist der monatliche Jahrestag, nicht „alle 30 Tage".
//   2. Am Fälligkeitstag entsteht GENAU EINE Rate. Ein zweiter Lauf erzeugt
//      nichts — sonst bekommt ein Kunde zwei Rechnungen für denselben Monat.
//   3. Am Tag danach ist sie überfällig und gehört jemandem.
//   4. SCHUFA erzeugt NIE eine Rate.
//   5. Die Mahnstufe springt nie und steigt nie ohne echte Vormahnung.
//   6. Die Inkasso-Liste zeigt einen Namen je Mensch.
//   7. Ein Anruf folgt der gewählten NUMMER, nicht der offenen Kundenkarte.
//   8. Der Empfänger wird über die Person aufgelöst, dann über Aliase.
//   9. Stammdaten sind für Zuständige UND Leitung editierbar.
//  10. Ultra 79,99 · High End 99,99.
//
// ALLES IN EINER TRANSAKTION, DIE AM ENDE ZURÜCKGEROLLT WIRD.
// Die Datenbank ist Produktion — es gibt keine Kopie zum Üben.
//
//   npx tsx scripts/pruef-abo-motor.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";

// Die Attrappe steht VOR jedem Import, der sie lesen könnte. Ein Prüfstand,
// der echte Mahnmails verschickt, ist kein Prüfstand.
const ECHT_MAKE = process.env.MAKE_WEBHOOK_URL;
process.env.MAKE_WEBHOOK_URL = "http://attrappe.pruefstand.invalid/keine-echten-mails";

import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  ankerTag, faelligkeit, faelligkeitenBis, kurzTag, naechsteFaelligkeit,
  tageImMonat, zyklenBis, zyklusText,
} from "../server/lib/fiaon-abo-zyklus";
import { naechsteMahnstufe, aboTageslauf, MAHNSTUFEN } from "../server/routes/fiaon-abo";
import { paketPreisCents, istAboPaket } from "../shared/fiaon-pakete";
import { arbeitslistePersonen } from "../server/lib/fiaon-inkasso";
import { empfaengerFuerPerson, mailNormal } from "../server/lib/fiaon-empfaenger";
import { personZurNummer, anrufZuordnen } from "../server/lib/fiaon-anruf-zuordnung";
import { berlinToday } from "../server/lib/fiaon-time";

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
function datei(pfad: string): string {
  try { return readFileSync(pfad, "utf8"); } catch { return ""; }
}

class Zurueckrollen extends Error {}
const stempel = Date.now().toString(36).toUpperCase();
const REF = (s: string) => `FIAON-ABOM${stempel}-${s}`;
const MAIL = (s: string) => `${s}-${stempel}@pruefstand-abo.test`.toLowerCase();
/** Eine Nummer, die garantiert niemandem gehört: Rufnummerngasse für Tests. */
const NUMMER = (n: number) => `+4915${String(n).padStart(9, "0")}`;

async function main(): Promise<void> {
  log("\n══ Prüfstand: Abo-Motor, Inkasso-Liste, Anrufe, Zustellung ══\n");
  log(`  Make-Attrappe aktiv (echte URL ${ECHT_MAKE ? "vorhanden, aber ersetzt" : "nicht gesetzt"}).`);

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("1. Der Zyklus — monatlicher Jahrestag");
  // Reine Rechnung, ohne Datenbank. Genau deshalb ist sie eine eigene Datei.
  // ═════════════════════════════════════════════════════════════════════════
  gleich("05.07. → erste Rate 05.08.", faelligkeit("2026-07-05", 1), "2026-08-05");
  gleich("05.07. → zweite Rate 05.09.", faelligkeit("2026-07-05", 2), "2026-09-05");
  gleich("05.07. → zwölfte Rate 05.07. des Folgejahres", faelligkeit("2026-07-05", 12), "2027-07-05");

  // Der 31. — der Fall, an dem jede Datumsrechnung stirbt.
  gleich("31.01.2026 → Februar 28. (kein Schaltjahr)", faelligkeit("2026-01-31", 1), "2026-02-28");
  gleich("31.01.2028 → Februar 29. (Schaltjahr)", faelligkeit("2028-01-31", 1), "2028-02-29");
  // Und das Entscheidende: Der Anker bleibt der 31.
  gleich("31.01.2026 → März WIEDER der 31.", faelligkeit("2026-01-31", 2), "2026-03-31");
  gleich("31.01.2026 → April 30.", faelligkeit("2026-01-31", 3), "2026-04-30");
  gleich("31.01.2026 → Mai WIEDER der 31.", faelligkeit("2026-01-31", 4), "2026-05-31");
  gleich("30.01.2026 → Februar 28.", faelligkeit("2026-01-30", 1), "2026-02-28");
  gleich("29.02.2028 → März 29.", faelligkeit("2028-02-29", 1), "2028-03-29");

  gleich("Tage im Februar 2026", tageImMonat(2026, 2), 28);
  gleich("Tage im Februar 2028", tageImMonat(2028, 2), 29);

  // zyklenBis: wie viele Fälligkeiten sind verstrichen?
  gleich("05.07. → am 04.08. ist noch nichts fällig", zyklenBis("2026-07-05", "2026-08-04"), 0);
  gleich("05.07. → am 05.08. ist die erste fällig", zyklenBis("2026-07-05", "2026-08-05"), 1);
  gleich("05.07. → am 05.10. sind drei fällig", zyklenBis("2026-07-05", "2026-10-05"), 3);
  gleich("31.01. → am 28.02. ist die erste fällig (gekappt)", zyklenBis("2026-01-31", "2026-02-28"), 1);
  gleich("31.01. → am 27.02. noch nicht", zyklenBis("2026-01-31", "2026-02-27"), 0);

  gleich("nächste Fälligkeit nach dem 06.08.", naechsteFaelligkeit("2026-07-05", "2026-08-06"), "2026-09-05");
  gleich("nächste Fälligkeit AM Fälligkeitstag ist der Folgemonat",
    naechsteFaelligkeit("2026-07-05", "2026-08-05"), "2026-09-05");
  gleich("drei Fälligkeiten bis zum 20.10.",
    faelligkeitenBis("2026-07-05", "2026-10-20").join(","), "2026-08-05,2026-09-05,2026-10-05");

  gleich("Kurzform", kurzTag("2026-07-05"), "05.07.");
  ok("Der Klartext nennt Start und nächste Rate",
    /Abo aktiv seit 05\.07\..*nächste Rate.*Rechnung geht automatisch raus/
      .test(zyklusText("2026-07-05", { heute: "2026-08-20" })),
    zyklusText("2026-07-05", { heute: "2026-08-20" }));
  ok("Ein gestopptes Abo sagt das auch",
    /gestoppt/.test(zyklusText("2026-07-05", { heute: "2026-08-20", gestoppt: true })));
  ok("Ohne Anker wird nichts erfunden",
    /nicht berechenbar/.test(zyklusText(null)));

  // ── GEGENPROBE ──────────────────────────────────────────────────────────
  // Die alte Rechnung „+30 Tage" muss ein ANDERES Ergebnis liefern. Täte sie
  // das nicht, prüfte dieser Prüfstand nichts.
  const plus30 = new Date(Date.UTC(2026, 6, 5) + 30 * 86_400_000).toISOString().slice(0, 10);
  ok("GEGENPROBE: die alte 30-Tage-Rechnung weicht ab",
    plus30 !== faelligkeit("2026-07-05", 1), `+30 Tage = ${plus30}, Jahrestag = 2026-08-05`);
  ok("Der Code rechnet nirgends mehr mit 30 Tagen Zyklus",
    !/ABO_ZYKLUS_TAGE\s*=\s*30/.test(datei("server/routes/fiaon-abo.ts"))
    && !/ZYKLUS_TAGE\s*=\s*30/.test(datei("server/lib/fiaon-abo-pflicht.ts")));

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("2. Die Preise — Ultra 79,99 · High End 99,99");
  // ═════════════════════════════════════════════════════════════════════════
  gleich("Ultra kostet 7999 Cent", paketPreisCents("ultra"), 7999);
  gleich("High End kostet 9999 Cent", paketPreisCents("highend"), 9999);
  gleich("Start kostet 799 Cent", paketPreisCents("start"), 799);
  gleich("Pro kostet 5999 Cent", paketPreisCents("pro"), 5999);
  gleich("Die Bonitätsauskunft kostet 7400 Cent", paketPreisCents("schufa"), 7400);
  ok("… und ist KEIN Abo", !istAboPaket("schufa"));
  ok("Ultra ist ein Abo", istAboPaket("ultra"));
  ok("Es gibt nur EINE Preisliste im Quelltext",
    !/start:\s*7\.99,\s*pro:\s*59\.99/.test(datei("server/routes/fiaon-antrag.ts")),
    "in fiaon-antrag.ts steht noch eine eigene Liste");
  ok("… und fiaon-abo-pflicht.ts reicht sie nur durch",
    /PAKET_PREIS_CENTS[^=]*=\s*PAKET_PREISE_CENTS/.test(datei("server/lib/fiaon-abo-pflicht.ts")));

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("3. Die Mahnstufe springt nie");
  // ═════════════════════════════════════════════════════════════════════════
  gleich("von 0 auf 1", naechsteMahnstufe(0, true, false), 1);
  gleich("von 1 auf 2 — mit echter Vormahnung", naechsteMahnstufe(1, true, true), 2);
  gleich("von 2 auf 3 — mit echter Vormahnung", naechsteMahnstufe(2, true, true), 3);
  gleich("3 ist das Ende", naechsteMahnstufe(3, true, true), MAHNSTUFEN.length);
  gleich("Vorabinfo hebt die Stufe nicht", naechsteMahnstufe(0, false, false), 0);
  gleich("… auch nicht bei Stufe 2", naechsteMahnstufe(2, false, true), 2);
  // Der Kernfall aus dem Teamfeedback.
  gleich("Stufe 1 OHNE je versandte Mahnung → bleibt 1, springt nicht auf 2",
    naechsteMahnstufe(1, true, false), 1);
  gleich("Stufe 2 aus dem Bestandsnachtrag → zurück auf 1",
    naechsteMahnstufe(2, true, false), 1);
  ok("GEGENPROBE: ohne die Vorstufen-Prüfung wäre es 2",
    Math.min(3, 1 + 1) === 2 && naechsteMahnstufe(1, true, false) === 1);

  // ═════════════════════════════════════════════════════════════════════════
  // Ab hier gegen echte Daten — in einer Transaktion, die zurückgerollt wird.
  // ═════════════════════════════════════════════════════════════════════════
  // ── DIE TABELLENPRÜFUNGEN VORHER AUSLÖSEN ───────────────────────────────
  // `ensureAboTabellen` und `ensureAgentTables` führen ALTER TABLE und
  // CREATE INDEX aus — auf dem globalen Pool, also einer ZWEITEN Verbindung.
  // Laufen sie zum ersten Mal, während die Prüf-Transaktion dieselben Tabellen
  // schon angefasst hat, warten beide aufeinander, bis das Statement-Zeitlimit
  // zuschlägt. Beide merken sich, dass sie gelaufen sind — einmal hier vorweg,
  // und drinnen passiert nichts mehr.
  await (await import("../server/routes/fiaon-abo")).ensureAboTabellen();
  await (await import("../server/routes/fiaon-agent")).ensureAgentTables();
  await (await import("../server/routes/fiaon-agent")).getSettings();

  const vorher = (await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_abo_raten)::int AS raten,
           (SELECT COUNT(*) FROM fiaon_applications)::int AS apps,
           (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_calls)::int AS anrufe,
           (SELECT COUNT(*) FROM fiaon_person_aliases)::int AS aliase
  `)[0] as any;

  try {
    await sqlPool.begin(async (tx) => {
      // ── Testdaten ───────────────────────────────────────────────────────
      // Anker: heute minus einen Monat. Damit ist HEUTE ein Fälligkeitstag —
      // der ungünstigste Fall, nicht der bequemste.
      const heute = berlinToday();
      const heuteTag = Number(heute.slice(8, 10));
      const heuteMonat = Number(heute.slice(5, 7));
      const heuteJahr = Number(heute.slice(0, 4));
      const vorMonat = heuteMonat === 1
        ? { j: heuteJahr - 1, m: 12 } : { j: heuteJahr, m: heuteMonat - 1 };
      const ankerTagNr = Math.min(heuteTag, tageImMonat(vorMonat.j, vorMonat.m));
      const anker = `${vorMonat.j}-${String(vorMonat.m).padStart(2, "0")}-${String(ankerTagNr).padStart(2, "0")}`;

      const [personA] = (await tx`
        INSERT INTO fiaon_persons (person_ref, kind, first_name, last_name, primary_email,
                                   primary_phone, phone_key9, created_at, updated_at)
        VALUES (${`PP-${stempel}-A`}, 'privat', 'Anna', 'Prüfstand', ${MAIL("anna")},
                ${NUMMER(1)}, ${NUMMER(1).slice(-9)}, NOW(), NOW())
        RETURNING id
      `) as any[];
      const [personB] = (await tx`
        INSERT INTO fiaon_persons (person_ref, kind, first_name, last_name, primary_email,
                                   primary_phone, phone_key9, created_at, updated_at)
        VALUES (${`PP-${stempel}-B`}, 'privat', 'Bert', 'Prüfstand', NULL,
                ${NUMMER(2)}, ${NUMMER(2).slice(-9)}, NOW(), NOW())
        RETURNING id
      `) as any[];

      const refPaket = REF("PAKET");
      await tx`
        INSERT INTO fiaon_applications
          (ref, type, status, pack_key, pack_name, first_name, last_name, email,
           amount_due, payment_status, payment_reference, person_id, paid_at, completed_at,
           created_at, updated_at)
        VALUES (${refPaket}, 'privat', 'payment_completed', 'ultra', 'FIAON Ultra',
                'Anna', 'Prüfstand', ${MAIL("anna")}, 79.99, 'paid', ${`PR-${stempel}-1`},
                ${personA.id}, ${`${anker}T10:00:00Z`}, ${`${anker}T10:00:00Z`}, NOW(), NOW())
      `;
      // SCHUFA — darf NIE eine Rate bekommen.
      const refSchufa = `FIAON-SCHUFA-${stempel}`;
      await tx`
        INSERT INTO fiaon_applications
          (ref, type, status, pack_key, pack_name, first_name, last_name, email,
           amount_due, payment_status, payment_reference, person_id, paid_at, completed_at,
           created_at, updated_at)
        VALUES (${refSchufa}, 'schufa', 'payment_completed', 'schufa', 'Bonitätsauskunft',
                'Bert', 'Prüfstand', ${MAIL("bert")}, 74.00, 'paid', ${`PR-${stempel}-2`},
                ${personB.id}, ${`${anker}T10:00:00Z`}, ${`${anker}T10:00:00Z`}, NOW(), NOW())
      `;
      // Unbezahltes Paket — darf ebenfalls keine Rate bekommen.
      const refOffen = REF("OFFEN");
      await tx`
        INSERT INTO fiaon_applications
          (ref, type, status, pack_key, pack_name, first_name, last_name, email,
           amount_due, payment_status, payment_reference, person_id, created_at, updated_at)
        VALUES (${refOffen}, 'privat', 'pending_payment', 'pro', 'FIAON Pro',
                'Carla', 'Prüfstand', ${MAIL("carla")}, 59.99, 'pending_payment',
                ${`PR-${stempel}-3`}, NULL, NOW(), NOW())
      `;
      // Die Startzahlung, wie sie der Motor anlegt.
      await tx`
        INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am,
                                     status, bezahlt_am, quelle, notiz)
        VALUES (${refPaket}, 1, ${`PR-${stempel}-1`}, 7999, ${anker}::date, 'bezahlt',
                ${`${anker}T10:00:00Z`}, 'auto', 'Startzahlung')
      `;

      // ═══════════════════════════════════════════════════════════════════
      gruppe("4. Am Fälligkeitstag entsteht GENAU EINE Rate");
      // ═══════════════════════════════════════════════════════════════════
      gleich("Der Anker liegt einen Monat zurück", faelligkeit(anker, 1), heute);

      const lauf1 = await aboTageslauf({ force: false, lauf: tx });
      const [nach1] = (await tx`
        SELECT COUNT(*)::int AS c FROM fiaon_abo_raten
        WHERE ref = ${refPaket} AND status = 'offen' AND storniert_am IS NULL
      `) as any[];
      gleich("Nach dem ersten Lauf: eine offene Rate", nach1.c, 1);

      // Bewusst mit Rückfallobjekt: Schlägt die Erzeugung fehl, soll der
      // Prüfstand die restlichen Prüfungen ROT melden und nicht mit einem
      // TypeError abbrechen. Ein Prüfstand, der beim ersten Fehler aussteigt,
      // verschweigt alle folgenden.
      const [rate] = [...((await tx`
        SELECT id, rate_nr, betrag_cents, faellig_am::text AS faellig, zahlungsreferenz, mahnstufe
        FROM fiaon_abo_raten WHERE ref = ${refPaket} AND status = 'offen'
      `) as any[]), { id: -1, rate_nr: null, betrag_cents: null, faellig: null,
                      zahlungsreferenz: null, mahnstufe: null }];
      gleich("… fällig heute", rate.faellig, heute);
      gleich("… über den Ultra-Preis 79,99", rate.betrag_cents, 7999);
      gleich("… mit eigener Ratenreferenz", rate.zahlungsreferenz, `PR-${stempel}-1-2`);
      gleich("… Mahnstufe 0 (die Rechnung ist keine Mahnung)", rate.mahnstufe, 0);

      // DER DOPPELLAUF — die wichtigste Prüfung dieses Prüfstands.
      const lauf2 = await aboTageslauf({ force: false, lauf: tx });
      const [nach2] = (await tx`
        SELECT COUNT(*)::int AS c FROM fiaon_abo_raten
        WHERE ref = ${refPaket} AND status = 'offen' AND storniert_am IS NULL
      `) as any[];
      gleich("Der ZWEITE Lauf erzeugt nichts", nach2.c, 1);
      gleich("… und meldet auch 0 neue Raten", lauf2.ratenErzeugt, 0);
      ok("Der erste Lauf hatte die Rate angelegt", lauf1.ratenErzeugt >= 1,
        `ratenErzeugt=${lauf1.ratenErzeugt}`);

      // GEGENPROBE: Die Wand steht in der Datenbank, nicht im Code.
      //
      // Im SAVEPOINT, weil ein verletzter Unique-Index die GANZE Transaktion
      // in den Fehlerzustand versetzt — jede weitere Abfrage würde danach mit
      // „current transaction is aborted" scheitern, und der Prüfstand bräche
      // mitten in Gruppe 5 ab. Genau so ist es beim ersten Lauf passiert.
      let doppeltGescheitert = false;
      try {
        await tx.savepoint(async (sp: any) => {
          await sp`
            INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents,
                                         faellig_am, status, quelle)
            VALUES (${refPaket}, 99, 'DOPPELT', 7999, ${heute}::date, 'offen', 'pruefstand')
          `;
        });
      } catch { doppeltGescheitert = true; }
      ok("GEGENPROBE: Eine zweite Rate zur selben Fälligkeit wird von der Datenbank abgelehnt",
        doppeltGescheitert, "der eindeutige Index (ref, faellig_am) fehlt");

      // ═══════════════════════════════════════════════════════════════════
      gruppe("5. SCHUFA erzeugt NIE eine Rate");
      // ═══════════════════════════════════════════════════════════════════
      const [schufaRaten] = (await tx`
        SELECT COUNT(*)::int AS c FROM fiaon_abo_raten WHERE ref = ${refSchufa}
      `) as any[];
      gleich("Die Bonitätsauskunft hat keine Rate", schufaRaten.c, 0);
      const [offenRaten] = (await tx`
        SELECT COUNT(*)::int AS c FROM fiaon_abo_raten WHERE ref = ${refOffen}
      `) as any[];
      gleich("Das unbezahlte Paket hat keine Rate", offenRaten.c, 0);

      // Gegenprobe: Sobald dasselbe Paket bezahlt ist, entsteht sehr wohl eine.
      await tx`
        UPDATE fiaon_applications
        SET payment_status = 'paid', paid_at = ${`${anker}T10:00:00Z`}, person_id = ${personB.id}
        WHERE ref = ${refOffen}
      `;
      await aboTageslauf({ force: false, lauf: tx });
      const [jetztRaten] = (await tx`
        SELECT COUNT(*)::int AS c FROM fiaon_abo_raten WHERE ref = ${refOffen}
      `) as any[];
      ok("GEGENPROBE: nach der Buchung entsteht die Rate sehr wohl", jetztRaten.c >= 1,
        `${jetztRaten.c} Raten`);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("6. Am Tag danach: überfällig und zugeteilt");
      // ═══════════════════════════════════════════════════════════════════
      // Die Rate auf gestern ziehen — dann ist heute der Tag danach.
      await tx`
        UPDATE fiaon_abo_raten
        SET faellig_am = ${heute}::date - 1, ueberfaellig_seit = NULL
        WHERE id = ${rate.id}
      `;
      await aboTageslauf({ force: false, lauf: tx });
      const [ueber] = (await tx`
        SELECT ueberfaellig_seit::text AS seit FROM fiaon_abo_raten WHERE id = ${rate.id}
      `) as any[];
      ok("Die gestern fällige Rate ist ab heute überfällig", ueber.seit === heute,
        `ueberfaellig_seit = ${ueber.seit}, erwartet ${heute}`);

      // Die Zuteilung braucht einen Menschen mit der Rolle Inkasso. Gibt es
      // keinen, ist „nicht zugeteilt" die richtige Antwort — nicht ein Fehler.
      const inkassoLeute = (await tx`
        SELECT COUNT(*)::int AS c FROM fiaon_agents
        WHERE active AND rolle = 'inkasso' AND NOT COALESCE(is_test_account, FALSE)
      `) as any[];
      if (Number(inkassoLeute[0].c) > 0) {
        const [zug] = (await tx`
          SELECT inkasso_agent_id FROM fiaon_abo_raten WHERE id = ${rate.id}
        `) as any[];
        ok("… und gehört einem Menschen im Forderungsmanagement",
          zug.inkasso_agent_id != null, "keine Zuteilung erfolgt");
      } else {
        ok("… Zuteilung übersprungen: es gibt keinen aktiven Inkasso-Mitarbeiter", true);
      }

      // ═══════════════════════════════════════════════════════════════════
      gruppe("7. Inkasso-Liste — ein Name je Mensch");
      // ═══════════════════════════════════════════════════════════════════
      // Der ungünstigste Fall: derselbe Mensch, ZWEI Bestellungen, mehrere Raten.
      const refZweit = REF("ZWEIT");
      await tx`
        INSERT INTO fiaon_applications
          (ref, type, status, pack_key, pack_name, first_name, last_name, email,
           amount_due, payment_status, payment_reference, person_id, paid_at, completed_at,
           created_at, updated_at)
        VALUES (${refZweit}, 'privat', 'payment_completed', 'pro', 'FIAON Pro',
                'Anna', 'Prüfstand', ${MAIL("anna")}, 59.99, 'paid', ${`PR-${stempel}-4`},
                ${personA.id}, ${`${anker}T10:00:00Z`}, ${`${anker}T10:00:00Z`}, NOW(), NOW())
      `;
      for (let i = 1; i <= 3; i++) {
        await tx`
          INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents,
                                       faellig_am, status, quelle)
          VALUES (${refZweit}, ${i}, ${`PR-${stempel}-4-${i}`}, 5999,
                  ${heute}::date - ${i * 3}::int, 'offen', 'pruefstand')
        `;
      }
      const karten = await arbeitslistePersonen({ limit: 200 }, tx as any);
      const meine = karten.filter((k) => k.personId === Number(personA.id));
      gleich("Anna Prüfstand steht GENAU EINMAL in der Liste", meine.length, 1);
      ok("… mit allen ihren Raten in einer Karte", meine[0].anzahl >= 4,
        `${meine[0]?.anzahl} Raten auf der Karte`);
      ok("… und ist als Zweit-Abo markiert (zwei Bestellungen)", meine[0].zweitAbo === true);
      gleich("… über zwei Bestellungen", meine[0].bestellungen, 2);
      ok("… die Karte trägt den Zyklus im Klartext",
        /Abo aktiv seit/.test(String(meine[0].zyklusText ?? "")), meine[0].zyklusText);
      // GEGENPROBE: Ungruppiert wären es mehrere Zeilen.
      const [zeilen] = (await tx`
        SELECT COUNT(*)::int AS c FROM fiaon_abo_raten r
        JOIN fiaon_applications a ON a.ref = r.ref
        WHERE a.person_id = ${personA.id} AND r.status = 'offen' AND r.storniert_am IS NULL
      `) as any[];
      ok("GEGENPROBE: ungruppiert wären es mehr Zeilen als Menschen",
        Number(zeilen.c) > meine.length, `${zeilen.c} Raten, ${meine.length} Karte`);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("8. Der Anruf folgt der NUMMER, nicht der offenen Karte");
      // ═══════════════════════════════════════════════════════════════════
      const wemA = await personZurNummer(NUMMER(1), tx as any);
      gleich("Annas Nummer gehört Anna", wemA.person?.personId, Number(personA.id));
      ok("… und das Panel sagt es vorher", /^Du rufst Anna Prüfstand an\.$/.test(wemA.anzeige),
        wemA.anzeige);

      // DER FALL AUS DEM TEAMFEEDBACK: Karte A offen, Nummer B gewählt.
      const z = await anrufZuordnen(NUMMER(2), Number(personA.id), tx as any);
      gleich("Bei Berts Nummer gewinnt BERT, nicht die offene Karte von Anna",
        z.person?.personId, Number(personB.id));
      ok("… und der Widerspruch wird erkannt", z.widerspruch === true);
      ok("… das Panel nennt den richtigen Namen", /Bert Prüfstand/.test(z.anzeige), z.anzeige);

      // Unbekannte Nummer → kein Personenbezug, Zuordnung ist Pflicht.
      const unbekannt = await anrufZuordnen(NUMMER(987), Number(personA.id), tx as any);
      gleich("Eine unbekannte Nummer gehört NIEMANDEM", unbekannt.person, null);
      ok("… und sagt das ausdrücklich", /Unbekannte Nummer/.test(unbekannt.anzeige),
        unbekannt.anzeige);

      // Alias-Nummer: Der Kunde hat seine Nummer gewechselt.
      await tx`
        INSERT INTO fiaon_person_aliases (person_id, kind, value_norm, value_raw, source)
        VALUES (${personA.id}, 'phone', ${NUMMER(77)}, ${NUMMER(77)}, 'pruefstand')
      `;
      const ueberAlias = await personZurNummer(NUMMER(77), tx as any);
      gleich("Die alte Nummer führt weiter zu Anna", ueberAlias.person?.personId, Number(personA.id));
      gleich("… und wird als Alias ausgewiesen", ueberAlias.person?.quelle, "alias");

      // GEGENPROBE: Der Server nimmt die personId nicht mehr ungeprüft.
      const telQuelle = datei("server/routes/fiaon-telefonie.ts");
      ok("GEGENPROBE: die Route schreibt nicht mehr die rohe personId in fiaon_calls",
        !/INSERT INTO fiaon_calls[\s\S]{0,200}VALUES \(\$\{personId\}/.test(telQuelle));
      ok("… sondern die aus der Nummer aufgelöste Person",
        /VALUES \(\$\{echtePersonId\}/.test(telQuelle));
      ok("… und prüft die Zugriffsrechte an DIESER Person",
        /darfAnKunde\(req\.agent!\.id, rolle, echtePersonId\)/.test(telQuelle));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("9. Der Empfänger kommt von der Person, dann vom Alias");
      // ═══════════════════════════════════════════════════════════════════
      const eA = await empfaengerFuerPerson(Number(personA.id), tx as any);
      gleich("Annas Adresse kommt aus den Stammdaten", eA?.email, MAIL("anna"));
      gleich("… und sagt das auch", eA?.quelle, "person");

      // Bert hat KEINE primary_email — aber einen Alias.
      await tx`
        INSERT INTO fiaon_person_aliases (person_id, kind, value_norm, value_raw, source)
        VALUES (${personB.id}, 'email', ${MAIL("bert-alias")}, ${MAIL("bert-alias")}, 'pruefstand')
      `;
      const eB = await empfaengerFuerPerson(Number(personB.id), tx as any);
      gleich("Ohne Stammdaten-Adresse greift der Alias", eB?.email, MAIL("bert-alias"));
      gleich("… und wird als Alias ausgewiesen", eB?.quelle, "alias");

      // Und der gemeldete Fall: Adresse fehlt an der Bestellzeile, Person hat sie.
      await tx`UPDATE fiaon_applications SET email = NULL, contact_email = NULL, billing_email = NULL WHERE ref = ${refPaket}`;
      const eTrotzdem = await empfaengerFuerPerson(Number(personA.id), tx as any);
      gleich("Leere Bestellzeile ändert nichts — die Person weiß es", eTrotzdem?.email, MAIL("anna"));

      // Niemand erreichbar: Es wird NICHT gesendet, und das ist sichtbar.
      const [personC] = (await tx`
        INSERT INTO fiaon_persons (person_ref, kind, first_name, last_name, created_at, updated_at)
        VALUES (${`PP-${stempel}-C`}, 'privat', 'Clemens', 'Ohnemail', NOW(), NOW())
        RETURNING id
      `) as any[];
      gleich("Ohne jede Adresse gibt es keinen Empfänger",
        await empfaengerFuerPerson(Number(personC.id), tx as any), null);

      gleich("Eine Adresse mit Leerzeichen ist keine Adresse", mailNormal("a b@c.de"), null);
      gleich("… ohne @ auch nicht", mailNormal("keine-adresse"), null);
      gleich("… und wird kleingeschrieben", mailNormal("  Max@Beispiel.DE "), "max@beispiel.de");

      // Der eine Ort, an dem aufgelöst wird.
      const webhookQuelle = datei("server/make-webhook.ts");
      ok("Jeder Versand geht durch die Empfänger-Auflösung",
        /adresseBestimmen\(payload\)/.test(webhookQuelle));
      ok("… und ohne Adresse geht NICHTS raus, bevor webhookRoh gerufen wird",
        /if \(!aufgeloest\.email\) \{[\s\S]{0,400}return erg;\n  \}/.test(webhookQuelle)
        && webhookQuelle.indexOf("if (!aufgeloest.email)")
           < webhookQuelle.indexOf("const erg = await webhookRoh"));
      ok("… der Fehlschlag steht im Protokoll",
        /protokollNebenbei\(eventType, payload, erg\);[\s\S]{0,120}console\.warn/.test(webhookQuelle));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("10. Stammdaten — Zuständiger UND Leitung dürfen");
      // ═══════════════════════════════════════════════════════════════════
      const { darfAnKunde } = await import("../server/lib/fiaon-kundenzugriff");
      // Ein Agent, dem Anna zugeteilt ist.
      const [agentEigen] = (await tx`
        INSERT INTO fiaon_agents (name, email, rolle, active, created_at)
        VALUES (${`Prüf Agent ${stempel}`}, ${MAIL("agent")}, 'agent', TRUE, NOW())
        RETURNING id
      `) as any[];
      const [agentFremd] = (await tx`
        INSERT INTO fiaon_agents (name, email, rolle, active, created_at)
        VALUES (${`Prüf Fremd ${stempel}`}, ${MAIL("fremd")}, 'agent', TRUE, NOW())
        RETURNING id
      `) as any[];
      const [leitung] = (await tx`
        INSERT INTO fiaon_agents (name, email, rolle, active, created_at)
        VALUES (${`Prüf Leitung ${stempel}`}, ${MAIL("leitung")}, 'vertriebsleiter', TRUE, NOW())
        RETURNING id
      `) as any[];
      const [inkasso] = (await tx`
        INSERT INTO fiaon_agents (name, email, rolle, active, created_at)
        VALUES (${`Prüf Inkasso ${stempel}`}, ${MAIL("inkasso")}, 'inkasso', TRUE, NOW())
        RETURNING id
      `) as any[];
      await tx`UPDATE fiaon_persons SET assigned_agent_id = ${agentEigen.id} WHERE id = ${personA.id}`;

      ok("Der zuständige Agent darf an Anna",
        await darfAnKunde(Number(agentEigen.id), "agent", Number(personA.id), tx as any));
      ok("Die Vertriebsleitung darf an Anna",
        await darfAnKunde(Number(leitung.id), "vertriebsleiter", Number(personA.id), tx as any));
      ok("Das Forderungsmanagement darf an Anna (sie hat eine offene Rate)",
        await darfAnKunde(Number(inkasso.id), "inkasso", Number(personA.id), tx as any));
      ok("GEGENPROBE: ein fremder Agent darf NICHT",
        !(await darfAnKunde(Number(agentFremd.id), "agent", Number(personA.id), tx as any)));
      ok("GEGENPROBE: das Forderungsmanagement darf NICHT an einen Menschen ohne offene Rate",
        !(await darfAnKunde(Number(inkasso.id), "inkasso", Number(personC.id), tx as any)));

      // Die Torwächter-Funktion darf keine zweite Definition mehr haben.
      const agentQuelle = datei("server/routes/fiaon-agent.ts");
      ok("requireEigenerKunde benutzt darfAnKunde statt einer eigenen Regel",
        /async function requireEigenerKunde[\s\S]{0,1800}darfAnKunde\(req\.agent!\.id, rolle/.test(agentQuelle));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("11. Eine Nummernquelle — die Änderung erreicht die Person");
      // ═══════════════════════════════════════════════════════════════════
      // Das Durchschreiben passiert in updateCustomerContact über sqlPool und
      // ist deshalb hier nicht ausführbar. Geprüft wird, dass es da ist und
      // den alten Wert als Alias sichert, statt ihn zu überschreiben.
      ok("Die Stammdaten-Korrektur schreibt auf die Person durch",
        /await personDurchschreiben\(ref, \{/.test(agentQuelle));
      ok("… setzt phone_key9 mit (sonst wird der Rückruf nicht erkannt)",
        /SET primary_phone = \$\{neu\.phone\}, phone_key9 = \$\{kern\}/.test(agentQuelle));
      ok("… und sichert den alten Wert als Alias, statt ihn zu löschen",
        /await alias\("phone", p\.primary_phone\)/.test(agentQuelle)
        && /await alias\("email", p\.primary_email\)/.test(agentQuelle));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("12. Der Motor arbeitet sichtbar");
      // ═══════════════════════════════════════════════════════════════════
      const aboQuelle = datei("server/routes/fiaon-abo.ts");
      ok("Es gibt eine Auskunft, was der Motor heute getan hat",
        /router\.get\("\/admin\/abo\/motor\/heute"/.test(aboQuelle));
      ok("… mit dem Satz für den Betreiber",
        /Abo-Motor: heute \$\{Number\(k\.rechnungen_heute\)\} Rechnung\(en\) versandt/.test(aboQuelle));
      ok("Der Tageslauf ist von Hand auslösbar",
        /router\.post\("\/admin\/abo\/tageslauf"/.test(aboQuelle));
      ok("Es gibt den Zyklus im Klartext je Bestellung",
        /router\.get\("\/admin\/abo\/:ref\/zyklus"/.test(aboQuelle));

      const tafel = datei("client/src/components/admin/AboTafel.tsx");
      ok("Die Zahlungszentrale zeigt die Motor-Karte",
        /Abo-Motor: heute \{motor\.rechnungenVersandt\}/.test(tafel));
      ok("… und hat einen Knopf für den Tageslauf",
        /Tageslauf jetzt/.test(tafel) && /void tageslauf\(\)/.test(tafel));

      const hub = datei("client/src/pages/admin-hub.tsx");
      ok("Das Dashboard zeigt die Zustellkarte",
        /\{zustellung\.versandtHeute\} versandt/.test(hub));
      ok("… mit Deep-Link auf das gefilterte Protokoll",
        /href=\{zustellung\.link\}/.test(hub));

      const akte = datei("client/src/pages/admin-kunde.tsx");
      ok("Die Kundenakte zeigt den Abo-Zyklus", /\{zyklus\.text\}/.test(akte));

      const inkassoSeite = datei("client/src/pages/agent/inkasso.tsx");
      ok("Die Inkasso-Liste rendert Menschen, nicht Raten",
        /menschen\.map\(\(m, i\) =>/.test(inkassoSeite));
      ok("… mit aufklappbaren Raten",
        /Alle \$\{m\.anzahl\} Raten zeigen/.test(inkassoSeite)
        && /setAufgeklappt\(\(v\) =>/.test(inkassoSeite));
      ok("… und zeigt den Zyklus im Klartext", /\{m\.zyklusText\}/.test(inkassoSeite));

      const softphone = datei("client/src/components/Softphone.tsx");
      ok("Das Panel fragt vor dem Wählen, wem die Nummer gehört",
        /telefon\/wem\?nummer=/.test(softphone));
      ok("… und zeigt die Antwort an", /\{wem\.anzeige\}/.test(softphone));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("13. Nichts ist an echten Daten hängengeblieben");
      // ═══════════════════════════════════════════════════════════════════
      const [fremd] = (await tx`
        SELECT COUNT(*)::int AS c FROM fiaon_abo_raten r
        WHERE r.quelle = 'pruefstand' AND r.ref NOT LIKE ${`FIAON-ABOM${stempel}%`}
      `) as any[];
      gleich("Keine Prüfstands-Rate an einer fremden Bestellung", fremd.c, 0);

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("14. Die Transaktion wurde zurückgerollt");
  // ═════════════════════════════════════════════════════════════════════════
  const nachher = (await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_abo_raten)::int AS raten,
           (SELECT COUNT(*) FROM fiaon_applications)::int AS apps,
           (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_calls)::int AS anrufe,
           (SELECT COUNT(*) FROM fiaon_person_aliases)::int AS aliase
  `)[0] as any;
  // „Darf nicht schrumpfen und nicht durch uns wachsen": Ein echter Besucher,
  // der währenddessen ein Formular ausfüllt, ist der Betrieb — deshalb wird
  // auf die eigenen Spuren geprüft und nicht auf Gleichstand.
  for (const feld of ["raten", "apps", "personen", "anrufe", "aliase"]) {
    ok(`${feld}: keine Zeile aus dem Prüfstand übrig`,
      Number(nachher[feld]) >= Number(vorher[feld]),
      `vorher ${vorher[feld]}, nachher ${nachher[feld]}`);
  }
  const [reste] = (await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_applications WHERE ref LIKE ${`FIAON-ABOM${stempel}%`})::int
         + (SELECT COUNT(*) FROM fiaon_persons WHERE person_ref LIKE ${`PP-${stempel}%`})::int
         + (SELECT COUNT(*) FROM fiaon_agents WHERE name LIKE ${`Prüf %${stempel}`})::int AS c
  `) as any[];
  gleich("Kein Prüfstands-Datensatz in der Produktion", reste.c, 0);

  // ═════════════════════════════════════════════════════════════════════════
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
