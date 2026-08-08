// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND — Merge, Archiv und der Dauerschutz aus Teil 0
//
// Dieser Lauf beantwortet die Frage, die das Team dem Zusammenführen bisher
// verweigert hat: Geht dabei etwas verloren?
//
// WIE SICHER DAS IST
// Alles läuft in EINER Transaktion, die am Ende bewusst zurückgerollt wird.
// Es wird also nicht „aufgeräumt" — es wird nie etwas geschrieben. Damit kann
// dieser Prüfstand am echten Bestand laufen, ohne ihn zu berühren, und es gibt
// keinen Hard-Delete von Testzeilen (der beim letzten Mal Reste hinterließ).
//
// WAS GEPRÜFT WIRD
//   1. Merge: Zählprobe, Aliase, Zuständigkeit, alle Verbote
//   2. Der Verlierer verschwindet aus JEDER Liste — einzeln geprüft
//   3. Archiv: raus aus Arbeitslisten, bezahlte Bestellung nicht archivierbar
//   4. Teil 0: Fristablauf ändert keinen Kontozustand und entfernt niemanden
//
// ZWEI ARTEN VON PRÜFUNG, mit Absicht:
//   · DYNAMISCH — echte Zeilen, echte Abfragen, echte Ergebnisse.
//   · IM QUELLTEXT — ob die Bedingung wirklich in der Abfrage der Anwendung
//     steht. Eine dynamische Prüfung, die die Bedingung im Prüfstand selbst
//     mitbringt, würde auch dann bestehen, wenn sie in der Anwendung fehlt.
//
//   npx tsx scripts/pruef-merge.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { MergeVerboten, personenZusammenfuehren } from "../server/lib/fiaon-person-merge";
import { archiviereAntrag, ArchivVerboten, stelleAntragWiederHer } from "../server/lib/fiaon-antrag-archiv";
import {
  echtePersonSql, fristAbgelaufenSql, nichtArchiviertSql, offeneZahlungSql,
} from "../server/lib/fiaon-bestand-filter";
import { istAttrappenNummer } from "../server/lib/fiaon-dubletten-kandidaten";

let bestanden = 0;
let fehlgeschlagen = 0;
const fehlerListe: string[] = [];

const log = (s = "") => console.log(s);
function ok(name: string, bedingung: boolean, detail = ""): void {
  if (bedingung) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; fehlerListe.push(name); log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function gleich(name: string, ist: unknown, soll: unknown): void {
  ok(name, ist === soll, `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 64 - t.length))}`); }

/** Sentinel: beendet die Transaktion und nimmt damit ALLES zurück. */
class Zurueckrollen extends Error {}

const stempel = Date.now().toString(36).toUpperCase();
const TEST_REF = (s: string) => `FIAON-TEST-MERGE-${stempel}-${s}`;
const ECHT_REF = (s: string) => `FIAON-PMPRUEF-${stempel}-${s}`;
const AKTEUR = { name: "Prüfstand (pruef-merge)", agentId: null as number | null };

async function main(): Promise<void> {
  log("\n══ Prüfstand: Zusammenführen, Archiv, Dauerschutz ══");

  // ── Bestand vorher, für die Gegenprobe am Ende ────────────────────────
  const [vorBestand] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_applications)::int AS bestellungen,
           (SELECT COUNT(*) FROM fiaon_contact_log)::int AS verlauf,
           (SELECT COUNT(*) FROM fiaon_person_aliases)::int AS aliase,
           (SELECT COUNT(*) FROM fiaon_agent_events)::int AS ereignisse
  `;

  try {
    await sqlPool.begin(async (tx) => {
      // ═══════════════════════════════════════════════════════════════════
      // TESTDATEN
      // ═══════════════════════════════════════════════════════════════════
      const person = async (felder: Record<string, unknown>): Promise<number> => {
        const [r] = await tx`
          INSERT INTO fiaon_persons ${tx({
            person_ref: `FIAON-P-PM${stempel}${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
            kind: "private", account_status: "pending", priority_tier: 2,
            ...felder,
          } as any)} RETURNING id
        `;
        return Number(r.id);
      };
      const antrag = async (ref: string, felder: Record<string, unknown>): Promise<string> => {
        await tx`
          INSERT INTO fiaon_applications ${tx({
            ref, status: "completed", type: "private", payment_status: "pending_payment",
            ist_entwurf: false, ...felder,
          } as any)}
        `;
        return ref;
      };
      const verlaufEintrag = async (ref: string, felder: Record<string, unknown> = {}) => {
        await tx`
          INSERT INTO fiaon_contact_log ${tx({
            ref, agent_name: "Prüfstand", type: "result", outcome: "erreicht", ...felder,
          } as any)}
        `;
      };
      const agent = async (name: string): Promise<number> => {
        const [r] = await tx`
          INSERT INTO fiaon_agents ${tx({
            name, email: `pm-${stempel}-${name.toLowerCase()}@merge-pruef.invalid`,
            active: true, is_test_account: true,
          } as any)} RETURNING id
        `;
        return Number(r.id);
      };

      const agentA = await agent("PruefA");
      const agentB = await agent("PruefB");

      // Gewinner und Verlierer: gleiche Rufnummer, ABWEICHENDE E-Mail und Straße.
      const gewinner = await person({
        first_name: "Prüf", last_name: "Zusammenfuehrung",
        primary_email: `gewinner-${stempel}@merge-pruef.invalid`,
        primary_phone: "+4915100000001", phone_key9: "100000001",
        birthdate: "1980-01-01", street: "Gewinnerweg 1", zip: "10115", city: "Berlin",
        assigned_agent_id: agentA, betreuung_seit: new Date(),
      });
      const verlierer = await person({
        first_name: "Prüf", last_name: "Zusammenfuehrung",
        primary_email: `verlierer-${stempel}@merge-pruef.invalid`,
        primary_phone: "+4915100000001", phone_key9: "100000001",
        birthdate: "1980-01-01", street: "Verliererstraße 9", zip: "10117", city: "Berlin",
        assigned_agent_id: agentA,
        promised_payment_date: "2026-08-20", follow_up_date: "2026-08-12",
      });

      const refG1 = await antrag(TEST_REF("G1"), {
        person_id: gewinner, pack_name: "Prüfpaket", amount_due: "59.99",
        payment_reference: `FIAON-PMG${stempel}`.slice(0, 20),
        payment_due_date: new Date(Date.now() + 5 * 86400_000), assigned_agent_id: agentA,
      });
      const refV1 = await antrag(TEST_REF("V1"), {
        person_id: verlierer, pack_name: "Prüfpaket", amount_due: "59.99",
        payment_reference: `FIAON-PMV1${stempel}`.slice(0, 20),
        payment_due_date: new Date(Date.now() + 5 * 86400_000), assigned_agent_id: agentA,
      });
      const refV2 = await antrag(TEST_REF("V2"), {
        person_id: verlierer, pack_name: "Prüfpaket Zwei", amount_due: "19.99",
        payment_reference: `FIAON-PMV2${stempel}`.slice(0, 20),
        payment_due_date: new Date(Date.now() + 5 * 86400_000), assigned_agent_id: agentA,
      });

      await verlaufEintrag(refG1, { note: "Gewinner: erstes Gespräch" });
      await verlaufEintrag(refV1, { note: "Verlierer: Gespräch mit Termin", scheduled_at: new Date(Date.now() + 86400_000) });
      await verlaufEintrag(refV1, { note: "Verlierer: Zahlung zugesagt", promised_date: new Date(Date.now() + 3 * 86400_000) });
      await verlaufEintrag(refV2, { note: "Verlierer: zweite Bestellung besprochen" });

      const [leadV] = await tx`
        INSERT INTO fiaon_leads ${tx({
          vorname: "Prüf", nachname: "Zusammenfuehrung",
          email: `verlierer-${stempel}@merge-pruef.invalid`, telefon: "+4915100000001",
          quelle: "pruefstand", status: "neu", person_id: verlierer,
        } as any)} RETURNING id
      `;
      await tx`
        INSERT INTO fiaon_lead_log ${tx({
          lead_id: Number(leadV.id), agent_name: "Prüfstand", type: "call",
          outcome: "erreicht", note: "Lead-Verlauf des Verlierers",
        } as any)}
      `;

      // ═══════════════════════════════════════════════════════════════════
      gruppe("1. Merge: Zählprobe und Vollständigkeit");
      // ═══════════════════════════════════════════════════════════════════
      const ergebnis = await personenZusammenfuehren(verlierer, gewinner, {}, AKTEUR, { tx });

      const z = ergebnis.zaehlprobe;
      gleich("Bestellungen: vorher = nachher", z.bestellungen.nachher, z.bestellungen.vorher);
      gleich("Bestellungen am Gewinner: 3", z.bestellungen.nachher, 3);
      gleich("Verlaufseinträge: vorher = nachher", z.verlauf.nachher, z.verlauf.vorher);
      gleich("Verlaufseinträge am Gewinner: 4", z.verlauf.nachher, 4);
      gleich("Termine erhalten", z.termine.nachher, z.termine.vorher);
      gleich("Zusagen erhalten", z.zusagen.nachher, z.zusagen.vorher);
      gleich("Leads erhalten", z.leads.nachher, z.leads.vorher);
      gleich("Lead-Verlauf erhalten", z.leadVerlauf.nachher, z.leadVerlauf.vorher);
      ok("Zwei Bestellungen übernommen", ergebnis.bestellungenUebernommen.length === 2,
        JSON.stringify(ergebnis.bestellungenUebernommen));

      const [wv] = await tx`
        SELECT promised_payment_date, follow_up_date FROM fiaon_persons WHERE id = ${gewinner}
      `;
      ok("Zusagedatum des Verlierers übernommen", wv?.promised_payment_date != null);
      ok("Wiedervorlage des Verlierers übernommen", wv?.follow_up_date != null);

      const [notiz] = await tx`
        SELECT note FROM fiaon_contact_log
        WHERE ref = ${refG1} AND outcome = 'person_merge' ORDER BY id DESC LIMIT 1
      `;
      ok("Klartext-Notiz im Verlauf des Gewinners", !!notiz?.note && String(notiz.note).includes("Zusammengeführt"),
        String(notiz?.note ?? "(keine)"));
      const [ev] = await tx`
        SELECT meta, actor FROM fiaon_agent_events WHERE type = 'person_merge' ORDER BY id DESC LIMIT 1
      `;
      ok("Protokoll in fiaon_agent_events ('person_merge')", !!ev && String(ev.actor).includes("Prüfstand"));
      ok("Protokoll enthält die Zählprobe", !!ev && String(ev.meta).includes("zaehlprobe"));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("2. Abweichende Angaben sind gesichert und auffindbar");
      // ═══════════════════════════════════════════════════════════════════
      const verliererMail = `verlierer-${stempel}@merge-pruef.invalid`;
      const aliase = await tx`
        SELECT kind, value_norm, COALESCE(feld_wert, value_raw) AS wert, quelle_person_id
        FROM fiaon_person_aliases WHERE person_id = ${gewinner}
      `;
      const alsText = JSON.stringify(aliase);
      ok("Abweichende E-Mail des Verlierers als Alias gespeichert",
        alsText.includes(verliererMail), alsText);
      ok("Abweichende Straße des Verlierers gesichert",
        alsText.includes("Verliererstraße 9"), alsText);
      ok("Herkunft des Alias vermerkt (quelle_person_id)",
        (aliase as any[]).some((a) => Number(a.quelle_person_id) === verlierer));
      ok("Gewinner behält seine eigene E-Mail",
        (await tx`SELECT primary_email FROM fiaon_persons WHERE id = ${gewinner}`)[0].primary_email
          === `gewinner-${stempel}@merge-pruef.invalid`);

      // Die Agentensuche: exakt der Zweig, der in fiaon-agent-kunden.ts steht.
      const suchTreffer = await tx.unsafe(`
        SELECT p.id FROM fiaon_persons p
        WHERE p.assigned_agent_id = $1 AND ${echtePersonSql("p")}
          AND (COALESCE(p.primary_email, '') ILIKE '%' || $2 || '%'
               OR EXISTS (SELECT 1 FROM fiaon_person_aliases al WHERE al.person_id = p.id
                            AND (al.value_norm ILIKE '%' || $2 || '%'
                                 OR COALESCE(al.value_raw, '') ILIKE '%' || $2 || '%'
                                 OR COALESCE(al.feld_wert, '') ILIKE '%' || $2 || '%')))
      `, [agentA, verliererMail]);
      ok("Alte E-Mail führt über die Agentensuche zum Gewinner",
        (suchTreffer as any[]).length === 1 && Number((suchTreffer as any[])[0].id) === gewinner,
        JSON.stringify(suchTreffer));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("3. Der Verlierer verschwindet aus JEDER Liste");
      // ═══════════════════════════════════════════════════════════════════
      const nichtDrin = async (name: string, sql: string, params: any[] = []) => {
        const rows = await tx.unsafe(sql, params);
        const ids = (rows as any[]).map((r) => Number(r.id));
        ok(name, !ids.includes(verlierer), `gefundene IDs: ${JSON.stringify(ids)}`);
      };

      // Agentenliste (fiaon-agent-kunden.ts: GET /agent/crm/kunden)
      await nichtDrin("Agentenliste enthält den Verlierer nicht", `
        SELECT p.id FROM fiaon_persons p
        WHERE p.assigned_agent_id = $1 AND ${echtePersonSql("p")}
          AND p.priority_tier BETWEEN 1 AND 2`, [agentA]);

      // Vertriebsleitung (fiaon-vertrieb.ts: GET /agent/vertrieb/personen)
      await nichtDrin("Vertriebsliste enthält den Verlierer nicht", `
        SELECT p.id FROM fiaon_persons p
        WHERE ${echtePersonSql("p")} AND p.priority_tier BETWEEN 1 AND 3`, []);

      // Admin-Suche (fiaon-admin-hub.ts: GET /admin/search) — sie sucht auf
      // Bestellungen; nach dem Merge darf keine Bestellung mehr am Verlierer hängen.
      const adminSuche = await tx.unsafe(`
        SELECT a.ref, a.person_id FROM fiaon_applications a
        WHERE a.merged_into IS NULL
          AND NOT EXISTS (SELECT 1 FROM fiaon_persons mp
                           WHERE mp.id = a.person_id AND mp.merged_into_person_id IS NOT NULL)
          AND a.ref LIKE $1`, [`FIAON-TEST-MERGE-${stempel}%`]);
      ok("Admin-Suche liefert keine Bestellung eines Wegweisers",
        (adminSuche as any[]).every((r) => Number(r.person_id) === gewinner),
        JSON.stringify(adminSuche));
      gleich("Admin-Suche findet alle drei Bestellungen am Gewinner", (adminSuche as any[]).length, 3);

      // Erstverteilung (scripts/erstverteilung.ts: holePersonen)
      await nichtDrin("Erstverteilung übergeht den Verlierer", `
        SELECT p.id FROM fiaon_persons p
        WHERE ${echtePersonSql("p")} AND p.priority_tier = 2
          AND NOT p.is_blocked AND p.betreuung_seit IS NULL
          AND p.primary_phone = $1`, ["+4915100000001"]);

      // Nachschub (fiaon-followup.ts: nachschub)
      await nichtDrin("Nachschub übergeht den Verlierer", `
        SELECT p.id FROM fiaon_persons p
        WHERE p.assigned_agent_id IS NULL AND ${echtePersonSql("p")}
          AND p.priority_tier = 2 AND NOT p.is_blocked AND p.betreuung_seit IS NULL`, []);

      // Follow-up-Tageslauf (fiaon-followup.ts: runFollowUpTageslauf, Eskalation)
      await nichtDrin("Follow-up-Tageslauf übergeht den Verlierer", `
        SELECT p.id FROM fiaon_persons p
        WHERE p.assigned_agent_id IS NOT NULL AND ${echtePersonSql("p")}
          AND NOT p.is_blocked AND p.priority_tier IN (1, 2)`, []);

      // Auto-Assign (fiaon-followup.ts: autoAssignTier1)
      const autoAssign = await tx`
        SELECT id FROM fiaon_persons WHERE id = ${verlierer} AND merged_into_person_id IS NULL
      `;
      ok("Auto-Assign findet den Verlierer nicht mehr", (autoAssign as any[]).length === 0);

      const [wegweiser] = await tx`
        SELECT merged_into_person_id, account_status, is_blocked FROM fiaon_persons WHERE id = ${verlierer}
      `;
      gleich("Verlierer zeigt auf den Gewinner", Number(wegweiser.merged_into_person_id), gewinner);
      gleich("Verlierer ist als 'merged' gekennzeichnet", wegweiser.account_status, "merged");
      ok("Verlierer ist nicht gelöscht (kein Hard-Delete)", !!wegweiser);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("4. Verbote");
      // ═══════════════════════════════════════════════════════════════════
      const verboten = async (name: string, code: string, fn: () => Promise<unknown>) => {
        try {
          await fn();
          ok(name, false, "wurde ausgeführt, obwohl verboten");
        } catch (err: any) {
          ok(name, err instanceof MergeVerboten && err.code === code,
            `${err?.name}/${err?.code}: ${err?.message}`);
        }
      };

      await verboten("Selbst-Merge abgelehnt", "selbst_merge",
        () => personenZusammenfuehren(gewinner, gewinner, {}, AKTEUR, { tx }));

      await verboten("Merge auf eine bereits gemergte Person abgelehnt", "bereits_gemergt",
        () => personenZusammenfuehren(gewinner, verlierer, {}, AKTEUR, { tx }));

      const frischA = await person({
        first_name: "Prüf", last_name: "Frisch",
        primary_email: `frisch-a-${stempel}@merge-pruef.invalid`,
        phone_key9: "100000002", primary_phone: "+4915100000002",
      });
      await verboten("Merge eines Wegweisers als Verlierer abgelehnt", "bereits_gemergt",
        () => personenZusammenfuehren(verlierer, frischA, {}, AKTEUR, { tx }));

      // Testkonto gegen echten Kunden
      const testPerson = await person({
        first_name: "Dev", last_name: "Testkonto",
        primary_email: `dev-${stempel}@fiaon-internal.dev`,
        phone_key9: "100000003", primary_phone: "+4915100000003",
      });
      const echtePerson = await person({
        first_name: "Dev", last_name: "Testkonto",
        primary_email: `echter.kunde.${stempel}@web.de`,
        phone_key9: "100000003", primary_phone: "+4915100000003",
      });
      await antrag(ECHT_REF("E1"), { person_id: echtePerson, pack_name: "Prüfpaket" });
      await verboten("Merge Testkonto ↔ echter Kunde abgelehnt", "test_und_echt",
        () => personenZusammenfuehren(testPerson, echtePerson, {}, AKTEUR, { tx }));

      // Zwei verschiedene dokumentierte Betreuer
      const betreutA = await person({
        first_name: "Prüf", last_name: "Betreut",
        primary_email: `betreut-a-${stempel}@merge-pruef.invalid`,
        phone_key9: "100000004", primary_phone: "+4915100000004",
        assigned_agent_id: agentA, betreuung_seit: new Date(),
      });
      const betreutB = await person({
        first_name: "Prüf", last_name: "Betreut",
        primary_email: `betreut-b-${stempel}@merge-pruef.invalid`,
        phone_key9: "100000004", primary_phone: "+4915100000004",
        assigned_agent_id: agentB, betreuung_seit: new Date(),
      });
      await verboten("Zwei verschiedene Betreuer OHNE Entscheidung abgelehnt", "betreuer_entscheidung_fehlt",
        () => personenZusammenfuehren(betreutB, betreutA, {}, AKTEUR, { tx }));

      const mitWahl = await personenZusammenfuehren(betreutB, betreutA,
        { betreuer: "verlierer" }, AKTEUR, { tx });
      gleich("Mit ausdrücklicher Wahl: Betreuer des Verlierers gewinnt", mitWahl.betreuer.agentId, agentB);
      gleich("Die Wahl ist protokolliert", mitWahl.betreuer.quelle, "verlierer");

      // ═══════════════════════════════════════════════════════════════════
      gruppe("5. Feldwahl: nichts wird überschrieben und vergessen");
      // ═══════════════════════════════════════════════════════════════════
      const feldA = await person({
        first_name: "Prüf", last_name: "Feldwahl", street: "Alte Gasse 1",
        primary_email: `feld-a-${stempel}@merge-pruef.invalid`,
        phone_key9: "100000005", primary_phone: "+4915100000005",
      });
      const feldB = await person({
        first_name: "Prüf", last_name: "Feldwahl", street: "Neue Allee 2",
        primary_email: `feld-b-${stempel}@merge-pruef.invalid`,
        phone_key9: "100000005", primary_phone: "+4915100000005",
      });
      await personenZusammenfuehren(feldB, feldA, { felder: { street: "verlierer" } }, AKTEUR, { tx });
      const [feldGewinner] = await tx`SELECT street FROM fiaon_persons WHERE id = ${feldA}`;
      gleich("Ausdrücklich gewählter Wert steht am Gewinner", feldGewinner.street, "Neue Allee 2");
      const feldAliase = JSON.stringify(await tx`
        SELECT COALESCE(feld_wert, value_raw) AS wert FROM fiaon_person_aliases WHERE person_id = ${feldA}
      `);
      ok("Der überschriebene Wert des Gewinners ist gesichert",
        feldAliase.includes("Alte Gasse 1"), feldAliase);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("5b. „Keine Dublette“ — dauerhaft, aber rücknehmbar");
      // ═══════════════════════════════════════════════════════════════════
      // Gefunden am 08.08.2026: Die Kandidatensuche las ALLE Zeilen dieser
      // Tabelle statt nur die verworfenen. Ein zurückgenommener Fehlklick blieb
      // damit für immer unterdrückt — ein stiller Datenverlust in der
      // Arbeitsliste.
      const paarA = await person({
        first_name: "Prüf", last_name: "Verworfen",
        primary_email: `verworfen-a-${stempel}@merge-pruef.invalid`,
        phone_key9: "100000008", primary_phone: "+4915100000008",
      });
      const paarB = await person({
        first_name: "Prüf", last_name: "Verworfen",
        primary_email: `verworfen-b-${stempel}@merge-pruef.invalid`,
        phone_key9: "100000009", primary_phone: "+4915100000009",
      });
      const [kl, gr] = paarA < paarB ? [paarA, paarB] : [paarB, paarA];
      await tx`
        INSERT INTO fiaon_dubletten_entschieden (person_a, person_b, entscheidung, akteur)
        VALUES (${kl}, ${gr}, 'keine_dublette', 'Prüfstand')
      `;
      const unterdrueckt = async () => {
        const rows = await tx`
          SELECT person_a, person_b FROM fiaon_dubletten_entschieden
          WHERE entscheidung = 'keine_dublette' AND person_a = ${kl} AND person_b = ${gr}
        `;
        return (rows as any[]).length === 1;
      };
      ok("Verworfenes Paar wird unterdrückt", await unterdrueckt());
      await tx`
        UPDATE fiaon_dubletten_entschieden SET entscheidung = 'wieder_offen'
        WHERE person_a = ${kl} AND person_b = ${gr}
      `;
      ok("Zurückgenommenes Paar wird wieder vorgeschlagen", !(await unterdrueckt()));
      const [historie] = await tx`
        SELECT entscheidung FROM fiaon_dubletten_entschieden
        WHERE person_a = ${kl} AND person_b = ${gr}
      `;
      ok("Die Entscheidung bleibt als Historie stehen (kein Hard-Delete)",
        historie?.entscheidung === "wieder_offen");

      // ═══════════════════════════════════════════════════════════════════
      gruppe("5c. Rufnummern, die keine Spur sind");
      // ═══════════════════════════════════════════════════════════════════
      // Gemessen am 08.08.2026: An „…701234567" hingen 32 Datensätze,
      // überwiegend „Dev User" — und dazwischen ein echter „Thomas Müller".
      // Als sichere Rufnummer-Gleichheit angeboten, hätte der erste Klick einen
      // Kunden in einen Testeintrag geführt.
      for (const attrappe of ["701234567", "000000000", "123456789", "987654321", "111111111"]) {
        ok(`Attrappe erkannt: …${attrappe}`, istAttrappenNummer(attrappe));
      }
      for (const echt of ["723891768", "562810491", "176611193", "151234987"]) {
        ok(`Echte Nummer bleibt Spur: …${echt}`, !istAttrappenNummer(echt));
      }

      // Gleiche Nummer, klar anderer Vorname: „Franz Molk" und „Gerda Molk"
      // teilen einen Anschluss — das sind Eheleute, keine Dublette. Der
      // Vorschlag bleibt sichtbar (sonst kann ihn niemand beurteilen), aber als
      // VERMUTUNG mit Begründung.
      const eheA = await person({
        first_name: "Franzpruef", last_name: `Anschluss${stempel}`,
        primary_email: `anschluss-a-${stempel}@merge-pruef.invalid`,
        phone_key9: "100000021", primary_phone: "+4915100000021",
      });
      const eheB = await person({
        first_name: "Gerdapruef", last_name: `Anschluss${stempel}`,
        primary_email: `anschluss-b-${stempel}@merge-pruef.invalid`,
        phone_key9: "100000021", primary_phone: "+4915100000021",
      });
      ok("Zwei Personen an einer Nummer angelegt", eheA > 0 && eheB > 0);
      ok("Herabstufung steht in der Anwendung, nicht nur hier",
        /Gleiche Rufnummer, anderer Vorname \(Vermutung\)/.test(
          readFileSync("server/lib/fiaon-dubletten-kandidaten.ts", "utf8")));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("6. Archiv (Teil 3)");
      // ═══════════════════════════════════════════════════════════════════
      const archivPerson = await person({
        first_name: "Prüf", last_name: "Archiv",
        primary_email: `archiv-${stempel}@merge-pruef.invalid`,
        phone_key9: "100000006", primary_phone: "+4915100000006",
        assigned_agent_id: agentA, priority_tier: 2,
      });
      const refArchiv = await antrag(TEST_REF("A1"), {
        person_id: archivPerson, pack_name: "Prüfpaket", amount_due: "59.99",
        payment_reference: `FIAON-PMA${stempel}`.slice(0, 20),
        payment_due_date: new Date(Date.now() + 5 * 86400_000), assigned_agent_id: agentA,
      });
      const refBezahlt = await antrag(TEST_REF("A2"), {
        person_id: archivPerson, pack_name: "Prüfpaket", amount_due: "59.99",
        payment_status: "paid", payment_reference: `FIAON-PMB${stempel}`.slice(0, 20),
      });
      const refProvision = await antrag(TEST_REF("A3"), {
        person_id: archivPerson, pack_name: "Prüfpaket", amount_due: "59.99",
        payment_reference: `FIAON-PMC${stempel}`.slice(0, 20),
      });
      await tx`
        INSERT INTO fiaon_commissions ${tx({
          agent_id: agentA, ref: refProvision, base_amount_cents: 5999,
          rate_bp: 1000, amount_cents: 600, status: "bestaetigt",
        } as any)}
      `;

      const archivFehler = async (name: string, code: string, fn: () => Promise<unknown>) => {
        try {
          await fn();
          ok(name, false, "wurde ausgeführt, obwohl gesperrt");
        } catch (err: any) {
          ok(name, err instanceof ArchivVerboten && err.code === code,
            `${err?.name}/${err?.code}: ${err?.message}`);
        }
      };
      const alsAdmin = { name: "Prüfstand", rolle: "admin" as const };
      await archivFehler("Bezahlte Bestellung ist nicht archivierbar", "bezahlt",
        () => archiviereAntrag(refBezahlt, "doppelt", null, alsAdmin, { tx }));
      await archivFehler("Bestellung mit gebuchter Provision ist nicht archivierbar", "provision",
        () => archiviereAntrag(refProvision, "doppelt", null, alsAdmin, { tx }));
      await archivFehler("Archivieren ohne Grund abgelehnt", "grund_fehlt",
        () => archiviereAntrag(refArchiv, "", null, alsAdmin, { tx }));
      await archivFehler("„Sonstiges“ ohne Erklärung abgelehnt", "notiz_fehlt",
        () => archiviereAntrag(refArchiv, "sonstiges", "hm", alsAdmin, { tx }));

      // Und jetzt der echte Weg: archivieren über die Funktion, die auch die
      // Oberfläche aufruft — mit Grund, Protokoll und Verlaufseintrag.
      await archiviereAntrag(refArchiv, "testeintrag", null, alsAdmin, { tx });
      const [archiviert] = await tx`
        SELECT archived_at, archived_reason, archived_by FROM fiaon_applications WHERE ref = ${refArchiv}
      `;
      ok("Archivieren gesetzt: Zeitpunkt, Grund und Name", !!archiviert.archived_at
        && archiviert.archived_reason === "testeintrag" && archiviert.archived_by === "Prüfstand");
      const [archivNotiz] = await tx`
        SELECT note FROM fiaon_contact_log WHERE ref = ${refArchiv} AND outcome = 'archiviert'
      `;
      ok("Archivierung steht im Verlauf der Akte", !!archivNotiz?.note);
      const [archivEreignis] = await tx`
        SELECT actor FROM fiaon_agent_events WHERE type = 'antrag_archiviert' ORDER BY id DESC LIMIT 1
      `;
      ok("Archivierung ist protokolliert", archivEreignis?.actor === "Prüfstand");

      await stelleAntragWiederHer(refArchiv, alsAdmin, { tx });
      const [zurueck] = await tx`SELECT archived_at FROM fiaon_applications WHERE ref = ${refArchiv}`;
      ok("Wiederherstellen räumt das Archiv-Kennzeichen ab", zurueck.archived_at == null);
      try {
        await stelleAntragWiederHer(refArchiv, { name: "Vertriebsleitung", rolle: "leitung" }, { tx });
        ok("Vertriebsleitung darf NICHT wiederherstellen", false, "wurde ausgeführt");
      } catch (err: any) {
        ok("Vertriebsleitung darf NICHT wiederherstellen",
          err instanceof ArchivVerboten && err.code === "nur_archiviert" || err?.code === "nur_admin",
          `${err?.code}: ${err?.message}`);
      }
      // Für die Listenprüfungen wieder archivieren.
      await archiviereAntrag(refArchiv, "doppelt", null, alsAdmin, { tx });

      const archivDrin = async (name: string, sql: string, params: any[], erwartet: boolean) => {
        const rows = await tx.unsafe(sql, params);
        const refs = (rows as any[]).map((r) => String(r.ref));
        ok(name, refs.includes(refArchiv) === erwartet, `gefunden: ${JSON.stringify(refs)}`);
      };

      await archivDrin("Archivierte Bestellung ist aus der Zahlungsliste heraus", `
        SELECT a.ref FROM fiaon_applications a
        WHERE ${offeneZahlungSql("a")} AND ${nichtArchiviertSql("a")}
          AND a.merged_into IS NULL AND a.ref LIKE $1`,
        [`FIAON-TEST-MERGE-${stempel}%`], false);

      await archivDrin("Archivierte Bestellung ist aus der Verteilung heraus", `
        SELECT a.ref FROM fiaon_applications a
        WHERE a.person_id = $1 AND a.merged_into IS NULL AND ${nichtArchiviertSql("a")}`,
        [archivPerson], false);

      await archivDrin("Archivierte Bestellung bleibt in der Akte sichtbar", `
        SELECT ref FROM fiaon_applications WHERE person_id = $1 AND merged_into IS NULL`,
        [archivPerson], true);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("7. Teil 0: Fristablauf schaltet niemanden ab");
      // ═══════════════════════════════════════════════════════════════════
      const fristPerson = await person({
        first_name: "Prüf", last_name: "Fristablauf",
        primary_email: `frist-${stempel}@merge-pruef.invalid`,
        phone_key9: "100000007", primary_phone: "+4915100000007",
        assigned_agent_id: agentA, priority_tier: 2, account_status: "pending",
      });
      const refFrist = await antrag(TEST_REF("F1"), {
        person_id: fristPerson, pack_name: "Prüfpaket", amount_due: "59.99",
        payment_status: "pending_payment", account_status: "pending",
        payment_reference: `FIAON-PMF${stempel}`.slice(0, 20),
        // Frist liegt in der VERGANGENHEIT — genau der Fall, der früher
        // stündlich auf 'expired' gesetzt wurde.
        payment_due_date: new Date(Date.now() - 3 * 86400_000), assigned_agent_id: agentA,
      });

      const [vorFrist] = await tx`
        SELECT account_status, payment_status FROM fiaon_applications WHERE ref = ${refFrist}
      `;
      const [vorPerson] = await tx`SELECT account_status FROM fiaon_persons WHERE id = ${fristPerson}`;

      // Der Lauf, der früher abgeschaltet hat — jetzt zählt er nur.
      const [gezaehlt] = await tx.unsafe(`
        SELECT COUNT(*)::int AS n FROM fiaon_applications a
        WHERE a.payment_status = 'pending_payment'
          AND a.payment_due_date IS NOT NULL AND a.payment_due_date < NOW()
          AND a.merged_into IS NULL AND ${nichtArchiviertSql("a")} AND a.ref = $1`, [refFrist]);
      gleich("Abgelaufene Frist wird erkannt (Etikett)", Number(gezaehlt.n), 1);

      const [nachFrist] = await tx`
        SELECT account_status, payment_status FROM fiaon_applications WHERE ref = ${refFrist}
      `;
      const [nachPerson] = await tx`SELECT account_status FROM fiaon_persons WHERE id = ${fristPerson}`;
      gleich("Kontozustand der Bestellung unverändert", nachFrist.account_status, vorFrist.account_status);
      gleich("Zahlungszustand bleibt 'pending_payment'", nachFrist.payment_status, "pending_payment");
      gleich("Kontozustand der Person unverändert", nachPerson.account_status, vorPerson.account_status);
      ok("Kein Konto steht auf 'suspended'", nachFrist.account_status !== "suspended"
        && nachPerson.account_status !== "suspended");

      const inAgentenliste = await tx.unsafe(`
        SELECT p.id FROM fiaon_persons p
        WHERE p.assigned_agent_id = $1 AND ${echtePersonSql("p")}
          AND p.priority_tier BETWEEN 1 AND 2 AND p.id = $2`, [agentA, fristPerson]);
      ok("Kunde mit abgelaufener Frist bleibt in der Agentenliste",
        (inAgentenliste as any[]).length === 1);

      const inZahlungsliste = await tx.unsafe(`
        SELECT a.ref FROM fiaon_applications a
        WHERE ${offeneZahlungSql("a")} AND ${nichtArchiviertSql("a")}
          AND a.merged_into IS NULL AND a.ref = $1`, [refFrist]);
      ok("Kunde mit abgelaufener Frist bleibt in der Zahlungsliste",
        (inZahlungsliste as any[]).length === 1);

      const alsAbgelaufen = await tx.unsafe(`
        SELECT a.ref FROM fiaon_applications a
        WHERE ${fristAbgelaufenSql("a")} AND a.ref = $1`, [refFrist]);
      ok("Der Filter „Frist abgelaufen“ findet den Fall trotzdem",
        (alsAbgelaufen as any[]).length === 1);

      const nochInFollowup = await tx.unsafe(`
        SELECT a.ref FROM fiaon_applications a
        WHERE a.payment_status IN ('pending_payment', 'claimed_paid')
          AND a.payment_reference IS NOT NULL AND a.merged_into IS NULL
          AND ${nichtArchiviertSql("a")} AND a.ref = $1`, [refFrist]);
      ok("Die Erinnerungs-Engine läuft weiter (Status blieb erinnerungsfähig)",
        (nochInFollowup as any[]).length === 1);

      throw new Zurueckrollen();
    });
  } catch (err) {
    if (!(err instanceof Zurueckrollen)) {
      log(`\n  ABBRUCH: ${(err as Error).message}`);
      console.error(err);
      fehlgeschlagen++;
      fehlerListe.push("Prüfstand-Ausführung");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("8. Im Quelltext: stehen die Bedingungen in der Anwendung?");
  // ═══════════════════════════════════════════════════════════════════════
  const datei = (p: string) => readFileSync(p, "utf8");
  const enthaelt = (name: string, pfad: string, muster: RegExp) =>
    ok(name, muster.test(datei(pfad)), `${pfad} — Muster ${muster}`);

  enthaelt("Agentenliste filtert gemergte Personen",
    "server/routes/fiaon-agent-kunden.ts", /merged_into_person_id IS NULL/);
  enthaelt("Agentenliste sucht über Aliase",
    "server/routes/fiaon-agent-kunden.ts", /fiaon_person_aliases/);
  enthaelt("Vertriebsliste sucht über Aliase",
    "server/routes/fiaon-vertrieb.ts", /fiaon_person_aliases/);
  enthaelt("Admin-Suche schließt Wegweiser aus",
    "server/routes/fiaon-admin-hub.ts", /merged_into_person_id IS NOT NULL/);
  enthaelt("Admin-Suche sucht über Aliase",
    "server/routes/fiaon-admin-hub.ts", /fiaon_person_aliases/);
  enthaelt("Einstufung übergeht archivierte Bestellungen",
    "server/lib/tier.ts", /archived_at IS NULL/);
  enthaelt("Follow-up übergeht archivierte Bestellungen",
    "server/routes/fiaon-followup.ts", /archived_at IS NULL/);
  enthaelt("Erstverteilung übergeht archivierte Bestellungen",
    "scripts/erstverteilung.ts", /archived_at IS NULL/);
  enthaelt("Zahlungsliste übergeht archivierte Bestellungen",
    "server/lib/fiaon-kundenlage.ts", /nichtArchiviertSql/);
  enthaelt("Zahlungsliste nutzt das gemeinsame Frist-Etikett",
    "server/lib/fiaon-kundenlage.ts", /fristAbgelaufenSql/);
  enthaelt("Erinnerungs-Engine übergeht archivierte Bestellungen",
    "server/routes/fiaon-antrag.ts", /fa\.archived_at IS NULL/);
  enthaelt("Kandidatensuche unterdrückt nur verworfene Paare",
    "server/lib/fiaon-dubletten-kandidaten.ts", /WHERE entscheidung = 'keine_dublette'/);
  enthaelt("Kandidatensuche schließt Testdatensätze aus",
    "server/lib/fiaon-dubletten-kandidaten.ts", /istTestKandidat/);

  // Teil 0, der wichtigste Quelltext-Beweis: Es darf KEINE Stelle mehr geben,
  // die payment_status automatisch auf 'expired' setzt.
  const antragQuelle = datei("server/routes/fiaon-antrag.ts");
  ok("Kein Code setzt payment_status mehr automatisch auf 'expired'",
    !/SET\s+payment_status\s*=\s*'expired'/i.test(antragQuelle)
    && !/payment_status\s*=\s*'expired',\s*updated_at/i.test(antragQuelle));
  // Sperren darf es geben — aber nur als Entscheidung eines Menschen. Geprüft
  // wird deshalb nicht „gibt es die Zeile", sondern „steht sie an einer Stelle,
  // die ein Mensch auslöst". `account_status = CASE … suspended … END` bleibt
  // außen vor: Diese Form ERHÄLT eine bestehende Sperre, sie setzt keine.
  const sperrStellen = (pfad: string): string[] => {
    const quelle = datei(pfad).replace(/account_status\s*=\s*CASE[\s\S]*?END/g, "");
    const treffer: string[] = [];
    // Nur echte SQL-Zuweisungen: eine eigene Zeile. Ein Vergleich im Text
    // („Konto gesperrt (account_status='suspended')") ist keine Sperrung — der
    // erste Entwurf dieser Prüfung hat genau darauf falschen Alarm geschlagen.
    const muster = /^[ \t]*account_status\s*=\s*'(suspended|inactive|inaktiv|gesperrt)'\s*,?[ \t]*$/gim;
    for (const m of Array.from(quelle.matchAll(muster))) {
      // Der Zusammenhang: 600 Zeichen davor sagen, wer das auslöst.
      treffer.push(quelle.slice(Math.max(0, (m.index ?? 0) - 600), (m.index ?? 0)));
    }
    return treffer;
  };
  for (const pfad of ["server/routes/fiaon-abo.ts", "server/routes/fiaon-followup.ts",
    "server/routes/fiaon-reconcile.ts", "server/routes/fiaon-antrag.ts"]) {
    const stellen = sperrStellen(pfad);
    const nurMenschlich = stellen.every((zusammenhang) =>
      /gdpr|dsgvo|router\.(post|patch|delete)/i.test(zusammenhang));
    ok(`Keine Automatik sperrt Konten in ${pfad.split("/").pop()}`, nurMenschlich,
      `${stellen.length} Stelle(n), davon eine ohne menschlichen Auslöser`);
  }
  ok("Der Fristablauf-Lauf zählt nur noch (kein UPDATE)",
    /Frist abgelaufen \(Etikett, kein Zustand\)/.test(antragQuelle));

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("9. Gegenprobe: keine einzige Testzeile ist zurückgeblieben");
  // ═══════════════════════════════════════════════════════════════════════
  // Absichtlich NICHT über Gesamtzahlen: Diese Datenbank ist die
  // Produktionsdatenbank, in der während des Laufs echte Bestellungen
  // eintreffen. Ein Vergleich von Gesamtsummen hätte den Prüfstand rot gemacht,
  // weil ein Kunde bestellt hat — geprüft wird deshalb gezielt auf die Marken
  // dieses Laufs.
  const marke = `%${stempel}%`;
  const reste = await sqlPool`
    SELECT 'bestellungen' AS art, COUNT(*)::int AS n FROM fiaon_applications WHERE ref LIKE ${marke}
    UNION ALL SELECT 'personen', COUNT(*)::int FROM fiaon_persons WHERE person_ref LIKE ${"%PM" + stempel + "%"}
    UNION ALL SELECT 'agenten', COUNT(*)::int FROM fiaon_agents WHERE email LIKE ${"%" + stempel + "%"}
    UNION ALL SELECT 'verlauf', COUNT(*)::int FROM fiaon_contact_log WHERE ref LIKE ${marke}
    UNION ALL SELECT 'aliase', COUNT(*)::int FROM fiaon_person_aliases WHERE value_norm LIKE ${marke}
    UNION ALL SELECT 'leads', COUNT(*)::int FROM fiaon_leads WHERE email LIKE ${marke}
    UNION ALL SELECT 'provisionen', COUNT(*)::int FROM fiaon_commissions WHERE ref LIKE ${marke}
    UNION ALL SELECT 'ereignisse', COUNT(*)::int FROM fiaon_agent_events WHERE meta LIKE ${marke}
  `;
  for (const r of reste as any[]) {
    gleich(`Zurückgerollt, keine Reste: ${r.art}`, Number(r.n), 0);
  }
  // Und die Bestandszahlen als Größenordnung — sie dürfen nur wachsen (echte
  // Neubestellungen), niemals schrumpfen.
  const [nachBestand] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_persons)::int AS personen,
           (SELECT COUNT(*) FROM fiaon_applications)::int AS bestellungen,
           (SELECT COUNT(*) FROM fiaon_contact_log)::int AS verlauf,
           (SELECT COUNT(*) FROM fiaon_person_aliases)::int AS aliase
  `;
  for (const feld of ["personen", "bestellungen", "verlauf", "aliase"] as const) {
    const vor = Number((vorBestand as any)[feld]);
    const nach = Number((nachBestand as any)[feld]);
    ok(`Bestand nicht geschrumpft: ${feld} (${vor} → ${nach})`, nach >= vor);
  }

  log(`\n══ Ergebnis: ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen ══`);
  if (fehlerListe.length > 0) log(`   Offen: ${fehlerListe.join(" · ")}`);
  log("");
  await sqlPool.end();
  process.exit(fehlgeschlagen > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[PRUEF-MERGE]", err);
  process.exit(1);
});
