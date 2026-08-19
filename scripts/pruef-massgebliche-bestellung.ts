// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE RECHNUNG TRÄGT DAS RICHTIGE PAKET
//
// ── DIE MELDUNG (Florentine Lombardi, 19.08.2026) ──────────────────────────
// „Er wollte ein Pro-Paket. Das High End habe ich rausgenommen. Wenn ich auf
// Rechnung senden drücke, bekommt er aber eine E-Mail für das High-End-Paket."
//
// ── DIE URSACHE, GEMESSEN ─────────────────────────────────────────────────
// `zahlungsdatenSenden` löste ohne `archived_at IS NULL` auf. Ein „rausgenommenes"
// Paket ist archiviert, blieb in der Auswahl, und weil es SPÄTER angelegt wurde
// als das gültige, gewann es das `ORDER BY created_at DESC`.
//
// Bewiesen an Person 4254 (Gabor Toth): archiviertes Ultra vom 16.07. schlug das
// lebende Pro vom 02.07. Und im Zustellprotokoll: fünf Mails „High End 1,00 €"
// an Josef Rohrmoser, gültig war Pro. Bestandsweit 37 betroffene Personen,
// 8 echte Fehlversände in 14 Tagen.
//
// ── WAS HIER GEPRÜFT WIRD ─────────────────────────────────────────────────
//   1. Der Prüffall aus der Meldung: High End archiviert (NEUER), Pro lebend
//      (ÄLTER) → die Auflösung nimmt Pro, Betrag und Verwendungszweck stimmen.
//   2. Storniert, ersetzt, zusammengeführt, DSGVO-gelöscht fallen ebenso weg.
//   3. Mehrere lebende offene Bestellungen: die neueste gewinnt, und die Zahl
//      der weiteren wird gemeldet (für die Bestätigung vor dem Senden).
//   4. Eine veraltete Referenz vom Client wird ABGELEHNT — mit Klartext, der
//      das jetzt Gültige nennt.
//   5. Kein Weg im Haus trifft noch eine eigene Auswahl (Quelltext).
//
// ALLES IN EINER TRANSAKTION, DIE AM ENDE ZURÜCKGEROLLT WIRD.
//
//   npx tsx scripts/pruef-massgebliche-bestellung.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import {
  massgeblicheBestellung, bestellungPruefen, lebendeOffeneBestellungSql,
} from "../server/lib/fiaon-massgebliche-bestellung";

let bestanden = 0;
let fehlgeschlagen = 0;
const fehler: string[] = [];
const log = (s = "") => console.log(s);
function ok(name: string, bedingung: boolean, detail = ""): void {
  if (bedingung) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; fehler.push(name); log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function gleich(name: string, ist: unknown, soll: unknown): void {
  ok(name, String(ist) === String(soll), `ist „${ist}“, soll „${soll}“`);
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 52 - t.length))}`); }

class Zurueckrollen extends Error {}
const stempel = Date.now().toString(36).toUpperCase();

async function main(): Promise<void> {
  log("\n══ Prüfstand: maßgebliche Bestellung ══");

  try {
    await sqlPool.begin(async (tx) => {
      // ── DER PRÜFFALL AUS DER MELDUNG ────────────────────────────────────
      // Wichtig ist die REIHENFOLGE: Das archivierte High End muss NEUER sein
      // als das lebende Pro. Sonst prüft der Lauf nichts — mit umgekehrter
      // Reihenfolge hätte auch die alte, fehlerhafte Auflösung Pro gewählt.
      // AGENTS.md: „Der ungünstigste Fall, nicht der erstbeste."
      const [person] = (await tx`
        INSERT INTO fiaon_persons (person_ref, kind, account_status, priority_tier,
                                   first_name, last_name, created_at)
        VALUES (${`FIAON-P-PMB${stempel}`}, 'private', 'pending', 2,
                'Prüf', ${`Paket${stempel}`}, NOW())
        RETURNING id
      `) as any[];
      const personId = Number(person.id);

      const anlegen = async (o: {
        marke: string; paket: string; cents: number; tageAlt: number;
        status?: string; archiviert?: boolean; storniert?: boolean;
      }) => {
        const ref = `FIAON-PMB${stempel}-${o.marke}`;
        await tx`
          INSERT INTO fiaon_applications
            (ref, person_id, pack_name, amount_due, payment_reference, payment_status,
             status, email, first_name, last_name, created_at, archived_at, cancelled_at)
          VALUES (${ref}, ${personId}, ${o.paket}, ${o.cents},
                  ${`PMB${stempel}${o.marke}`}, ${o.status ?? "pending_payment"},
                  'completed', ${`pmb.${stempel.toLowerCase()}@example.invalid`},
                  'Prüf', ${`Paket${stempel}`},
                  NOW() - (${o.tageAlt} || ' days')::interval,
                  ${o.archiviert ? new Date() : null},
                  ${o.storniert ? new Date() : null})
        `;
        return ref;
      };

      // Pro: ÄLTER (30 Tage), lebend  → das ist die richtige Antwort.
      const refPro = await anlegen({ marke: "PRO", paket: "FIAON Pro (Standard)", cents: 5999, tageAlt: 30 });
      // High End: NEUER (10 Tage), archiviert → die falsche, die vorher gewann.
      const refHigh = await anlegen({
        marke: "HIGH", paket: "FIAON High End (Das Maximum)", cents: 19999, tageAlt: 10,
        archiviert: true,
      });

      // ═══════════════════════════════════════════════════════════════════
      gruppe("1. Der Prüffall: archiviertes High End (neuer) gegen Pro");
      // ═══════════════════════════════════════════════════════════════════
      const b = await massgeblicheBestellung(personId, tx as any);
      ok("Es wird eine Bestellung gefunden", !!b);
      gleich("Es ist die PRO-Bestellung", b?.ref, refPro);
      gleich("Das Paket heißt Pro", b?.paket, "FIAON Pro (Standard)");
      gleich("Der Betrag ist 5999 Cent", b?.betragCents, 5999);
      gleich("Der Verwendungszweck ist der der Pro-Bestellung",
        b?.verwendungszweck, `PMB${stempel}PRO`);
      ok("NICHT die archivierte High-End-Bestellung", b?.ref !== refHigh,
        `gewählt wurde ${b?.ref}`);
      gleich("Keine weiteren offenen Bestellungen", b?.weitereOffen, 0);

      // ── DIE GEGENPROBE ZUR REIHENFOLGE ────────────────────────────────
      // Beweist, dass der Prüffall überhaupt scharf ist: Die ALTE Abfrage
      // (ohne Archiv-Filter) hätte hier High End gewählt.
      const [alt] = (await tx`
        SELECT ref, pack_name FROM fiaon_applications
        WHERE person_id = ${personId} AND merged_into IS NULL
          AND payment_status IN ('pending_payment', 'claimed_paid', 'expired')
        ORDER BY created_at DESC LIMIT 1
      `) as any[];
      gleich("GEGENPROBE: die alte Abfrage hätte High End gewählt", alt?.ref, refHigh);
      ok("… also prüft dieser Fall wirklich den Unterschied", alt?.ref !== b?.ref);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("2. Storniert, ersetzt, zusammengeführt fallen weg");
      // ═══════════════════════════════════════════════════════════════════
      const refStorno = await anlegen({
        marke: "STORNO", paket: "FIAON Ultra (Elite Konto)", cents: 12999, tageAlt: 5,
        storniert: true,
      });
      let b2 = await massgeblicheBestellung(personId, tx as any);
      gleich("Eine STORNIERTE Bestellung gewinnt nicht", b2?.ref, refPro);

      const refErsetzt = await anlegen({
        marke: "ERSETZT", paket: "FIAON Ultra (Elite Konto)", cents: 12999, tageAlt: 4,
        status: "superseded",
      });
      b2 = await massgeblicheBestellung(personId, tx as any);
      gleich("Eine ERSETZTE Bestellung gewinnt nicht", b2?.ref, refPro);

      const refMerged = await anlegen({
        marke: "MERGED", paket: "FIAON Ultra (Elite Konto)", cents: 12999, tageAlt: 3,
      });
      await tx`UPDATE fiaon_applications SET merged_into = ${refPro} WHERE ref = ${refMerged}`;
      b2 = await massgeblicheBestellung(personId, tx as any);
      gleich("Eine ZUSAMMENGEFÜHRTE Bestellung gewinnt nicht", b2?.ref, refPro);

      const refPaid = await anlegen({
        marke: "PAID", paket: "FIAON Ultra (Elite Konto)", cents: 12999, tageAlt: 2,
        status: "paid",
      });
      b2 = await massgeblicheBestellung(personId, tx as any);
      gleich("Eine BEZAHLTE Bestellung gewinnt nicht", b2?.ref, refPro);
      void refStorno; void refErsetzt;

      // ═══════════════════════════════════════════════════════════════════
      gruppe("3. Mehrere LEBENDE offene Bestellungen");
      // ═══════════════════════════════════════════════════════════════════
      // Hier gibt es keine falsche Antwort — aber eine stille. Der Agent muss
      // erfahren, dass es mehrere sind.
      const refNeuer = await anlegen({
        marke: "NEU", paket: "FIAON Ultra (Elite Konto)", cents: 12999, tageAlt: 1,
      });
      const b3 = await massgeblicheBestellung(personId, tx as any);
      gleich("Die NEUESTE lebende gewinnt", b3?.ref, refNeuer);
      gleich("… und eine weitere wird gemeldet", b3?.weitereOffen, 1);
      ok("Die Bestätigung kann den Hinweis bauen", (b3?.weitereOffen ?? 0) > 0,
        "ohne diese Zahl wäre die Auswahl wieder still");

      // ═══════════════════════════════════════════════════════════════════
      gruppe("4. Eine veraltete Referenz vom Client wird abgelehnt");
      // ═══════════════════════════════════════════════════════════════════
      const geprueftAlt = await bestellungPruefen(personId, refHigh, tx as any);
      ok("Die archivierte Referenz wird ABGELEHNT", !geprueftAlt.ok);
      if (!geprueftAlt.ok) {
        ok("… der Grund nennt „archiviert“", /archiviert/i.test(geprueftAlt.fehler),
          geprueftAlt.fehler);
        ok("… und das jetzt gültige Paket", /Ultra/.test(geprueftAlt.fehler),
          geprueftAlt.fehler);
        ok("… und den Verwendungszweck", geprueftAlt.fehler.includes(`PMB${stempel}NEU`),
          geprueftAlt.fehler);
        ok("… und sagt, was zu tun ist", /neu/i.test(geprueftAlt.fehler));
      }
      const geprueftGut = await bestellungPruefen(personId, refNeuer, tx as any);
      ok("Die gültige Referenz wird angenommen", geprueftGut.ok);
      const ohneRef = await bestellungPruefen(personId, null, tx as any);
      ok("Ohne Referenz wird die Auflösung genommen", ohneRef.ok);
      const bezahlteRef = await bestellungPruefen(personId, refPaid, tx as any);
      ok("Eine BEZAHLTE Referenz wird abgelehnt", !bezahlteRef.ok);
      if (!bezahlteRef.ok) {
        ok("… mit „bereits bezahlt“", /bezahlt/i.test(bezahlteRef.fehler), bezahlteRef.fehler);
      }

      // Eine Referenz, die einem ANDEREN Menschen gehört.
      const [fremd] = (await tx`
        SELECT ref FROM fiaon_applications
        WHERE person_id IS NOT NULL AND person_id <> ${personId}
          AND merged_into IS NULL LIMIT 1
      `) as any[];
      if (fremd) {
        const fremdGeprueft = await bestellungPruefen(personId, String(fremd.ref), tx as any);
        ok("Eine FREMDE Referenz wird abgelehnt", !fremdGeprueft.ok);
        if (!fremdGeprueft.ok) {
          ok("… mit dem Hinweis auf den falschen Kunden",
            /gehört nicht zu diesem Kunden/i.test(fremdGeprueft.fehler),
            fremdGeprueft.fehler);
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      gruppe("5. Ohne offene Bestellung: kein Rückfall auf das Archiv");
      // ═══════════════════════════════════════════════════════════════════
      // Der zweithäufigste Fall in der Messung: 30 der 37 Personen haben GAR
      // KEINE lebende offene Bestellung. Vorher wurde dann die archivierte
      // genommen — jetzt muss klar „keine" herauskommen.
      const [person2] = (await tx`
        INSERT INTO fiaon_persons (person_ref, kind, account_status, priority_tier,
                                   first_name, last_name, created_at)
        VALUES (${`FIAON-P-PMB${stempel}B`}, 'private', 'pending', 2,
                'Prüf', ${`Leer${stempel}`}, NOW())
        RETURNING id
      `) as any[];
      await tx`
        INSERT INTO fiaon_applications
          (ref, person_id, pack_name, amount_due, payment_reference, payment_status,
           status, email, created_at, archived_at)
        VALUES (${`FIAON-PMB${stempel}-NUR-ARCHIV`}, ${Number(person2.id)},
                'FIAON High End (Das Maximum)', 19999, ${`PMB${stempel}ARCH`},
                'pending_payment', 'completed',
                ${`pmb2.${stempel.toLowerCase()}@example.invalid`}, NOW(), NOW())
      `;
      const leer = await massgeblicheBestellung(Number(person2.id), tx as any);
      ok("Nur eine archivierte Bestellung → keine maßgebliche", leer === null,
        `gefunden: ${leer?.ref}`);
      const leerGeprueft = await bestellungPruefen(Number(person2.id), null, tx as any);
      ok("Die Prüfung lehnt ab", !leerGeprueft.ok);
      if (!leerGeprueft.ok) {
        ok("… und nennt die möglichen Gründe",
          /bezahlt|storniert|archiviert/i.test(leerGeprueft.fehler), leerGeprueft.fehler);
      }

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  // ═══════════════════════════════════════════════════════════════════════
  gruppe("6. Kein Weg trifft noch eine eigene Auswahl");
  // ═══════════════════════════════════════════════════════════════════════
  // Eine Definition, ein Ort. Der Fehler entstand, weil sechs Wege dieselbe
  // Frage jeder für sich beantworteten.
  const { readFileSync } = await import("node:fs");
  const kunden = readFileSync("server/routes/fiaon-agent-kunden.ts", "utf8");
  const ohneKommentar = kunden
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*(\/\/|--).*$/gm, " ");

  ok("Die Sende-Route benutzt massgeblicheBestellung",
    /massgeblicheBestellung/.test(ohneKommentar));
  ok("Sie prüft eine mitgeschickte Referenz",
    /bestellungPruefen/.test(ohneKommentar));
  // DIE ENTSCHEIDENDE PRÜFUNG: keine Auswahl mehr ohne Archiv-Filter.
  const eigeneAuswahl = Array.from(ohneKommentar.matchAll(
    /FROM fiaon_applications[\s\S]{0,400}?ORDER BY created_at DESC/g))
    .map((m) => m[0])
    .filter((q) => /person_id = \$\{personId\}|person_id = \$\{Number\(personId\)\}/.test(q));
  const ohneArchivFilter = eigeneAuswahl.filter((q) => !/archived_at IS NULL/.test(q));
  ok("Jede verbleibende Auswahl je Person filtert archived_at",
    ohneArchivFilter.length === 0,
    `${ohneArchivFilter.length} von ${eigeneAuswahl.length} ohne Filter:\n`
    + ohneArchivFilter.map((q) => `        ${q.replace(/\s+/g, " ").slice(0, 150)}`).join("\n"));

  ok("Der SQL-Baustein enthält alle vier Ausschlüsse",
    ["archived_at IS NULL", "merged_into IS NULL", "cancelled_at IS NULL",
      "gdpr_deleted_at IS NULL"].every((s) => lebendeOffeneBestellungSql().includes(s)));

  ok("Es gibt eine Vorschau-Route",
    /rechnung-vorschau/.test(ohneKommentar),
    "ohne sie drückt der Agent weiter blind auf senden");

  gruppe("7. Gegenprobe: nichts zurückgeblieben");
  const [reste] = (await sqlPool`
    SELECT (SELECT COUNT(*)::int FROM fiaon_persons WHERE person_ref LIKE ${`FIAON-P-PMB${stempel}%`}) AS personen,
           (SELECT COUNT(*)::int FROM fiaon_applications WHERE ref LIKE ${`FIAON-PMB${stempel}%`}) AS bestellungen
  `) as any[];
  gleich("Zurückgerollt: Personen", reste.personen, 0);
  gleich("Zurückgerollt: Bestellungen", reste.bestellungen, 0);

  log(`\n══ Ergebnis: ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen ══\n`);
  if (fehler.length > 0) {
    log("Fehlgeschlagen:");
    for (const f of fehler) log(`  · ${f}`);
    log("");
  }
  await sqlPool.end();
  process.exit(fehlgeschlagen > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
