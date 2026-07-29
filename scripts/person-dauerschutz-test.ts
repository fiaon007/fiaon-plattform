/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DAUERSCHUTZ (P1-C) — DER TESTPLAN, AUSGEFÜHRT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Prüft an ECHTEN Zeilen, dass die Schreibpfade keine zweite Person mehr
 * anlegen. Ein Test gegen Attrappen würde hier nichts beweisen: Die Fehler,
 * die uns Geld gekostet haben, steckten in der Zusammenarbeit von Abfrage,
 * eindeutigem Index und Reihenfolge — nicht in der reinen Logik.
 *
 * SICHERHEIT
 *   · Alle Testzeilen tragen das Präfix `FIAON-TEST-P1C-` bzw. eine
 *     `@p1c-test.invalid`-Adresse und werden am Ende RESTLOS entfernt.
 *   · Es wird nichts an Bestandsdaten verändert. Kein `payment_status`,
 *     keine Provision, keine E-Mail.
 *   · Am Ende steht eine Gegenprobe: Ist der Bestand unverändert?
 *
 *   npx tsx scripts/person-dauerschutz-test.ts
 */

import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import {
  bindePersonAnAntrag,
  bindePersonAnLead,
  ensurePersonTables,
} from "../server/fiaon-person-model";

const MARKE = "p1c-test.invalid";
const REF_PRAEFIX = "FIAON-TEST-P1C-";

let bestanden = 0, fehlgeschlagen = 0;
const log = (s = "") => console.log(s);
function ok(name: string, bedingung: boolean, detail = ""): void {
  if (bedingung) { bestanden++; log(`  ✓ ${name}`); }
  else { fehlgeschlagen++; log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}
function gleich(name: string, ist: unknown, soll: unknown): void {
  ok(name, ist === soll, `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 62 - t.length))}`); }

const stempel = Date.now().toString(36).toUpperCase();
const ref = (s: string) => `${REF_PRAEFIX}${stempel}-${s}`;

async function antragAnlegen(r: string, felder: Record<string, unknown>): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_applications ${sqlPool({ ref: r, status: "draft", ...felder } as any)}
  `;
}

async function personVon(r: string): Promise<number | null> {
  const [x] = await sqlPool`SELECT person_id FROM fiaon_applications WHERE ref = ${r}`;
  return x?.person_id != null ? Number(x.person_id) : null;
}

/**
 * Jede Person, die dieser Lauf angelegt hat.
 *
 * Ohne diese Liste bliebe nach einer Zusammenführung eine Person zurück: Ihre
 * Aliase sind dann korrekt an die überlebende Person gewandert — und damit ist
 * sie über die Test-Marke nicht mehr auffindbar. Genau das ist beim ersten
 * Durchlauf passiert.
 */
const angelegtePersonen = new Set<number>();
function merken(z: { personId: number; zusammengefuehrt: number[] } | null): void {
  if (!z) return;
  angelegtePersonen.add(z.personId);
  for (const id of z.zusammengefuehrt) angelegtePersonen.add(id);
}

async function aufraeumen(): Promise<{ apps: number; leads: number; personen: number; aliase: number }> {
  // Zusätzlich die Marke absuchen — fängt Reste eines abgebrochenen Laufs.
  const pIds = await sqlPool`
    SELECT DISTINCT p.id FROM fiaon_persons p
    JOIN fiaon_person_aliases a ON a.person_id = p.id
    WHERE a.value_norm LIKE ${"%" + MARKE} OR a.source LIKE ${REF_PRAEFIX + "%"}
       OR a.source LIKE ${"app:" + REF_PRAEFIX + "%"}
  `;
  const ids = Array.from(new Set([
    ...(pIds as any[]).map((r) => Number(r.id)),
    ...angelegtePersonen,
  ]));
  const apps = await sqlPool`DELETE FROM fiaon_applications WHERE ref LIKE ${REF_PRAEFIX + "%"} RETURNING ref`;
  const leads = await sqlPool`
    DELETE FROM fiaon_leads WHERE email LIKE ${"%" + MARKE} OR telefon LIKE '+4915777%' RETURNING id
  `;
  let aliase = 0, personen = 0;
  if (ids.length > 0) {
    const a = await sqlPool`DELETE FROM fiaon_person_aliases WHERE person_id = ANY(${ids}::int[]) RETURNING id`;
    const p = await sqlPool`DELETE FROM fiaon_persons WHERE id = ANY(${ids}::int[]) RETURNING id`;
    aliase = a.length; personen = p.length;
  }
  return { apps: apps.length, leads: leads.length, personen, aliase };
}

async function main(): Promise<void> {
  log("\nDAUERSCHUTZ P1-C — TESTPLAN");
  log("═".repeat(66));
  await ensurePersonTables();
  await aufraeumen(); // Reste eines abgebrochenen Laufs

  const [vorher] = await sqlPool`
    SELECT (SELECT COUNT(*)::int FROM fiaon_persons) AS personen,
           (SELECT COUNT(*)::int FROM fiaon_applications) AS apps,
           (SELECT COUNT(*)::int FROM fiaon_person_aliases) AS aliase
  `;

  try {
    // ── 1. Neuer Antrag mit bekannter E-Mail ────────────────────────────────
    gruppe("Neuer Antrag mit bekannter E-Mail");
    const mail = `anna.${stempel.toLowerCase()}@${MARKE}`;
    const r1 = ref("A1");
    await antragAnlegen(r1, {
      type: "private", first_name: "Anna", last_name: "Test", email: mail,
      phone: "015777123456", phone_country_code: "+49", password: "geheim-echt",
    });
    const z1 = await bindePersonAnAntrag(r1);
    merken(z1);
    ok("Person angelegt", z1?.angelegt === true);
    const p1 = await personVon(r1);
    ok("person_id an der Zeile", p1 != null);

    // Zweite Bestellung, gleiche E-Mail, KEIN Passwort im Body.
    const r2 = ref("A2");
    await antragAnlegen(r2, { type: "private", first_name: "Anna", email: mail });
    const z2 = await bindePersonAnAntrag(r2);
    merken(z2);
    gleich("keine zweite Person angelegt", z2?.angelegt, false);
    gleich("dieselbe Person", await personVon(r2), p1);

    const [pw] = await sqlPool`SELECT password FROM fiaon_persons WHERE id = ${p1}`;
    gleich("Passwort unversehrt", pw?.password, "geheim-echt");

    // ── 2. Bonitäts-Kauf ────────────────────────────────────────────────────
    gruppe("Bonitäts-Kauf legt keine zweite Person an");
    const rS = ref("SCHUFA");
    await antragAnlegen(rS, {
      type: "schufa", status: "submitted", first_name: "Anna", last_name: "Test",
      email: mail, pack_name: "Bonitätsauskunft inkl. Handlungsplan",
    });
    const zS = await bindePersonAnAntrag(rS);
    merken(zS);
    gleich("keine neue Person", zS?.angelegt, false);
    gleich("dieselbe Person wie das Konto", await personVon(rS), p1);
    const [pw2] = await sqlPool`SELECT password FROM fiaon_persons WHERE id = ${p1}`;
    gleich("Passwort weiterhin unversehrt (Kunde bleibt eingeloggt)", pw2?.password, "geheim-echt");

    const [zeilen] = await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE person_id = ${p1}
    `;
    gleich("drei Bestellungen an EINER Person", zeilen.n, 3);

    // ── 3. Lead ohne E-Mail wird später Antrag mit E-Mail ───────────────────
    gruppe("Lead ohne E-Mail → Antrag mit fremder E-Mail (Zusammenführung)");
    const tel = "+4915777987654";
    const [lead] = await sqlPool`
      INSERT INTO fiaon_leads (vorname, nachname, email, telefon, quelle, status)
      VALUES ('Bernd', 'Ohnemail', NULL, ${tel}, 'facebook_lead_ads', 'neu')
      RETURNING id
    `;
    const zL = await bindePersonAnLead(Number(lead.id));
    merken(zL);
    ok("Lead-Person angelegt (nur Rufnummer)", zL?.angelegt === true);
    const leadPerson = zL!.personId;

    // Eine zweite, unabhängige Person mit einer E-Mail.
    const mailB = `bernd.${stempel.toLowerCase()}@${MARKE}`;
    const rB0 = ref("B0");
    await antragAnlegen(rB0, { type: "private", first_name: "Bernd", email: mailB });
    const zB0 = await bindePersonAnAntrag(rB0);
    merken(zB0);
    ok("zweite, getrennte Person angelegt", zB0?.angelegt === true);
    ok("es sind wirklich zwei", zB0!.personId !== leadPerson);

    // Jetzt die Zeile, die BEIDE Merkmale trägt.
    const rB1 = ref("B1");
    await antragAnlegen(rB1, {
      type: "private", first_name: "Bernd", last_name: "Ohnemail",
      email: mailB, phone: "015777987654", phone_country_code: "+49",
    });
    const zB1 = await bindePersonAnAntrag(rB1);
    merken(zB1);
    gleich("keine dritte Person", zB1?.angelegt, false);
    ok("zusammengeführt", (zB1?.zusammengefuehrt.length ?? 0) === 1,
       `zusammengeführt: ${JSON.stringify(zB1?.zusammengefuehrt)}`);

    const ueberlebt = zB1!.personId;
    const [aliasZahl] = await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_person_aliases WHERE person_id = ${ueberlebt}
    `;
    ok("alle Aliase an einer Person (E-Mail + Rufnummer)", Number(aliasZahl.n) >= 2,
       `${aliasZahl.n} Aliase`);

    const [telAlias] = await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_person_aliases
      WHERE person_id = ${ueberlebt} AND kind = 'phone' AND value_norm = '777987654'
    `;
    gleich("die Lead-Nummer ist erhalten geblieben", telAlias.n, 1);

    const [leadJetzt] = await sqlPool`SELECT person_id FROM fiaon_leads WHERE id = ${lead.id}`;
    gleich("der Lead zeigt auf die überlebende Person", Number(leadJetzt.person_id), ueberlebt);

    const verliererId = leadPerson === ueberlebt ? zB0!.personId : leadPerson;
    const [verlierer] = await sqlPool`
      SELECT merged_into_person_id, account_status FROM fiaon_persons WHERE id = ${verliererId}
    `;
    ok("die unterlegene Person wurde NICHT gelöscht", verlierer != null);
    gleich("sie zeigt auf die überlebende", Number(verlierer?.merged_into_person_id), ueberlebt);

    // ── 4. Funnel-Abbrecher ─────────────────────────────────────────────────
    gruppe("Funnel-Abbrecher bekommt bewusst KEINE Person");
    const rLeer = ref("LEER");
    await antragAnlegen(rLeer, { type: "private", first_name: "Ohne" });
    const zLeer = await bindePersonAnAntrag(rLeer);
    gleich("keine Zuordnung", zLeer, null);
    gleich("person_id bleibt leer", await personVon(rLeer), null);

    // ── 5. Wiederholtes Speichern ───────────────────────────────────────────
    gruppe("Der Funnel speichert bei jedem Schritt — ohne Nebenwirkung");
    const vorWiederholung = await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_persons`;
    for (let i = 0; i < 4; i++) await bindePersonAnAntrag(r1);
    const nachWiederholung = await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_persons`;
    gleich("viermal gespeichert, keine neue Person", nachWiederholung[0].n, vorWiederholung[0].n);
    gleich("person_id unverändert", await personVon(r1), p1);
    const [pw3] = await sqlPool`SELECT password FROM fiaon_persons WHERE id = ${p1}`;
    gleich("Passwort auch nach vier Speichervorgängen da", pw3?.password, "geheim-echt");

  } finally {
    // ── Aufräumen ─────────────────────────────────────────────────────────
    gruppe("Aufräumen");
    const weg = await aufraeumen();
    log(`  entfernt: ${weg.apps} Anträge, ${weg.leads} Leads, ${weg.personen} Personen, ${weg.aliase} Aliase`);

    const [nachher] = await sqlPool`
      SELECT (SELECT COUNT(*)::int FROM fiaon_persons) AS personen,
             (SELECT COUNT(*)::int FROM fiaon_applications) AS apps,
             (SELECT COUNT(*)::int FROM fiaon_person_aliases) AS aliase
    `;
    gleich("Personen wie vorher", nachher.personen, vorher.personen);
    gleich("Antragszeilen wie vorher", nachher.apps, vorher.apps);
    gleich("Aliase wie vorher", nachher.aliase, vorher.aliase);
  }

  log("\n" + "═".repeat(66));
  log(`ERGEBNIS: ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`);
  await sqlPool.end();
  if (fehlgeschlagen > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error("\nTest abgebrochen:", err);
  await aufraeumen().catch(() => {});
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
