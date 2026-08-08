// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND TEIL B — Verwendungszweck, Intake, Statuswahrheit, Produkt, Beleg
//
// Läuft in EINER Transaktion, die am Ende zurückgerollt wird: Es wird nie etwas
// geschrieben, also gibt es auch nichts aufzuräumen. Die Datenbank ist die
// Produktionsdatenbank — dieser Prüfstand darf sie nicht anfassen.
//
// Geprüft wird die WIRKUNG, nicht die Absicht. Wo eine dynamische Prüfung die
// Bedingung selbst mitbringen müsste (und damit auch bestehen würde, wenn sie in
// der Anwendung fehlt), steht zusätzlich eine Quelltext-Prüfung.
//
//   npx tsx scripts/pruef-fundament-b.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { nameTeilen } from "../server/lib/fiaon-name";
import { kundenstatus, statusAusTierGrund, zahlungsstatusText } from "../shared/fiaon-kundenstatus";
import { produktstand, produktstandFuerBestellungen } from "../server/lib/fiaon-produktstand";
import { statusFuerPerson, statusFuerBestellungen } from "../server/lib/fiaon-kundenstatus";
import { belegAnhaengen, belegStand, BelegVerboten } from "../server/lib/fiaon-zahlungsbeleg";
import { istRoboterUnterschrift } from "../server/lib/fiaon-vertrieb-zusage";

let bestanden = 0;
let fehlgeschlagen = 0;
const offen: string[] = [];

const log = (s = "") => console.log(s);
function ok(name: string, bedingung: boolean, detail = ""): void {
  if (bedingung) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; offen.push(name); log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function gleich(name: string, ist: unknown, soll: unknown): void {
  ok(name, ist === soll, `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 64 - t.length))}`); }

class Zurueckrollen extends Error {}

const stempel = Date.now().toString(36).toUpperCase();
const REF = (s: string) => `FIAON-TEST-B${stempel}-${s}`;
const AKTEUR = { name: "Prüfstand (fundament-b)", agentId: null as number | null };

async function main(): Promise<void> {
  log("\n══ Prüfstand Teil B ══");

  const [vorher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_applications)::int AS bestellungen,
           (SELECT COUNT(*) FROM fiaon_persons)::int AS personen
  `;

  try {
    await sqlPool.begin(async (tx) => {
      const person = async (felder: Record<string, unknown>): Promise<number> => {
        const [r] = await tx`
          INSERT INTO fiaon_persons ${tx({
            person_ref: `FIAON-P-TB${stempel}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            kind: "private", account_status: "pending", priority_tier: 2, ...felder,
          } as any)} RETURNING id
        `;
        return Number(r.id);
      };

      // ═══════════════════════════════════════════════════════════════════
      gruppe("1. Verwendungszweck ab Sekunde null");
      // ═══════════════════════════════════════════════════════════════════
      // Bestellung OHNE E-Mail und ohne Verwendungszweck anlegen — genau der
      // Fall, der dreimal an einem Tag gemeldet wurde.
      const [ohneMail] = await tx`
        INSERT INTO fiaon_applications ${tx({
          ref: REF("OHNE-MAIL"), type: "private", status: "started", pack_key: "pro",
          first_name: "Prüf", last_name: "OhneMail",
        } as any)} RETURNING ref, payment_reference
      `;
      ok("Bestellung ohne E-Mail bekommt einen Verwendungszweck",
        !!ohneMail.payment_reference, JSON.stringify(ohneMail));
      ok("Format ist FIAON-XXXXXX (verwechslungsfreie Zeichen)",
        /^FIAON-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(String(ohneMail.payment_reference)),
        String(ohneMail.payment_reference));

      // Mitgegebener Wert wird NICHT überschrieben.
      const eigener = `FIAON-TB${stempel.slice(-4)}`.slice(0, 12);
      const [mitEigenem] = await tx`
        INSERT INTO fiaon_applications ${tx({
          ref: REF("EIGEN"), type: "private", status: "started", payment_reference: eigener,
        } as any)} RETURNING payment_reference
      `;
      gleich("Mitgegebener Verwendungszweck bleibt", mitEigenem.payment_reference, eigener);

      // Kollision: derselbe Wert zweimal → der eindeutige Index greift.
      let kollisionGeblockt = false;
      try {
        await tx.savepoint(async (sp) => {
          await sp`
            INSERT INTO fiaon_applications ${sp({
              ref: REF("KOLLISION"), type: "private", status: "started", payment_reference: eigener,
            } as any)}
          `;
        });
      } catch { kollisionGeblockt = true; }
      ok("Doppelter Verwendungszweck wird abgewiesen (UNIQUE greift)", kollisionGeblockt);

      // Neu würfeln: 200 Referenzen in einem Zug, alle verschieden.
      const viele = await tx`
        SELECT array_agg(DISTINCT fiaon_verwendungszweck_neu()) AS refs
        FROM generate_series(1, 200)
      `;
      gleich("200-mal neu gewürfelt, 200 verschiedene Referenzen",
        (viele[0].refs as string[]).length, 200);

      const [nullen] = await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE payment_reference IS NULL
      `;
      gleich("Keine Bestellung ohne Verwendungszweck im Bestand", Number(nullen.n), 0);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("2. Intake: Namen trennen");
      // ═══════════════════════════════════════════════════════════════════
      const faelle: [string, string | null, string | null][] = [
        ["Axel Conrad", "Axel", "Conrad"],
        ["Konstantinos Nikoloudis", "Konstantinos", "Nikoloudis"],
        ["Anna van der Berg", "Anna", "van der Berg"],
        ["Ahmed", "Ahmed", null],
        ["Conrad, Axel", "Axel", "Conrad"],
      ];
      for (const [voll, vor, nach] of faelle) {
        const t = nameTeilen(voll);
        ok(`Name „${voll}“ → „${vor}“ | „${nach}“`,
          t.vorname === vor && t.nachname === nach, JSON.stringify(t));
      }
      const bekannt = nameTeilen("Axel", "Conrad");
      ok("Mitgeschickter Nachname wird nicht angetastet",
        bekannt.vorname === "Axel" && bekannt.nachname === "Conrad" && !bekannt.getrennt);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("3. Intake: Dedupe am Eingang");
      // ═══════════════════════════════════════════════════════════════════
      // EINDEUTIGER Treffer: eine bestehende Person mit dieser Nummer.
      const bekannteMail = `bekannt-${stempel}@intake-pruef.invalid`;
      const bekanntePerson = await person({
        first_name: "Prüf", last_name: "Bekannt",
        primary_email: bekannteMail, primary_phone: "+4915200000001", phone_key9: "200000001",
      });
      await tx`
        INSERT INTO fiaon_person_aliases (person_id, kind, value_norm, value_raw, source)
        VALUES (${bekanntePerson}, 'phone', '200000001', '+4915200000001', 'pruefstand'),
               (${bekanntePerson}, 'email', ${bekannteMail}, ${bekannteMail}, 'pruefstand')
      `;
      const eindeutig = await tx`
        SELECT DISTINCT a.person_id FROM fiaon_person_aliases a
        JOIN fiaon_persons p ON p.id = a.person_id AND p.merged_into_person_id IS NULL
        WHERE (a.kind = 'phone' AND a.value_norm = '200000001')
           OR (a.kind = 'email' AND a.value_norm = ${bekannteMail})
      `;
      gleich("Bekannte Nummer trifft genau EINE lebende Person", eindeutig.length, 1);
      ok("… und zwar die bestehende (keine neue Person)",
        Number((eindeutig as any[])[0].person_id) === bekanntePerson);

      // MEHRDEUTIGER Treffer: zwei Personen teilen dieselbe Nummer.
      const zweiA = await person({
        first_name: "Prüf", last_name: "MehrdeutigA",
        primary_email: `mA-${stempel}@intake-pruef.invalid`, phone_key9: "200000002",
        primary_phone: "+4915200000002",
      });
      const zweiB = await person({
        first_name: "Prüf", last_name: "MehrdeutigB",
        primary_email: `mB-${stempel}@intake-pruef.invalid`, phone_key9: "200000002",
        primary_phone: "+4915200000002",
      });
      await tx`
        INSERT INTO fiaon_person_aliases (person_id, kind, value_norm, value_raw, source)
        VALUES (${zweiA}, 'phone', '200000002', '+4915200000002', 'pruefstand'),
               (${zweiB}, 'phone', '200000002', '+4915200000002', 'pruefstand')
      `;
      const mehrdeutig = await tx`
        SELECT DISTINCT a.person_id FROM fiaon_person_aliases a
        JOIN fiaon_persons p ON p.id = a.person_id AND p.merged_into_person_id IS NULL
        WHERE a.kind = 'phone' AND a.value_norm = '200000002'
      `;
      gleich("Mehrdeutige Nummer trifft ZWEI lebende Personen", mehrdeutig.length, 2);
      ok("Bei Mehrdeutigkeit wird NICHT automatisch zusammengeführt",
        (await tx`SELECT merged_into_person_id FROM fiaon_persons WHERE id IN (${zweiA}, ${zweiB})`)
          .every((r: any) => r.merged_into_person_id == null));

      // Das Paar muss als Dubletten-Kandidat erkennbar sein (Stufe „Telefon“).
      const alsKandidat = await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_persons p1
        JOIN fiaon_persons p2 ON p2.phone_key9 = p1.phone_key9 AND p2.id > p1.id
        WHERE p1.id IN (${zweiA}, ${zweiB}) AND p2.id IN (${zweiA}, ${zweiB})
          AND p1.merged_into_person_id IS NULL AND p2.merged_into_person_id IS NULL
      `;
      gleich("Das mehrdeutige Paar erscheint als Dubletten-Kandidat", Number(alsKandidat[0].n), 1);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("4. Eine Statuswahrheit");
      // ═══════════════════════════════════════════════════════════════════
      const gemeldet = kundenstatus({ zahlungsstatus: "claimed_paid", hatBestellung: true });
      gleich("claimed_paid heißt „Kunde meldet Zahlung“", gemeldet.text, "Kunde meldet Zahlung");
      gleich("… mit Pflicht-Zusatz", gemeldet.zusatz, "noch nicht bankbestätigt");
      ok("… und das Wort „bezahlt“ steht NICHT allein im Text",
        !/^bezahlt$/i.test(gemeldet.text));
      ok("Die Anzeige nennt den Zusatz immer mit",
        gemeldet.anzeige.includes("noch nicht bankbestätigt"), gemeldet.anzeige);
      gleich("paid heißt „Bezahlt“", kundenstatus({ zahlungsstatus: "paid", hatBestellung: true }).text, "Bezahlt");
      gleich("pending_payment heißt „Antrag fertig — Rechnung offen“",
        kundenstatus({ zahlungsstatus: "pending_payment", hatBestellung: true }).text,
        "Antrag fertig — Rechnung offen");
      ok("Kein Status trägt den alten Widerspruch",
        !Object.values(await import("../shared/fiaon-kundenstatus").then((m) => m.KUNDENSTATUS))
          .some((v: any) => /abgeschlossen, keine Zahlung/i.test(v.text)));

      const abgelaufen = kundenstatus({
        zahlungsstatus: "pending_payment", hatBestellung: true,
        frist: new Date(Date.now() - 3 * 86400_000),
      });
      gleich("Abgelaufene Frist bleibt ein Etikett", abgelaufen.etikett, "Frist abgelaufen");
      gleich("… und ändert den Status nicht", abgelaufen.schluessel, "rechnung_offen");

      gleich("tier_reason 'zahlung_angekuendigt' ergibt denselben Text",
        statusAusTierGrund("zahlung_angekuendigt").text, "Kunde meldet Zahlung");

      // Der Beweis über die echten Antworten: eine Testperson mit claimed_paid.
      const meldePerson = await person({
        first_name: "Prüf", last_name: "Meldet",
        primary_email: `meldet-${stempel}@intake-pruef.invalid`,
        phone_key9: "200000003", primary_phone: "+4915200000003",
      });
      const refGemeldet = REF("GEMELDET");
      await tx`
        INSERT INTO fiaon_applications ${tx({
          ref: refGemeldet, type: "private", status: "completed", payment_status: "claimed_paid",
          person_id: meldePerson, pack_key: "ultra", pack_name: "FIAON Ultra\n(Elite Konto)",
          amount_due: "79.99", claimed_paid_at: new Date(),
        } as any)}
      `;
      const herkunft = await statusFuerPerson(meldePerson, tx);
      ok("Akte: Status der Person ist „Kunde meldet Zahlung“",
        herkunft?.status.text === "Kunde meldet Zahlung", JSON.stringify(herkunft?.status));
      ok("Akte: „Warum dieser Status?“ nennt die Bestellung",
        herkunft?.ref === refGemeldet, String(herkunft?.ref));
      ok("Akte: „Warum dieser Status?“ nennt das Ereignis",
        !!herkunft?.ereignis && /gemeldet/i.test(herkunft.ereignis), String(herkunft?.ereignis));

      // ── Der Widerspruch vom 08.08.2026 darf nicht zurückkommen ───────────
      // Die Akte fasst eine Person über gleiche Kontaktdaten zusammen, nicht
      // über `person_id`. Zählte der Statusblock nach `person_id`, stand oben
      // „Diese Person hat genau eine Bestellung“ und rechts daneben vier.
      // Gemessen an einem echten Kunden: fünf lebende Bestellungen, verteilt
      // über fünf Personensätze desselben Menschen.
      const zwilling = await person({
        first_name: "Prüf", last_name: "Meldet",
        primary_email: `meldet-zwilling-${stempel}@intake-pruef.invalid`,
        phone_key9: "200000013", primary_phone: "+4915200000013",
      });
      const refZwilling = REF("ZWILLING");
      await tx`
        INSERT INTO fiaon_applications ${tx({
          ref: refZwilling, type: "private", status: "completed", payment_status: "pending_payment",
          person_id: zwilling, pack_key: "pro", pack_name: "FIAON Pro\n(Standard)",
          amount_due: "59.99",
        } as any)}
      `;
      const familie = [refGemeldet, refZwilling];
      const ueberFamilie = await statusFuerBestellungen(familie, tx);
      gleich("Akte zählt über die angezeigten Bestellungen, nicht über person_id",
        ueberFamilie?.bestellungen, 2);
      ok("… und nennt weiterhin die stärkste Bestellung",
        ueberFamilie?.ref === refGemeldet, String(ueberFamilie?.ref));
      ok("… die Begründung spricht von mehreren Bestellungen",
        !!ueberFamilie?.begruendung && /Von 2 Bestellungen/.test(ueberFamilie.begruendung),
        String(ueberFamilie?.begruendung));
      const produktFamilie = await produktstandFuerBestellungen(familie, tx);
      ok("Produktstand sieht dieselben Bestellungen und meldet zwei offene Stufen",
        produktFamilie.mehrfachStufe, JSON.stringify(produktFamilie.text));

      // Text-Grep über die Antworten: nirgends „bezahlt“ ohne Zusatz.
      const antworten = [
        JSON.stringify(herkunft?.status),
        zahlungsstatusText("claimed_paid"),
        statusAusTierGrund("zahlung_angekuendigt").anzeige,
      ];
      for (const [i, a] of antworten.entries()) {
        const nenntBezahlt = /bezahlt/i.test(a);
        const nenntZusatz = /nicht bankbest/i.test(a);
        ok(`Antwort ${i + 1}: „bezahlt“ nie ohne den Zusatz`, !nenntBezahlt || nenntZusatz, a);
      }

      // ═══════════════════════════════════════════════════════════════════
      gruppe("5. Produkt-Hygiene: ein Kunde, eine Stufe");
      // ═══════════════════════════════════════════════════════════════════
      const produktPerson = await person({
        first_name: "Prüf", last_name: "Produkt",
        primary_email: `produkt-${stempel}@intake-pruef.invalid`,
        phone_key9: "200000004", primary_phone: "+4915200000004",
      });
      const refAlt = REF("PAKET-ALT");
      const refNeu = REF("PAKET-NEU");
      const refSchufa = REF("SCHUFA");
      const refBezahlt = REF("BEZAHLT");
      await tx`
        INSERT INTO fiaon_applications ${tx({
          ref: refAlt, type: "private", status: "completed", payment_status: "pending_payment",
          person_id: produktPerson, pack_key: "pro", pack_name: "FIAON Pro\n(Standard)",
          amount_due: "59.99", created_at: new Date(Date.now() - 10 * 86400_000),
        } as any)}
      `;
      await tx`
        INSERT INTO fiaon_applications ${tx({
          ref: refSchufa, type: "schufa", status: "submitted", payment_status: "pending_payment",
          person_id: produktPerson, pack_name: "Bonitätsauskunft inkl. Handlungsplan",
          amount_due: "74.00", created_at: new Date(Date.now() - 5 * 86400_000),
        } as any)}
      `;
      await tx`
        INSERT INTO fiaon_applications ${tx({
          ref: refBezahlt, type: "private", status: "payment_completed", payment_status: "paid",
          person_id: produktPerson, pack_key: "start", pack_name: "FIAON Starter\n(Das Fundament)",
          amount_due: "7.99", created_at: new Date(Date.now() - 20 * 86400_000),
        } as any)}
      `;
      // Zweite Paketbestellung derselben Person — sie soll die ÄLTERE offene stilllegen.
      const [neu] = await tx`
        INSERT INTO fiaon_applications ${tx({
          ref: refNeu, type: "private", status: "completed", payment_status: "pending_payment",
          person_id: produktPerson, pack_key: "ultra", pack_name: "FIAON Ultra\n(Elite Konto)",
          amount_due: "79.99",
        } as any)} RETURNING ref, payment_reference
      `;

      // Genau die Bedingung, die supersedeSisterOrders benutzt (Person + Kategorie).
      const stillgelegt = await tx`
        UPDATE fiaon_applications SET payment_status = 'superseded', superseded_by = ${neu.payment_reference}
        WHERE ref <> ${refNeu} AND person_id = ${produktPerson}
          AND merged_into IS NULL AND archived_at IS NULL
          AND payment_status IN ('pending_payment', 'claimed_paid')
          AND (COALESCE(type, '') = 'schufa' OR ref LIKE 'FIAON-SCHUFA-%') = FALSE
        RETURNING ref
      `;
      const gelegt = (stillgelegt as any[]).map((r) => String(r.ref));
      ok("Die ältere offene Paketbestellung wird stillgelegt", gelegt.includes(refAlt), JSON.stringify(gelegt));
      ok("Das Zusatzprodukt bleibt unberührt", !gelegt.includes(refSchufa));
      ok("Die bezahlte Bestellung bleibt unberührt", !gelegt.includes(refBezahlt));
      const [zeiger] = await tx`SELECT superseded_by FROM fiaon_applications WHERE ref = ${refAlt}`;
      const [auflösbar] = await tx`
        SELECT 1 AS treffer FROM fiaon_applications
        WHERE payment_reference = ${zeiger.superseded_by} OR ref = ${zeiger.superseded_by} LIMIT 1
      `;
      ok("Der „ersetzt durch“-Verweis ist auflösbar (kein Phantom)", !!auflösbar, String(zeiger.superseded_by));

      const stand = await produktstand(produktPerson, tx);
      // Die BEZAHLTE Stufe bestimmt den Produktstand — die neu bestellte Ultra ist
      // erst Produktstand, wenn sie bezahlt ist. Der erste Entwurf dieser Prüfung
      // erwartete „Ultra" und war damit selbst die falsche Annahme.
      ok("Produktstand ist EINE Zeile: bezahlte Stufe plus Zusatzprodukt",
        stand.text.includes("Starter") && stand.text.includes("Bonitätsauskunft"), stand.text);
      ok("Die bezahlte Stufe schlägt die offene", stand.stufe?.zahlungsstatus === "paid",
        JSON.stringify(stand.stufe));
      ok("Keine zwei OFFENEN Stufen mehr", !stand.mehrfachStufe);
      ok("Stillgelegte Bestellungen stehen darunter",
        stand.stillgelegt.some((s) => s.ref === refAlt), JSON.stringify(stand.stillgelegt));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("6. Zahlungsbeleg");
      // ═══════════════════════════════════════════════════════════════════
      const bild = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
        "base64");
      const heute = new Date().toISOString().slice(0, 10);

      const belegFehler = async (name: string, code: string, fn: () => Promise<unknown>) => {
        try { await fn(); ok(name, false, "wurde angenommen"); }
        catch (err: any) {
          ok(name, err instanceof BelegVerboten && err.code === code, `${err?.code}: ${err?.message}`);
        }
      };
      await belegFehler("Beleg ohne Datum abgelehnt", "datum_fehlt",
        () => belegAnhaengen(refGemeldet, { daten: bild, typ: "image/png", name: "b.png", datum: "", notiz: null }, AKTEUR, { tx }));
      await belegFehler("Beleg mit Datum in der Zukunft abgelehnt", "datum_zukunft",
        () => belegAnhaengen(refGemeldet, { daten: bild, typ: "image/png", name: "b.png", datum: "2099-01-01", notiz: null }, AKTEUR, { tx }));
      await belegFehler("Falscher Dateityp abgelehnt", "typ",
        () => belegAnhaengen(refGemeldet, { daten: bild, typ: "text/html", name: "b.html", datum: heute, notiz: null }, AKTEUR, { tx }));

      const erg = await belegAnhaengen(refGemeldet,
        { daten: bild, typ: "image/png", name: "ueberweisung.png", datum: heute, notiz: "Screenshot vom Kunden" },
        AKTEUR, { tx });
      ok("Beleg landet an der Bestellung", erg.ref === refGemeldet && !erg.ersetzt);
      const belegDa = await belegStand(refGemeldet, tx);
      ok("Belegstand: vorhanden, mit Datum und Name",
        !!belegDa?.vorhanden && belegDa?.datum === heute && belegDa?.von === AKTEUR.name,
        JSON.stringify(belegDa));

      // Der Beleg muss in der Verbuchungs-Antwort auftauchen (dieselbe Abfrage).
      const [inVerbuchung] = await tx`
        SELECT (a.payment_proof IS NOT NULL) AS beleg_da, a.payment_proof_date
        FROM fiaon_applications a WHERE a.ref = ${refGemeldet}
      `;
      ok("Verbuchung sieht den Beleg", !!inVerbuchung.beleg_da);

      const [verlauf] = await tx`
        SELECT note FROM fiaon_contact_log WHERE ref = ${refGemeldet} AND outcome = 'zahlungsbeleg'
      `;
      ok("Beleg steht im Kundenverlauf", !!verlauf?.note && /Hinweis, keine Buchung/.test(String(verlauf.note)),
        String(verlauf?.note ?? ""));
      const [nochOffen] = await tx`SELECT payment_status FROM fiaon_applications WHERE ref = ${refGemeldet}`;
      gleich("Ein Beleg bucht NICHTS", nochOffen.payment_status, "claimed_paid");

      const ersetzt = await belegAnhaengen(refGemeldet,
        { daten: bild, typ: "image/png", name: "zweiter.png", datum: heute, notiz: null }, AKTEUR, { tx });
      ok("Ein zweiter Beleg ersetzt den ersten und wird vermerkt", ersetzt.ersetzt);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("7. Roboter-Unterschriften");
      // ═══════════════════════════════════════════════════════════════════
      ok("localhost wird als Roboter erkannt", istRoboterUnterschrift("127.0.0.1", "Chrome").roboter);
      ok("::1 wird als Roboter erkannt", istRoboterUnterschrift("::1", "Chrome").roboter);
      ok("HeadlessChrome wird als Roboter erkannt",
        istRoboterUnterschrift("1.2.3.4", "Mozilla/5.0 HeadlessChrome/143").roboter);
      ok("Playwright wird als Roboter erkannt", istRoboterUnterschrift("1.2.3.4", "playwright/1.0").roboter);
      ok("Ein echter Browser wird NICHT abgelehnt",
        !istRoboterUnterschrift("104.28.30.59",
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.5.2 Safari/605.1.15").roboter);
      const [roboterZusage] = await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_vertrieb_zusagen
        WHERE widerrufen_am IS NULL AND (ip IN ('127.0.0.1', '::1') OR user_agent ILIKE '%headless%')
      `;
      gleich("Keine gültige Roboter-Unterschrift mehr im Bestand", Number(roboterZusage.n), 0);

      throw new Zurueckrollen();
    });
  } catch (err) {
    if (!(err instanceof Zurueckrollen)) {
      log(`\n  ABBRUCH: ${(err as Error).message}`);
      console.error(err);
      fehlgeschlagen++;
      offen.push("Prüfstand-Ausführung");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("8. Im Quelltext: steht es wirklich in der Anwendung?");
  // ═══════════════════════════════════════════════════════════════════════
  const datei = (p: string) => readFileSync(p, "utf8");
  const enthaelt = (name: string, pfad: string, muster: RegExp) =>
    ok(name, muster.test(datei(pfad)), `${pfad} — ${muster}`);
  const enthaeltNicht = (name: string, pfad: string, muster: RegExp) =>
    ok(name, !muster.test(datei(pfad)), `${pfad} — ${muster} gefunden`);

  enthaelt("Trigger für den Verwendungszweck existiert",
    "db/migrations/037_verwendungszweck_bedingungslos.sql", /CREATE TRIGGER fiaon_verwendungszweck_trigger/);
  enthaelt("Verwendungszweck ist NOT NULL",
    "db/migrations/039_verwendungszweck_pflicht.sql", /SET NOT NULL/);
  enthaelt("Alt-Bestand hat ein eigenes Merkmal",
    "db/migrations/038_altbestand_merkmal.sql", /alt_bestand BOOLEAN/);
  enthaelt("Umsatzdefinition nutzt alt_bestand statt fehlender Referenz",
    "server/lib/fiaon-truth.ts", /alt_bestand/);
  enthaeltNicht("Umsatzdefinition hängt NICHT mehr an payment_reference",
    "server/lib/fiaon-truth.ts", /payment_reference IS (NOT )?NULL/);
  enthaelt("Intake trennt Namen", "server/routes/fiaon-leads.ts", /nameTeilen\(/);
  enthaelt("Intake antwortet mit personId und neuAngelegt",
    "server/routes/fiaon-leads.ts", /neuAngelegt: result\.neuAngelegt/);
  enthaelt("Intake hängt nur bei eindeutigem Treffer an",
    "server/fiaon-person-model.ts", /beiMehrdeutigkeit/);
  enthaeltNicht("Kein automatisches Zusammenführen mehr im Personenmodell",
    "server/fiaon-person-model.ts", /^\s*await personenZusammenfuehren\(/m);
  enthaelt("Supersede läuft über person_id",
    "server/routes/fiaon-antrag.ts", /person_id = \$\{personId\}::int/);
  enthaelt("Statusvokabular liegt in shared/",
    "shared/fiaon-kundenstatus.ts", /noch nicht bankbestätigt/);
  // Nur ZUWEISUNGEN prüfen: Der Satz steht weiterhin im Kommentar, der erklärt,
  // was hier früher stand — das ist Dokumentation, kein Text für den Agenten.
  enthaeltNicht("Der widersprüchliche Titel ist fort",
    "server/lib/tier-hinweise.ts", /titel:\s*"Antrag abgeschlossen, keine Zahlung"/);
  for (const pfad of ["client/src/pages/agent/kunden-neu.tsx", "client/src/pages/agent/vertrieb.tsx",
    "client/src/pages/admin-kunde.tsx", "client/src/pages/admin-kunden.tsx",
    "client/src/pages/agent/meine-kunden.tsx", "client/src/components/admin/Detailfenster.tsx"]) {
    enthaelt(`Statustexte kommen aus einer Quelle: ${pfad.split("/").pop()}`,
      pfad, /@shared\/fiaon-kundenstatus/);
  }
  enthaelt("Beleg erscheint in der Verbuchung",
    "server/routes/fiaon-verbuchung.ts", /payment_proof IS NOT NULL/);
  enthaelt("Beleg erscheint im Vertriebsbereich",
    "server/lib/fiaon-kundenlage.ts", /payment_proof IS NOT NULL/);
  enthaelt("Zusage lehnt Roboter ab",
    "server/lib/fiaon-vertrieb-zusage.ts", /istRoboterUnterschrift\(opts\.ip/);
  enthaelt("Zusagestand zählt widerrufene Annahmen nicht",
    "server/lib/fiaon-vertrieb-zusage.ts", /widerrufen_am IS NULL/);
  enthaelt("Browser-Test-Regel steht in AGENTS.md", "AGENTS.md", /VOR dem letzten\s+Klick/);
  enthaelt("Akte holt den Status über ihre eigenen Bestellungen",
    "server/routes/fiaon-kunden.ts", /statusFuerBestellungen\(familyRefs\)/);
  enthaelt("Akte holt den Produktstand über ihre eigenen Bestellungen",
    "server/routes/fiaon-kunden.ts", /produktstandFuerBestellungen\(familyRefs\)/);
  enthaeltNicht("Statusmarke in der Akte darf umbrechen",
    "client/src/pages/admin-kunde.tsx", /font-bold whitespace-nowrap/);

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("9. Gegenprobe: keine Testzeile zurückgeblieben");
  // ═══════════════════════════════════════════════════════════════════════
  const marke = `%${stempel}%`;
  const reste = await sqlPool`
    SELECT 'bestellungen' AS art, COUNT(*)::int AS n FROM fiaon_applications WHERE ref LIKE ${marke}
    UNION ALL SELECT 'personen', COUNT(*)::int FROM fiaon_persons WHERE person_ref LIKE ${"%TB" + stempel + "%"}
    UNION ALL SELECT 'aliase', COUNT(*)::int FROM fiaon_person_aliases WHERE value_norm LIKE ${marke}
    UNION ALL SELECT 'verlauf', COUNT(*)::int FROM fiaon_contact_log WHERE ref LIKE ${marke}
    UNION ALL SELECT 'ereignisse', COUNT(*)::int FROM fiaon_agent_events WHERE meta LIKE ${marke}
  `;
  for (const r of reste as any[]) gleich(`Zurückgerollt: ${r.art}`, Number(r.n), 0);

  const [nachher] = await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_applications)::int AS bestellungen,
           (SELECT COUNT(*) FROM fiaon_persons)::int AS personen
  `;
  ok(`Bestand nicht geschrumpft: Bestellungen (${vorher.bestellungen} → ${nachher.bestellungen})`,
    Number(nachher.bestellungen) >= Number(vorher.bestellungen));
  ok(`Bestand nicht geschrumpft: Personen (${vorher.personen} → ${nachher.personen})`,
    Number(nachher.personen) >= Number(vorher.personen));

  log(`\n══ Ergebnis: ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen ══`);
  if (offen.length > 0) log(`   Offen: ${offen.join(" · ")}`);
  log("");
  await sqlPool.end();
  process.exit(fehlgeschlagen > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[PRUEF-FUNDAMENT-B]", err);
  process.exit(1);
});
